// Marca de Rebelarte 2.0: logo e iconos de rama como datos SVG.
// Fuente única para los componentes (Logo, BranchIcon) y para scripts/build-marca.mjs,
// que genera favicon, og-default.png y los SVG sueltos de static/marca/.
// Reinterpretación de los recursos originales de 2007 (carpeta «finales» del Drive):
// Atlas que sostiene un globo con película y espiral; iconos de plumilla, páginas,
// máscara, altavoz y fotograma.
import type { BranchId } from './types';

/** Trazos de 24×24 para usar con stroke="currentColor". */
export const BRANCH_ICON_PATHS: Record<BranchId, string> = {
  plasticas:
    '<path d="M4.5 3.5v6L12 17l7.5-7.5v-6z"/><path d="M7.6 11.8C9 10.6 10.4 10 12 10s3 .6 4.4 1.8L12 16.2z" fill="currentColor" stroke="none"/><path d="M12 19.8v1.2h7.5"/>',
  textos:
    '<path d="M8 3.5h9.5a2 2 0 0 1 2 2V17"/><rect x="4.5" y="6.5" width="12" height="14" rx="2"/><path d="M7.5 10.5h6M7.5 13.5h6M7.5 16.5h4"/>',
  escenicas:
    '<path d="M12 3c3.6 0 7.6 1.6 7.6 1.6s1.2 8.4-1.6 12.4C16.3 19.4 12 21 12 21s-4.3-1.6-6-4c-2.8-4-1.6-12.4-1.6-12.4S8.4 3 12 3z"/><path d="M12 3c3.6 0 7.6 1.6 7.6 1.6s1.2 8.4-1.6 12.4C16.3 19.4 12 21 12 21z" fill="currentColor" fill-opacity=".22" stroke="none"/><path d="M7.3 10.2c.9-1 2.1-1 3 0M13.7 10.2c.9-1 2.1-1 3 0"/><path d="M8.6 13.8h6.8c-.4 2-1.7 3.2-3.4 3.2s-3-1.2-3.4-3.2z" fill="currentColor"/>',
  sonido:
    '<rect x="5" y="3" width="14" height="18" rx="3.5"/><circle cx="12" cy="7.2" r="1.3" fill="currentColor"/><circle cx="12" cy="14.6" r="3.9"/><circle cx="12" cy="14.6" r="1.2" fill="currentColor"/>',
  audiovisuales:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/><circle cx="12" cy="10" r="1.7" fill="currentColor"/><path d="M9.8 16.5v-1.6a2.2 2.2 0 0 1 4.4 0v1.6z" fill="currentColor"/>'
};

/** Colores vivos de rama (fondos de insignia con icono blanco). */
export const BRANCH_VIVID: Record<BranchId, string> = {
  plasticas: '#c87800',
  textos: '#0090a8',
  escenicas: '#b5609a',
  sonido: '#74895a',
  audiovisuales: '#c24546'
};

export const BRAND_COLOR = '#1b5457';

const SPIRAL =
  'M36.1 22.5L36.2 22.7L36.3 22.9L36.2 23.2L36.1 23.5L35.8 23.8L35.5 24.0L35.1 24.0L34.6 24.0L34.1 23.8L33.7 23.5L33.4 23.0L33.2 22.4L33.1 21.8L33.3 21.1L33.6 20.5L34.1 20.0L34.8 19.6L35.6 19.3L36.5 19.3L37.3 19.6L38.1 20.1L38.8 20.8L39.3 21.7L39.5 22.7L39.5 23.8L39.1 24.8L38.5 25.8L37.6 26.6L36.5 27.1L35.2 27.4L33.9 27.3L32.7 26.8L31.5 26.0L30.6 24.9L30.0 23.6L29.8 22.1L29.9 20.6L30.5 19.1L31.5 17.8L32.8 16.8L34.3 16.2L36.0 15.9L37.8 16.1L39.4 16.8L40.9 18.0L42.0 19.5L42.7 21.2L42.9 23.2L42.6 25.1L41.8 27.0L40.5 28.6L38.8 29.8L36.8 30.6L34.7 30.8L32.5 30.4L30.4 29.5';

/**
 * Contenido del logo (viewBox 0 0 64 64). `brand` es el color de la figura,
 * `ink` el de los detalles del globo y `gap` el del aro que separa globo y brazos
 * (normalmente el color de fondo).
 */
export function logoMarkSvg(brand: string, ink: string, gap: string): string {
  return (
    `<path d="M13.5 30C13 44 21 50.5 32 51s19-6.5 18.5-21" fill="none" stroke="${brand}" stroke-width="4" stroke-linecap="round"/>` +
    `<circle cx="32" cy="23" r="19.5" fill="${brand}" stroke="${gap}" stroke-width="2"/>` +
    `<path d="M23.97 34.47A14 14 0 0 1 23.97 11.53" fill="none" stroke="${ink}" stroke-width="5"/>` +
    `<path d="M23.97 34.47A14 14 0 0 1 23.97 11.53" fill="none" stroke="${brand}" stroke-width="2.2" stroke-dasharray="2.3 2.1"/>` +
    `<path d="${SPIRAL}" fill="none" stroke="${ink}" stroke-width="2.3" stroke-linecap="round"/>` +
    `<circle cx="32" cy="46.8" r="3.3" fill="${brand}"/>` +
    `<path d="M26 50.6q6 2 12 0L35.6 56q4.9 3 8.9 8h-7q-3-3.8-5.5-4.6-2.5.8-5.5 4.6h-7q4-5 8.9-8z" fill="${brand}"/>`
  );
}
