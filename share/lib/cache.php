<?php
// Caché en disco con escritura atómica.
declare(strict_types=1);

function reb_cache_file(array $cfg, string $path, string $lang): string
{
    $dir = $cfg['CACHE_DIR'] ?? (dirname(__DIR__) . '/cache');
    return rtrim($dir, '/') . '/' . sha1($path . '|' . $lang) . '.json';
}

/** Devuelve el dato cacheado si no ha caducado; null si no. */
function reb_cache_get(array $cfg, string $path, string $lang): ?array
{
    $f = reb_cache_file($cfg, $path, $lang);
    $raw = @file_get_contents($f);
    if ($raw === false) {
        return null;
    }
    $d = json_decode($raw, true);
    if (!is_array($d) || !isset($d['exp'], $d['data']) || $d['exp'] < time()) {
        return null;
    }
    return $d['data'];
}

function reb_cache_put(array $cfg, string $path, string $lang, array $data, int $ttl): void
{
    if ($ttl <= 0) {
        return;
    }
    $f = reb_cache_file($cfg, $path, $lang);
    $dir = dirname($f);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true) && !is_dir($dir)) {
        return;
    }
    $tmp = $f . '.' . bin2hex(random_bytes(4)) . '.tmp';
    if (@file_put_contents($tmp, json_encode(['exp' => time() + $ttl, 'data' => $data]), LOCK_EX) === false) {
        return;
    }
    if (!@rename($tmp, $f)) {
        @unlink($tmp);
    }
}
