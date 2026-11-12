-- 07 · Notificaciones, denuncias y moderación

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('participation_new','participation_rejected','participation_withdrawn',
                                           'participation_invited','message_new','moderation')),
  payload    jsonb not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_unread on public.notifications (user_id) where read_at is null;
alter table public.notifications enable row level security;

-- Inserta una notificación. Interna: la usan triggers y RPC security definer;
-- no es ejecutable por los clientes (ver 08).
create or replace function public._notify(p_user uuid, p_type text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is not null then
    insert into public.notifications (user_id, type, payload) values (p_user, p_type, coalesce(p_payload, '{}'));
  end if;
end $$;

-- El usuario solo puede marcar como leída (la columna read_at es la única con UPDATE).
create or replace function public.tg_notifications_guard()
returns trigger language plpgsql as $$
begin
  if public.is_client() and (new.user_id is distinct from old.user_id or new.type is distinct from old.type
                             or new.payload is distinct from old.payload) then
    raise exception 'forbidden_columns' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger notifications_guard before update on public.notifications
  for each row execute function public.tg_notifications_guard();

-- Denuncias
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('work','profile','attachment','message','award')),
  target_id   uuid not null,   -- polimórfico: sin FK; se valida en el trigger
  reason      text not null check (reason in ('copyright','image_rights','minors','offensive','spam','other')),
  details     text check (char_length(details) <= 2000),
  status      text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at  timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz
);
create index reports_queue on public.reports (status, created_at);
create index reports_target on public.reports (target_type, target_id);
-- una denuncia abierta por persona y objetivo
create unique index reports_open_uq on public.reports (reporter_id, target_type, target_id)
  where status = 'open' and reporter_id is not null;

create or replace function public.tg_reports_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ok boolean;
begin
  -- el cliente no fija el estado
  if public.is_client() then
    new.status := 'open'; new.resolved_by := null; new.resolved_at := null;
  end if;
  -- el objetivo existe
  ok := case new.target_type
    when 'work'       then exists (select 1 from public.works       where id = new.target_id)
    when 'profile'    then exists (select 1 from public.profiles    where id = new.target_id)
    when 'attachment' then exists (select 1 from public.attachments where id = new.target_id)
    when 'message'    then exists (select 1 from public.messages    where id = new.target_id)
    when 'award'      then exists (select 1 from public.awards      where id = new.target_id)
  end;
  if not coalesce(ok, false) then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;
  -- antiabuso: máx. 20 denuncias por hora y persona
  if new.reporter_id is not null and (select count(*) from public.reports
       where reporter_id = new.reporter_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.tg_reports_before_insert();
alter table public.reports enable row level security;

-- Registro de moderación: solo insert (desde la RPC moderate), inmutable.
-- Sin FK a profiles a propósito: el registro debe sobrevivir a la baja del moderador.
create table public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  moderator_id uuid not null,
  target_type  text not null check (target_type in ('work','profile','attachment','message','award')),
  target_id    uuid not null,
  action       text not null check (action in ('hide','restore','delete','suspend_user','unsuspend_user',
                                               'verify_award','dismiss_report')),
  note         text check (char_length(note) <= 2000),
  created_at   timestamptz not null default now()
);
create index moderation_actions_target on public.moderation_actions (target_type, target_id);

create or replace function public.tg_moderation_actions_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'moderation_actions_immutable' using errcode = '42501';
end $$;
create trigger moderation_actions_immutable before update or delete on public.moderation_actions
  for each row execute function public.tg_moderation_actions_immutable();
alter table public.moderation_actions enable row level security;
