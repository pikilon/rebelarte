# Base de datos de Rebelarte (Supabase)

Migraciones SQL, semilla y pruebas. Contrato: `docs/arquitectura.md` §4 y `src/lib/types.ts`.

```
migrations/   SQL numerado (01 catálogos … 14 advisors)
templates/    plantillas de correo de Auth (magic_link, confirmation, email_change)
config.toml   configuración de Auth para `supabase config push`
seed.sql      catálogos (ramas, categorías, cargos, licencias); idempotente
seed-demo.sql datos ficticios para desarrollo local (opcional)
tests/        run.sh, stubs.sql, helpers.sql y *.test.sql
```

## Aplicar a un proyecto Supabase

Con la CLI (`supabase link --project-ref <ref>` una vez):

```bash
supabase db push                         # aplica supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed.sql   # o pegar seed.sql en el SQL editor
```

`db push` no ejecuta `seed.sql` en remoto: **hay que lanzarlo a mano una vez**
(sin él no hay ramas, cargos ni licencias y no se pueden crear obras). Sin CLI,
pega cada migración en orden en el SQL editor y después `seed.sql`.

Moderadores y administradores se asignan por SQL (no hay RPC):
`update public.profiles set role = 'admin' where alias = 'tu-alias';`

## Auth sin contraseña (Email OTP)

En *Authentication*:

1. **Providers → Email**: activar; desactivar *Confirm email* no hace falta. Con
   OTP no se usan contraseñas: la app solo llama a `signInWithOtp`.
   Si quieres cerrar la vía de contraseña, desactiva el registro con contraseña
   (la API de `signUp` con contraseña) y no ofrezcas el formulario.
2. **Email Templates → Magic Link** (y *Confirm signup*): incluir ambos, enlace
   y código de 6 dígitos:
   ```html
   <h2>Entra en Rebelarte</h2>
   <p><a href="{{ .ConfirmationURL }}">Entrar</a></p>
   <p>O introduce este código: <strong>{{ .Token }}</strong></p>
   ```
3. **URL Configuration**: *Site URL* `https://rebelarte.com`; *Redirect URLs*:
   `https://rebelarte.com/**`, `http://localhost:5173/**` (desarrollo).
4. Longitud del OTP: 6 (por defecto). Revisa el límite de correos por hora.

## Storage

La migración 09 crea los buckets `images`, `docs`, `audio` y `avatars` (públicos,
con límites de tamaño y tipo) y las políticas: solo se escribe en `<uid>/…`.
Los archivos de un adjunto borrado o retirado por moderación no se eliminan solos:
bórralos con la API de Storage.

## Pruebas

```bash
npm run test:db     # = bash supabase/tests/run.sh
```

Levanta un Postgres 16 temporal (`/usr/lib/postgresql/16/bin`, o `PGBIN=...`;
como root usa el usuario `postgres`), carga `tests/stubs.sql` (imita roles, `auth`
y `storage` de Supabase), aplica migraciones y seeds y ejecuta `tests/*.test.sql`
(cada fichero en una transacción que se revierte). Sale con código distinto de 0
si algo falla; `VERBOSE=1` muestra todas las aserciones.

## Estado del proyecto remoto (12-11-2026)

- Proyecto `jwuqsqwbkfggrycpburv` (eu-west-3), reseteado con `supabase db reset --linked` y las 14 migraciones + `seed.sql`.
- **SMTP y plantillas de correo**: activados con `no-reply@rebelarte.com` (`smtp.hostinger.com:465`) y subidos con `SUPABASE_SMTP_PASS=... npx supabase config push`. Los correos incluyen tanto el enlace mágico como el código OTP de 6 dígitos (`supabase/templates/`).
- **Advisors**: la migración 14 corrige `search_path`, funciones de trigger expuestas, `auth.uid()` en políticas RLS,
  políticas permisivas duplicadas e índices de claves foráneas. Quedan, por diseño: las vistas `profiles_public` y
  `works_cards` (SECURITY DEFINER para exponer solo columnas públicas), las funciones `is_*` y las RPC públicas
  ejecutables por `anon`/`authenticated` (las usan las políticas RLS y la app) y los índices «sin uso» (aún no hay tráfico).
- Borrar un usuario de `auth.users` elimina en cascada perfil, obras y participaciones, pero **no** sus archivos de Storage
  (Supabase prohíbe borrarlos por SQL): hay que eliminarlos con la API de Storage o con
  `npx supabase storage rm --experimental --remote ss:///<bucket>/<ruta>` (en la CLI v3 `--linked` está obsoleto; usa `--remote`).
  Los 4 archivos huérfanos de las pruebas E2E se borraron el 12-11-2026; Storage quedó vacío.
- `test:db` necesita Postgres 16 local; sin él: `docker run --rm -v "$PWD":/repo -w /repo postgres:16 bash -c "apt-get update -qq && apt-get install -y -qq python3 && bash supabase/tests/run.sh"`.
