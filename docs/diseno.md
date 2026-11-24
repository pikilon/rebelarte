# Diseño de Rebelarte 2.0

Rediseño del 24-11-2026. Parte de los recursos gráficos originales (2007-2011) de la carpeta
`imagenes/finales` del Drive del proyecto: el logo del Atlas, los iconos de rama y las maquetas
de pantallas (`rebelarte_obras`, `mi-rebelarte`, `subir_obra`). Esos archivos **no** están en el
repositorio: aquí solo hay reinterpretaciones nuevas dibujadas en SVG.

## Qué se ha tomado de los originales

| Original | Reinterpretación |
|---|---|
| Logo: figura (Atlas) que sostiene un globo con película, espiral y notas, verde petróleo `#1B5457` | Marca plana en 64×64: brazos, cabeza y piernas en un solo color, globo con película perforada y espiral. Sin degradados. |
| Iconos de rama 40 px: plumilla (plásticas, naranja `#F39200`), páginas (textos, `#0096AE`), máscara (escénicas, `#BD6A9D`), altavoz/disco (sonido, `#849A66`), fotograma con figura (audiovisuales, `#C24546`) | Iconos de línea en rejilla de 24 px (trazo 1,7) y variante «insignia» (cuadrado redondeado de color con icono blanco). |
| Menú superior de ramas con icono y subcategorías | Franja de ramas fija bajo la cabecera en las páginas públicas. |
| Iconos de «Mi Rebelarte» (preferencias, currículum, mis obras) | `SectionIcon.svelte` para el menú y el resumen de Mi Rebelarte. |
| Lema «Portal para artistas y sus obras» | Subtítulo del logo en el pie (`app.short`). |

## Piezas

- `src/lib/brand.ts`: fuente única del logo (`logoMarkSvg`) y de los iconos de rama (`BRANCH_ICON_PATHS`, `BRANCH_VIVID`).
- `src/lib/components/ui/Logo.svelte`, `BranchIcon.svelte` (`badge` para la insignia), `SectionIcon.svelte`.
- `src/lib/styles/tokens.css`: paleta clara y oscura.
- `scripts/build-marca.mjs` (`npm run build:marca`): genera `static/favicon.svg`, `static/og-default.png` (necesita `rsvg-convert`) y los SVG sueltos de `static/marca/`. Sustituye al antiguo `share/tools/make-og-default.php`.

## Paleta

- Marca: verde petróleo `#1B5457` (claro) / `#6FD0C4` (oscuro). Es también `--accent`.
- Fondo papel `#F7F5F0`, superficies blancas, líneas `#DDE3DF`. Modo oscuro sobre `#0B1615`.
- Cada rama tiene dos tonos: `--rama-<id>` para texto (AA, ≥4,5:1 sobre el fondo) y `--rama-<id>-vivid` para fondos de insignia con icono blanco (≥3:1).

## Tipografía

- Titulares: Bricolage Grotesque (Google Fonts), heredera de la palo seco condensada del logo original.
- Interfaz: Inter.
