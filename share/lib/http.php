<?php
// Cliente mínimo de Supabase REST (cURL o, si no hay, stream context). Lanza RuntimeException ante cualquier fallo.
declare(strict_types=1);

function reb_supabase(array $cfg, string $method, string $endpoint, ?array $body = null)
{
    $url = rtrim($cfg['SUPABASE_URL'], '/') . '/rest/v1/' . $endpoint;
    $timeout = (float)($cfg['HTTP_TIMEOUT'] ?? 2);
    $headers = [
        'apikey: ' . $cfg['SUPABASE_ANON_KEY'],
        'Authorization: Bearer ' . $cfg['SUPABASE_ANON_KEY'],
        'Accept: application/json',
    ];
    $payload = null;
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT_MS => (int)($timeout * 1000),
            CURLOPT_TIMEOUT_MS => (int)($timeout * 1000),
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        if ($payload !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        }
        $raw = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) {
            throw new RuntimeException('cURL: ' . $err);
        }
    } else {
        $ctx = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $payload ?? '',
            'timeout' => $timeout,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) {
            throw new RuntimeException('stream: sin respuesta');
        }
        $code = 0;
        foreach (($http_response_header ?? []) as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
                $code = (int)$m[1];
            }
        }
    }
    if ($code < 200 || $code >= 300) {
        throw new RuntimeException('Supabase HTTP ' . $code);
    }
    $data = json_decode($raw, true);
    if ($data === null && trim($raw) !== 'null' && trim($raw) !== '') {
        throw new RuntimeException('JSON inválido');
    }
    return $data;
}

/** Primera fila de una respuesta REST (lista de filas, objeto único o null). */
function reb_first_row($data): ?array
{
    if (!is_array($data) || $data === []) {
        return null;
    }
    if (array_is_list($data)) {
        return is_array($data[0]) ? $data[0] : null;
    }
    return $data;
}
