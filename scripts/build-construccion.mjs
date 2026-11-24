// Compila la página provisional: copia site/ a dist/ y valida lo mínimo.
// Sin dependencias a propósito: la tecnología del portal aún no está decidida.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const origen = new URL("../site/", import.meta.url);
const destino = new URL("../dist/", import.meta.url);

await rm(destino, { recursive: true, force: true });
await mkdir(destino, { recursive: true });
await cp(origen, destino, { recursive: true });

const html = await readFile(new URL("index.html", destino), "utf8");
for (const requerido of ["<!doctype html>", "<title>", 'lang="es"', "</html>"]) {
  if (!html.includes(requerido)) {
    throw new Error(`index.html no contiene ${requerido}`);
  }
}

// GitHub Pages no debe pasar el sitio por Jekyll.
await writeFile(new URL(".nojekyll", destino), "");

console.log(`Compilado en dist/ (${html.length} bytes de HTML)`);
