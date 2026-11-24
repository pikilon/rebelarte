# Guía de despliegue en Hostinger

Este documento describe la preparación, los artefactos, los procedimientos de subida, la configuración de DNS, la seguridad y las verificaciones para publicar **Rebelarte 2.0** en el alojamiento compartido de Hostinger.

> [!IMPORTANT]
> Este documento prepara el despliegue sin ejecutarlo. Todas las operaciones de cambio de DNS, subida a producción y decisiones legales o de correo quedan en manos del usuario.

---

## 1. Visión general de la arquitectura en producción

La arquitectura de Rebelarte 2.0 combina una SPA estática, una capa PHP ligera y el backend gestionado en Supabase:

```
                    ┌─────────────────────────── Hostinger (Apache + PHP 8.2+) ───────────────────────┐
                    │                                                                                 │
Petición entrante ─▶│ .htaccess                                                                       │
                    │   ├── Assets físicos (_app/…, favicon, etc.) ─▶ Servidos directos por Apache    │
                    │   └── Fallback / rutas dinámicas / raíz ─────▶ index.php                        │
                    │                                                  ├── /c/<id>, /o/<id> ─▶ 302 QR │
                    │                                                  ├── /<lang>/<alias>  ─▶ Metas  │
                    │                                                  ├── /<lang>/obra/<id>─▶ OG/Card│
                    │                                                  └── Rutas SPA profunda─▶ HTML  │
                    └───────────────────────────────────┬─────────────────────────────────────────────┘
                                                        │ REST (clave anon pública, solo lectura)
Navegador (SPA SvelteKit) ── supabase-js ───────────────┴──────────────▶ Supabase: Postgres + RLS, Auth, Storage
```

- **SPA SvelteKit 2 + Svelte 5**: compilada de forma estática con `@sveltejs/adapter-static` (`ssr = false`). Todo el renderizado y el enrutado de la interfaz ocurren en el navegador del cliente.
- **Capa PHP (`share/`)**: alojada junto a la SPA en `public_html`. Su cometido se limita a:
  1. Redirecciones HTTP 302 para códigos QR cortos (`/c/<id>` para CVs y `/o/<id>` para obras) hacia la URL canónica en el idioma de origen.
  2. Inyección de etiquetas Open Graph y Twitter Cards (`<meta property="og:*">`) en `index.html` cuando rastreadores de redes sociales o mensajería (WhatsApp, Telegram, X, Facebook, LinkedIn, Discord) consultan un CV o una ficha de obra.
  3. Caché en disco de metadatos (TTL de 10 minutos en `cache/`).
  4. Fallback transparente: para cualquier otra ruta de la SPA, o ante caídas/timeouts de Supabase, sirve `index.html` intacto (código 200), permitiendo que la SPA cargue sin mostrar errores de servidor.
- **Supabase**: base de datos Postgres con RLS (Row Level Security), autenticación sin contraseña (Email OTP) y almacenamiento de archivos (Storage con CDN).

---

## 2. Artefactos a desplegar

### 2.1. Qué se sube a Hostinger

Para desplegar la aplicación en `public_html` se combinan los artefactos generados por la compilación de SvelteKit con los archivos de la capa PHP:

| Origen | Elemento | Descripción |
|---|---|---|
| `build/` | `index.html` | Shell principal de la SPA con el marcador `<!--OG-->…<!--/OG-->` para inyección de metadatos. |
| `build/` | `_app/` | Código compilado, fragmentos JS inmutables, hojas de estilo CSS y manifiestos de SvelteKit. |
| `build/` | `favicon.svg` | Icono del sitio. |
| `build/` | `og-default.png` | Imagen representativa predeterminada para previsualizaciones sociales (25 KB). |
| `share/` | `index.php` | Punto de entrada y router PHP para redirecciones QR y previsualizaciones OG. |
| `share/` | `.htaccess` | Reglas de Apache: forzado de HTTPS, seguridad, caché y reescritura. |
| `share/` | `lib/` | Módulos auxiliares de PHP: `handler.php`, `render.php`, `http.php`, `cache.php`, `util.php`. |
| `share/` | `config.example.php` | Plantilla de configuración (se copia a `config.php` en el servidor). |
| *(generado)* | `cache/` | Directorio local para la caché de respuestas JSON de la capa PHP. |

### 2.2. Qué NO se debe subir

Por seguridad y buenas prácticas, **nunca** deben subirse al alojamiento web:
- Código fuente de la SPA (`src/`).
- Dependencias de Node.js (`node_modules/`).
- Archivos de entorno locales (`.env`, `.env.local`, `.env.*`).
- Carpeta de control de versiones (`.git/`, `.github/`).
- Migraciones y pruebas de Supabase (`supabase/`).
- Pruebas y utilidades de desarrollo PHP (`share/tests/`, `share/tools/`, `share/README.md`).
- Scripts de mantenimiento local (`scripts/`).

