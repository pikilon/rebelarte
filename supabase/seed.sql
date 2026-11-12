-- Semilla de catálogos de Rebelarte 2.0. Idempotente (se puede ejecutar varias veces).
-- Hay que ejecutarla tras las migraciones: `supabase db push` no la aplica en un
-- proyecto remoto (solo `supabase db reset` en local). Ver supabase/README.md.

-- Ramas
insert into public.branches (id, name, sort) values
  ('plasticas',     '{"es": "Artes plásticas", "en": "Visual arts"}', 1),
  ('textos',        '{"es": "Textos", "en": "Texts"}', 2),
  ('escenicas',     '{"es": "Artes escénicas", "en": "Performing arts"}', 3),
  ('sonido',        '{"es": "Sonido", "en": "Sound"}', 4),
  ('audiovisuales', '{"es": "Audiovisuales", "en": "Audiovisual"}', 5)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;

-- Categorías por rama
insert into public.categories (branch, slug, name, sort) values
  ('audiovisuales', 'cortos',        '{"es": "Cortometrajes", "en": "Short films"}', 1),
  ('audiovisuales', 'videoclips',    '{"es": "Videoclips", "en": "Music videos"}', 2),
  ('audiovisuales', 'documental',    '{"es": "Documental", "en": "Documentary"}', 3),
  ('audiovisuales', 'animacion',     '{"es": "Animación", "en": "Animation"}', 4),
  ('audiovisuales', 'otros',         '{"es": "Otros audiovisuales", "en": "Other audiovisual"}', 99),
  ('textos',        'novela',        '{"es": "Novela", "en": "Novel"}', 1),
  ('textos',        'poesia',        '{"es": "Poesía", "en": "Poetry"}', 2),
  ('textos',        'relato',        '{"es": "Relato", "en": "Short story"}', 3),
  ('textos',        'ensayo',        '{"es": "Ensayo", "en": "Essay"}', 4),
  ('textos',        'otros',         '{"es": "Otros textos", "en": "Other texts"}', 99),
  ('plasticas',     'pintura',       '{"es": "Pintura", "en": "Painting"}', 1),
  ('plasticas',     'escultura',     '{"es": "Escultura", "en": "Sculpture"}', 2),
  ('plasticas',     'fotografia',    '{"es": "Fotografía", "en": "Photography"}', 3),
  ('plasticas',     'ilustracion',   '{"es": "Ilustración", "en": "Illustration"}', 4),
  ('plasticas',     'grabado',       '{"es": "Grabado", "en": "Printmaking"}', 5),
  ('plasticas',     'otros',         '{"es": "Otras artes plásticas", "en": "Other visual arts"}', 99),
  ('escenicas',     'teatro',        '{"es": "Teatro", "en": "Theatre"}', 1),
  ('escenicas',     'danza',         '{"es": "Danza", "en": "Dance"}', 2),
  ('escenicas',     'circo',         '{"es": "Circo", "en": "Circus"}', 3),
  ('escenicas',     'performance',   '{"es": "Performance", "en": "Performance art"}', 4),
  ('escenicas',     'otros',         '{"es": "Otras artes escénicas", "en": "Other performing arts"}', 99),
  ('sonido',        'musica',        '{"es": "Música", "en": "Music"}', 1),
  ('sonido',        'podcast',       '{"es": "Podcast", "en": "Podcast"}', 2),
  ('sonido',        'paisaje-sonoro','{"es": "Paisaje sonoro", "en": "Soundscape"}', 3),
  ('sonido',        'otros',         '{"es": "Otros sonidos", "en": "Other sound"}', 99)
on conflict (branch, slug) do update set name = excluded.name, sort = excluded.sort;

