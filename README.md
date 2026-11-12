# Rebelarte

Portal gratuito para promocionar a artistas y sus obras. Este repositorio contiene la reconstrucción del proyecto desde cero.

Ahora mismo solo publica una página «en construcción» en [rebelarte.com](https://rebelarte.com).

- [especificacion-funcional.md](especificacion-funcional.md): especificación vigente (borrador).
- [AGENTS.md](AGENTS.md): instrucciones para agentes de IA.

## Desarrollo

La aplicación (SPA SvelteKit + Supabase + capa PHP) está descrita en [docs/arquitectura.md](docs/arquitectura.md).

```bash
npm install
cp .env.example .env   # rellena PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

Comprobaciones:

```bash
npm run check      # tipos y Svelte
npm run test       # pruebas unitarias (vitest)
npm run test:db    # migraciones, RLS y RPC sobre Postgres 16 local
npm run test:php   # capa PHP de vistas previas y QR
npm run build      # SPA en build/
```

- Base de datos: [supabase/README.md](supabase/README.md).
- Despliegue en Hostinger (build/ + share/): [share/README.md](share/README.md).
- `npm run build:construccion` genera la página provisional en `dist/` (la que publica el CI).

## Publicación

Cada push a `main` lanza [.github/workflows/deploy.yml](.github/workflows/deploy.yml), que compila y publica `dist/` en GitHub Pages con el dominio `rebelarte.com`.