### 2.3. Generación automática del paquete (`npm run build:hostinger`)

El repositorio incluye el comando automatizado:

```bash
npm run build:hostinger
```

Este script:
1. Ejecuta `npm run build` para compilar la SPA estática en `build/`.
2. Verifica que `build/index.html` contiene el bloque `<!--OG-->` imprescindible para la capa PHP.
3. Genera la carpeta limpia `build-hostinger/`.
4. Copia los archivos estáticos de la SPA y los componentes productivos de `share/`.
5. Excluye automáticamente `tests/`, `tools/` y documentación interna.
6. Crea el directorio `build-hostinger/cache/`.
7. Valida la integridad y tamaño de cada archivo crítico antes de terminar.

El contenido resultante en `build-hostinger/` está listo para transferirse directamente a `public_html`.

---

## 3. Estructura de carpetas en `public_html`

La estructura resultante en el directorio raíz de publicación de Hostinger debe ser:

```text
public_html/
├── .htaccess                 # Directivas Apache (HTTPS, CSP, reescritura, caché)
├── config.php                # Configuración local con credenciales públicas (creado en el servidor)
├── config.example.php        # Plantilla versionada de referencia
├── index.html                # Entrada de la SPA (sirve como fallback universal)
├── index.php                 # Enrutador PHP para QR y Open Graph
├── favicon.svg               # Favicon vectorial
├── og-default.png            # Imagen OG por defecto al compartir enlaces
├── cache/                    # Almacén de respuestas cacheadas (archivos .json)
├── lib/                      # Funciones auxiliares PHP
│   ├── cache.php
│   ├── handler.php
│   ├── http.php
│   ├── render.php
│   └── util.php
└── _app/                     # Activos estáticos generados por SvelteKit
    ├── env.js
    └── immutable/
        ├── assets/           # Archivos CSS con hash
        ├── chunks/           # Módulos JS compartidos con hash
        ├── entry/            # Puntos de arranque de la SPA con hash
        └── nodes/            # Componentes de ruta con hash
```

### Permisos recomendados en el servidor

Hostinger utiliza configuraciones basadas en suPHP / PHP-FPM / FastCGI donde los scripts PHP se ejecutan bajo el usuario de la cuenta:
- **Directorios generales**: `755` (`drwxr-xr-x`).
- **Archivos generales**: `644` (`-rw-r--r--`).
- **Directorio `cache/`**: debe tener permisos de escritura para PHP. Generalmente `755` es suficiente; si el servidor lo requiere, utilizar `775`.
- **Archivo `config.php`**: `640` o `644` (el archivo está bloqueado contra descargas web directas en `.htaccess`).

---

## 4. Reglas de reescritura y seguridad (`.htaccess`)

El archivo `.htaccess` gobierna la interacción entre Apache, la capa PHP y la SPA estática:

```apache
Options -Indexes
DirectoryIndex index.html index.php

<IfModule mod_rewrite.c>
RewriteEngine On

# 1. Forzar HTTPS (soporta proxies inversos mediante X-Forwarded-Proto)
RewriteCond %{HTTPS} !=on
RewriteCond %{HTTP:X-Forwarded-Proto} !=https
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# 2. Bloquear acceso web a directorios internos y configuraciones
RewriteRule ^(cache|lib|tests|tools)(/|$) - [F,L]
RewriteRule ^config(\.example)?\.php$ - [F,L]

# 3. Si el archivo o directorio físico existe, servirlo directamente (salvo la raíz)
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^(?!$) - [L]

# 4. Fallback universal: todo lo demás y la raíz pasan por index.php
RewriteRule ^ index.php [L]
</IfModule>
```

### Flujo de peticiones

1. **Recursos físicos (`/_app/…`, `favicon.svg`, `og-default.png`)**:
   - `RewriteCond %{REQUEST_FILENAME} -f` coincide.
   - Apache entrega el archivo directamente a máxima velocidad sin invocar el intérprete de PHP.
   - Para `/_app/immutable/…`, Apache añade la cabecera `Cache-Control: public, max-age=31536000, immutable`.
2. **Raíz (`/`)**:
   - La regla `^(?!$)` no coincide con la cadena vacía.
   - Pasa a `index.php`, que invoca `reb_handle()`, detecta ruta estándar y sirve `index.html` con `Cache-Control: no-cache`.
3. **Enlaces QR (`/c/<short>`, `/o/<short>`)**:
   - El archivo físico no existe; pasa a `index.php`.
   - PHP consulta la vista pública en Supabase (`profiles_public` o `works`).
   - Devuelve un `302 Found` con la cabecera `Location: /<lang>/<alias>` o `Location: /<lang>/obra/<short>`.
