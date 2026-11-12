<?php
// Copia este archivo a config.php (no se versiona) y ajusta los valores.
return [
    'SUPABASE_URL'      => 'https://TU-PROYECTO.supabase.co',
    'SUPABASE_ANON_KEY' => 'sb_publishable_…', // clave publicable (o la anon antigua)
    'SITE_URL'          => 'https://rebelarte.com',
    'CACHE_TTL'         => 600,                 // segundos
    'INDEX_PATH'        => __DIR__ . '/index.html',
    // Opcionales:
    // 'CACHE_DIR'      => __DIR__ . '/cache',
    // 'HTTP_TIMEOUT'   => 2,                   // segundos
];
