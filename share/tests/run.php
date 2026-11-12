<?php
// Pruebas de la capa PHP, sin dependencias. Uso: php share/tests/run.php
// Levanta un Supabase falso y el propio index.php con php -S y comprueba el comportamiento por HTTP.
declare(strict_types=1);

$root = dirname(__DIR__);
$tmp = sys_get_temp_dir() . '/rebelarte-test-' . bin2hex(random_bytes(4));
mkdir($tmp . '/cache', 0755, true);
$fails = 0; $total = 0; $procs = [];

function check(string $name, bool $ok, string $detail = ''): void
{
    global $fails, $total;
    $total++;
    if (!$ok) { $fails++; }
    echo ($ok ? '  ok   ' : '  FALLA ') . $name . ($ok || $detail === '' ? '' : "\n         $detail") . "\n";
}

function free_port(): int
{
    $s = stream_socket_server('tcp://127.0.0.1:0', $en, $es);
    $p = (int)substr(strrchr(stream_socket_get_name($s, false), ':'), 1);
    fclose($s);
    return $p;
}

function start_server(int $port, string $docroot, string $router, array $env): mixed
{
    global $procs;
    $cmd = [PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $docroot, $router];
    $p = proc_open($cmd, [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $docroot,
        $env + ['PHP_CLI_SERVER_WORKERS' => '4'] + getenv());
    $procs[] = $p;
    for ($i = 0; $i < 50; $i++) {
        $c = @fsockopen('127.0.0.1', $port, $en, $es, 0.2);
        if ($c) { fclose($c); return $p; }
        usleep(100000);
    }
    throw new RuntimeException("No arranca el servidor en $port");
}

/** GET sin seguir redirecciones. Devuelve [status, headers(minúsculas), body]. */
function get(int $port, string $path, float $timeout = 10): array
{
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'follow_location' => 0, 'ignore_errors' => true,
        'timeout' => $timeout, 'header' => "User-Agent: facebookexternalhit/1.1\r\n"]]);
    $body = @file_get_contents("http://127.0.0.1:$port$path", false, $ctx);
    $status = 0; $h = [];
    foreach (($http_response_header ?? []) as $line) {
        if (preg_match('#^HTTP/\S+ (\d{3})#', $line, $m)) { $status = (int)$m[1]; }
        elseif (str_contains($line, ':')) { [$k, $v] = explode(':', $line, 2); $h[strtolower(trim($k))] = trim($v); }
    }
    return [$status, $h, (string)$body];
}