4. **Fichas de autor y obra (`/<lang>/<alias>`, `/<lang>/obra/<short>…`)**:
   - Pasa a `index.php`.
   - PHP comprueba la caché en disco (`cache/<hash>.json`). Si no está en caché, consulta Supabase REST (`rpc/profile_public` o `works_cards`).
   - Lee `index.html`, reemplaza el bloque `<!--OG-->…<!--/OG-->` con las etiquetas específicas (`og:title`, `og:description`, `og:image`, `twitter:card`, `hreflang`) y sirve la página con `X-Rebelarte-Cache: hit|miss`.
5. **Rutas internas de la SPA (`/<lang>/buscar`, `/<lang>/mi/…`, etc.)**:
   - Pasa a `index.php`.
   - Al no coincidir con rutas QR ni de ficha, PHP entrega `index.html` original con código 200.
   - El cliente web carga los scripts de `_app/` y el router de SvelteKit toma el control.
6. **Resiliencia ante fallos**:
   - Si Supabase sufre un corte o tarda más de 2 segundos, PHP captura la excepción y sirve `index.html` intacto (código 200). De este modo, la SPA arranca con normalidad y el usuario nunca ve un error 500 de servidor.

### Cabeceras de seguridad y CSP

El archivo `.htaccess` incluye cabeceras de endurecimiento HTTP:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000` (HSTS)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Content-Security-Policy`:
  - `script-src 'self' 'unsafe-inline'` (necesario por el script de arranque inyectado por SvelteKit).
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' https://fonts.gstatic.com data:`
  - `img-src 'self' data: blob: https://*.supabase.co https://i.ytimg.com https://*.bcbits.com`
  - `media-src 'self' blob: https://*.supabase.co`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co`
  - `frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://w.soundcloud.com https://bandcamp.com`
  - `worker-src 'self' blob:`
  - `object-src 'none'`

---

## 5. Variables de configuración y credenciales

### 5.1. Archivo `config.php` en Hostinger

En el servidor se crea el archivo `public_html/config.php` a partir de `config.example.php`:

```php
<?php
// Configuración de producción para la capa PHP de Rebelarte
return [
    'SUPABASE_URL'      => 'https://jwuqsqwbkfggrycpburv.supabase.co',
    'SUPABASE_ANON_KEY' => 'sb_publishable_FJXx59T7VuK7pXJ1p6SyKA_hRHLb40y',
    'SITE_URL'          => 'https://rebelarte.com', // En beta: 'https://beta.rebelarte.com'
    'CACHE_TTL'         => 600,                     // 10 minutos
    'INDEX_PATH'        => __DIR__ . '/index.html',
    'CACHE_DIR'         => __DIR__ . '/cache',      // Opcional, por defecto __DIR__ . '/cache'
    'HTTP_TIMEOUT'      => 2,                       // Segundos máximos de espera a Supabase
];
```

> [!CAUTION]
> **Regla de seguridad fundamental**:
> - Utiliza **únicamente** la clave publicable o anon (`sb_publishable_...` o `anon`).
> - **NUNCA** coloques la clave `service_role` ni contraseñas de base de datos en `config.php`, en la SPA ni en ningún archivo accesible por Apache.
> - La clave anon es pública por diseño y está acotada por las políticas RLS y las funciones RPC de Supabase.

### 5.2. Variables en la SPA SvelteKit

Durante la compilación (`npm run build`), Vite incrusta las variables de entorno públicas desde `.env`:
- `PUBLIC_SUPABASE_URL`: `https://jwuqsqwbkfggrycpburv.supabase.co`
- `PUBLIC_SUPABASE_ANON_KEY`: `sb_publishable_FJXx59T7VuK7pXJ1p6SyKA_hRHLb40y`

Si cambias de proyecto de Supabase, debes recompilar la SPA antes de generar el paquete para Hostinger.

---

## 6. Procedimiento de subida a Hostinger

Existen tres métodos para transferir los archivos generados en `build-hostinger/` a Hostinger:

### Opción A: SSH y Rsync (Recomendada)

Es el método más rápido, incremental y limpio.

1. **Activar acceso SSH en Hostinger**:
   - Accede a hPanel → **Avanzado** → **Acceso SSH**.
   - Activa el interruptor de SSH. Datos de la cuenta verificados: Servidor IP `<IP_SERVIDOR>`, Puerto `<PUERTO_SSH>`, Usuario `<USUARIO_HOSTINGER>`.
2. **Sincronizar los archivos**:
   Desde la raíz del repositorio en tu máquina:
   ```bash
   npm run build:hostinger
   rsync -avz -e "ssh -p <PUERTO_SSH>" --delete build-hostinger/ <USUARIO_HOSTINGER>@<IP_SERVIDOR>:public_html/
   ```
3. **Crear `config.php` en el servidor**:
   ```bash
   ssh -p <PUERTO_SSH> <USUARIO_HOSTINGER>@<IP_SERVIDOR> "cp public_html/config.example.php public_html/config.php"
   ```
   Edita `public_html/config.php` si requieres ajustar la URL o credenciales.
