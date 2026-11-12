# Arquitectura de Rebelarte 2.0

Documento de diseño técnico. Desarrolla la [especificación funcional](../especificacion-funcional.md); si hay contradicción, manda la especificación. Es el contrato entre las partes del código: base de datos, aplicación web y capa PHP.

## 1. Visión general

```
                 ┌─────────────────────────── Hostinger (Apache + PHP) ───────────────────────────┐
navegador ──────▶│ .htaccess → index.php                                                          │
                 │   · /c/<id>, /o/<id>        → 302 a la URL canónica (idioma de origen)          │
                 │   · /<lang>/<alias>,         → index.html con <meta og:*> inyectadas            │
                 │     /<lang>/obra/<id>/…        (caché en disco, 10 min)                          │
                 │   · resto                   → index.html tal cual (SPA)                          │
                 │ assets estáticos (_app/…)   → servidos por Apache con caché larga               │
                 └───────────────────────────────────────┬─────────────────────────────────────────┘
                                                         │ REST (clave anon, solo lectura pública)
navegador (SPA SvelteKit) ── supabase-js ───────────────▶ Supabase: Postgres + RLS, Auth (OTP), Storage
```

- **SPA**: SvelteKit 2 + Svelte 5 (runas) con `adapter-static` y `ssr = false`. Toda la interfaz se renderiza en el cliente.
- **Supabase**: Postgres con RLS como única capa de autorización; Auth sin contraseña; Storage para imágenes, PDF, ZIP y audio (con CDN).
- **PHP en Hostinger** (`share/`): solo vistas previas al compartir (Open Graph / Twitter Cards) y redirección de QR. No contiene lógica de negocio.
- **Procesado de archivos en el navegador**: las imágenes se redimensionan y se reencodan con `canvas` (eso elimina EXIF/GPS); las miniaturas de PDF se generan con pdf.js. No hay servidores de procesado. Storage limita tamaño y tipo MIME por bucket como segunda barrera.

## 2. Autenticación (sin contraseña)

- `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: true } })`.
- El correo trae **enlace mágico y código de 6 dígitos**. La pantalla de entrada permite pegar el código (`verifyOtp({ email, token, type: 'email' })`), útil cuando el correo se abre en otro dispositivo.
- Registro = primera entrada. Si el usuario no tiene `profiles`, se le lleva a `/<lang>/mi/bienvenida` a elegir alias, nombre e idioma (RPC `create_profile`).
- No hay contraseñas en ningún punto. Cambio de correo con `updateUser({ email })` (doble confirmación de Supabase).

## 3. Rutas de la SPA

Segmentos de ruta en español para ambos idiomas (simplicidad; `hreflang` apunta a `/es/…` y `/en/…`).

| Ruta | Página |
|---|---|
| `/` | Redirige a `/es` o `/en` según el navegador |
| `/[lang]` | Portada: obras recientes, ramas, buscador |
| `/[lang]/buscar?q=&rama=&categoria=` | Búsqueda de obras y autores |
| `/[lang]/rama/[rama]` | Obras de una rama, filtrable por categoría |
| `/[lang]/obra/[id]/[[slug]]` | Ficha de obra (`id` = `short_id`) |
| `/[lang]/obra/[id]/participantes` | Lista de participantes con enlace a sus CV |
| `/[lang]/[alias]` | CV público; `?vista=galeria` para el modo galería |
| `/[lang]/entrar` | Entrada/registro sin contraseña |
| `/[lang]/mi` | Panel «Mi Rebelarte» |
| `/[lang]/mi/bienvenida` | Alta del perfil tras la primera entrada |
| `/[lang]/mi/perfil` | Datos del perfil, interruptores de contacto, visibilidad |
| `/[lang]/mi/cv` | Entradas del CV (formación, experiencia, etc.) y premios |
| `/[lang]/mi/obras`, `/nueva`, `/[id]` | Mis obras: lista, alta, edición, adjuntos, participantes |
| `/[lang]/mi/participaciones` | Participaciones propias y solicitudes recibidas |
| `/[lang]/mi/reclamar` | Reclamar participación con código |
| `/[lang]/mi/mensajes`, `/[id]` | Bandeja y conversación |
| `/[lang]/mi/notificaciones` | Avisos |
| `/[lang]/moderacion` | Cola de denuncias, acciones, verificación de premios (solo moderadores) |
| `/[lang]/legal/[pagina]` | Aviso legal, condiciones, privacidad (textos pendientes de revisión legal) |
| `/c/[short]`, `/o/[short]` | URL estable de QR (CV y obra). Resuelta por PHP; la SPA también la resuelve como respaldo |

