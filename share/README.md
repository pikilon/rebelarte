# share/ — capa PHP de Rebelarte

Solo hace dos cosas: redirigir las URL de QR (`/c/<id>`, `/o/<id>`) y inyectar metadatos Open Graph / Twitter en `index.html` para que WhatsApp, Telegram, X, Facebook o Mastodon muestren título y miniatura. Todo lo demás lo sirve Apache (SPA estática). PHP 8.1+, sin Composer. Ante cualquier error sirve `index.html` sin tocar.

## Despliegue en Hostinger

1. En local: `npm run build` (genera `build/`).
2. Sube al `public_html` el **contenido** de `build/` y el **contenido** de `share/` (mismo directorio, de modo que `index.html`, `index.php` y `.htaccess` queden juntos). No hace falta subir `tests/` ni `tools/` (se bloquean por `.htaccess` si se suben).
3. Copia `config.example.php` a `config.php` en el servidor y rellena `SUPABASE_URL`, `SUPABASE_ANON_KEY` (clave anon pública), `SITE_URL` (`https://rebelarte.com`). `config.php` no está en git.
4. Crea `cache/` si no existe y dale permisos de escritura para PHP (755 suele bastar en Hostinger; 775 si no escribe). Está protegido por `.htaccess`.
5. Comprueba que `og-default.png` (de `static/`) llega a la raíz con el build.
6. Tras cada nuevo despliegue de `build/`, la caché (10 min) puede servir metadatos anteriores; el HTML siempre se lee fresco. Para vaciarla: `rm public_html/cache/*.json`.

Si falta `config.php`, la capa PHP se desactiva y se sirve la SPA tal cual.

## Comprobar las vistas previas

```bash
# Como un rastreador (ver bloque OG inyectado y cabecera de caché)
curl -sI -A "facebookexternalhit/1.1" https://rebelarte.com/es/<alias> | grep -i -E "^HTTP|x-rebelarte"
curl -s  -A "facebookexternalhit/1.1" https://rebelarte.com/es/<alias> | sed -n '/<!--OG-->/,/<!--\/OG-->/p'
# QR
curl -sI https://rebelarte.com/c/<short_id> | grep -i -E "^HTTP|location"
```

Depuradores: [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/), [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/). Usa «Scrape again» tras cambios; WhatsApp y Telegram cachean por su cuenta.

## Pruebas

`npm run test:php` (o `php share/tests/run.php`). Levanta un Supabase falso y el router con `php -S`; no toca red externa ni `cache/` real.

## Contrato asumido con Supabase

- `profiles_public`: `alias`, `lang`, filtrable por `short_id`.
- `rpc/profile_public` (POST `{"p_alias"}`): objeto o fila con `display_name`, `lang`, `headline` (jsonb), `avatar_path`; `null` o vacío si no existe.
- `works_cards`: `title` (jsonb o texto), `author_name` (también acepta `author`, `uploader_name`, `display_name`), `cover_path`; `works`: `description`, `lang`, `video_url`.