4. **Verificar permisos**:
   ```bash
   ssh -p <PUERTO_SSH> <USUARIO_HOSTINGER>@<IP_SERVIDOR> "chmod 755 public_html/cache"
   ```

---

### Opción B: SFTP / FTP con FileZilla o Cyberduck

1. Accede a hPanel → **Archivos** → **Cuentas FTP**.
2. Anota los datos de conexión: Host FTP, Puerto (`21` para FTP o `<PUERTO_SSH>` para SFTP), Usuario y Contraseña.
3. Conéctate con tu cliente FTP.
4. Navega hasta el directorio `public_html/`.
5. Si existen archivos de un despliegue anterior o una página por defecto de Hostinger (`default.php`), elimínalos o muévelos a una carpeta de respaldo.
6. Sube todo el **contenido** de la carpeta local `build-hostinger/` directamente al interior de `public_html/`.
7. En el servidor, haz una copia de `config.example.php` con el nombre `config.php`.
8. Comprueba que la carpeta `cache/` exista y tenga permisos de lectura y escritura (`755`).

---

### Opción C: Administrador de Archivos de hPanel (Vía Web)

1. En local, empaqueta los contenidos:
   ```bash
   npm run build:hostinger
   cd build-hostinger && zip -r ../rebelarte-hostinger.zip . && cd ..
   ```
2. Entra en hPanel → **Archivos** → **Administrador de Archivos**.
3. Abre la carpeta `public_html`.
4. Haz clic en **Subir archivo**, selecciona `rebelarte-hostinger.zip`.
5. Haz clic derecho sobre el zip subido → **Extraer** en el directorio actual (`public_html`).
6. Elimina el archivo `.zip`.
7. Copia `config.example.php` como `config.php`.

---

## 7. Plan beta.rebelarte.com (Fase 1 — Despliegue en subdominio)

De acuerdo con la decisión de despliegue, la primera publicación de Rebelarte 2.0 se realizará en el subdominio **`beta.rebelarte.com`** alojado en Hostinger. De este modo:
- El dominio raíz `rebelarte.com` y `www.rebelarte.com` continúan sirviendo la página provisional «en construcción» en GitHub Pages sin ninguna interrupción.
- Los DNS de `rebelarte.com` se siguen gestionando exclusivamente en Piensa Solutions.
- Se valida la pila completa (Apache, PHP 8.2+, `.htaccess`, Open Graph, códigos QR, Supabase Auth y Storage) en el entorno real de Hostinger antes del cambio definitivo de dominio.

### 7.1. Reconocimiento de la infraestructura en Hostinger

> El repositorio es público: `<IP_SERVIDOR>`, `<USUARIO_HOSTINGER>` y `<PUERTO_SSH>` son marcadores. Los valores reales están en hPanel → Avanzado → Acceso SSH.

Tras inspeccionar la cuenta mediante la API de Hostinger (solo lectura):
- **Plan de alojamiento**: `hostinger_premium` (CloudLinux / Web Hosting compartido, estado `active`).
- **Usuario del sistema**: `<USUARIO_HOSTINGER>`.
- **IP real del servidor**: **`<IP_SERVIDOR>`** (verificada a partir de los registros DNS de la misma cuenta).
- **Versión de PHP**: La cuenta cuenta actualmente con PHP 8.1.34 por defecto, con versiones soportadas hasta PHP 8.5. Para Rebelarte se seleccionará **PHP 8.2** o **PHP 8.3**.
- **Extensiones de PHP**: Módulos requeridos (`curl`, `json`, `mbstring`, `openssl`) se encuentran activos o integrados por defecto.
- **Acceso SSH / SFTP**: Disponible en el puerto `<PUERTO_SSH>` (`ssh -p <PUERTO_SSH> <USUARIO_HOSTINGER>@<IP_SERVIDOR>`).
- **Estado de dominios**: Ni `rebelarte.com` ni `beta.rebelarte.com` están dados de alta aún en Hostinger.

### 7.2. Registros DNS exactos a crear en Piensa Solutions para `beta`

En el panel de cliente de **Piensa Solutions** → **Mis Dominios** → `rebelarte.com` → **Gestión de DNS**, añadir el siguiente registro para la web beta:

| Nombre / Host | Tipo | Valor / Destino | TTL | Propósito |
|---|---|---|---|---|
| `beta` (o `beta.rebelarte.com.`) | **A** | **`<IP_SERVIDOR>`** | `300` (5 min) | Apuntar el subdominio de pruebas al servidor de Hostinger |

> [!IMPORTANT]
> **NO MODIFICAR** los registros existentes para `@` (los 4 registros A `185.199.108.153`…`185.199.111.153`) ni para `www` (`pikilon.github.io.`), a fin de mantener activa la página «en construcción».

### 7.3. Pasos exactos en Hostinger (hPanel)

