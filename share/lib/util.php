<?php
// Utilidades puras de la capa PHP de Rebelarte.
declare(strict_types=1);

const REB_RESERVED = ['buscar', 'rama', 'obra', 'entrar', 'mi', 'moderacion', 'legal', 'admin', 'api',
    'c', 'o', 'es', 'en', 'static', '_app', 'share'];
const REB_ALIAS_RE = '/^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/';

function reb_e(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Texto traducible {es,en}: idioma pedido, luego el de origen, luego cualquiera. */
function reb_tr($v, string $lang, string $origin = ''): string
{
    if (is_string($v)) {
        return trim($v);
    }
    if (!is_array($v)) {
        return '';
    }
    foreach ([$lang, $origin, 'es', 'en'] as $k) {
        if ($k !== '' && isset($v[$k]) && is_string($v[$k]) && trim($v[$k]) !== '') {
            return trim($v[$k]);
        }
    }
    foreach ($v as $x) {
        if (is_string($x) && trim($x) !== '') {
            return trim($x);
        }
    }
    return '';
}

/** Recorta a $max caracteres (multibyte) añadiendo «…» y colapsa espacios. */
function reb_trim_text(string $s, int $max = 200): string
{
    $s = trim((string)preg_replace('/\s+/u', ' ', strip_tags($s)));
    if (mb_strlen($s) <= $max) {
        return $s;
    }
    return rtrim(mb_substr($s, 0, $max - 1)) . '…';
}

/** Ruta normalizada o null si no es segura. */
function reb_normalize_path(string $uri): ?string
{
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        return null;
    }
    $path = rawurldecode($path);
    if (preg_match('/[^\x21-\x7e]/', $path)) {
        return null;
    }
    $path = preg_replace('#/+#', '/', $path);
    if (strlen($path) > 1) {
        $path = rtrim($path, '/');
    }
    return $path === '' ? '/' : $path;
}

/**
 * Clasifica la ruta. Devuelve ['type'=>'qr_cv|qr_work|cv|work', ...] o null.
 */
function reb_route(string $path): ?array
{
    if (preg_match('#^/c/([A-Za-z0-9]{1,16})$#', $path, $m)) {
        return ['type' => 'qr_cv', 'short' => $m[1]];
    }
    if (preg_match('#^/o/([A-Za-z0-9]{1,16})$#', $path, $m)) {
        return ['type' => 'qr_work', 'short' => $m[1]];
    }
    if (preg_match('#^/(es|en)/obra/([A-Za-z0-9]{1,16})(?:/([a-z0-9-]{1,80}))?$#', $path, $m)) {
        return ['type' => 'work', 'lang' => $m[1], 'short' => $m[2], 'slug' => $m[3] ?? ''];
    }
    if (preg_match('#^/(es|en)/([a-z0-9-]{3,30})$#', $path, $m)
        && preg_match(REB_ALIAS_RE, $m[2]) && !in_array($m[2], REB_RESERVED, true)) {
        return ['type' => 'cv', 'lang' => $m[1], 'alias' => $m[2]];
    }
    return null;
}

/** Id de vídeo de YouTube o null. */
function reb_youtube_id(string $url): ?string
{
    if (preg_match('#^https?://(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:[^\#]*&)?v=|embed/|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})#', $url, $m)) {
        return $m[1];
    }
    return null;
}
