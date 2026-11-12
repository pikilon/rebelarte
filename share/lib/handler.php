<?php
// Lógica del router. reb_handle() devuelve la respuesta como array para poder probarla.
declare(strict_types=1);

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/cache.php';
require_once __DIR__ . '/render.php';

/** Respuesta: ['status'=>int,'headers'=>[...],'body'=>string]. */
function reb_resp(int $status, string $body = '', array $headers = []): array
{
    return ['status' => $status, 'headers' => $headers, 'body' => $body];
}

function reb_serve_index(array $cfg, int $status = 200, array $headers = []): array
{
    $html = @file_get_contents($cfg['INDEX_PATH'] ?? '');
    if ($html === false) {
        return reb_resp(503, 'Servicio no disponible', ['Content-Type' => 'text/plain; charset=utf-8']);
    }
    return reb_resp($status, $html, $headers + ['Content-Type' => 'text/html; charset=utf-8', 'Cache-Control' => 'no-cache']);
}

/** Resuelve la ruta contra Supabase. Devuelve un array cacheable: kind redirect|meta|notfound. */
function reb_resolve(array $cfg, array $r): array
{
    switch ($r['type']) {
        case 'qr_cv':
            $row = reb_first_row(reb_supabase($cfg, 'GET', 'profiles_public?short_id=eq.' . rawurlencode($r['short']) . '&select=alias,lang'));
            if (!$row || !isset($row['alias']) || !preg_match(REB_ALIAS_RE, (string)$row['alias'])) {
                return ['kind' => 'redirect', 'to' => '/'];
            }
            $lang = ($row['lang'] ?? 'es') === 'en' ? 'en' : 'es';
            return ['kind' => 'redirect', 'to' => "/$lang/" . $row['alias']];

        case 'qr_work':
            $row = reb_first_row(reb_supabase($cfg, 'GET', 'works?short_id=eq.' . rawurlencode($r['short']) . '&select=short_id,lang'));
            if (!$row) {
                return ['kind' => 'redirect', 'to' => '/'];
            }
            $lang = ($row['lang'] ?? 'es') === 'en' ? 'en' : 'es';
            return ['kind' => 'redirect', 'to' => "/$lang/obra/" . $r['short']];

        case 'cv':
            return reb_resolve_cv($cfg, $r);

        case 'work':
            return reb_resolve_work($cfg, $r);
    }
    return ['kind' => 'notfound'];
}

function reb_default_image(array $cfg): string
{
    return rtrim($cfg['SITE_URL'], '/') . '/og-default.png';
}

function reb_resolve_cv(array $cfg, array $r): array
{
    $data = reb_supabase($cfg, 'POST', 'rpc/profile_public', ['p_alias' => $r['alias']]);
    $row = reb_first_row($data);
    // Tolerancia: algunas formas devuelven {profile: {...}}
    if ($row && isset($row['profile']) && is_array($row['profile'])) {
        $row = $row['profile'];
    }
    if (!$row || empty($row['display_name'])) {
        return ['kind' => 'notfound'];
    }
    $lang = $r['lang'];
    $origin = (string)($row['lang'] ?? '');
    $name = trim((string)$row['display_name']);
    $desc = reb_trim_text(reb_tr($row['headline'] ?? null, $lang, $origin), 200);
    if ($desc === '') {
        $desc = $lang === 'en' ? 'Artist profile on Rebelarte.' : 'Perfil de artista en Rebelarte.';
    }
    $img = reb_default_image($cfg);
    if (!empty($row['avatar_path']) && is_string($row['avatar_path'])) {
        $img = rtrim($cfg['SUPABASE_URL'], '/') . '/storage/v1/object/public/avatars/' . reb_encode_path($row['avatar_path']);
    }
    $base = '/%s/' . $r['alias'];
    return ['kind' => 'meta', 'meta' => [
        'lang' => $lang, 'path' => sprintf($base, $lang), 'og_type' => 'profile',
        'title' => $name . ' — Rebelarte', 'description' => $desc, 'image' => $img,
        'alt' => ['es' => sprintf($base, 'es'), 'en' => sprintf($base, 'en')],
    ]];
}

function reb_encode_path(string $p): string
{
    return implode('/', array_map('rawurlencode', explode('/', ltrim($p, '/'))));
}