Alias reservados (no válidos como alias): `buscar rama obra entrar mi moderacion legal admin api c o es en static _app share`.

## 4. Modelo de datos

Esquema `public`. Todas las tablas con RLS activada. Los textos traducibles son `jsonb` con forma `{"es": "...", "en": "..."}` y van acompañados de `lang` (idioma de origen, obligatorio). Tipos `text` con `check` en vez de enums de Postgres para facilitar migraciones.

### Catálogos
- `branches` (`id text pk` en `plasticas|textos|escenicas|sonido|audiovisuales`, `name jsonb`, `sort int`).
- `categories` (`id serial`, `branch text fk`, `slug text`, `name jsonb`, `sort int`, unique `(branch, slug)`).
- `role_catalog` (`id serial`, `branch text fk null` = válido en todas, `slug text`, `name jsonb`, `sort int`).
- `licenses` (`id text pk`: `cc-by-nc-nd-4.0` por defecto, `cc-by-4.0`, `cc-by-sa-4.0`, `cc-by-nc-4.0`, `cc-by-nc-sa-4.0`, `cc-by-nd-4.0`, `cc0`, `all-rights-reserved`; `name jsonb`, `url text`).

### Perfiles y CV
- `profiles`: `id uuid pk → auth.users`, `alias citext unique` (regex `^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$`, no reservado), `short_id text unique` (8 caracteres base62, generado), `display_name text`, `lang text`, `headline jsonb`, `cover_letter jsonb`, `location text`, `avatar_path text`, `contact_email text null`, `show_email bool default false`, `accepts_commissions bool default false`, `sells_works bool default false`, `rate_text jsonb`, `rate_price text`, `field_visibility jsonb default '{}'` (claves: `location`, `contact_email`, `rate`, `cover_letter`; valores `public|registered|private`), `role text default 'user'` (`user|moderator|admin`), `status text default 'active'` (`active|suspended`), `created_at`, `updated_at`.
  - Los campos con visibilidad se exponen por la función `profile_public(alias)` que aplica `field_visibility` según el visitante. La lectura directa de `profiles` por terceros se limita a columnas no sensibles mediante la vista `profiles_public` (`id, alias, short_id, display_name, lang, headline, avatar_path, accepts_commissions, sells_works, role, created_at`).
- `cv_entries`: `id uuid`, `profile_id`, `kind` (`education|course|degree|experience|skill|material|other`), `title jsonb`, `organization text`, `start_date date`, `end_date date`, `description jsonb`, `lang`, `visibility` (`public|registered|private`), `sort int`.
- `profile_attachments`: adjuntos del CV (mismo formato que `attachments`, máx. 6).

### Obras
- `works`: `id uuid`, `short_id` (8 base62), `uploader_id → profiles`, `branch`, `category_id null`, `title jsonb`, `description jsonb`, `keywords text[]`, `place text`, `created_on date`, `lang`, `license_id default 'cc-by-nc-nd-4.0'`, `visibility` (`public|unlisted|private`), `status` (`draft|review|published|hidden|deleted`), `for_sale bool`, `accepts_commissions bool`, `price_text text`, `cover_attachment_id null`, `video_url text`, `audio_embed_url text`, campos de rama: `technique text`, `pages int`, `duration_seconds int`, `audio_channels text`, `recording_format text`, `aspect_ratio text`; `search tsvector` (generada por trigger desde todos los idiomas de `title`, `description`, `keywords`), `published_at`, `created_at`, `updated_at`.
  - Visible a terceros si `status = 'published'` y `visibility in ('public','unlisted')`. Las `unlisted` no salen en listados ni búsqueda.
  - Borrado lógico: `status = 'deleted'`.
