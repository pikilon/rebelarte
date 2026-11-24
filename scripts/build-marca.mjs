// Genera los recursos de marca estáticos a partir de src/lib/brand.ts:
//   static/favicon.svg, static/marca/*.svg y static/og-default.png (1200×630).
// Uso: node scripts/build-marca.mjs  (necesita Node ≥ 23 y, para el PNG, rsvg-convert).
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BRANCH_ICON_PATHS, BRANCH_VIVID, BRAND_COLOR, logoMarkSvg } from '../src/lib/brand.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => join(root, 'static', p);
mkdirSync(out('marca'), { recursive: true });

const BG = '#f7f5f0';
const svg = (vb, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>${body}</svg>\n`;

// Logo (marca sola) en color y en blanco.
writeFileSync(out('marca/rebelarte-logo.svg'), svg('0 0 64 64', logoMarkSvg(BRAND_COLOR, '#ffffff', '#ffffff')));
writeFileSync(out('marca/rebelarte-logo-blanco.svg'), svg('0 0 64 64', logoMarkSvg('#ffffff', BRAND_COLOR, BRAND_COLOR)));

// Favicon: marca blanca sobre cuadrado redondeado verde petróleo.
writeFileSync(
  out('favicon.svg'),
  svg('0 0 64 64', `<rect width="64" height="64" rx="14" fill="${BRAND_COLOR}"/><g transform="translate(6 5) scale(.81)">${logoMarkSvg('#ffffff', BRAND_COLOR, BRAND_COLOR)}</g>`)
);

// Iconos de rama: trazo (currentColor) e insignia de color.
const badge = (b, x = 0, y = 0, s = 48) =>
  `<g transform="translate(${x} ${y})"><rect width="${s}" height="${s}" rx="${s * 0.3}" fill="${BRANCH_VIVID[b]}"/>` +
  `<g transform="translate(${s * 0.19} ${s * 0.19}) scale(${(s * 0.62) / 24})" fill="none" stroke="#fff" color="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${BRANCH_ICON_PATHS[b]}</g></g>`;
for (const [b, paths] of Object.entries(BRANCH_ICON_PATHS)) {
  writeFileSync(
    out(`marca/rama-${b}.svg`),
    svg('0 0 24 24', paths, ` fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"`)
  );
  writeFileSync(out(`marca/rama-${b}-insignia.svg`), svg('0 0 48 48', badge(b)));
}

// Imagen OG por defecto.
const branches = Object.keys(BRANCH_ICON_PATHS);
const og = svg(
  '0 0 1200 630',
  `<rect width="1200" height="630" fill="${BG}"/>` +
    `<circle cx="1010" cy="90" r="320" fill="${BRAND_COLOR}" opacity=".07"/>` +
    `<g transform="translate(96 150) scale(4.6)">${logoMarkSvg(BRAND_COLOR, '#ffffff', BG)}</g>` +
    `<text x="440" y="290" font-family="Adwaita Sans, Inter, Liberation Sans, sans-serif" font-weight="800" font-size="128" letter-spacing="-5" fill="#0f1f1e">Rebelarte</text>` +
    `<text x="444" y="350" font-family="Adwaita Sans, Inter, Liberation Sans, sans-serif" font-weight="500" font-size="32" fill="#5b6b69">Portal gratuito de artistas y sus obras</text>` +
    branches.map((b, i) => badge(b, 444 + i * 92, 410, 72)).join('') +
    `<rect y="612" width="1200" height="18" fill="${BRAND_COLOR}"/>`
);
const ogSvg = out('marca/og-default.svg');
writeFileSync(ogSvg, og);
try {
  execFileSync('rsvg-convert', ['-w', '1200', '-h', '630', ogSvg, '-o', out('og-default.png')]);
  console.log('og-default.png generado');
} catch {
  console.warn('rsvg-convert no disponible: og-default.png no se ha regenerado');
}
console.log('Marca generada en static/');
