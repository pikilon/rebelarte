<?php
// Construcción del bloque OG y sustitución en index.html.
declare(strict_types=1);

/** Construye el HTML del bloque <!--OG--> a partir de datos ya validados (sin escapar). */
function reb_build_og(array $m): string
{
    $site = rtrim($m['site_url'], '/');
    $lang = $m['lang'];
    $locale = $lang === 'en' ? 'en_GB' : 'es_ES';
    $other = $lang === 'en' ? 'es_ES' : 'en_GB';
    $url = $site . $m['path'];
    $title = $m['title'];
    $desc = $m['description'];
    $image = $m['image'];
    $e = 'reb_e';

    $l = [];
    $l[] = '<title>' . $e($title) . '</title>';
    $l[] = '<meta name="description" content="' . $e($desc) . '" />';
    $l[] = '<link rel="canonical" href="' . $e($url) . '" />';
    foreach (['es', 'en'] as $h) {
        $l[] = '<link rel="alternate" hreflang="' . $h . '" href="' . $e($site . $m['alt'][$h]) . '" />';
    }
    $l[] = '<meta property="og:site_name" content="Rebelarte" />';
    $l[] = '<meta property="og:type" content="' . $e($m['og_type']) . '" />';
    $l[] = '<meta property="og:title" content="' . $e($title) . '" />';
    $l[] = '<meta property="og:description" content="' . $e($desc) . '" />';
    $l[] = '<meta property="og:url" content="' . $e($url) . '" />';
    $l[] = '<meta property="og:image" content="' . $e($image) . '" />';
    $l[] = '<meta property="og:locale" content="' . $locale . '" />';
    $l[] = '<meta property="og:locale:alternate" content="' . $other . '" />';
    $l[] = '<meta name="twitter:card" content="summary_large_image" />';
    $l[] = '<meta name="twitter:title" content="' . $e($title) . '" />';
    $l[] = '<meta name="twitter:description" content="' . $e($desc) . '" />';
    $l[] = '<meta name="twitter:image" content="' . $e($image) . '" />';
    return "    <!--OG-->\n    " . implode("\n    ", $l) . "\n    <!--/OG-->";
}

/** Sustituye el bloque OG; si no existe, devuelve el HTML tal cual. */
function reb_inject_og(string $html, string $og): string
{
    $out = preg_replace_callback('/[ \t]*<!--OG-->.*?<!--\/OG-->/s', fn() => $og, $html, 1, $n);
    return ($out === null || $n === 0) ? $html : $out;
}