- `attachments`: `id uuid`, `work_id`, `kind` (`image|pdf|zip|audio`), `path`, `thumb_path`, `mime`, `size_bytes`, `width`, `height`, `title text`, `sort int`. Máx. **6** por obra (trigger). Límites: imagen 10 MB, PDF 20 MB, ZIP 10 MB, audio 30 MB.
  - Imagen representativa: `works.cover_attachment_id`; si es null, la primera imagen por `sort`; si no hay, miniatura del vídeo; si no, imagen por defecto de la rama.

### Participaciones
- `participations`: `id uuid`, `work_id`, `profile_id null` (null = participante sin cuenta), `guest_name text null`, `claim_code text null unique` (para reclamar), `status` (`pending|accepted|rejected|withdrawn`), `created_by`, `note text`, `created_at`, `updated_at`. Unique `(work_id, profile_id)`.
- `participation_roles`: `id uuid`, `participation_id`, `role_id null → role_catalog`, `role_text text null` (cargo libre «otro»), `status` (`accepted|rejected`), `sort`.
- El subidor tiene participación propia creada automáticamente al crear la obra (cargo «autor/a»).
- Reglas (todas por RPC `security definer`; no hay `insert/update` directos sobre estas tablas):
  - `request_participation(work_id, roles jsonb)`: el autor se apunta; queda `accepted` con todos los cargos `accepted`; notifica al subidor.
  - `add_guest_participant(work_id, guest_name, roles)` (solo subidor) → devuelve `claim_code`.
  - `invite_participant(work_id, alias, roles)` (solo subidor): participación `accepted`; notifica al invitado, que puede retirarse.
  - `set_participation_status(id, status)`: subidor → `rejected`; participante → `withdrawn`.
  - `set_participation_role_status(role_id, status)` (solo subidor): rechazo parcial. Si todos los cargos quedan rechazados, la participación pasa a `rejected`.
  - `claim_participation(code)`: enlaza la participación sin cuenta al usuario actual.
- El CV muestra obras con participación `accepted` y cargos `accepted`, solo de obras visibles.

### Premios
- `awards`: `id uuid`, `name jsonb`, `year int`, `organization text`, `description jsonb`, `image_path`, `lang`, `verified bool default false`, `verified_by`, `verified_at`, `created_by`.
- `award_links`: `id`, `award_id`, `work_id null`, `profile_id null`, `check (num_nonnulls(work_id, profile_id) = 1)`, `created_by`.
- Premio autodeclarado; un moderador lo marca como verificado (sello). Los participantes aceptados de una obra premiada lo ven en su CV como «premio de la obra» (derivado en consulta, no copiado).

### Contacto
- `conversations`: `id`, `recipient_id` (autor), `sender_id`, `work_id null`, `kind` (`commission|purchase|license|collaboration|other`), `subject`, `created_at`, `last_message_at`, `deleted_by_sender bool`, `deleted_by_recipient bool`.
- `messages`: `id`, `conversation_id`, `sender_id`, `body text (≤ 5000)`, `created_at`, `read_at`.
- Solo usuarios registrados. RPC `start_conversation(recipient_id, kind, subject, body, work_id)` comprueba que el destinatario acepta encargos o vende (perfil u obra) y aplica límite: máx. 5 conversaciones nuevas/hora y 30 mensajes/hora por remitente.
- Aviso por correo: pendiente (Database Webhook → función o SMTP de Supabase); en esta fase solo notificación en la plataforma.

### Notificaciones, denuncias y moderación
- `notifications`: `id`, `user_id`, `type` (`participation_new|participation_rejected|participation_withdrawn|participation_invited|message_new|moderation`), `payload jsonb`, `read_at`, `created_at`. Se insertan por triggers/RPC.
- `reports`: `id`, `reporter_id null`, `target_type` (`work|profile|attachment|message|award`), `target_id uuid`, `reason` (`copyright|image_rights|minors|offensive|spam|other`), `details`, `status` (`open|actioned|dismissed`), `created_at`, `resolved_by`, `resolved_at`.
- `moderation_actions`: `id`, `moderator_id`, `target_type`, `target_id`, `action` (`hide|restore|delete|suspend_user|unsuspend_user|verify_award|dismiss_report`), `note`, `created_at`. Inmutable (solo insert).
- RPC `moderate(target_type, target_id, action, note, report_id null)` (solo `moderator|admin`).

