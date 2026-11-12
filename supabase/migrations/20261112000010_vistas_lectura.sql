-- 10 · Vistas y RPC de lectura
--
-- Sobre security_invoker = false (las vistas ejecutan como propietario y por
-- tanto saltan RLS de las tablas base): se usa SOLO en profiles_public y
-- works_cards, porque su función es exponer un subconjunto seguro de columnas y
-- filas de tablas que RLS no deja leer a terceros (profiles) o cuya portada
-- exige leer adjuntos. El filtro de filas (activos / publicadas y públicas) y la
-- lista de columnas están fijados en la propia definición. Se revocan INSERT,
-- UPDATE y DELETE sobre ellas (una vista simple sería actualizable como dueño).

-- Perfiles visibles: solo activos, solo columnas no sensibles.
create view public.profiles_public with (security_invoker = false) as
select id, alias, short_id, display_name, lang, headline, avatar_path,
       accepts_commissions, sells_works, role, created_at
from public.profiles
where status = 'active';

-- Obras para tarjetas y listados: solo published + public (las unlisted no salen)
-- de usuarios activos. cover_path = miniatura (o ruta) de la imagen de portada:
-- la elegida (cover_attachment_id) o, si no hay, la primera imagen por sort.
create view public.works_cards with (security_invoker = false) as
select w.id, w.short_id, w.branch, w.category_id, w.title, w.lang,
       w.uploader_id,
       p.alias::text as uploader_alias,
       p.display_name as uploader_name,
       (select coalesce(a.thumb_path, a.path)
          from public.attachments a
         where a.work_id = w.id and a.kind = 'image'
         order by (a.id = w.cover_attachment_id) desc, a.sort, a.id
         limit 1) as cover_path,
       w.video_url,
       w.published_at
from public.works w
join public.profiles p on p.id = w.uploader_id
where w.status = 'published' and w.visibility = 'public' and p.status = 'active';

revoke all on public.profiles_public, public.works_cards from anon, authenticated;
grant select on public.profiles_public, public.works_cards to anon, authenticated;

-- Participaciones + claim_code para el subidor. security_invoker: la RLS de
-- participations y participation_claims se aplica al usuario, así que solo el
-- subidor ve el código (el resto ve claim_code = null).
create view public.participations_manage with (security_invoker = true) as
select p.id, p.work_id, p.profile_id, p.guest_name, c.claim_code, p.status,
       p.created_by, p.note, p.created_at, p.updated_at
from public.participations p
left join public.participation_claims c on c.participation_id = p.id;
revoke all on public.participations_manage from anon, authenticated;
grant select on public.participations_manage to authenticated;

-- ---------------------------------------------------------------------------
-- Visibilidad de campos del perfil
-- ---------------------------------------------------------------------------
-- ¿Ve el visitante actual el campo `p_key`? public: todos; registered: con
-- sesión; private: solo el dueño. El dueño ve siempre todo.
create or replace function public._field_visible(p_owner uuid, p_vis jsonb, p_key text)
returns boolean language sql stable as $$
  select p_owner = auth.uid()
      or case coalesce(p_vis ->> p_key, 'public')
           when 'public' then true
           when 'registered' then auth.uid() is not null
           else false end
$$;

