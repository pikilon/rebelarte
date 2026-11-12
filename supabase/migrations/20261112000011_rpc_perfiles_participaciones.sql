-- 11 · RPC de perfiles y participaciones (security definer)
--
-- Errores: todas lanzan `raise exception '<codigo>'` con un código en minúsculas
-- que el frontend puede mapear a texto:
--   not_authenticated (28000) · profile_required · account_suspended (42501) ·
--   forbidden (42501) · *_not_found (P0002) · y códigos de validación (P0001).
-- Todas fijan search_path y comprueban auth.uid().

-- Usuario autenticado, con perfil y activo. Interna (no ejecutable por clientes).
create or replace function public._require_active()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select status into v_status from public.profiles where id = v_uid;
  if not found then
    raise exception 'profile_required' using errcode = 'P0001';
  end if;
  if v_status <> 'active' then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  return v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- create_profile: primer paso tras el primer acceso (/mi/bienvenida)
-- Errores: invalid_alias, reserved_alias, alias_taken, invalid_name,
--          invalid_lang, profile_exists.
-- ---------------------------------------------------------------------------
create or replace function public.create_profile(p_alias text, p_display_name text, p_lang text default 'es')
returns public.profiles
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_alias text := lower(btrim(coalesce(p_alias, '')));
  v_name text := btrim(coalesce(p_display_name, ''));
  v_row public.profiles;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'profile_exists' using errcode = 'P0001';
  end if;
  if v_alias !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' then
    raise exception 'invalid_alias' using errcode = 'P0001';
  end if;
  if v_alias = any (array['buscar','rama','obra','entrar','mi','moderacion','legal','admin',
                          'api','c','o','es','en','static','_app','share']) then
    raise exception 'reserved_alias' using errcode = 'P0001';
  end if;
  if char_length(v_name) not between 1 and 80 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;
  if p_lang is null or p_lang not in ('es', 'en') then
    raise exception 'invalid_lang' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where alias = v_alias::extensions.citext) then
    raise exception 'alias_taken' using errcode = '23505';
  end if;

  insert into public.profiles (id, alias, display_name, lang)
  values (v_uid, v_alias, v_name, p_lang)
  returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- Cargos: valida y guarda un array jsonb [{"role_id": n} | {"role_text": "..."}]
-- Interna. Errores: roles_required, too_many_roles, invalid_role.
-- ---------------------------------------------------------------------------
create or replace function public._insert_roles(p_participation uuid, p_roles jsonb, p_branch text)
returns void language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  i int := 0;
  v_id int;
  v_text text;
begin
  if p_roles is null or jsonb_typeof(p_roles) <> 'array' or jsonb_array_length(p_roles) = 0 then
    raise exception 'roles_required' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_roles) > 10 then
    raise exception 'too_many_roles' using errcode = 'P0001';
  end if;
  for r in select * from jsonb_array_elements(p_roles) loop
    v_id := null; v_text := null;
    if jsonb_typeof(r) <> 'object' then
      raise exception 'invalid_role' using errcode = 'P0001';
    end if;
    if (r ->> 'role_id') is not null then
      if (r ->> 'role_id') !~ '^[0-9]{1,9}$' then
        raise exception 'invalid_role' using errcode = 'P0001';
      end if;
      v_id := (r ->> 'role_id')::int;
      if not exists (select 1 from public.role_catalog
                     where id = v_id and (branch is null or branch = p_branch)) then
        raise exception 'invalid_role' using errcode = 'P0001';
      end if;
    elsif (r ->> 'role_text') is not null then
      v_text := btrim(r ->> 'role_text');
      if char_length(v_text) not between 1 and 80 then
        raise exception 'invalid_role' using errcode = 'P0001';
      end if;
    else
      raise exception 'invalid_role' using errcode = 'P0001';
    end if;
    insert into public.participation_roles (participation_id, role_id, role_text, status, sort)
    values (p_participation, v_id, v_text, 'accepted', i)
    on conflict do nothing;   -- cargos repetidos se ignoran
    i := i + 1;
  end loop;
end $$;

-- Código de reclamo: 12 caracteres sin ambiguos (sin 0/O/1/I), único.
create or replace function public._gen_claim_code()
returns text language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 símbolos
  v text;
  b bytea;
  i int;
begin
  loop
    b := extensions.gen_random_bytes(12);
    v := '';
    for i in 0..11 loop
      v := v || substr(alphabet, (get_byte(b, i) % 32) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.participation_claims where claim_code = v);
  end loop;
  return v;
end $$;

