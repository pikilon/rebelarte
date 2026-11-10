# AGENTS.md — Rebelarte 2.0

Instrucciones para agentes de IA que trabajen en este repositorio. Léelas antes de tocar nada.

## Qué es el proyecto

Rebelarte es un portal gratuito para promocionar a artistas y sus obras. Nació en 2006-2008 como proyecto de una asociación cultural de Córdoba, orientado a artistas andaluces sin medios para darse a conocer en internet. Esta carpeta contiene la reconstrucción del proyecto desde cero, pensada para desarrollarse íntegramente con IA.

Funciones principales:
- CV público por autor (`/es/<alias>`, `/en/<alias>`), construido a partir de sus participaciones, premios y títulos.
- Obras por rama (plásticas, textos, escénicas, sonido, audiovisuales), con varios participantes y cargos.
- Participaciones con aceptación por defecto, rechazo posterior y rechazo parcial por cargos.
- Modo galería en el CV, navegación de obra a participantes.
- Miniaturas y QR por CV y por obra.
- Multiidioma (es y en en el lanzamiento).
- Contacto interno para encargos y compras.

## Fuente de verdad

1. **[especificacion-funcional.md](especificacion-funcional.md)** es la especificación vigente. Si algo contradice este AGENTS.md, manda la especificación.
2. Los puntos marcados **Decidir** en la especificación (sección 10) están abiertos. No los resuelvas por tu cuenta. Si necesitas una decisión, pregunta al usuario.
3. Las referencias históricas están en Google Drive (ver abajo). Son material de contexto, no requisitos vigentes.

## Referencias en Google Drive

Carpeta raíz: **Rebelarte.com**
https://drive.google.com/drive/folders/1w5rfHh9ltCwPv7lYFpZi_Xfc8LkbIkA0
(ID `1w5rfHh9ltCwPv7lYFpZi_Xfc8LkbIkA0`, propietario `pikilon@gmail.com`)

### Documentos útiles (Google Docs, leer con `read_file_content`)

| Documento | ID | Por qué importa |
|---|---|---|
| Textos de ayuda y presentación | `1IQLQE4bLoILukZDRXW20IaRDr4ajns1Yolk70IvkwDc` | Cómo funciona el portal: artistas, obras, ramas, campos por rama, adjuntos, imagen representativa |
| Subvención del portal Rebelarte | `1XV-VagzX2cNCXqxHjXIynoutAe4rHX5S1HwddQ_olvw` | Objetivos, metodología, presupuesto original, plan de comunicación |
| Esquema de proyecto para subvención | `1AIco_Wp2JMwSxfaGaggrUkGVXmK-Srm4FP4UT4cb24c` | Índice de la memoria del proyecto |
| Folletos Rebelarte | `1d8_97CCRgBKi8Vw8UpMN1Vq4pLuAutcp91DGT-qG4vk` | Texto de presentación pública del portal |
| Ayuda contextual | `1x-EFi56_LKi4q4luO_1VP_2WxXR7jyv-Oj9jhOUiZiY` | Pantalla "Mi Rebelarte": cuenta, CV, mis obras, participaciones |
| Página principal | `1XUhUIGiXFS6fZdbzJ7z3fxnPgH5H4KqAXsuk53YbTy0` | Textos de la página de inicio |
| Memoria de seguimiento | `1-e3BijM1TpRpEMuRZcAKRkiN06KvYaScLJd8dBekzd4` | Seguimiento del proyecto original |

### Carpetas con material gráfico y de diseño

| Carpeta | ID | Contenido |
|---|---|---|
| imagenes | `1VFf190WAcprVdTHqXzKFkZF13gYKjSQ2` | Logo y boceto (PSD), subcarpetas `finales`, `iconos-40px`, `gif` |
| finales | `1Fti-HFmbyxsHqqJiDFgBcx4oMvBfhlXB` | Mockups de interfaz: `interfaz_rebelarte3.0.psd`, `rebelarte_usuarios.psd`, `rebelarte_obras.psd`, `iconos_rebelarte.bmp` |
| rebelarte cartel | `16NDzM7JpJw-Ihgc-g34fPVpiLo6GgUIj` | Folleto/cartel en TIF (delantera y trasera) |
| iconos-40px | `1Cc4IDAQJhu8FsjULILl3WtS0HVXJu7Kd` | Iconos de rama (BMP) y `iconos-40px.zip` |
| gif | `1vVN64WB9Mow0BgdRJvKLXgnMfGIytvtx` | Animaciones de pasos y `estilosBoletines.css` |
| web / esquemas | `1LlHEuPffX5JLON8jz_p7F14hMza0GS1b` / `1ahwuEq-opQYKBFMu2sj_CseW_C3Jg7nK` | Mapa de la web y esquema de la página principal |
| proyecto | `16973EzdPFQYNI-EflLZILb05H5oLmup6` | Copias de documentos del proyecto |
| documentos | `1TFoDSaZiLxLMeMV44-fucYJh-0qAZUBJ` | Certificado digital, hosting, web, bases de datos, datos de miembros |

