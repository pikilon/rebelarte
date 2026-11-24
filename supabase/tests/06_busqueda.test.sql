-- Búsqueda
select t.setup();
select t.login(t.alice());
insert into public.works (uploader_id, branch, title, description, keywords, lang, status, visibility) values
  (auth.uid(), 'sonido', '{"es": "Canción de otoño", "en": "Autumn song"}', '{"es": "Una melodía"}', '{guitarra}', 'es', 'published', 'public'),
  (auth.uid(), 'textos', '{"es": "Poemas del mar"}', '{"es": "Versos sobre el océano"}', '{poesía,mar}', 'es', 'published', 'public'),
  (auth.uid(), 'sonido', '{"es": "Canción secreta"}', '{}', '{}', 'es', 'published', 'unlisted'),
  (auth.uid(), 'sonido', '{"es": "Canción privada"}', '{}', '{}', 'es', 'draft', 'public');
select t.anon();
select t.eq(t.n($$select 1 from public.search_works('autumn')$$), 1::bigint, 'encuentra por título en inglés');
select t.eq(t.n($$select 1 from public.search_works('AUTUMN SONG')$$), 1::bigint, 'sin distinguir mayúsculas, varias palabras');
select t.eq(t.n($$select 1 from public.search_works('cancion')$$), 1::bigint, 'sin acentos: cancion encuentra «Canción» (sin unlisted ni borrador)');
select t.eq(t.n($$select 1 from public.search_works('canción otoño')$$), 1::bigint, 'con acentos también');
select t.eq(t.n($$select 1 from public.search_works('poesia')$$), 1::bigint, 'palabras clave sin acentos');
select t.eq(t.n($$select 1 from public.search_works('oceano')$$), 1::bigint, 'descripción sin acentos');
select t.eq(t.n($$select 1 from public.search_works('can')$$), 1::bigint, 'prefijo');
select t.eq(t.n($$select 1 from public.search_works('cancion', 'textos')$$), 0::bigint, 'filtro por rama');
select t.eq(t.n($$select 1 from public.search_works('cancion', 'sonido')$$), 1::bigint, 'filtro por rama coincide');
select t.eq(t.n($$select 1 from public.search_works(null, 'sonido')$$), 1::bigint, 'sin texto: listado por rama');
select t.eq(t.n($$select 1 from public.search_works(null)$$), 2::bigint, 'sin texto ni filtros: todas las públicas');
select t.eq(t.n($$select 1 from public.search_works('a:* | b & !''x''')$$), 0::bigint, 'entrada con símbolos de tsquery no rompe');
select t.eq(t.n($$select 1 from public.search_works('', null, null, 1, 0)$$), 1::bigint, 'limit respetado');
select t.eq(t.n($$select 1 from public.search_works('mar', null, (select id from public.categories where slug = 'novela'))$$), 0::bigint, 'filtro por categoría');

-- relevancia: título pesa más que descripción
select t.login(t.alice());
insert into public.works (uploader_id, branch, title, description, lang, status) values
  (auth.uid(), 'textos', '{"es": "Faro"}', '{"es": "historia de un viaje"}', 'es', 'published'),
  (auth.uid(), 'textos', '{"es": "Viaje"}', '{"es": "historia de un faro"}', 'es', 'published');
select t.eq((select title->>'es' from public.search_works('viaje') limit 1), 'Viaje', 'relevancia: coincidencia en título primero');

select t.eq(t.n($$select 1 from public.search_profiles('ALI')$$), 1::bigint, 'search_profiles por alias');
select t.eq(t.n($$select 1 from public.search_profiles('prueba')$$), 5::bigint, 'search_profiles por nombre');
select t.eq(t.n($$select 1 from public.search_profiles('%')$$), 0::bigint, 'comodines escapados');
select t.eq(t.n($$select 1 from public.search_profiles('')$$), 0::bigint, 'consulta vacía');
