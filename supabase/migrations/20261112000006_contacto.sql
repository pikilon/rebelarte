-- 06 · Contacto interno (conversaciones y mensajes)
-- Alta solo por RPC start_conversation / send_message (migración 12).

create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  recipient_id         uuid not null references public.profiles(id) on delete cascade,
  sender_id            uuid not null references public.profiles(id) on delete cascade,
  work_id              uuid references public.works(id) on delete set null,
  kind                 text not null check (kind in ('commission','purchase','license','collaboration','other')),
  subject              text not null check (char_length(btrim(subject)) between 1 and 200),
  created_at           timestamptz not null default now(),
  last_message_at      timestamptz not null default now(),
  deleted_by_sender    boolean not null default false,
  deleted_by_recipient boolean not null default false,
  check (recipient_id <> sender_id)
);
create index conversations_recipient on public.conversations (recipient_id, last_message_at desc);
create index conversations_sender    on public.conversations (sender_id, last_message_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index messages_conversation on public.messages (conversation_id, created_at);
create index messages_sender_recent on public.messages (sender_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- Un cliente solo puede cambiar su propia marca de borrado en la conversación
-- (las columnas con UPDATE concedido ya son solo esas dos; esto evita que una
-- parte toque la marca de la otra).
create or replace function public.tg_conversations_guard()
returns trigger language plpgsql as $$
begin
  if public.is_client() then
    if (new.deleted_by_sender is distinct from old.deleted_by_sender and auth.uid() <> old.sender_id)
    or (new.deleted_by_recipient is distinct from old.deleted_by_recipient and auth.uid() <> old.recipient_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger conversations_guard before update on public.conversations
  for each row execute function public.tg_conversations_guard();

-- El destinatario del mensaje solo puede marcarlo como leído.
create or replace function public.tg_messages_guard()
returns trigger language plpgsql as $$
begin
  if public.is_client() and (
       new.id is distinct from old.id or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at) then
    raise exception 'forbidden_columns' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger messages_guard before update on public.messages
  for each row execute function public.tg_messages_guard();

-- Mensaje nuevo: actualiza la conversación (orden, reaparece si la otra parte la
-- había borrado) y notifica a la otra parte.
create or replace function public.tg_messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  v_other := case when new.sender_id = c.sender_id then c.recipient_id else c.sender_id end;
  update public.conversations
     set last_message_at = new.created_at,
         deleted_by_sender    = case when v_other = c.sender_id    then false else deleted_by_sender end,
         deleted_by_recipient = case when v_other = c.recipient_id then false else deleted_by_recipient end
   where id = c.id;
  perform public._notify(v_other, 'message_new', jsonb_build_object(
    'conversation_id', c.id, 'message_id', new.id, 'sender_id', new.sender_id,
    'work_id', c.work_id, 'subject', c.subject));
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.tg_messages_after_insert();
