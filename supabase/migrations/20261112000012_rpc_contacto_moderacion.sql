-- 12 · RPC de contacto y moderación (security definer)

-- ---------------------------------------------------------------------------
-- start_conversation: un usuario registrado escribe a un autor.
--  * El destinatario debe aceptar encargos o vender (perfil u obra).
--  * Límites por remitente: 5 conversaciones nuevas/hora y 30 mensajes/hora.
--  * Suspendidos no escriben. Devuelve el id de la conversación.
-- Errores: invalid_kind, invalid_subject, invalid_body, recipient_not_found,
--          recipient_not_accepting, rate_limited, cannot_message_self.
-- ---------------------------------------------------------------------------
create or replace function public.start_conversation(
  p_recipient_id uuid, p_kind text, p_subject text, p_body text, p_work_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
  r public.profiles;
  w public.works;
  v_ok boolean;
  v_conv uuid;
begin
  if p_kind is null or p_kind not in ('commission','purchase','license','collaboration','other') then
    raise exception 'invalid_kind' using errcode = 'P0001';
  end if;
  if char_length(v_subject) not between 1 and 200 then
    raise exception 'invalid_subject' using errcode = 'P0001';
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if p_recipient_id = v_uid then
    raise exception 'cannot_message_self' using errcode = 'P0001';
  end if;

  select * into r from public.profiles where id = p_recipient_id and status = 'active';
  if not found then
    raise exception 'recipient_not_found' using errcode = 'P0002';
  end if;

  v_ok := r.accepts_commissions or r.sells_works;
  if p_work_id is not null then
    select * into w from public.works where id = p_work_id;
    if not found or not public.is_work_public(p_work_id)
       or not (w.uploader_id = p_recipient_id
               or exists (select 1 from public.participations pa
                          where pa.work_id = p_work_id and pa.profile_id = p_recipient_id
                            and pa.status = 'accepted')) then
      raise exception 'work_not_found' using errcode = 'P0002';
    end if;
    v_ok := v_ok or w.for_sale or w.accepts_commissions;
  end if;
  if not v_ok then
    raise exception 'recipient_not_accepting' using errcode = 'P0001';
  end if;

  -- límites de envío (por hora, ventana deslizante)
  if (select count(*) from public.conversations
       where sender_id = v_uid and created_at > now() - interval '1 hour') >= 5
  or (select count(*) from public.messages
       where sender_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.conversations (recipient_id, sender_id, work_id, kind, subject)
  values (p_recipient_id, v_uid, p_work_id, p_kind, v_subject)
  returning id into v_conv;
  insert into public.messages (conversation_id, sender_id, body) values (v_conv, v_uid, v_body);
  return v_conv;
end $$;

-- ---------------------------------------------------------------------------
-- send_message: responde/continúa en una conversación de la que se es parte.
-- ---------------------------------------------------------------------------
create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active();
  v_body text := btrim(coalesce(p_body, ''));
  c public.conversations;
  v_msg uuid;
begin
  select * into c from public.conversations where id = p_conversation_id;
  if not found or v_uid not in (c.sender_id, c.recipient_id) then
    raise exception 'conversation_not_found' using errcode = 'P0002';
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'invalid_body' using errcode = 'P0001';
  end if;
  if (select count(*) from public.messages
       where sender_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.messages (conversation_id, sender_id, body)
  values (p_conversation_id, v_uid, v_body)
  returning id into v_msg;
  return v_msg;
end $$;

-- ---------------------------------------------------------------------------
-- moderate: acción de moderación (solo moderator|admin activos).
--   work:       hide | restore | delete
--   profile:    suspend_user | unsuspend_user
--   attachment: delete   (el archivo de Storage se retira aparte, con la API)
--   message:    delete
--   award:      verify_award | delete
--   cualquiera: dismiss_report (requiere p_report_id)
-- Registra siempre en moderation_actions (inmutable), cierra la denuncia si se
-- indica p_report_id y notifica (type 'moderation') al afectado con la nota,
-- como pide el procedimiento de retirada (especificación §9).
-- Devuelve el id de la acción. Errores: forbidden, invalid_action_for_target,
-- target_not_found, report_not_found, cannot_moderate_self.
-- ---------------------------------------------------------------------------
create or replace function public.moderate(
  p_target_type text, p_target_id uuid, p_action text, p_note text default null,
  p_report_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_type text := p_target_type;
  v_id uuid := p_target_id;
  v_report public.reports;
  w public.works;
  pf public.profiles;
  v_affected uuid;       -- a quién se notifica
  v_payload jsonb;
  v_action_id uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_moderator() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hide','restore','delete','suspend_user','unsuspend_user',
                                          'verify_award','dismiss_report') then
    raise exception 'invalid_action_for_target' using errcode = 'P0001';
  end if;

  if p_report_id is not null then
    select * into v_report from public.reports where id = p_report_id for update;
    if not found then
      raise exception 'report_not_found' using errcode = 'P0002';
    end if;
    v_type := coalesce(v_type, v_report.target_type);
    v_id   := coalesce(v_id, v_report.target_id);
  elsif p_action = 'dismiss_report' then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  if v_type is null or v_id is null or v_type not in ('work','profile','attachment','message','award') then
    raise exception 'target_not_found' using errcode = 'P0002';
  end if;

  v_payload := jsonb_build_object('action', p_action, 'target_type', v_type, 'target_id', v_id, 'reason', p_note);

  if p_action = 'dismiss_report' then
    null;  -- solo cierra la denuncia (más abajo)

  elsif v_type = 'work' and p_action in ('hide', 'restore', 'delete') then
    select * into w from public.works where id = v_id for update;
    if not found then raise exception 'target_not_found' using errcode = 'P0002'; end if;
    update public.works set status = case p_action
        when 'hide'    then 'hidden'
        when 'delete'  then 'deleted'
        else case when w.published_at is not null then 'published' else 'draft' end end
     where id = v_id;
    v_affected := w.uploader_id;
    v_payload := v_payload || jsonb_build_object('work_short_id', w.short_id, 'work_title', w.title);

  elsif v_type = 'profile' and p_action in ('suspend_user', 'unsuspend_user') then
    select * into pf from public.profiles where id = v_id for update;
    if not found then raise exception 'target_not_found' using errcode = 'P0002'; end if;
    if pf.id = v_uid then
      raise exception 'cannot_moderate_self' using errcode = 'P0001';
    end if;
    if pf.role in ('moderator', 'admin') and not public.is_admin() then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    update public.profiles set status = case p_action when 'suspend_user' then 'suspended' else 'active' end
     where id = v_id;
    v_affected := v_id;

  elsif v_type = 'attachment' and p_action = 'delete' then
    select work_id into v_affected from public.attachments where id = v_id;
    if not found then raise exception 'target_not_found' using errcode = 'P0002'; end if;
    select uploader_id into v_affected from public.works where id = v_affected;
    delete from public.attachments where id = v_id;

  elsif v_type = 'message' and p_action = 'delete' then
    perform 1 from public.messages where id = v_id;
    if not found then raise exception 'target_not_found' using errcode = 'P0002'; end if;
    delete from public.messages where id = v_id;   -- el autor del mensaje no se notifica

  elsif v_type = 'award' and p_action in ('verify_award', 'delete') then
    select created_by into v_affected from public.awards where id = v_id;
    if not found then raise exception 'target_not_found' using errcode = 'P0002'; end if;
    if p_action = 'verify_award' then
      update public.awards set verified = true, verified_by = v_uid, verified_at = now() where id = v_id;
    else
      delete from public.awards where id = v_id;
    end if;

  else
    raise exception 'invalid_action_for_target' using errcode = 'P0001';
  end if;

  insert into public.moderation_actions (moderator_id, target_type, target_id, action, note)
  values (v_uid, v_type, v_id, p_action, p_note)
  returning id into v_action_id;

  if p_report_id is not null then
    update public.reports
       set status = case when p_action = 'dismiss_report' then 'dismissed' else 'actioned' end,
           resolved_by = v_uid, resolved_at = now()
     where id = p_report_id;
  end if;

  if v_affected is not null and p_action <> 'dismiss_report' and v_affected <> v_uid then
    perform public._notify(v_affected, 'moderation', v_payload);
  end if;
  return v_action_id;
end $$;

revoke execute on function public.start_conversation(uuid, text, text, text, uuid) from public, anon;
revoke execute on function public.send_message(uuid, text) from public, anon;
revoke execute on function public.moderate(text, uuid, text, text, uuid) from public, anon;
grant execute on function public.start_conversation(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.send_message(uuid, text) to authenticated;
grant execute on function public.moderate(text, uuid, text, text, uuid) to authenticated;