// --- Supabase falso ---
file_put_contents("$tmp/fake.php", <<<'PHP'
<?php
$uri = $_SERVER['REQUEST_URI'];
file_put_contents(getenv('FAKE_LOG'), $uri . "\n", FILE_APPEND | LOCK_EX);
$auth = $_SERVER['HTTP_APIKEY'] ?? '';
if ($auth !== 'anon-test' || ($_SERVER['HTTP_AUTHORIZATION'] ?? '') !== 'Bearer anon-test') { http_response_code(401); echo '{}'; return; }
header('Content-Type: application/json');
$q = parse_url($uri, PHP_URL_QUERY) ?? ''; parse_str($q, $p);
$path = parse_url($uri, PHP_URL_PATH);
$sid = preg_replace('/^eq\./', '', $p['short_id'] ?? '');
$out = [];
if ($path === '/rest/v1/profiles_public') {
    if ($sid === 'cvEn0001') $out = [['alias' => 'ana-lopez', 'lang' => 'en']];
    if ($sid === 'cvEs0001') $out = [['alias' => 'rosa-vega', 'lang' => 'es']];
} elseif ($path === '/rest/v1/works' && str_contains($p['select'] ?? '', 'short_id,lang')) {
    if ($sid === 'obra0001') $out = [['short_id' => 'obra0001', 'lang' => 'es']];
} elseif ($path === '/rest/v1/works') {
    $s = $sid;
    if ($s === 'obra0001') $out = [['description' => ['es' => str_repeat('Óleo sobre lienzo. ', 30)], 'lang' => 'es', 'video_url' => null]];
    if ($s === 'obra0002') $out = [['description' => ['es' => 'Corto'], 'lang' => 'es', 'video_url' => 'https://youtu.be/dQw4w9WgXcQ']];
    if ($s === 'obra0003') $out = [['description' => ['es' => 'x'], 'lang' => 'es', 'video_url' => null]];
} elseif ($path === '/rest/v1/works_cards') {
    $s = $sid;
    if ($s === 'obra0001') $out = [['short_id' => $s, 'title' => ['es' => 'Mar de <i>"noche"</i>'], 'author_name' => 'Ana López', 'branch' => 'plasticas', 'cover_path' => 'u1/w1/a b.webp']];
    if ($s === 'obra0002') $out = [['short_id' => $s, 'title' => ['es' => 'Vídeo'], 'author_name' => 'Rosa Vega', 'branch' => 'audiovisuales', 'cover_path' => null]];
    if ($s === 'obra0003') $out = [['short_id' => $s, 'title' => ['es' => 'Sin portada'], 'author_name' => 'Rosa Vega', 'branch' => 'textos', 'cover_path' => null]];
} elseif ($path === '/rest/v1/rpc/profile_public') {
    $a = json_decode(file_get_contents('php://input'), true)['p_alias'] ?? '';
    if ($a === 'lento') { sleep(6); }
    if ($a === 'ana-lopez') $out = ['alias' => 'ana-lopez', 'display_name' => 'Ana López', 'lang' => 'es', 'headline' => ['es' => 'Pintora y grabadora'], 'avatar_path' => 'u1/avatar.webp'];
    if ($a === 'xss-guy') $out = ['alias' => 'xss-guy', 'display_name' => '<script>alert(1)</script>', 'lang' => 'es', 'headline' => ['es' => '"><b>hola</b>']];
    if ($a === 'solo-en') $out = ['alias' => 'solo-en', 'display_name' => 'Only EN', 'lang' => 'en', 'headline' => ['en' => 'Sculptor']];
    if ($out === []) { echo 'null'; return; }
    echo json_encode($out); return;
}
echo json_encode($out);
PHP);

$indexHtml = "<!doctype html><html><head>\n    <!--OG-->\n    <title>Rebelarte</title>\n    <meta property=\"og:title\" content=\"Rebelarte\" />\n    <!--/OG-->\n    <script>boot()</script></head><body>SPA</body></html>\n";
file_put_contents("$tmp/index.html", $indexHtml);

$fakePort = free_port();
$appPort = free_port();
$deadPort = free_port();
$log = "$tmp/fake.log"; touch($log);
start_server($fakePort, $tmp, "$tmp/fake.php", ['FAKE_LOG' => $log]);

function write_config(string $file, string $supabase, string $cacheDir, string $index, int $ttl = 600): void
{
    file_put_contents($file, "<?php return " . var_export([
        'SUPABASE_URL' => $supabase, 'SUPABASE_ANON_KEY' => 'anon-test', 'SITE_URL' => 'https://rebelarte.test',
        'CACHE_TTL' => $ttl, 'INDEX_PATH' => $index, 'CACHE_DIR' => $cacheDir,
    ], true) . ";\n");
}
write_config("$tmp/config.php", "http://127.0.0.1:$fakePort", "$tmp/cache", "$tmp/index.html");
start_server($appPort, $root, "$root/index.php", ['REBELARTE_CONFIG' => "$tmp/config.php"]);

$hits = fn() => count(array_filter(explode("\n", (string)file_get_contents($log))));