1. **Añadir el sitio / subdominio**:
   - Entrar en [hPanel de Hostinger](https://hpanel.hostinger.com/) con la cuenta de usuario.
   - Ir a **Sitios web** → **Crear o migrar un sitio web** (o Añadir sitio web).
   - Añadir `rebelarte.com` como sitio secundario (*Addon Website*). Si Hostinger solicita verificación previa por TXT para comprobar la titularidad (al estar los NS en Piensa Solutions), añadir temporalmente el registro TXT solicitado en Piensa Solutions.
   - Una vez creado el contenedor de `rebelarte.com`, entrar a su administración → **Avanzado** → **Subdominios**.
   - Crear el subdominio `beta`:
     - Subdominio: `beta`
     - Carpeta personalizada: dejar la sugerida por hPanel (típicamente `public_html/beta` o raíz propia `/home/<USUARIO_HOSTINGER>/domains/rebelarte.com/public_html/beta`).
2. **Configurar la versión de PHP**:
   - En la administración del sitio en hPanel → **Avanzado** → **Configuración de PHP**.
   - Seleccionar **PHP 8.2** o **PHP 8.3**.
   - Confirmar que las extensiones `curl`, `json`, `mbstring`, `openssl` están activas (vienen habilitadas por defecto).
3. **Instalar el certificado SSL gratuito**:
   - En hPanel → **Seguridad** → **SSL**.
   - Localizar el subdominio `beta.rebelarte.com` e instalar el certificado gratuito gestionado (Let's Encrypt / HSSL).
   - *Nota*: La emisión se completará con éxito en cuanto el registro A de Piensa Solutions (`beta` → `<IP_SERVIDOR>`) haya propagado.
4. **Habilitar acceso SSH (si no estuviese activo)**:
   - En hPanel → **Avanzado** → **Acceso SSH**.
   - Comprobar que el interruptor esté en **Activado**.

### 7.4. Generación del paquete y subida a Hostinger

1. **Compilar la versión para Hostinger en local**:
   Desde la raíz del repositorio:
   ```bash
   npm run build:hostinger
   ```
   Esto generará el directorio `build-hostinger/` con la SPA compilada, la capa PHP (`index.php`, `.htaccess`, `lib/`), el directorio `cache/` y la plantilla `config.example.php`.

2. **Subir los archivos al servidor**:
   - **Vía Rsync / SSH (Recomendada)**:
     ```bash
     rsync -avz -e "ssh -p <PUERTO_SSH>" --delete build-hostinger/ <USUARIO_HOSTINGER>@<IP_SERVIDOR>:domains/rebelarte.com/public_html/beta/
     ```
     *(Ajustar la ruta de destino según la carpeta configurada en hPanel para el subdominio).*
   - **Vía SFTP (FileZilla / Cyberduck)**:
     - Servidor: `<IP_SERVIDOR>`
     - Puerto: `<PUERTO_SSH>`
     - Usuario: `<USUARIO_HOSTINGER>`
     - Destino: Carpeta asignada al subdominio `beta`.

### 7.5. Configuración de `config.php` en el servidor

Una vez transferidos los archivos, conectarse por SSH al servidor o usar el Administrador de Archivos de hPanel:

1. **Copiar la plantilla de configuración**:
   ```bash
   ssh -p <PUERTO_SSH> <USUARIO_HOSTINGER>@<IP_SERVIDOR> "cp domains/rebelarte.com/public_html/beta/config.example.php domains/rebelarte.com/public_html/beta/config.php"
   ```
2. **Asegurar los valores para beta en `config.php`**:
   ```php
   <?php
   return [
       'SUPABASE_URL'      => 'https://jwuqsqwbkfggrycpburv.supabase.co',
       'SUPABASE_ANON_KEY' => 'sb_publishable_FJXx59T7VuK7pXJ1p6SyKA_hRHLb40y',
       'SITE_URL'          => 'https://beta.rebelarte.com',
       'CACHE_TTL'         => 600,                     // 10 minutos
       'INDEX_PATH'        => __DIR__ . '/index.html',
       'CACHE_DIR'         => __DIR__ . '/cache',
       'HTTP_TIMEOUT'      => 2,
   ];
   ```
3. **Verificar permisos**:
   ```bash
   ssh -p <PUERTO_SSH> <USUARIO_HOSTINGER>@<IP_SERVIDOR> "chmod 755 domains/rebelarte.com/public_html/beta/cache && chmod 644 domains/rebelarte.com/public_html/beta/config.php"
   ```

---

## 8. SMTP de Hostinger para Supabase Auth

Supabase en su plan gratuito aplica límites estrictos al envío de correos con su servidor predeterminado (máx. 3-4 correos por hora) y prohíbe el uso de plantillas personalizadas (`supabase config push` devuelve error `entitlement_required`). Para permitir el acceso seguro por OTP con enlace mágico y código de 6 dígitos, se utilizará el servicio de correo del plan de Hostinger (**Hostinger Email**, con hasta 100 buzones incluidos en el plan Premium).

### 8.1. Diagnóstico del DNS público actual de `rebelarte.com`

Se ha realizado una consulta exhaustiva del estado DNS real de `rebelarte.com` en los servidores DNS autorizados de Piensa Solutions:
- **Registros MX existentes**: **NINGUNO**.
- **Registros TXT / SPF existentes**: **NINGUNO**.
- **Registros DKIM (`_domainkey`)**: **NINGUNO**.
- **Registros DMARC (`_dmarc`)**: **NINGUNO**.

> [!NOTE]
> **Sin riesgo de rotura**: Dado que el dominio `rebelarte.com` no cuenta actualmente con ningún servicio de correo electrónico activo ni registros MX/SPF previos, dar de alta la configuración de correo de Hostinger en Piensa Solutions no interfiere con ningún buzón existente ni provocará pérdidas de correo.

### 8.2. Creación del buzón en Hostinger

1. Acceder a [hPanel](https://hpanel.hostinger.com/) → **Correos** → **Hostinger Email**.
2. Seleccionar el dominio `rebelarte.com` (o activarlo dentro del plan de correo gratuito incluido).
3. **Crear buzón**:
   - Nombre de cuenta: `no-reply` (quedando como **`no-reply@rebelarte.com`**).
   - Generar y asignar una contraseña robusta (mínimo 12 caracteres con mayúsculas, minúsculas, números y símbolos).
   - **Guardar la contraseña** de forma segura en un gestor de contraseñas. Se utilizará exclusivamente como secreto en Supabase.

### 8.3. Registros DNS exactos a crear en Piensa Solutions para el correo

Para que Hostinger pueda firmar y autenticar los correos enviados por `no-reply@rebelarte.com` y evitar que caigan en carpetas de spam, dar de alta en **Piensa Solutions** → **Gestión de DNS**:

| Nombre / Host | Tipo | Prioridad | Valor / Destino | TTL | Finalidad |
|---|---|---|---|---|---|
| `@` | **MX** | `5` | `mx1.hostinger.com.` | `3600` | Servidor de correo principal Hostinger |
| `@` | **MX** | `10` | `mx2.hostinger.com.` | `3600` | Servidor de correo secundario Hostinger |
| `@` | **TXT** | - | `"v=spf1 include:_spf.mail.hostinger.com ~all"` | `3600` | Registro SPF: autoriza a Hostinger a enviar correo del dominio |
| `hostingermail-a._domainkey` | **CNAME** | - | `hostingermail-a.dkim.mail.hostinger.com.` | `300` | Clave DKIM Selector A de Hostinger |
| `hostingermail-b._domainkey` | **CNAME** | - | `hostingermail-b.dkim.mail.hostinger.com.` | `300` | Clave DKIM Selector B de Hostinger |
| `hostingermail-c._domainkey` | **CNAME** | - | `hostingermail-c.dkim.mail.hostinger.com.` | `300` | Clave DKIM Selector C de Hostinger |
| `_dmarc` | **TXT** | - | `"v=DMARC1; p=none"` | `3600` | Política DMARC inicial (monitorización) |
| `autoconfig` *(opcional)* | **CNAME** | - | `autoconfig.mail.hostinger.com.` | `300` | Detección automática en clientes de correo |
| `autodiscover` *(opcional)* | **CNAME** | - | `autodiscover.mail.hostinger.com.` | `300` | Detección automática en Outlook / ActiveSync |

> **Importante:** los nombres y valores DKIM de la tabla son orientativos. Copia los exactos de hPanel → Correo → Ajustes de DNS una vez activado el correo para `rebelarte.com`, porque Hostinger los genera por dominio.

### 8.4. Valoración técnica: ¿Por qué apuntar los MX a Hostinger si solo enviamos?

Supabase se conecta como cliente SMTP saliente a `smtp.hostinger.com:465`. Cabría preguntarse si bastaría con SPF y DKIM sin apuntar los registros MX. La respuesta es que **los registros MX son indispensables**:
1. **Filtros antispam de destino (Gmail, Yahoo, Outlook)**: Desde febrero de 2024, Google y Yahoo exigen verificación estricta de remitente. Si un correo proviene de `@rebelarte.com` pero el dominio no tiene registros MX resolubles, muchos servidores receptores rechazan la entrega de forma tajante con un error permanente (`550 5.1.2 The host has no MX record`).
2. **Rebotes y notificaciones técnicas (NDR/DSN)**: Si un usuario introduce un correo incorrecto o se produce un rebote de entrega, el servidor receptor enviará el reporte de fallo a la dirección remitente (`no-reply@rebelarte.com`). Sin registros MX, estos rebotes no se pueden entregar ni procesar.
3. **Validación en hPanel**: Hostinger no marca el dominio como totalmente verificado y operativo para emisión y autenticación DKIM si faltan los registros MX en la zona DNS.
4. Al no existir ningún servicio de correo previo en `rebelarte.com`, apuntar los MX a Hostinger es 100% seguro y limpio.

### 8.5. Parámetros de configuración SMTP en Supabase

| Parámetro | Valor |
|---|---|
| **Host** | `smtp.hostinger.com` |
| **Port** | `465` (SSL) |
| **Encryption** | SSL/TLS |
| **Username** | `no-reply@rebelarte.com` |
| **Password** | *Contraseña del buzón en Hostinger* (**SECRETO — NUNCA en el repositorio**) |
| **Sender Email** | `no-reply@rebelarte.com` |
| **Sender Name** | `Rebelarte` |

#### Opción 1: Aplicación mediante CLI (`supabase config push`)

En `supabase/config.toml` ya se ha dejado preparada la sección `[auth.email.smtp]` y las plantillas personalizadas (comentadas).

Para activar:
1. Descomentar en `supabase/config.toml`:
   ```toml
   [auth.email.smtp]
   enabled = true
   host = "smtp.hostinger.com"
   port = 465
   user = "no-reply@rebelarte.com"
   pass = "env(SUPABASE_SMTP_PASS)"
   admin_email = "no-reply@rebelarte.com"
   sender_name = "Rebelarte"

   [auth.email.template.magic_link]
   subject = "Tu acceso a Rebelarte"
   content_path = "./supabase/templates/magic_link.html"

   [auth.email.template.confirmation]
   subject = "Confirma tu registro en Rebelarte"
   content_path = "./supabase/templates/confirmation.html"

   [auth.email.template.email_change]
   subject = "Confirma tu nuevo correo en Rebelarte"
   content_path = "./supabase/templates/email_change.html"
   ```
2. En la terminal de la máquina de desarrollo, exportar la contraseña antes de lanzar el push:
   ```bash
   export SUPABASE_SMTP_PASS="tu_contraseña_del_buzon"
   npx supabase config push
   ```

#### Opción 2: Aplicación directa en Supabase Dashboard (Web)

Si se prefiere no gestionar el secreto por terminal:
1. Acceder a [Supabase Dashboard](https://supabase.com/dashboard/project/jwuqsqwbkfggrycpburv) → **Project Settings** → **Authentication** → **SMTP Settings**.
2. Activar **Enable Custom SMTP**.
3. Rellenar los campos:
   - *Sender email*: `no-reply@rebelarte.com`
   - *Sender name*: `Rebelarte`
   - *Host*: `smtp.hostinger.com`
   - *Port*: `465`
   - *Username*: `no-reply@rebelarte.com`
   - *Password*: la contraseña del buzón.
4. Guardar cambios.
5. Ir a **Authentication** → **Email Templates** y verificar o pegar el contenido de las plantillas en `supabase/templates/` (`magic_link.html`, `confirmation.html`, `email_change.html`).

#### Redirect URLs preparadas

En `supabase/config.toml` ya se ha añadido la URL de redirección para el subdominio beta:
```toml
additional_redirect_urls = ["https://rebelarte.com/**", "https://beta.rebelarte.com/**", "http://localhost:5173/**"]
```
Si se configura por Dashboard, comprobar que en **Authentication** → **URL Configuration** figura `https://beta.rebelarte.com/**`.

---

## 9. Comprobaciones post-despliegue en beta

Una vez completada la subida y propagado el DNS de `beta.rebelarte.com`, ejecuta las siguientes comprobaciones para validar el correcto funcionamiento:

### 9.1. Vistas previas Open Graph (Simulando rastreadores)

Comprueba que los rastreadores reciben el HTML con los metadatos inyectados y las cabeceras de caché:

```bash
# Simular bot de Facebook para un perfil de artista
curl -sI -A "facebookexternalhit/1.1" https://beta.rebelarte.com/es/<alias> | grep -i -E "^HTTP|x-rebelarte|content-type"

# Comprobar que el bloque OG está inyectado con los datos del artista
curl -s -A "facebookexternalhit/1.1" https://beta.rebelarte.com/es/<alias> | grep -E "<meta property=\"og:|<title>"

# Simular bot de Twitter/X para una obra
curl -s -A "Twitterbot/1.0" https://beta.rebelarte.com/es/obra/<short_id> | grep -E "twitter:card|og:title"

# Segunda petición consecutiva para verificar la caché en disco (debe responder 'hit')
curl -sI -A "facebookexternalhit/1.1" https://beta.rebelarte.com/es/<alias> | grep -i "x-rebelarte-cache"
```

### 9.2. Redirección de códigos QR

Verifica que las URL cortas responden con un código HTTP 302 y la cabecera `Location` adecuada:

```bash
# Redirección de QR de CV (debe llevar al idioma de origen del autor)
curl -sI https://beta.rebelarte.com/c/<short_id> | grep -i -E "^HTTP|location"

# Redirección de QR de Obra
curl -sI https://beta.rebelarte.com/o/<short_id> | grep -i -E "^HTTP|location"

# Redirección de identificador inexistente (debe redirigir a la portada '/')
curl -sI https://beta.rebelarte.com/c/noexiste | grep -i -E "^HTTP|location"
```

### 9.3. Rutas profundas de la SPA

Verifica que las rutas de navegación interna son interceptadas por Apache y servidas con `index.html` (código 200), sin devolver 404:

```bash
curl -sI https://beta.rebelarte.com/es/buscar | grep -i -E "^HTTP|content-type"
curl -sI https://beta.rebelarte.com/en/mi/obras | grep -i -E "^HTTP|content-type"
```

### 9.4. Flujo de autenticación OTP

1. Acceder con el navegador a `https://beta.rebelarte.com/es/entrar`.
2. Introducir una dirección de correo y solicitar acceso.
3. Verificar la recepción del correo enviado desde `no-reply@rebelarte.com` con el asunto "Tu acceso a Rebelarte", conteniendo el enlace de entrada y el código de 6 dígitos.
4. Probar tanto el clic en el enlace como la introducción manual del código OTP.

---

## 10. Migración futura a producción definitiva (rebelarte.com)

Cuando las pruebas en `beta.rebelarte.com` sean satisfactorias y se disponga de los textos legales revisados:

1. **Reducción de TTL previa**: 24-48 horas antes, bajar el TTL de `@` y `www` en Piensa Solutions a 300 segundos.
2. **Cambio de DNS en Piensa Solutions**:
   - Eliminar los 4 registros A de GitHub Pages (`185.199.108.153`…`185.199.111.153`).
   - Crear un registro **A**: `@` → `<IP_SERVIDOR>`.
   - Modificar el registro **CNAME**: `www` → `rebelarte.com.`.
3. **Instalación de SSL en Hostinger**: Activar el certificado SSL para `rebelarte.com` y `www.rebelarte.com`.
4. **Actualización de `config.php`**: Cambiar `'SITE_URL' => 'https://rebelarte.com'`.
5. **Rollback a GitHub Pages (en caso de incidencia)**:
   - Eliminar el registro A a Hostinger.
   - Volver a crear los 4 registros A a GitHub Pages y el CNAME de `www` a `pikilon.github.io.`.

---

## 11. Lista de acciones y credenciales que requieren intervención del usuario

Para completar el despliegue en `beta.rebelarte.com` y la activación del SMTP de Hostinger, el usuario debe realizar las siguientes acciones directas con sus accesos:

| # | Ámbito | Acción concreta | Credenciales / Datos requeridos | Estado |
|---|---|---|---|---|
| **1** | **Piensa Solutions (DNS)** | Crear registro A: `beta` → `<IP_SERVIDOR>` (TTL 300). | Acceso al panel de Piensa Solutions. | Pendiente usuario |
| **2** | **Piensa Solutions (DNS)** | Crear registros de correo: 2 MX (`mx1`, `mx2`), 1 TXT SPF (`v=spf1 include:_spf.mail.hostinger.com ~all`), 3 CNAME DKIM (`hostingermail-a/b/c._domainkey`), 1 TXT DMARC (`_dmarc`). | Acceso al panel de Piensa Solutions. | Pendiente usuario |
| **3** | **Hostinger (hPanel)** | Dar de alta `rebelarte.com` como sitio web y crear el subdominio `beta.rebelarte.com`. | Acceso a hPanel Hostinger. | Pendiente usuario |
| **4** | **Hostinger (hPanel)** | Configurar la versión de PHP a **8.2** o **8.3** para el subdominio `beta`. | Acceso a hPanel Hostinger. | Pendiente usuario |
| **5** | **Hostinger (hPanel)** | Emitir certificado SSL gratuito para `beta.rebelarte.com` una vez propagado el DNS. | Acceso a hPanel Hostinger. | Pendiente usuario |
| **6** | **Hostinger (hPanel)** | Activar Hostinger Email para `rebelarte.com` y crear el buzón `no-reply@rebelarte.com` definiendo su contraseña. | Contraseña elegida por el usuario para el buzón. | Pendiente usuario |
| **7** | **Servidor Hostinger** | Subir el paquete compilado `build-hostinger/` a la carpeta del subdominio y crear `config.php` con `'SITE_URL' => 'https://beta.rebelarte.com'`. | Conexión SSH o credenciales FTP/SFTP del usuario `<USUARIO_HOSTINGER>`. | Pendiente tras paso 3 |
| **8** | **Supabase** | Configurar el SMTP con las credenciales de `no-reply@rebelarte.com` (vía `SUPABASE_SMTP_PASS` + `supabase config push` o vía Dashboard) y activar las plantillas. | Contraseña del buzón `no-reply@rebelarte.com`. | Pendiente tras paso 6 |