### Carpetas NO incluibles en el repositorio

Contienen datos personales, administrativos o financieros. Pueden consultarse solo para entender el esquema de datos, nunca copiar sus contenidos:

- `datos miembros` (`1V5ROq8LbTNmza9zKLFiU_G38HP_UPF8B`): escaneos de DNI y firmas de personas concretas.
- `datos usuarios` (`1NF-tIkOJ05Q3yxxp5-ix6XD38yMEDJAk`): hojas con datos de usuarios.
- `bases de datos` (`1YkidO28dNZGZPBGjRrjnn1BTZIsgZ_Yr`): `rebelarte.mdb` (Access, 2005) con datos reales. El diagrama `dbdesigner.xml` sí sirve como referencia de esquema.
- `facturas` (`1iUVa_v0gqEcLLYb716LwfcQfJM2I_X-t`), `certificado digital` y `firma digital`.
- `actas` (`1lczkWmIoX4GIN3oa70IY6trMSgQd0mXh`): documentos internos de la asociación.

## Reglas de trabajo

1. **Datos personales**: nunca copies al repositorio nada de las carpetas no incluibles ni datos reales de personas (nombres con DNI, correos, firmas, teléfonos). Si necesitas datos de ejemplo, inventa datos ficticios.
2. **Drive**: consulta las referencias con las herramientas de Google Drive. Para una búsqueda usa `search_files` con `parentId = '<ID>'`. Para leer un documento usa `read_file_content` con `fileId`. Solo descarga archivos (`download_file_content`) si el usuario lo pide expresamente, y di el tamaño antes.
3. **Propiedad intelectual**: los assets de Drive son del proyecto original. No los publiques en un repositorio público sin confirmación del usuario. Las obras de terceros no se suben sin licencia clara.
4. **Idioma**: los textos del producto son en español, con inglés previsto. Los comentarios de código y los mensajes de commit pueden ser en español.
5. **Git y GitHub**: no crees el repositorio remoto ni hagas push hasta que el usuario lo confirme (cuenta, nombre y visibilidad).
6. **Decisiones abiertas**: no tomes decisiones marcadas como "Decidir" en la especificación. Propón una opción y pregunta.
7. **Cambios en la especificación**: si un cambio altera la especificación, actualiza `especificacion-funcional.md` en el mismo cambio y anótalo.

## Estado actual

- Especificación funcional en borrador v0.1.
- Pendiente: decidir los 10 puntos de la sección 10 de la especificación.
- Pendiente: decidir tecnología. Propuesta sobre la mesa: Supabase (Postgres, autenticación y almacenamiento) con CDN barato (R2 o Bunny) para el audio si crece el tráfico.
- Pendiente: definir la licencia por defecto, los términos de uso y el procedimiento de retirada, con revisión legal antes del lanzamiento.
- Repositorio: `pikilon/rebelarte` en GitHub, público. Se hace push con la cuenta `pikilon`.
- Publicado: página «en construcción» (`site/`) en GitHub Pages con el dominio `rebelarte.com`. El CI (`.github/workflows/deploy.yml`) ejecuta `npm run build` y publica `dist/`. El DNS se gestiona en Piensa Solutions.

## Glosario rápido

- **Subidor**: autor que dio de alta una obra; puede aceptar o rechazar participaciones.
- **Participación**: relación entre un autor y una obra, con uno o varios cargos y un estado.
- **Rama**: tipo de obra (plásticas, textos, escénicas, sonido, audiovisuales).
- **CV**: página pública del autor, construida desde sus participaciones, premios y títulos.
