-- 04 · Participaciones y cargos
-- No hay insert/update/delete directo desde el cliente: todo va por RPC
-- security definer (migración 11) y por los triggers de este archivo.

create table public.participations (
  id         uuid primary key default gen_random_uuid(),
  work_id    uuid not null references public.works(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,  -- null = participante sin cuenta
  guest_name text check (char_length(guest_name) between 1 and 100),
  status     text not null default 'accepted'
             check (status in ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (work_id, profile_id),
  check (profile_id is not null or guest_name is not null)
);
create index participations_work    on public.participations (work_id);
create index participations_profile on public.participations (profile_id) where profile_id is not null;
create trigger participations_updated_at before update on public.participations
  for each row execute function public.set_updated_at();

-- DESVIACIÓN DEL CONTRATO (documentada en el informe): arquitectura §4 pone
-- `claim_code` como columna de `participations`. RLS no filtra columnas, y un
-- `select *` de cualquiera que pueda leer la participación expondría el código.
-- Protegerla con column privileges rompería `select('*')` de supabase-js para
-- todos. Por eso el código vive en una tabla aparte, solo legible por el subidor
-- (y de un solo uso: se borra al reclamar). La vista participations_manage
-- (migración 10) devuelve participations + claim_code para el subidor.
create table public.participation_claims (
  participation_id uuid primary key references public.participations(id) on delete cascade,
  claim_code       text not null unique,
  created_at       timestamptz not null default now()
);

create table public.participation_roles (
  id               uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.participations(id) on delete cascade,
  role_id          int references public.role_catalog(id),
  role_text        text check (char_length(btrim(role_text)) between 1 and 80),
  status           text not null default 'accepted' check (status in ('accepted', 'rejected')),
  sort             int not null default 0,
  check (num_nonnulls(role_id, role_text) = 1)
);
create index participation_roles_part on public.participation_roles (participation_id, sort);
create unique index participation_roles_uq_cat  on public.participation_roles (participation_id, role_id)
  where role_id is not null;
create unique index participation_roles_uq_text on public.participation_roles (participation_id, lower(role_text))
  where role_text is not null;

alter table public.participations       enable row level security;
alter table public.participation_claims enable row level security;
alter table public.participation_roles  enable row level security;

-- Al crear una obra, el subidor participa automáticamente (aceptada, cargo
-- «autor/a» del catálogo global; si el catálogo aún no está sembrado, texto libre).
create or replace function public.tg_works_autor_participation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_part uuid;
  v_role int;
begin
  insert into public.participations (work_id, profile_id, status, created_by)
  values (new.id, new.uploader_id, 'accepted', new.uploader_id)
  returning id into v_part;

  select id into v_role from public.role_catalog where slug = 'autor' and branch is null;
  if v_role is not null then
    insert into public.participation_roles (participation_id, role_id, status, sort)
    values (v_part, v_role, 'accepted', 0);
  else
    insert into public.participation_roles (participation_id, role_text, status, sort)
    values (v_part, 'autor', 'accepted', 0);
  end if;
  return new;
end $$;
create trigger works_autor_participation after insert on public.works
  for each row execute function public.tg_works_autor_participation();

-- Notificaciones de participación. Payload común:
--   {work_id, work_short_id, work_title, participation_id, profile_id,
--    profile_alias, profile_name, actor_id}
--  * alta/reactivación pedida por el propio autor  -> subidor: participation_new
--  * alta/reactivación hecha por el subidor        -> invitado: participation_invited
--  * reclamo de un participante sin cuenta         -> subidor: participation_new (claimed)
--  * rechazo (subidor)                             -> participante: participation_rejected
--  * retirada (participante)                       -> subidor: participation_withdrawn
-- La participación del propio subidor nunca notifica.
create or replace function public.tg_participations_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  w record;
  v_payload jsonb;
  v_alias text;
  v_name text;
  v_old_status text;
  v_old_profile uuid;
begin
  if tg_op = 'UPDATE' then
    v_old_status := old.status;
    v_old_profile := old.profile_id;
  end if;
  select id, short_id, uploader_id, title into w from public.works where id = new.work_id;
  select alias::text, display_name into v_alias, v_name from public.profiles where id = new.profile_id;
  v_payload := jsonb_build_object(
    'work_id', w.id, 'work_short_id', w.short_id, 'work_title', w.title,
    'participation_id', new.id, 'profile_id', new.profile_id,
    'profile_alias', v_alias, 'profile_name', coalesce(v_name, new.guest_name),
    'actor_id', auth.uid());

  if tg_op = 'UPDATE' and v_old_profile is null and new.profile_id is not null then
    if new.profile_id <> w.uploader_id then
      perform public._notify(w.uploader_id, 'participation_new', v_payload || '{"claimed": true}');
    end if;

  elsif tg_op = 'INSERT'
     or (v_old_status in ('rejected', 'withdrawn') and new.status in ('pending', 'accepted')) then
    if new.profile_id is not null and new.profile_id <> w.uploader_id and new.status = 'accepted' then
      if new.created_by = new.profile_id then
        perform public._notify(w.uploader_id, 'participation_new', v_payload);
      elsif new.created_by = w.uploader_id then
        perform public._notify(new.profile_id, 'participation_invited', v_payload);
      end if;
    end if;

  elsif v_old_status <> new.status then
    if new.status = 'rejected' and new.profile_id is not null then
      perform public._notify(new.profile_id, 'participation_rejected', v_payload);
    elsif new.status = 'withdrawn' and new.profile_id is distinct from w.uploader_id then
      perform public._notify(w.uploader_id, 'participation_withdrawn', v_payload);
    end if;
  end if;
  return new;
end $$;
create trigger participations_notify after insert or update on public.participations
  for each row execute function public.tg_participations_notify();
