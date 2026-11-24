-- 15 · Juez de decisiones (Jev) para aprobar y crear cargos de participación «on the fly»
--
-- Cuando un usuario propone un cargo que no está en `role_catalog` para la rama de
-- la obra, el sistema Jev (Edge Function `judge-role` con IA + catálogo) evalúa si:
--   1. Equivale a un cargo ya existente en el catálogo (`matched_existing`).
--   2. Es un cargo válido para esa rama artística y debe crearse en el acto en
--      `public.role_catalog` con traducción es/en y slug (`approved_new`).
--   3. No corresponde a esa rama o no es un cargo válido (`rejected`).
--
-- Todas las decisiones quedan registradas en `public.role_judge_decisions`, que
-- actúa como registro de auditoría, caché por `(branch, normalized_input)` y
-- control de límite de peticiones por hora.

create table public.role_judge_decisions (
  id               uuid primary key default gen_random_uuid(),
  branch           text not null references public.branches(id) on delete cascade,
  raw_input        text not null check (char_length(btrim(raw_input)) between 1 and 80),
  normalized_input text not null check (char_length(normalized_input) between 1 and 80),
  decision         text not null check (decision in ('approved_new', 'matched_existing', 'rejected')),
  role_id          int references public.role_catalog(id) on delete set null,
  reason           jsonb not null default '{"es": "", "en": ""}'::jsonb check (public.is_i18n(reason)),
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index role_judge_decisions_lookup     on public.role_judge_decisions (branch, normalized_input, created_at desc);
create index role_judge_decisions_created_by on public.role_judge_decisions (created_by, created_at desc);
create index role_judge_decisions_role       on public.role_judge_decisions (role_id);

alter table public.role_judge_decisions enable row level security;

revoke all on public.role_judge_decisions from anon, authenticated;
grant select on public.role_judge_decisions to authenticated;

create policy role_judge_decisions_select on public.role_judge_decisions
  for select to authenticated
  using (created_by = (select auth.uid()) or (select public.is_moderator()));

-- ---------------------------------------------------------------------------
-- Normalización y búsqueda de coincidencias en el catálogo existente
-- ---------------------------------------------------------------------------

create or replace function public.normalize_role_input(p_text text)
returns text language sql immutable parallel safe
set search_path = public, extensions, pg_temp as $$
  select lower(btrim(regexp_replace(public.f_unaccent(coalesce(p_text, '')), '\s+', ' ', 'g')))
$$;

create or replace function public.slugify_role(p_text text)
returns text language sql immutable parallel safe
set search_path = public, extensions, pg_temp as $$
  select substr(
    regexp_replace(
      regexp_replace(public.normalize_role_input(p_text), '[^a-z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    ),
    1, 50
  )
$$;

-- Comprueba si un texto ya normalizado coincide con la etiqueta del catálogo,
-- contemplando desdoblamientos de género habituales («Autor/a», «Actor/actriz…», «Fotógrafo/a»).
create or replace function public._role_name_matches(p_catalog_name text, p_norm_input text)
returns boolean language plpgsql immutable parallel safe
set search_path = public, extensions, pg_temp as $$
declare
  v_cat  text := public.normalize_role_input(p_catalog_name);
  v_masc text;
  v_fem  text;
begin
  if v_cat = '' or p_norm_input = '' then
    return false;
  end if;
  if p_norm_input = v_cat then
    return true;
  end if;

  v_masc := regexp_replace(regexp_replace(v_cat, '([a-z]+)/actriz\M', '\1', 'g'), '([a-z]+)/a\M', '\1', 'g');
  if p_norm_input = v_masc then
    return true;
  end if;

  v_fem := regexp_replace(v_cat, '[a-z]+/actriz\M', 'actriz', 'g');
  v_fem := regexp_replace(v_fem, '([a-z]+or)/a\M', '\1a', 'g');
  v_fem := regexp_replace(v_fem, '([a-z]+)o/a\M', '\1a', 'g');
  v_fem := regexp_replace(v_fem, '([a-z]+)/a\M', '\1a', 'g');
  return p_norm_input = v_fem;
end $$;

-- Busca en `role_catalog` un cargo válido para la rama (específico o global) que
-- coincida por slug o por nombre en español o inglés (incluyendo variantes de género).
create or replace function public.find_matching_catalog_role(p_branch text, p_raw_input text)
returns public.role_catalog language sql stable security definer
set search_path = public, extensions, pg_temp as $$
  with q as (
    select public.normalize_role_input(p_raw_input) as norm,
           public.slugify_role(p_raw_input) as sl
  )
  select rc.*
  from public.role_catalog rc, q
  where q.norm <> ''
    and (rc.branch = p_branch or rc.branch is null)
    and (
      rc.slug = q.sl
      or public._role_name_matches(rc.name ->> 'es', q.norm)
      or public._role_name_matches(rc.name ->> 'en', q.norm)
    )
  order by (rc.branch is null) asc, rc.sort asc, rc.id asc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- Consulta previa (catálogo o caché de decisiones del juez)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_existing_or_cached_role(p_branch text, p_raw_input text)
returns jsonb language plpgsql stable security definer
set search_path = public, extensions, pg_temp as $$
declare
  v_uid  uuid := public._require_active();
  v_raw  text := btrim(coalesce(p_raw_input, ''));
  v_norm text := public.normalize_role_input(v_raw);
  v_role public.role_catalog;
  v_dec  public.role_judge_decisions;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_branch is null or not exists (select 1 from public.branches where id = p_branch) then
    raise exception 'invalid_branch' using errcode = 'P0001';
  end if;
  if char_length(v_raw) not between 1 and 80 or v_norm = '' then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;

  select * into v_role from public.find_matching_catalog_role(p_branch, v_raw);
  if v_role.id is not null then
    return jsonb_build_object(
      'decision', 'matched_existing',
      'cached', true,
      'role', to_jsonb(v_role),
      'reason', jsonb_build_object(
        'es', 'Este cargo ya existe en el catálogo de la rama.',
        'en', 'This role already exists in the branch catalog.'
      )
    );
  end if;

  select * into v_dec
  from public.role_judge_decisions
  where branch = p_branch and normalized_input = v_norm
  order by created_at desc
  limit 1;

  if found then
    if v_dec.decision in ('approved_new', 'matched_existing') and v_dec.role_id is not null then
      select * into v_role from public.role_catalog where id = v_dec.role_id;
      if v_role.id is not null then
        return jsonb_build_object(
          'decision', v_dec.decision,
          'cached', true,
          'role', to_jsonb(v_role),
          'reason', v_dec.reason
        );
      end if;
    elsif v_dec.decision = 'rejected' then
      return jsonb_build_object(
        'decision', 'rejected',
        'cached', true,
        'role', null,
        'reason', v_dec.reason
      );
    end if;
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Registro de la decisión del juez y creación «on the fly» en `role_catalog`
-- Solo ejecutable desde el backend (service_role / propietario).
-- ---------------------------------------------------------------------------
create or replace function public.record_role_judge_decision(
  p_user_id uuid,
  p_branch text,
  p_raw_input text,
  p_decision text,
  p_slug text default null,
  p_name jsonb default null,
  p_matched_role_id int default null,
  p_reason jsonb default null
)
returns jsonb language plpgsql security definer
set search_path = public, extensions, pg_temp as $$
declare
  v_status text;
  v_raw    text := btrim(coalesce(p_raw_input, ''));
  v_norm   text := public.normalize_role_input(v_raw);
  v_slug   text;
  v_name   jsonb;
  v_reason jsonb := coalesce(p_reason, '{"es": "", "en": ""}'::jsonb);
  v_role   public.role_catalog;
begin
  if p_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select status into v_status from public.profiles where id = p_user_id;
  if not found then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  if v_status <> 'active' then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if p_branch is null or not exists (select 1 from public.branches where id = p_branch) then
    raise exception 'invalid_branch' using errcode = 'P0001';
  end if;
  if char_length(v_raw) not between 1 and 80 or v_norm = '' then
    raise exception 'invalid_role' using errcode = 'P0001';
  end if;
  if p_decision is null or p_decision not in ('approved_new', 'matched_existing', 'rejected') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  if not public.is_i18n(v_reason) then
    v_reason := '{"es": "", "en": ""}'::jsonb;
  end if;

  -- Límite de uso: 30 evaluaciones nuevas por usuario y hora
  if (select count(*) from public.role_judge_decisions
       where created_by = p_user_id and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if p_decision = 'matched_existing' then
    select * into v_role
    from public.role_catalog
    where id = p_matched_role_id and (branch = p_branch or branch is null);
    if v_role.id is null then
      raise exception 'invalid_role' using errcode = 'P0001';
    end if;

  elsif p_decision = 'approved_new' then
    v_slug := public.slugify_role(coalesce(nullif(btrim(p_slug), ''), p_name ->> 'es', v_raw));
    if v_slug = '' or v_slug !~ '^[a-z0-9-]+$' then
      raise exception 'invalid_role' using errcode = 'P0001';
    end if;
    if p_name is null or not public.is_i18n(p_name)
       or btrim(coalesce(p_name ->> 'es', '')) = ''
       or btrim(coalesce(p_name ->> 'en', '')) = '' then
      raise exception 'invalid_role' using errcode = 'P0001';
    end if;
    v_name := jsonb_build_object(
      'es', substr(btrim(p_name ->> 'es'), 1, 80),
      'en', substr(btrim(p_name ->> 'en'), 1, 80)
    );

    -- Si ya existe en el catálogo (global o de la rama) por slug o nombre, reutilizarlo
    select * into v_role
    from public.role_catalog
    where (branch = p_branch or branch is null) and slug = v_slug
    order by (branch is null) asc, id asc
    limit 1;

    if v_role.id is null then
      select * into v_role from public.find_matching_catalog_role(p_branch, v_name ->> 'es');
    end if;

    if v_role.id is null then
      insert into public.role_catalog (branch, slug, name, sort)
      values (p_branch, v_slug, v_name, 50)
      on conflict ((coalesce(branch, '*')), slug)
      do update set name = public.role_catalog.name
      returning * into v_role;
    end if;
  end if;

  insert into public.role_judge_decisions (
    branch, raw_input, normalized_input, decision, role_id, reason, created_by
  ) values (
    p_branch, v_raw, v_norm, p_decision, v_role.id, v_reason, p_user_id
  );

  return jsonb_build_object(
    'decision', p_decision,
    'cached', false,
    'role', case when v_role.id is not null then to_jsonb(v_role) else null end,
    'reason', v_reason
  );
end $$;

revoke execute on function public._role_name_matches(text, text) from public, anon, authenticated;
revoke execute on function public.normalize_role_input(text) from public, anon;
revoke execute on function public.slugify_role(text) from public, anon;
revoke execute on function public.find_matching_catalog_role(text, text) from public, anon;
revoke execute on function public.resolve_existing_or_cached_role(text, text) from public, anon;
revoke execute on function public.record_role_judge_decision(uuid, text, text, text, text, jsonb, int, jsonb) from public, anon, authenticated;

grant execute on function public.normalize_role_input(text) to authenticated, service_role;
grant execute on function public.slugify_role(text) to authenticated, service_role;
grant execute on function public.find_matching_catalog_role(text, text) to authenticated, service_role;
grant execute on function public.resolve_existing_or_cached_role(text, text) to authenticated, service_role;
grant execute on function public.record_role_judge_decision(uuid, text, text, text, text, jsonb, int, jsonb) to service_role;