try {
    echo "Redirecciones QR\n";
    [$s, $h] = get($appPort, '/c/cvEn0001');
    check('/c/<short> -> 302 /en/ana-lopez', $s === 302 && ($h['location'] ?? '') === '/en/ana-lopez', "$s " . ($h['location'] ?? ''));
    [$s, $h] = get($appPort, '/c/noexiste');
    check('/c/<inexistente> -> 302 /', $s === 302 && ($h['location'] ?? '') === '/');
    [$s, $h] = get($appPort, '/o/obra0001');
    check('/o/<short> -> 302 /es/obra/obra0001', $s === 302 && ($h['location'] ?? '') === '/es/obra/obra0001', ($h['location'] ?? ''));
    [$s, $h] = get($appPort, '/o/zzzz');
    check('/o/<inexistente> -> 302 /', $s === 302 && ($h['location'] ?? '') === '/');

    echo "Meta de CV\n";
    [$s, $h, $b] = get($appPort, '/es/ana-lopez');
    check('CV 200', $s === 200);
    check('título', str_contains($b, '<meta property="og:title" content="Ana López — Rebelarte" />'));
    check('descripción headline', str_contains($b, 'content="Pintora y grabadora"'));
    check('imagen avatar', str_contains($b, 'http://127.0.0.1:' . $fakePort . '/storage/v1/object/public/avatars/u1/avatar.webp'));
    check('og:type profile + url canónica', str_contains($b, 'og:type" content="profile"') && str_contains($b, '<link rel="canonical" href="https://rebelarte.test/es/ana-lopez" />'));
    check('hreflang es/en + locale', str_contains($b, 'hreflang="en" href="https://rebelarte.test/en/ana-lopez"') && str_contains($b, 'og:locale" content="es_ES"'));
    check('bloque OG sustituido (una sola og:title) y resto intacto', substr_count($b, 'og:title') === 1 && str_contains($b, '<script>boot()</script>'));
    [$s, $h, $b] = get($appPort, '/en/ana-lopez');
    check('fallback de idioma (en pide, solo hay es)', $s === 200 && str_contains($b, 'content="Pintora y grabadora"') && str_contains($b, 'og:locale" content="en_GB"'));
    [$s, $h, $b] = get($appPort, '/es/solo-en');
    check('fallback al idioma de origen', str_contains($b, 'content="Sculptor"'));
    [$s, $h, $b] = get($appPort, '/es/xss-guy');
    check('escape de <script> en el título', !str_contains($b, '<script>alert(1)') && str_contains($b, '&lt;script&gt;alert(1)&lt;/script&gt; — Rebelarte'));
    check('escape de comillas en descripción', str_contains($b, 'content="&quot;&gt;&lt;b&gt;hola&lt;/b&gt;"') || str_contains($b, '&quot;&gt;'));
    check('imagen por defecto sin avatar', str_contains($b, 'content="https://rebelarte.test/og-default.png"'));

    echo "Meta de obra\n";
    [$s, $h, $b] = get($appPort, '/es/obra/obra0001/mar-de-noche');
    check('obra 200', $s === 200);
    check('título «Título — Autor · Rebelarte» con escape', str_contains($b, 'og:title" content="Mar de &quot;noche&quot; — Ana López · Rebelarte"'), substr($b, 0, 600));
    check('og:type article + twitter:card', str_contains($b, 'og:type" content="article"') && str_contains($b, 'twitter:card" content="summary_large_image"'));
    check('portada codificada', str_contains($b, '/storage/v1/object/public/images/u1/w1/a%20b.webp'));
    preg_match('/og:description" content="([^"]*)"/', $b, $m);
    check('descripción recortada a <=200', isset($m[1]) && mb_strlen(html_entity_decode($m[1])) <= 200 && str_ends_with(html_entity_decode($m[1]), '…'));
    check('canónica con slug', str_contains($b, 'href="https://rebelarte.test/es/obra/obra0001/mar-de-noche"'));
    [$s, $h, $b] = get($appPort, '/en/obra/obra0002/participantes');
    check('miniatura de YouTube', $s === 200 && str_contains($b, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'));
    [$s, $h, $b] = get($appPort, '/es/obra/obra0003');
    check('imagen por defecto en obra', str_contains($b, 'content="https://rebelarte.test/og-default.png"'));

    echo "Sin tocar / 404\n";
    [$s, $h, $b] = get($appPort, '/es/buscar');
    check('alias reservado -> index sin tocar', $s === 200 && $b === $indexHtml);
    [$s, $h, $b] = get($appPort, '/es/mi');
    check('/es/mi -> index sin tocar', $s === 200 && $b === $indexHtml);
    [$s, $h, $b] = get($appPort, '/es/AB<script>');
    check('alias inválido -> index sin tocar', $s === 200 && $b === $indexHtml);
    [$s, $h, $b] = get($appPort, '/');
    check('raíz -> index sin tocar', $s === 200 && $b === $indexHtml);
    [$s, $h, $b] = get($appPort, '/es/no-existe-nadie');
    check('perfil inexistente -> 404 con index', $s === 404 && $b === $indexHtml);
    [$s, $h, $b] = get($appPort, '/es/obra/noexiste1');
    check('obra inexistente -> 404 con index', $s === 404 && $b === $indexHtml);

    echo "Caché\n";
    $before = $hits();
    [$s, $h] = get($appPort, '/es/ana-lopez');
    check('segunda petición: X-Rebelarte-Cache hit', ($h['x-rebelarte-cache'] ?? '') === 'hit', json_encode($h));
    check('sin nuevas llamadas a Supabase', $hits() === $before);
    [$s, $h] = get($appPort, '/es/obra/nuevaobra');
    [$s, $h] = get($appPort, '/es/obra/nuevaobra');
    check('negativa cacheada (hit)', ($h['x-rebelarte-cache'] ?? '') === 'hit' && $s === 404);
    $files = glob("$tmp/cache/*.json");
    check('archivos en cache/ y sin .tmp residuales', count($files) > 0 && !glob("$tmp/cache/*.tmp"));

    echo "Errores de Supabase\n";
    $t = microtime(true);
    [$s, $h, $b] = get($appPort, '/es/lento');
    $dt = microtime(true) - $t;
    check('timeout (<3 s) -> index sin tocar 200', $s === 200 && $b === $indexHtml && $dt < 3, sprintf('%d %.2fs', $s, $dt));

    $deadApp = free_port();
    mkdir("$tmp/cache2");
    write_config("$tmp/config-dead.php", "http://127.0.0.1:$deadPort", "$tmp/cache2", "$tmp/index.html");
    start_server($deadApp, $root, "$root/index.php", ['REBELARTE_CONFIG' => "$tmp/config-dead.php"]);
    $t = microtime(true);
    [$s, $h, $b] = get($deadApp, '/es/ana-lopez');
    check('Supabase caído -> index sin tocar 200 en <3 s', $s === 200 && $b === $indexHtml && (microtime(true) - $t) < 3);
    [$s, $h, $b] = get($deadApp, '/c/cvEn0001');
    check('Supabase caído en /c -> index sin tocar', $s === 200 && $b === $indexHtml);
    check('errores no se cachean', !glob("$tmp/cache2/*.json"));

    $noCfg = free_port();
    start_server($noCfg, $root, "$root/index.php", ['REBELARTE_CONFIG' => "$tmp/no-existe.php"]);
    [$s, $h, $b] = get($noCfg, '/es/ana-lopez');
    check('sin config.php -> index', $s === 503 || $s === 200);
} catch (Throwable $e) {
    $fails++;
    echo 'EXCEPCIÓN: ' . $e->getMessage() . "\n";
} finally {
    foreach ($procs as $p) { proc_terminate($p); }
    exec('rm -rf ' . escapeshellarg($tmp));
}
echo "\n$total comprobaciones, $fails fallos\n";
exit($fails > 0 ? 1 : 0);
