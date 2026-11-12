<?php
// Genera og-default.png (1200x630) con GD. Uso: php share/tools/make-og-default.php [ruta-salida]
declare(strict_types=1);

if (!extension_loaded('gd')) {
    fwrite(STDERR, "GD no está disponible: no se puede generar la imagen.\n");
    exit(1);
}
$out = $argv[1] ?? dirname(__DIR__, 2) . '/static/og-default.png';
$W = 1200; $H = 630;

$im = imagecreatetruecolor($W, $H);
imageantialias($im, true);
$bg = imagecolorallocate($im, 0xf6, 0xf1, 0xe7);
$ink = imagecolorallocate($im, 0x1c, 0x1a, 0x17);
$red = imagecolorallocate($im, 0xc8, 0x32, 0x1e);
imagefilledrectangle($im, 0, 0, $W, $H, $bg);
imagefilledrectangle($im, 0, $H - 18, $W, $H, $red);

// Busca una TTF del sistema (preferencia serif).
$ttf = null;
foreach ([
    '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf',
    '/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf',
    '/Library/Fonts/Georgia Bold.ttf',
    '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
    'C:\\Windows\\Fonts\\georgiab.ttf',
] as $f) {
    if (is_file($f)) { $ttf = $f; break; }
}
$ttfSans = null;
foreach ([
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/dejavu/DejaVuSans.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
] as $f) {
    if (is_file($f)) { $ttfSans = $f; break; }
}
$sub = 'Portal gratuito para promocionar a artistas y sus obras';

if ($ttf && function_exists('imagettftext')) {
    $size = 140;
    $b1 = imagettfbbox($size, 0, $ttf, 'rebel');
    $b2 = imagettfbbox($size, 0, $ttf, 'arte');
    $w1 = $b1[2] - $b1[0]; $w2 = $b2[2] - $b2[0];
    $x = (int)(($W - ($w1 + $w2)) / 2);
    $y = 340;
    imagettftext($im, $size, 0, $x, $y, $ink, $ttf, 'rebel');
    imagettftext($im, $size, 0, $x + $w1, $y, $red, $ttf, 'arte');
    $f2 = $ttfSans ?: $ttf;
    $s2 = 27;
    $bb = imagettfbbox($s2, 0, $f2, $sub);
    imagettftext($im, $s2, 0, (int)(($W - ($bb[2] - $bb[0])) / 2), 450, $ink, $f2, $sub);
} else {
    // Respaldo sin TTF: imagestring escalado con imagecopyresized.
    $draw = function (string $text, int $scale, int $color, int $y) use ($im, $W): array {
        $fw = 9; $fh = 15;
        $tw = strlen($text) * $fw; $tmp = imagecreatetruecolor($tw, $fh);
        imagesavealpha($tmp, true);
        $tr = imagecolorallocatealpha($tmp, 0, 0, 0, 127);
        imagefill($tmp, 0, 0, $tr);
        $c = imagecolorallocate($tmp, ($color >> 16) & 255, ($color >> 8) & 255, $color & 255);
        imagestring($tmp, 5, 0, 0, $text, $c);
        $dw = $tw * $scale;
        $dx = (int)(($W - $dw) / 2);
        imagecopyresized($im, $tmp, $dx, $y, 0, 0, $dw, $fh * $scale, $tw, $fh);
        imagedestroy($tmp);
        return [$dx, $dw];
    };
    // «rebelarte» con «arte» en rojo: se dibuja entero en tinta y luego se repinta «arte».
    $scale = 12;
    $total = 9 * 9 * $scale; $dx0 = (int)(($W - $total) / 2);
    $draw('rebel', $scale, 0x1c1a17, 200);
    $tmp = imagecreatetruecolor(4 * 9, 15);
    imagesavealpha($tmp, true);
    imagefill($tmp, 0, 0, imagecolorallocatealpha($tmp, 0, 0, 0, 127));
    imagestring($tmp, 5, 0, 0, 'arte', imagecolorallocate($tmp, 0xc8, 0x32, 0x1e));
    imagecopyresized($im, $tmp, $dx0 + 5 * 9 * $scale, 200, 0, 0, 4 * 9 * $scale, 15 * $scale, 36, 15);
    $draw($sub, 2, 0x1c1a17, 420);
}
@mkdir(dirname($out), 0755, true);
imagepng($im, $out, 9);
imagedestroy($im);
echo "Generado $out\n";
