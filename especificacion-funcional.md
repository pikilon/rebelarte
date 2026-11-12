# Rebelarte 2.0 — Especificación funcional (borrador v0.1)

Estado: borrador v0.2. Los puntos de la sección 10 tienen una **decisión provisional** (12-11-2026), revisable antes del lanzamiento. El diseño técnico está en [docs/arquitectura.md](docs/arquitectura.md).

## 1. Usuarios y roles

- **Acceso sin contraseña**: el registro y la entrada se hacen solo con correo (enlace mágico o código de un solo uso). La cuenta se crea en la primera entrada.

- **Visitante**: ve obras, CVs y buscador. Puede contactar con un autor si el autor lo permite (ver §8).
- **Autor**: tiene cuenta, alias único y CV. Puede subir obras y solicitar o aceptar participaciones.
- **Subidor**: autor que dio de alta una obra. Edita sus datos y gestiona las participaciones.
- **Moderador / administrador**: revisa denuncias, valida cargos y premios si se decide validarlos, y gestiona catálogos.

Cada campo del CV tiene visibilidad propia: público, solo usuarios registrados, o privado.

## 2. Obras

- Tipo por rama: plásticas, textos, escénicas, sonido, audiovisuales.
- Categoría dentro de la rama (cortos, videoclips, novela, poesía…).
- Campos comunes: título, descripción, palabras clave, lugar y fecha de creación, idioma de la obra, licencia, visibilidad (pública, no listada o privada), precio orientativo opcional (ver §8).
- Campos específicos por rama (fijados por la especificación original): técnica (plásticas); páginas (textos); duración, canales de sonido y formato de grabación (audiovisuales y sonido); relación de aspecto (audiovisuales).
- **Archivos adjuntos**: imágenes, PDF, ZIP y audio (ver §6). Máximo de adjuntos: **provisional, ver §10** (el original fijaba 4).
- **Vídeo**: solo como URL de plataforma (YouTube, Vimeo, PeerTube). Nunca se aloja en el servidor.
- **Imagen representativa**: la elige el subidor. Si no elige, el sistema toma la primera imagen.
- Estados: borrador, en revisión, publicada, oculta por moderación, eliminada (borrado lógico).

## 3. Participaciones

- Varios autores pueden participar en una misma obra con uno o varios cargos (actor protagonista, modelo, fotógrafo…).
- El cargo puede ser de un catálogo por rama o texto libre: **provisional, ver §10**.
- Cada participación pasa por estados: pendiente, aceptada, rechazada, retirada por el autor.
- **Aceptación por defecto**: las participaciones se aceptan automáticamente al solicitarlas. El subidor recibe notificación y puede rechazarlas o retirarlas a posteriori. El autor participante puede retirarse en cualquier momento.
- El rechazo puede ser parcial: se pueden aceptar unos cargos y rechazar otros de la misma solicitud. Pedido explícito en los textos originales.
- **Participantes sin cuenta**: **provisional, ver §10**. Opción recomendada: el subidor puede listar a alguien sin cuenta (nombre y cargo) y esa persona puede reclamar su perfil después.
- Solo el subidor edita los datos de la obra. Un participante solo edita su propia participación.
- **Varios subidores**: **provisional, ver §10**.

## 4. Premios y títulos

- **Premio**: entidad propia con nombre, año, organismo, descripción e imagen opcional. Se reutiliza entre obras y personas.
- Un premio puede asociarse a una obra, a una persona o a ambas. **provisional, ver §10** si los participantes heredan el premio de la obra en su CV.
- **Verificación**: autodeclarado, validado por moderación o mixto. **provisional, ver §10**.
- **Títulos y formación**: el autor los añade a su CV (experiencia académica, cursos, títulos oficiales).

## 5. CV

- Se construye a partir de las participaciones aceptadas, más premios, títulos, experiencia profesional, material, otros conocimientos, carta de presentación y hasta un número limitado de adjuntos (ver §2).
- **Modo galería**: rejilla de obras del autor con miniaturas, filtrable por rama y categoría.
- Desde cualquier obra se puede navegar a su lista de participantes y a sus CVs.
- URL pública del CV: `/es/<alias>` o `/en/<alias>` (ver §7).

## 6. Archivos, miniaturas y QR

- **Imágenes**: se redimensionan automáticamente y se eliminan los metadatos EXIF (GPS). Límite por archivo: **provisional, ver §10**.
- **PDF**: miniatura generada de la primera página.
- **Audio**: se sirve desde almacenamiento de objetos con CDN (no desde el servidor de la aplicación). Alternativamente se admite solo enlace o embed (SoundCloud, Bandcamp). **provisional, ver §10** si se permite subida directa.
- **Vídeo**: miniatura de la plataforma de origen.
- **ZIP**: límite de tamaño: **provisional, ver §10** (el original fijaba 10 MB).
- **Miniatura de CV y obra**: imagen elegida por el autor o imagen por defecto.
- **QR**: cada CV y cada obra tiene un QR que apunta a una URL estable con ID corto, descargable e imprimible. El QR apunta siempre a la versión en el idioma de origen del contenido, no al idioma del visitante.