### Storage
Buckets: `images` (público), `docs` (público: PDF y ZIP), `audio` (público), `avatars` (público). Rutas: `<user_id>/<work_id>/<uuid>.<ext>`; política: escribir solo en carpeta propia. Miniaturas en la misma carpeta con sufijo `-thumb.webp`. Las obras privadas usan rutas no adivinables (uuid); se acepta que el archivo sea accesible si se conoce la URL (documentado).

### Identificadores cortos
`short_id` de 8 caracteres base62 generado por función `gen_short_id()` con reintento ante colisión. Lo usan URLs de obra y QR.

## 5. Capa PHP (`share/`)

- `.htaccess`: si el archivo existe, se sirve; si no, `index.php`.
- `index.php`:
  - `/c/<short>` → busca el perfil (`profiles_public?short_id=eq.`) → `302 /<lang>/<alias>`.
  - `/o/<short>` → busca la obra → `302 /<lang>/obra/<short>`.
  - `/<lang>/<alias>` y `/<lang>/obra/<short>…` → carga `index.html` y sustituye el bloque `<!--OG-->…<!--/OG-->` por metas `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card=summary_large_image`, `link rel=alternate hreflang`.
  - Caché en `share/cache/` (fuera del webroot si el plan lo permite), TTL 600 s, clave = ruta normalizada.
  - Configuración en `config.php` fuera del repositorio (`SUPABASE_URL`, `SUPABASE_ANON_KEY`), con `config.example.php` versionado.
- Escapa todo con `htmlspecialchars`. Ante cualquier error, sirve `index.html` sin tocar.

## 6. Diseño visual

Continúa la página «en construcción»: papel crema, tinta, acento rojo, tipografía serif editorial con sans para la interfaz.

- Tokens en `src/lib/styles/tokens.css`. Modo oscuro automático y forzable con `data-theme`.
- Tipografía: títulos `"Fraunces", Georgia, serif`; texto e interfaz `"Inter", system-ui, sans-serif` (Google Fonts, con `font-display: swap`).
- Cada rama tiene color propio (`--rama-plasticas`, etc.) usado en etiquetas y bordes de tarjetas.
- Componentes base en `src/lib/components/ui/`: `Button`, `Field`, `Select`, `Toggle`, `Card`, `WorkCard`, `Tag`, `Avatar`, `Modal`, `Tabs`, `Empty`, `Notice`, `Spinner`, `LangText` (texto traducible con aviso de fallback).
- Rejilla de galería: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`, imágenes `aspect-ratio: 4/3; object-fit: cover`.
- Accesibilidad: contraste AA, foco visible, etiquetas en todos los campos, navegación por teclado.

## 7. Estructura del código

```
src/
  app.html                 plantilla (bloque <!--OG--> para PHP)
  lib/
    supabase.ts            cliente único
    auth.svelte.ts         estado de sesión y perfil (runas)
    i18n/                  es.ts, en.ts, index.ts (t(), lang actual, tr() para jsonb)
    routes.ts              constructores de URL (cvUrl, workUrl, qrUrl…)
    types.ts               tipos de filas y RPC
    api/                   consultas por dominio (works.ts, profiles.ts, participations.ts…)
    media/                 image.ts (redimensionado/EXIF), pdf.ts (miniatura), upload.ts
    components/            ui/ y de dominio
    styles/                tokens.css, base.css
  routes/                  páginas (§3)
supabase/
  migrations/              SQL numerado
  seed.sql                 catálogos y datos ficticios
  tests/                   pruebas SQL de RLS y RPC (Postgres local con stubs de auth)
share/                     capa PHP
```

## 8. Calidad

- `npm run check` (svelte-check) y `npm run test` (vitest para utilidades) deben pasar.
- `npm run test:db` ejecuta las pruebas SQL sobre Postgres local.
- `php share/tests/run.php` ejecuta las pruebas de la capa PHP.
- Sin datos reales de personas en semillas ni pruebas.