-- ---------------------------------------------------------------------------
-- request_participation: el autor se apunta a una obra visible. Queda aceptada.
-- Si había retirado antes su participación, se reactiva; si el subidor la
-- rechazó, no puede volver a pedirla. Devuelve el id de la participación.
-- ---------------------------------------------------------------------------
create or replace function public.request_participation(p_work_id uuid, p_roles jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  w public.works;
  pa public.participations;
  v_id uuid;
begin
  select * into w from public.works where id = p_work_id;
  if not found or not public.is_work_public(p_work_id) then
    raise exception 'work_not_found' using errcode = 'P0002';
  end if;

  select * into pa from public.participations
   where work_id = p_work_id and profile_id = v_uid for update;
  if found then
    if pa.status in ('pending', 'accepted') then
      raise exception 'already_participating' using errcode = 'P0001';
    elsif pa.status = 'rejected' then
      raise exception 'participation_rejected' using errcode = '42501';
    end if;
    -- withdrawn -> reactivar con los nuevos cargos
    delete from public.participation_roles where participation_id = pa.id;
    update public.participations set status = 'accepted', created_by = v_uid where id = pa.id;
    v_id := pa.id;
  else
    insert into public.participations (work_id, profile_id, status, created_by)
    values (p_work_id, v_uid, 'accepted', v_uid)
    returning id into v_id;
  end if;
  perform public._insert_roles(v_id, p_roles, w.branch);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- add_guest_participant: el subidor lista a alguien sin cuenta. Devuelve el
-- código para que esa persona reclame su participación (claim_participation).
-- ---------------------------------------------------------------------------
create or replace function public.add_guest_participant(p_work_id uuid, p_guest_name text, p_roles jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  w public.works;
  v_name text := btrim(coalesce(p_guest_name, ''));
  v_id uuid;
  v_code text;
begin
  select * into w from public.works where id = p_work_id;
  if not found then
    raise exception 'work_not_found' using errcode = 'P0002';
  end if;
  if w.uploader_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if w.status = 'deleted' then
    raise exception 'work_not_found' using errcode = 'P0002';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  insert into public.participations (work_id, profile_id, guest_name, status, created_by)
  values (p_work_id, null, v_name, 'accepted', v_uid)
  returning id into v_id;
  perform public._insert_roles(v_id, p_roles, w.branch);

  v_code := public._gen_claim_code();
  insert into public.participation_claims (participation_id, claim_code) values (v_id, v_code);
  return v_code;
end $$;

-- ---------------------------------------------------------------------------
-- invite_participant: el subidor añade a un autor con cuenta (por alias). Queda
-- aceptada; el invitado recibe notificación y puede retirarse. Devuelve el id.
-- ---------------------------------------------------------------------------
create or replace function public.invite_participant(p_work_id uuid, p_alias text, p_roles jsonb)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := public._require_active();
  w public.works;
  v_target uuid;
  pa public.participations;
  v_id uuid;
begin
  select * into w from public.works where id = p_work_id;
  if not found or w.status = 'deleted' then
    raise exception 'work_not_found' using errcode = 'P0002';
  end if;
  if w.uploader_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id into v_target from public.profiles
   where alias = btrim(coalesce(p_alias, ''))::extensions.citext and status = 'active';
  if v_target is null then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  select * into pa from public.participations
   where work_id = p_work_id and profile_id = v_target for update;
  if found then
    if pa.status in ('pending', 'accepted') then
      raise exception 'already_participating' using errcode = 'P0001';
    end if;
    delete from public.participation_roles where participation_id = pa.id;
    update public.participations set status = 'accepted', created_by = v_uid where id = pa.id;
    v_id := pa.id;
  else
    insert into public.participations (work_id, profile_id, status, created_by)
    values (p_work_id, v_target, 'accepted', v_uid)
    returning id into v_id;
  end if;
  perform public._insert_roles(v_id, p_roles, w.branch);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- set_participation_status: el subidor rechaza ('rejected'); el participante se
-- retira ('withdrawn'). El subidor no puede rechazar su propia participación
-- (puede retirarse como cualquier participante).
-- ---------------------------------------------------------------------------
create or replace function public.set_participation_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  pa public.participations;
  v_uploader uuid;
begin
  if p_status is null or p_status not in ('rejected', 'withdrawn') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into pa from public.participations where id = p_id for update;
  if not found then
    raise exception 'participation_not_found' using errcode = 'P0002';
  end if;
  select uploader_id into v_uploader from public.works where id = pa.work_id;

  if p_status = 'withdrawn' then
    if pa.profile_id is distinct from v_uid then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    if v_uploader <> v_uid then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if pa.profile_id = v_uid then
      raise exception 'own_participation' using errcode = 'P0001';
    end if;
  end if;
  if pa.status not in ('pending', 'accepted') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;

  update public.participations set status = p_status where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- set_participation_role_status: rechazo parcial (solo subidor). Si todos los
-- cargos quedan rechazados, la participación pasa a 'rejected'. Si se vuelve a
-- aceptar un cargo de una participación rechazada por esa vía, vuelve a 'accepted'.
-- ---------------------------------------------------------------------------
create or replace function public.set_participation_role_status(p_role_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  pr public.participation_roles;
  pa public.participations;
  w record;
  v_left int;
begin
  if p_status is null or p_status not in ('accepted', 'rejected') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into pr from public.participation_roles where id = p_role_id for update;
  if not found then
    raise exception 'role_not_found' using errcode = 'P0002';
  end if;
  select * into pa from public.participations where id = pr.participation_id for update;
  select id, short_id, title, uploader_id into w from public.works where id = pa.work_id;
  if w.uploader_id <> v_uid then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if pa.profile_id = v_uid then
    raise exception 'own_participation' using errcode = 'P0001';
  end if;
  if pa.status not in ('accepted', 'rejected') then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if pr.status = p_status then
    return;
  end if;

  update public.participation_roles set status = p_status where id = p_role_id;

  select count(*) into v_left from public.participation_roles
   where participation_id = pa.id and status = 'accepted';

  if p_status = 'rejected' then
    if v_left = 0 then
      -- el trigger de participations avisa del rechazo total
      update public.participations set status = 'rejected' where id = pa.id;
    elsif pa.profile_id is not null then
      perform public._notify(pa.profile_id, 'participation_rejected', jsonb_build_object(
        'work_id', w.id, 'work_short_id', w.short_id, 'work_title', w.title,
        'participation_id', pa.id, 'role_id', pr.role_id, 'role_text', pr.role_text,
        'partial', true, 'actor_id', v_uid));
    end if;
  elsif pa.status = 'rejected' then
    update public.participations set status = 'accepted' where id = pa.id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- claim_participation: enlaza una participación sin cuenta con el usuario actual.
-- El código es de un solo uso. Devuelve el id de la participación.
-- Errores: invalid_code, already_participating.
-- ---------------------------------------------------------------------------
create or replace function public.claim_participation(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_part uuid;
  pa public.participations;
begin
  select participation_id into v_part from public.participation_claims where claim_code = v_code;
  if v_part is null then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  select * into pa from public.participations where id = v_part for update;
  if pa.profile_id is not null then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.participations
             where work_id = pa.work_id and profile_id = v_uid) then
    raise exception 'already_participating' using errcode = 'P0001';
  end if;

  update public.participations set profile_id = v_uid, guest_name = null where id = v_part;
  delete from public.participation_claims where participation_id = v_part;
  return v_part;
end $$;

-- ---------------------------------------------------------------------------
-- Privilegios: escritura solo para usuarios con sesión; internas, para nadie.
-- ---------------------------------------------------------------------------
revoke execute on function public._require_active() from public, anon, authenticated;
revoke execute on function public._insert_roles(uuid, jsonb, text) from public, anon, authenticated;
revoke execute on function public._gen_claim_code() from public, anon, authenticated;
revoke execute on function public._notify(uuid, text, jsonb) from public, anon, authenticated;

revoke execute on function public.create_profile(text, text, text) from public, anon;
revoke execute on function public.request_participation(uuid, jsonb) from public, anon;
revoke execute on function public.add_guest_participant(uuid, text, jsonb) from public, anon;
revoke execute on function public.invite_participant(uuid, text, jsonb) from public, anon;
revoke execute on function public.set_participation_status(uuid, text) from public, anon;
revoke execute on function public.set_participation_role_status(uuid, text) from public, anon;
revoke execute on function public.claim_participation(text) from public, anon;
grant execute on function public.create_profile(text, text, text) to authenticated;
grant execute on function public.request_participation(uuid, jsonb) to authenticated;
grant execute on function public.add_guest_participant(uuid, text, jsonb) to authenticated;
grant execute on function public.invite_participant(uuid, text, jsonb) to authenticated;
grant execute on function public.set_participation_status(uuid, text) to authenticated;
grant execute on function public.set_participation_role_status(uuid, text) to authenticated;
grant execute on function public.claim_participation(text) to authenticated;
