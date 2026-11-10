# Rebelarte

Portal gratuito para promocionar a artistas y sus obras. Este repositorio contiene la reconstrucción del proyecto desde cero.

Ahora mismo solo publica una página «en construcción» en [rebelarte.com](https://rebelarte.com).

- [especificacion-funcional.md](especificacion-funcional.md): especificación vigente (borrador).
- [AGENTS.md](AGENTS.md): instrucciones para agentes de IA.

## Desarrollo

```bash
npm run build
```

Genera `dist/` a partir de `site/`. No hay dependencias.

## Publicación

Cada push a `main` lanza [.github/workflows/deploy.yml](.github/workflows/deploy.yml), que compila y publica `dist/` en GitHub Pages con el dominio `rebelarte.com`.