## 7. Multiidioma

- **Interfaz**: español (por defecto) e inglés en la primera versión. Otros idiomas, después.
- **Contenido**: cada obra y cada CV tiene un idioma de origen obligatorio (campo `lang`).
- **Traducción**: el autor puede traducir sus propios textos (título, descripción, carta de presentación, cargos, premios). La traducción automática como sugerencia, marcada como tal, es opcional y **provisional, ver §10**.
- **Fallback**: si no hay traducción al idioma del visitante, se muestra el original con un aviso.
- **URLs**: prefijo de idioma (`/es/`, `/en/`) y etiquetas `hreflang` para SEO.
- **Búsqueda**: indexa el contenido en todos los idiomas disponibles.
- **provisional, ver §10**: idiomas de lanzamiento (propuesta: es + en) y quién traduce la interfaz.

## 8. Contacto para compras y encargos

- **Objetivo**: que un visitante pueda contratar a un autor o comprar una obra sin que el autor exponga su correo.
- **Canal**: formulario interno de mensajes. El correo del autor no se muestra salvo que él lo active. Los mensajes llegan al autor por correo y en la plataforma.
- **Quién puede escribir**: **provisional, ver §10**. Propuesta: solo usuarios registrados, para reducir spam. Con captcha y límite de envíos por hora.
- **Tipos de consulta**: encargo, compra de obra, licencia de uso, colaboración, otros.
- **Opt-in del autor**: "acepto encargos" y "vendo obras" son interruptores en el perfil. Se pueden activar por obra.
- **Precio orientativo**: campo opcional en obra y en tarifa de CV. No hay pasarela de pago en la primera fase.
- **Pagos y facturación**: fuera de la plataforma en la primera fase. Si más adelante se quieren cobrar comisiones, cambia el encaje legal (intermediación, IVA, identificación de vendedores). Se trata en una fase posterior.
- **Aviso legal**: la plataforma no interviene en el acuerdo entre las partes. El mensaje no constituye contrato.
- **Historial**: los mensajes quedan en la plataforma para el autor y el visitante, con opción de borrado.

## 9. Moderación, denuncias y legal

- Cola de moderación para contenido denunciado y para contenido marcado por reglas automáticas.
- Procedimiento de retirada con notificación al autor, plazo de respuesta y posibilidad de contranotificación (DSA y LSSI).
- Política de reincidencia: suspensión de cuentas que suben contenido infringido.
- Condiciones de uso con garantía del autor sobre los derechos de lo que sube.
- Derechos de imagen: consentimiento para fotos de personas y tratamiento específico para menores.
- Registro de todas las actuaciones de moderación.
- Revisión por abogado antes del lanzamiento.

## 10. Decisiones provisionales

Adoptadas el 12-11-2026 como provisionales. Sustituyen a los **Decidir** de las secciones anteriores mientras no se revisen.

1. **Adjuntos**: máximo 6 por obra y 6 en el CV. Límites: imagen 10 MB, PDF 20 MB, ZIP 10 MB, audio 30 MB.
2. **Audio**: se admiten enlace/embed (SoundCloud, Bandcamp) y subida directa a almacenamiento con CDN.
3. **Cargos**: catálogo por rama más texto libre en la opción «otro».
4. **Participantes sin cuenta**: sí. El subidor los lista con nombre y cargo, y reciben un código para reclamar la participación.
5. **Varios subidores**: no en la primera versión.
6. **Premios**: mixto (autodeclarado con sello «verificado» que pone la moderación). Los participantes aceptados de una obra premiada lo ven en su CV como premio de la obra.
7. **Licencia por defecto**: CC BY-NC-ND 4.0, elegible por obra. Pendiente de revisión legal.
8. **Idiomas**: español e inglés. Sin traducción automática en la primera versión.
9. **Contacto**: solo usuarios registrados, con límite de envíos por hora.
10. **Comentarios, festivales y convocatorias**: fase posterior.

### Historial de cambios

- v0.2 (12-11-2026): acceso sin contraseña; decisiones provisionales de la sección 10; enlace al diseño técnico.

## 11. Puntos que estaban abiertos (referencia)

1. Máximo de adjuntos por obra y tamaños de archivo.
2. Audio: enlace, subida a almacenamiento externo o ambos.
3. Cargos: catálogo cerrado o texto libre.
4. Participantes sin cuenta: sí o no.
5. Varios subidores por obra: sí o no.
6. Premios: autodeclarados, validados o mixtos; herencia a participantes.
7. Licencia por defecto de las obras.
8. Idiomas de lanzamiento y traducción automática.
9. Quién puede enviar mensajes de contacto: solo registrados o también público.
10. Comentarios, festivales y convocatorias: dentro de esta fase o después.