-- Catálogo de cargos. branch null = válido en todas las ramas.
insert into public.role_catalog (branch, slug, name, sort)
select nullif(v.branch, '*'), v.slug, v.name::jsonb, v.sort
from (values
  -- todas las ramas
  ('*',             'autor',               '{"es": "Autor/a", "en": "Author"}', 1),
  ('*',             'colaborador',         '{"es": "Colaborador/a", "en": "Collaborator"}', 2),
  ('*',             'productor',           '{"es": "Productor/a", "en": "Producer"}', 3),
  ('*',             'traductor',           '{"es": "Traductor/a", "en": "Translator"}', 4),
  -- audiovisuales
  ('audiovisuales', 'director',            '{"es": "Director/a", "en": "Director"}', 10),
  ('audiovisuales', 'guionista',           '{"es": "Guionista", "en": "Screenwriter"}', 11),
  ('audiovisuales', 'actor-protagonista',  '{"es": "Actor/actriz protagonista", "en": "Lead actor"}', 12),
  ('audiovisuales', 'actor-reparto',       '{"es": "Actor/actriz de reparto", "en": "Supporting actor"}', 13),
  ('audiovisuales', 'camara',              '{"es": "Cámara", "en": "Camera"}', 14),
  ('audiovisuales', 'fotografia',          '{"es": "Dirección de fotografía", "en": "Cinematography"}', 15),
  ('audiovisuales', 'montaje',             '{"es": "Montaje", "en": "Editing"}', 16),
  ('audiovisuales', 'musica-original',     '{"es": "Música original", "en": "Original music"}', 17),
  ('audiovisuales', 'sonido',              '{"es": "Sonido", "en": "Sound"}', 18),
  ('audiovisuales', 'iluminacion',         '{"es": "Iluminación", "en": "Lighting"}', 19),
  ('audiovisuales', 'escenografia',        '{"es": "Escenografía", "en": "Set design"}', 20),
  -- escénicas
  ('escenicas',     'director',            '{"es": "Director/a", "en": "Director"}', 10),
  ('escenicas',     'dramaturgo',          '{"es": "Dramaturgo/a", "en": "Playwright"}', 11),
  ('escenicas',     'actor-protagonista',  '{"es": "Actor/actriz protagonista", "en": "Lead actor"}', 12),
  ('escenicas',     'actor-reparto',       '{"es": "Actor/actriz de reparto", "en": "Supporting actor"}', 13),
  ('escenicas',     'interprete',          '{"es": "Intérprete", "en": "Performer"}', 14),
  ('escenicas',     'coreografo',          '{"es": "Coreógrafo/a", "en": "Choreographer"}', 15),
  ('escenicas',     'escenografia',        '{"es": "Escenografía", "en": "Set design"}', 16),
  ('escenicas',     'iluminacion',         '{"es": "Iluminación", "en": "Lighting"}', 17),
  ('escenicas',     'sonido',              '{"es": "Sonido", "en": "Sound"}', 18),
  ('escenicas',     'musica-original',     '{"es": "Música original", "en": "Original music"}', 19),
  -- sonido
  ('sonido',        'compositor',          '{"es": "Compositor/a", "en": "Composer"}', 10),
  ('sonido',        'interprete',          '{"es": "Intérprete", "en": "Performer"}', 11),
  ('sonido',        'letrista',            '{"es": "Letrista", "en": "Lyricist"}', 12),
  ('sonido',        'sonido',              '{"es": "Técnico/a de sonido", "en": "Sound engineer"}', 13),
  ('sonido',        'mezcla',              '{"es": "Mezcla y masterización", "en": "Mixing and mastering"}', 14),
  ('sonido',        'voz',                 '{"es": "Voz", "en": "Voice"}', 15),
  -- plásticas
  ('plasticas',     'fotografo',           '{"es": "Fotógrafo/a", "en": "Photographer"}', 10),
  ('plasticas',     'modelo',              '{"es": "Modelo", "en": "Model"}', 11),
  ('plasticas',     'ilustrador',          '{"es": "Ilustrador/a", "en": "Illustrator"}', 12),
  ('plasticas',     'escultor',            '{"es": "Escultor/a", "en": "Sculptor"}', 13),
  ('plasticas',     'pintor',              '{"es": "Pintor/a", "en": "Painter"}', 14),
  ('plasticas',     'comisario',           '{"es": "Comisario/a", "en": "Curator"}', 15),
  -- textos
  ('textos',        'ilustrador',          '{"es": "Ilustrador/a", "en": "Illustrator"}', 10),
  ('textos',        'editor',              '{"es": "Editor/a", "en": "Editor"}', 11),
  ('textos',        'prologuista',         '{"es": "Prologuista", "en": "Foreword author"}', 12)
) as v(branch, slug, name, sort)
on conflict ((coalesce(branch, '*')), slug) do update set name = excluded.name, sort = excluded.sort;

-- Licencias (CC BY-NC-ND 4.0 por defecto, pendiente de revisión legal)
insert into public.licenses (id, name, url) values
  ('cc-by-nc-nd-4.0', '{"es": "CC BY-NC-ND 4.0 · Reconocimiento, no comercial, sin obra derivada", "en": "CC BY-NC-ND 4.0 · Attribution, non-commercial, no derivatives"}', 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.es'),
  ('cc-by-4.0',       '{"es": "CC BY 4.0 · Reconocimiento", "en": "CC BY 4.0 · Attribution"}', 'https://creativecommons.org/licenses/by/4.0/deed.es'),
  ('cc-by-sa-4.0',    '{"es": "CC BY-SA 4.0 · Reconocimiento, compartir igual", "en": "CC BY-SA 4.0 · Attribution, share-alike"}', 'https://creativecommons.org/licenses/by-sa/4.0/deed.es'),
  ('cc-by-nc-4.0',    '{"es": "CC BY-NC 4.0 · Reconocimiento, no comercial", "en": "CC BY-NC 4.0 · Attribution, non-commercial"}', 'https://creativecommons.org/licenses/by-nc/4.0/deed.es'),
  ('cc-by-nc-sa-4.0', '{"es": "CC BY-NC-SA 4.0 · Reconocimiento, no comercial, compartir igual", "en": "CC BY-NC-SA 4.0 · Attribution, non-commercial, share-alike"}', 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.es'),
  ('cc-by-nd-4.0',    '{"es": "CC BY-ND 4.0 · Reconocimiento, sin obra derivada", "en": "CC BY-ND 4.0 · Attribution, no derivatives"}', 'https://creativecommons.org/licenses/by-nd/4.0/deed.es'),
  ('cc0',             '{"es": "CC0 · Dominio público", "en": "CC0 · Public domain"}', 'https://creativecommons.org/publicdomain/zero/1.0/deed.es'),
  ('all-rights-reserved', '{"es": "Todos los derechos reservados", "en": "All rights reserved"}', null)
on conflict (id) do update set name = excluded.name, url = excluded.url;