-- CV público de un perfil con field_visibility aplicado. Devuelve 0 o 1 filas
-- (usar .maybeSingle()). contact_email solo sale si el autor activó show_email
-- (y la visibilidad del campo lo permite). Perfiles suspendidos: ocultos, salvo
-- para su dueño.
create or replace function public.profile_public(p_alias text)
returns table (
  id uuid, alias text, short_id text, display_name text, lang text, headline jsonb,
  avatar_path text, accepts_commissions boolean, sells_works boolean, role text,
  created_at timestamptz,
  cover_letter jsonb, location text, contact_email text, rate_text jsonb, rate_price text
)
language sql stable security definer set search_path = public, extensions as $$
  select p.id, p.alias::text, p.short_id, p.display_name, p.lang, p.headline,
         p.avatar_path, p.accepts_commissions, p.sells_works, p.role, p.created_at,
         case when public._field_visible(p.id, p.field_visibility, 'cover_letter') then p.cover_letter end,
         case when public._field_visible(p.id, p.field_visibility, 'location') then p.location end,
         case when p.contact_email is not null
                   and (p.id = auth.uid()
                        or (p.show_email and public._field_visible(p.id, p.field_visibility, 'contact_email')))
              then p.contact_email end,
         case when public._field_visible(p.id, p.field_visibility, 'rate') then p.rate_text end,
         case when public._field_visible(p.id, p.field_visibility, 'rate') then p.rate_price end
  from public.profiles p
  where p.alias = btrim(p_alias)::extensions.citext
    and (p.status = 'active' or p.id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- CV: obras y premios
-- ---------------------------------------------------------------------------
-- Obras del CV: participación aceptada del perfil en obras published+public
-- (igual criterio que works_cards: las unlisted no se listan en el CV) y con
-- sus cargos aceptados en `roles` = [{role_id, role_text}].
create or replace function public.cv_works(p_profile_id uuid)
returns table (
  id uuid, short_id text, branch text, category_id int, title jsonb, lang text,
  uploader_id uuid, uploader_alias text, uploader_name text, cover_path text,
  video_url text, published_at timestamptz, roles jsonb
)
language sql stable security definer set search_path = public as $$
  select c.id, c.short_id, c.branch, c.category_id, c.title, c.lang, c.uploader_id,
         c.uploader_alias, c.uploader_name, c.cover_path, c.video_url, c.published_at,
         r.roles
  from public.works_cards c
  join public.participations pa
    on pa.work_id = c.id and pa.profile_id = p_profile_id and pa.status = 'accepted'
  join lateral (
    select jsonb_agg(jsonb_build_object('role_id', pr.role_id, 'role_text', pr.role_text)
                     order by pr.sort, pr.id) as roles
    from public.participation_roles pr
    where pr.participation_id = pa.id and pr.status = 'accepted'
  ) r on r.roles is not null
  where public.is_active_profile(p_profile_id)
  order by c.published_at desc nulls last, c.id
$$;

-- Premios del CV: propios (award_links.profile_id) + los de obras en las que el
-- perfil participa (aceptado) y que son públicas. `via_work_id` null = propio;
-- si un premio es a la vez propio y de obra, sale como propio.
create or replace function public.cv_awards(p_profile_id uuid)
returns table (
  id uuid, name jsonb, year int, organization text, description jsonb,
  image_path text, lang text, verified boolean, created_by uuid, via_work_id uuid
)
language sql stable security definer set search_path = public as $$
  select * from (
    select distinct on (a.id)
           a.id, a.name, a.year, a.organization, a.description, a.image_path,
           a.lang, a.verified, a.created_by, x.via_work_id
    from public.awards a
    join (
      select al.award_id, null::uuid as via_work_id, 0 as pri
        from public.award_links al where al.profile_id = p_profile_id
      union all
      select al.award_id, al.work_id, 1
        from public.award_links al
        join public.participations pa
          on pa.work_id = al.work_id and pa.profile_id = p_profile_id and pa.status = 'accepted'
        join public.works w on w.id = al.work_id and w.status = 'published' and w.visibility = 'public'
    ) x on x.award_id = a.id
    where public.is_active_profile(p_profile_id)
    order by a.id, x.pri, x.via_work_id
  ) s
  order by s.year desc nulls last, s.id
$$;

-- ---------------------------------------------------------------------------
-- Búsqueda
-- ---------------------------------------------------------------------------
-- Obras (published + public) por relevancia. Texto: palabras sin acentos y por
-- prefijo contra el tsvector 'simple' de todos los idiomas. Sin texto: devuelve
-- lo más reciente (sirve para listados por rama/categoría).
create or replace function public.search_works(
  p_q text default null, p_branch text default null, p_category int default null,
  p_limit int default 24, p_offset int default 0)
returns setof public.works_cards
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_query tsquery;
  v_words text[];
begin
  if p_q is not null and btrim(p_q) <> '' then
    select array_agg(w) into v_words
      from regexp_split_to_table(lower(public.f_unaccent(p_q)), '[^[:alnum:]]+') w
     where w <> '';
    if v_words is not null then
      -- solo caracteres alfanuméricos => seguro para to_tsquery
      v_query := to_tsquery('simple', (select string_agg(w || ':*', ' & ') from unnest(v_words) w));
    end if;
  end if;

  return query
    select c.*
    from public.works_cards c
    join public.works w on w.id = c.id
    where (p_branch is null or c.branch = p_branch)
      and (p_category is null or c.category_id = p_category)
      and (v_query is null or w.search @@ v_query)
    order by case when v_query is null then 0 else ts_rank_cd(w.search, v_query) end desc,
             c.published_at desc nulls last, c.id
    limit least(greatest(coalesce(p_limit, 24), 1), 100)
    offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- Autores por nombre o alias (sin acentos, sin mayúsculas, por subcadena).
create or replace function public.search_profiles(p_q text, p_limit int default 20)
returns setof public.profiles_public
language sql stable security definer set search_path = public, extensions as $$
  with q as (
    select replace(replace(replace(lower(public.f_unaccent(btrim(coalesce(p_q, '')))), '\', '\\'), '%', '\%'), '_', '\_') as t
  )
  select pp.*
  from public.profiles_public pp
  join public.profiles p on p.id = pp.id, q
  where q.t <> ''
    and public.f_unaccent(lower(p.display_name || ' ' || p.alias::text)) like '%' || q.t || '%'
  order by (lower(p.alias::text) = q.t) desc,
           (public.f_unaccent(lower(p.display_name)) like q.t || '%') desc,
           p.display_name
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
$$;

-- Privilegios: lectura pública. Las auxiliares con _ no son llamables por clientes.
revoke execute on function public._field_visible(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public.profile_public(text) from public;
revoke execute on function public.cv_works(uuid) from public;
revoke execute on function public.cv_awards(uuid) from public;
revoke execute on function public.search_works(text, text, int, int, int) from public;
revoke execute on function public.search_profiles(text, int) from public;
grant execute on function public.profile_public(text) to anon, authenticated;
grant execute on function public.cv_works(uuid) to anon, authenticated;
grant execute on function public.cv_awards(uuid) to anon, authenticated;
grant execute on function public.search_works(text, text, int, int, int) to anon, authenticated;
grant execute on function public.search_profiles(text, int) to anon, authenticated;
