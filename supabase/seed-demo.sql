-- Datos de ejemplo FICTICIOS para desarrollo local (nada real). Requiere seed.sql.
-- Se ejecuta como propietario (psql / SQL editor), no como usuario de la API.
-- Los correos son @example.invalid; no es posible entrar con ellos (sin contraseña
-- ni enlace): sirven solo para tener filas con las que probar la interfaz.

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'lucia.demo@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a2', 'marco.demo@example.invalid'),
  ('00000000-0000-4000-8000-0000000000a3', 'sol.demo@example.invalid')
on conflict (id) do nothing;

insert into public.profiles (id, alias, display_name, lang, headline, cover_letter, location,
                             accepts_commissions, sells_works, field_visibility) values
  ('00000000-0000-4000-8000-0000000000a1', 'lucia-demo', 'Lucía Demo', 'es',
   '{"es": "Pintora y fotógrafa", "en": "Painter and photographer"}',
   '{"es": "Perfil de ejemplo, personaje ficticio."}', 'Córdoba', true, true, '{}'),
  ('00000000-0000-4000-8000-0000000000a2', 'marco-demo', 'Marco Demo', 'es',
   '{"es": "Director de cortometrajes"}', '{"es": "Perfil de ejemplo."}', 'Sevilla',
   true, false, '{"location": "registered"}'),
  ('00000000-0000-4000-8000-0000000000a3', 'sol-demo', 'Sol Demo', 'en',
   '{"en": "Poet and translator"}', '{"en": "Example profile."}', null,
   false, false, '{"cover_letter": "private"}')
on conflict (id) do nothing;

insert into public.works (id, uploader_id, branch, category_id, title, description, keywords, lang,
                          visibility, status, for_sale, price_text, technique) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a1', 'plasticas',
   (select id from public.categories where branch = 'plasticas' and slug = 'pintura'),
   '{"es": "Naranjos en otoño", "en": "Orange trees in autumn"}',
   '{"es": "Óleo sobre lienzo (obra de ejemplo)."}', '{oleo,paisaje}', 'es', 'public', 'published',
   true, 'Desde 300 EUR', 'Óleo sobre lienzo'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000a2', 'audiovisuales',
   (select id from public.categories where branch = 'audiovisuales' and slug = 'cortos'),
   '{"es": "La última función", "en": "The last show"}',
   '{"es": "Cortometraje de ficción de ejemplo."}', '{cortometraje,ficcion}', 'es', 'public', 'published',
   false, null, null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a3', 'textos',
   (select id from public.categories where branch = 'textos' and slug = 'poesia'),
   '{"en": "Salt and Light"}', '{"en": "A short poem sequence (example)."}', '{poetry}', 'en',
   'public', 'published', false, null, null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000a1', 'plasticas',
   null, '{"es": "Boceto privado"}', '{}', '{}', 'es', 'private', 'draft', false, null, null)
on conflict (id) do nothing;

-- Marco colabora como modelo (cargo libre) en la obra de Lucía.
do $$
declare v_id uuid;
begin
  insert into public.participations (work_id, profile_id, status, created_by)
  values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000a2',
          'accepted', '00000000-0000-4000-8000-0000000000a2')
  on conflict (work_id, profile_id) do nothing
  returning id into v_id;
  if v_id is not null then
    perform public._insert_roles(v_id, '[{"role_text": "Modelo"}]'::jsonb, 'plasticas');
  end if;
end $$;

insert into public.cv_entries (profile_id, kind, title, organization, start_date, end_date, visibility, sort) values
  ('00000000-0000-4000-8000-0000000000a1', 'education', '{"es": "Grado en Bellas Artes (ejemplo)"}',
   'Universidad de Ejemplo', '2010-09-01', '2014-06-30', 'public', 1);

insert into public.awards (id, name, year, organization, lang, created_by) values
  ('20000000-0000-4000-8000-000000000001', '{"es": "Premio de Pintura Ejemplo", "en": "Example Painting Prize"}',
   2022, 'Ayuntamiento de Ejemplo', 'es', '00000000-0000-4000-8000-0000000000a1')
on conflict (id) do nothing;
insert into public.award_links (award_id, work_id, created_by) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-0000000000a1')
on conflict do nothing;
