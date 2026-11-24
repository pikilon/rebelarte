<?php
// Router de Rebelarte: redirección de QR y metadatos Open Graph para compartir.
declare(strict_types=1);

require __DIR__ . '/lib/handler.php';

$configFile = getenv('REBELARTE_CONFIG') ?: __DIR__ . '/config.php';
$cfg = null;
if (is_file($configFile)) {
    try {
        $c = require $configFile;
        $cfg = is_array($c) ? $c : null;
    } catch (Throwable $e) {
        $cfg = null;
    }
}
if ($cfg !== null && empty($cfg['INDEX_PATH'])) {
    $cfg['INDEX_PATH'] = __DIR__ . '/index.html';
}

try {
    $res = reb_handle($cfg, $_SERVER['REQUEST_URI'] ?? '/');
} catch (Throwable $e) {
    $res = reb_serve_index($cfg ?? ['INDEX_PATH' => __DIR__ . '/index.html']);
}

http_response_code($res['status']);
foreach ($res['headers'] as $k => $v) {
    header("$k: $v");
}
echo $res['body'];
