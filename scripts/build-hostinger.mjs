// Compila y ensambla el paquete listo para desplegar en Hostinger (public_html).
// Combina la SPA estática (build/) con la capa PHP de share/ (.htaccess, index.php, lib/, config.example.php).
import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";

const buildDir = new URL("../build/", import.meta.url);
const shareDir = new URL("../share/", import.meta.url);
const outDir = new URL("../build-hostinger/", import.meta.url);

// 1. Comprobar que la SPA está compilada
let indexHtml;
try {
  indexHtml = await readFile(new URL("index.html", buildDir), "utf8");
} catch {
  console.error("Error: no existe build/index.html. Ejecuta antes 'npm run build'.");
  process.exit(1);
}

for (const tag of ["<!--OG-->", "<!--/OG-->", "<!doctype html>"]) {
  if (!indexHtml.includes(tag)) {
    console.error(`Error: build/index.html no contiene la marca requerida ${tag}`);
    process.exit(1);
  }
}

// 2. Limpiar y recrear build-hostinger/
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// 3. Copiar la SPA compilada
await cp(buildDir, outDir, { recursive: true });

// 4. Copiar la capa PHP (solo lo necesario para producción)
const phpFiles = [
  "index.php",
  ".htaccess",
  "config.example.php"
];

for (const file of phpFiles) {
  await cp(new URL(file, shareDir), new URL(file, outDir));
}

// Copiar carpeta lib/ recursiva
await cp(new URL("lib/", shareDir), new URL("lib/", outDir), { recursive: true });

// Crear carpeta cache/ para las respuestas cacheadas de PHP
await mkdir(new URL("cache/", outDir), { recursive: true });

// 5. Validaciones finales
const requiredFiles = [
  "index.html",
  "index.php",
  ".htaccess",
  "config.example.php",
  "og-default.png",
  "favicon.svg",
  "lib/handler.php",
  "lib/render.php",
  "lib/http.php",
  "lib/cache.php",
  "lib/util.php"
];

for (const rel of requiredFiles) {
  try {
    const s = await stat(new URL(rel, outDir));
    if (s.size === 0) {
      throw new Error(`El archivo ${rel} está vacío`);
    }
  } catch (err) {
    console.error(`Error de validación: falta ${rel} en build-hostinger/:`, err.message);
    process.exit(1);
  }
}

const htaccessContent = await readFile(new URL(".htaccess", outDir), "utf8");
if (!htaccessContent.includes("RewriteEngine On") || !htaccessContent.includes("index.php")) {
  console.error("Error: .htaccess no contiene las reglas esperadas.");
  process.exit(1);
}

console.log("✓ Paquete Hostinger generado con éxito en build-hostinger/");
console.log("  Contenido listo para subir a public_html en Hostinger:");
console.log("  - SPA SvelteKit (index.html, _app/, assets)");
console.log("  - Capa PHP y router (index.php, lib/)");
console.log("  - Reglas Apache y seguridad (.htaccess)");
console.log("  - Directorio cache/ creado");
console.log("  - Plantilla config.example.php");
console.log("");
console.log("  Recuerda en el servidor: copiar config.example.php a config.php y configurar permisos en cache/.");