function reb_resolve_work(array $cfg, array $r): array
{
    $short = rawurlencode($r['short']);
    $card = reb_first_row(reb_supabase($cfg, 'GET', "works_cards?short_id=eq.$short"));
    if (!$card) {
        return ['kind' => 'notfound'];
    }
    $w = reb_first_row(reb_supabase($cfg, 'GET', "works?short_id=eq.$short&select=description,lang,video_url")) ?? [];
    $lang = $r['lang'];
    $origin = (string)($w['lang'] ?? $card['lang'] ?? '');

    $title = reb_trim_text(reb_tr($card['title'] ?? null, $lang, $origin), 150);
    if ($title === '') {
        $title = $lang === 'en' ? 'Untitled work' : 'Obra sin título';
    }
    $author = '';
    foreach (['author_name', 'author', 'uploader_name', 'uploader_display_name', 'display_name'] as $k) {
        if (!empty($card[$k]) && is_string($card[$k])) {
            $author = trim($card[$k]);
            break;
        }
    }
    $desc = reb_trim_text(reb_tr($w['description'] ?? null, $lang, $origin), 200);
    if ($desc === '') {
        $branch = !empty($card['branch']) ? reb_tr($card['branch_name'] ?? null, $lang, $origin) : '';
        $desc = $lang === 'en' ? 'A work on Rebelarte' : 'Una obra en Rebelarte';
        if ($author !== '') {
            $desc .= ($lang === 'en' ? ' by ' : ' de ') . $author;
        }
        $desc .= '.';
        unset($branch);
    }

    $img = reb_default_image($cfg);
    $video = (string)($w['video_url'] ?? $card['video_url'] ?? '');
    if (!empty($card['cover_path']) && is_string($card['cover_path'])) {
        $img = rtrim($cfg['SUPABASE_URL'], '/') . '/storage/v1/object/public/images/' . reb_encode_path($card['cover_path']);
    } elseif ($video !== '' && ($yt = reb_youtube_id($video))) {
        $img = "https://i.ytimg.com/vi/$yt/hqdefault.jpg";
    }

    $suffix = $r['slug'] !== '' ? '/' . $r['slug'] : '';
    $base = '/%s/obra/' . $r['short'] . $suffix;
    return ['kind' => 'meta', 'meta' => [
        'lang' => $lang, 'path' => sprintf($base, $lang), 'og_type' => 'article',
        'title' => $title . ($author !== '' ? ' — ' . $author : '') . ' · Rebelarte',
        'description' => $desc, 'image' => $img,
        'alt' => ['es' => sprintf($base, 'es'), 'en' => sprintf($base, 'en')],
    ]];
}

/** Punto de entrada: $cfg puede ser null (sin config) y $uri la REQUEST_URI. */
function reb_handle(?array $cfg, string $uri): array
{
    if ($cfg === null || empty($cfg['SUPABASE_URL']) || empty($cfg['SUPABASE_ANON_KEY']) || empty($cfg['SITE_URL'])) {
        return reb_serve_index($cfg ?? ['INDEX_PATH' => __DIR__ . '/../index.html']);
    }
    $cfg += ['INDEX_PATH' => dirname(__DIR__) . '/index.html', 'CACHE_TTL' => 600];

    $path = reb_normalize_path($uri);
    $route = $path === null ? null : reb_route($path);
    if ($route === null) {
        return reb_serve_index($cfg);
    }

    $lang = $route['lang'] ?? '-';
    $cacheState = 'hit';
    $res = reb_cache_get($cfg, $path, $lang);
    if ($res === null) {
        $cacheState = 'miss';
        try {
            $res = reb_resolve($cfg, $route);
        } catch (Throwable $e) {
            // Error o timeout: index.html intacto, sin cachear.
            return reb_serve_index($cfg, 200, ['X-Rebelarte-Cache' => 'miss']);
        }
        reb_cache_put($cfg, $path, $lang, $res, $res['kind'] === 'notfound' ? 60 : (int)$cfg['CACHE_TTL']);
    }
    $h = ['X-Rebelarte-Cache' => $cacheState];

    switch ($res['kind']) {
        case 'redirect':
            return reb_resp(302, '', $h + ['Location' => $res['to'], 'Cache-Control' => 'public, max-age=60']);
        case 'notfound':
            return reb_serve_index($cfg, 404, $h);
        case 'meta':
            $index = reb_serve_index($cfg, 200, $h);
            if ($index['status'] !== 200) {
                return $index;
            }
            $m = $res['meta'] + ['site_url' => $cfg['SITE_URL']];
            $index['body'] = reb_inject_og($index['body'], reb_build_og($m));
            return $index;
    }
    return reb_serve_index($cfg);
}
