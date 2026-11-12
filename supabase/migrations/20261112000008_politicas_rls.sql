-- 08 · Funciones auxiliares de autorización, políticas RLS y privilegios
--
-- Modelo de seguridad:
--  * Todas las tablas tienen RLS activada. Además se parte de cero privilegios
--    (revoke all) y se concede solo lo necesario, porque Supabase concede por
--    defecto ALL sobre las tablas nuevas a anon/authenticated.
--  * Las funciones is_*/can_* son security definer para evitar recursión de RLS
--    entre obras <-> participaciones y para leer profiles (que solo es legible
--    por su dueño). Solo devuelven booleanos sobre el usuario actual.
--  * Para añadir tablas nuevas en el futuro: activar RLS, crear políticas y
--    conceder privilegios explícitamente (no hay grants por defecto aquí).

-- ---------------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------------

-- Obra visible a terceros: publicada, pública o no listada, y subidor activo.
create or replace function public.is_work_public(p_work uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.works w join public.profiles p on p.id = w.uploader_id
    where w.id = p_work and w.status = 'published'
      and w.visibility in ('public', 'unlisted') and p.status = 'active')
$$;

create or replace function public.is_work_uploader(p_work uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.works where id = p_work and uploader_id = auth.uid())
$$;

create or replace function public.is_work_participant(p_work uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participations
                 where work_id = p_work and profile_id = auth.uid() and status = 'accepted')
$$;

-- Lectura de la obra: pública, o subidor, o participante aceptado, o moderación.
create or replace function public.can_read_work(p_work uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_work_public(p_work) or public.is_work_uploader(p_work)
      or public.is_work_participant(p_work) or public.is_moderator()
$$;

create or replace function public.is_participation_uploader(p_part uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participations p join public.works w on w.id = p.work_id
                 where p.id = p_part and w.uploader_id = auth.uid())
$$;

-- Subidor de la obra o titular de la participación.
create or replace function public.is_participation_party(p_part uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.participations p join public.works w on w.id = p.work_id
                 where p.id = p_part and (w.uploader_id = auth.uid() or p.profile_id = auth.uid()))
$$;

create or replace function public.is_conversation_party(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations
                 where id = p_conv and auth.uid() in (sender_id, recipient_id))
$$;

-- Privacidad: moderación solo lee mensajes/conversaciones que han sido denunciados.
create or replace function public.is_reported_message(p_msg uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_moderator() and exists (
    select 1 from public.reports where target_type = 'message' and target_id = p_msg)
$$;

create or replace function public.is_reported_conversation(p_conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_moderator() and exists (
    select 1 from public.reports r join public.messages m on m.id = r.target_id
    where r.target_type = 'message' and m.conversation_id = p_conv)
$$;

-- ---------------------------------------------------------------------------
-- Privilegios base: partir de cero
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catálogos: lectura pública; edición solo administradores
-- ---------------------------------------------------------------------------
grant select on public.branches, public.categories, public.role_catalog, public.licenses to anon, authenticated;
grant insert, update, delete on public.branches, public.categories, public.role_catalog, public.licenses to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create policy branches_read   on public.branches   for select to anon, authenticated using (true);
create policy categories_read on public.categories for select to anon, authenticated using (true);
create policy roles_read      on public.role_catalog for select to anon, authenticated using (true);
create policy licenses_read   on public.licenses   for select to anon, authenticated using (true);

create policy branches_admin   on public.branches   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy categories_admin on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy roles_admin      on public.role_catalog for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy licenses_admin   on public.licenses   for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Perfiles
--   Lectura directa: solo el propio perfil y moderación. Los demás usan la
--   vista profiles_public y la RPC profile_public (migración 10).
--   Alta: solo por RPC create_profile. Baja: en cascada desde auth.users.
--   Edición: solo columnas listadas (no role, status, short_id, id).
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (alias, display_name, lang, headline, cover_letter, location, avatar_path,
              contact_email, show_email, accepts_commissions, sells_works, rate_text,
              rate_price, field_visibility)
  on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_moderator());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and status = 'active');   -- un suspendido no edita

-- ---------------------------------------------------------------------------
-- CV
-- ---------------------------------------------------------------------------
grant select on public.cv_entries, public.profile_attachments to anon, authenticated;
grant insert, update, delete on public.cv_entries, public.profile_attachments to authenticated;

-- visibilidad por entrada: public (todos), registered (con sesión), private (dueño)
create policy cv_entries_select on public.cv_entries for select to anon, authenticated
  using (
    profile_id = auth.uid()
    or (public.is_active_profile(profile_id)
        and (visibility = 'public' or (visibility = 'registered' and auth.uid() is not null)))
  );
create policy cv_entries_write on public.cv_entries for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_user());
create policy cv_entries_update on public.cv_entries for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_active_user());
create policy cv_entries_delete on public.cv_entries for delete to authenticated
  using (profile_id = auth.uid());

create policy profile_attachments_select on public.profile_attachments for select to anon, authenticated
  using (profile_id = auth.uid() or public.is_active_profile(profile_id) or public.is_moderator());
create policy profile_attachments_insert on public.profile_attachments for insert to authenticated
  with check (profile_id = auth.uid() and public.is_active_user()
              and path like auth.uid()::text || '/%');
create policy profile_attachments_update on public.profile_attachments for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and public.is_active_user() and path like auth.uid()::text || '/%');
create policy profile_attachments_delete on public.profile_attachments for delete to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Obras
--   Lectura: publicada (public/unlisted) para todos; el subidor, los participantes
--   aceptados y moderación ven además el resto. NOTA: «unlisted» no puede
--   excluirse de la lectura directa por RLS (hay que poder abrirla por su
--   enlace); los listados y la búsqueda usan works_cards / search_works, que
--   solo devuelven las públicas.
--   Escritura: el subidor. No hay borrado real salvo borradores (el borrado es
--   lógico: status = 'deleted'). 'hidden' lo gestiona tg_works_guard.
-- ---------------------------------------------------------------------------
grant select on public.works to anon, authenticated;
grant insert, update, delete on public.works to authenticated;

-- La condición del subidor va inline (no solo vía can_read_work): una función
-- stable no ve la fila que la propia sentencia acaba de insertar, y sin ella
-- `insert ... returning` fallaría para el subidor.
create policy works_select on public.works for select to anon, authenticated
  using (uploader_id = auth.uid()
         or (status = 'published' and visibility in ('public', 'unlisted')
             and public.is_active_profile(uploader_id))
         or public.is_work_participant(id)
         or public.is_moderator());
create policy works_insert on public.works for insert to authenticated
  with check (uploader_id = auth.uid() and public.is_active_user()
              and status in ('draft', 'review', 'published'));
create policy works_update on public.works for update to authenticated
  using (uploader_id = auth.uid())
  with check (uploader_id = auth.uid() and public.is_active_user());
create policy works_delete on public.works for delete to authenticated
  using (uploader_id = auth.uid() and status = 'draft');

-- Adjuntos: legibles como la obra; los escribe el subidor y solo en su carpeta
-- de storage (<uid>/...), para que no pueda enlazar archivos ajenos.
grant select on public.attachments to anon, authenticated;
grant insert, update, delete on public.attachments to authenticated;

create policy attachments_select on public.attachments for select to anon, authenticated
  using (public.can_read_work(work_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.is_work_uploader(work_id) and public.is_active_user()
              and path like auth.uid()::text || '/%');
create policy attachments_update on public.attachments for update to authenticated
  using (public.is_work_uploader(work_id))
  with check (public.is_work_uploader(work_id) and public.is_active_user()
              and path like auth.uid()::text || '/%');
create policy attachments_delete on public.attachments for delete to authenticated
  using (public.is_work_uploader(work_id) or public.is_moderator());
grant delete on public.attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Participaciones: solo lectura directa (la escritura es por RPC).
--   Públicas: las aceptadas de obras visibles. Rechazadas/retiradas: solo subidor,
--   titular y moderación. Roles: los aceptados son públicos; los rechazados solo
--   para subidor/titular/moderación.
--   participation_claims (código de reclamo): solo el subidor.
-- ---------------------------------------------------------------------------
grant select on public.participations, public.participation_roles to anon, authenticated;
grant select on public.participation_claims to authenticated;

create policy participations_select on public.participations for select to anon, authenticated
  using ((status = 'accepted' and public.is_work_public(work_id))
         or profile_id = auth.uid()
         or public.is_work_uploader(work_id)
         or public.is_moderator());

create policy participation_roles_select on public.participation_roles for select to anon, authenticated
  using (
    exists (select 1 from public.participations p where p.id = participation_id)   -- RLS de participations
    and (status = 'accepted'
         or public.is_participation_party(participation_id)
         or public.is_moderator())
  );

create policy participation_claims_select on public.participation_claims for select to authenticated
  using (public.is_participation_uploader(participation_id));

-- ---------------------------------------------------------------------------
-- Premios
--   Lectura pública. Cualquier usuario activo puede declarar un premio; solo el
--   creador lo edita/borra (y pierde el sello si cambia datos clave). El sello
--   «verificado» lo pone moderación (RPC moderate, tg_awards_guard).
--   Enlaces: el subidor enlaza premios a sus obras; cada uno a su propio perfil.
-- ---------------------------------------------------------------------------
grant select on public.awards, public.award_links to anon, authenticated;
grant insert, update, delete on public.awards to authenticated;
grant insert, delete on public.award_links to authenticated;

create policy awards_select on public.awards for select to anon, authenticated using (true);
create policy awards_insert on public.awards for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_user());
create policy awards_update on public.awards for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and public.is_active_user());
create policy awards_delete on public.awards for delete to authenticated
  using (created_by = auth.uid() and not verified);

create policy award_links_select on public.award_links for select to anon, authenticated
  using ((work_id is not null and public.can_read_work(work_id))
         or (profile_id is not null and public.is_active_profile(profile_id))
         or created_by = auth.uid());
create policy award_links_insert on public.award_links for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_user()
              and ((work_id is not null and public.is_work_uploader(work_id))
                   or profile_id = auth.uid()));
create policy award_links_delete on public.award_links for delete to authenticated
  using (created_by = auth.uid()
         or (work_id is not null and public.is_work_uploader(work_id))
         or profile_id = auth.uid()
         or public.is_moderator());

-- ---------------------------------------------------------------------------
-- Contacto: solo las dos partes. Altas por RPC. Cada parte puede marcar su
-- propio borrado; el destinatario marca mensajes como leídos.
-- Moderación solo lee lo denunciado.
-- ---------------------------------------------------------------------------
grant select on public.conversations to authenticated;
grant update (deleted_by_sender, deleted_by_recipient) on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;

create policy conversations_select on public.conversations for select to authenticated
  using (auth.uid() in (sender_id, recipient_id) or public.is_reported_conversation(id));
create policy conversations_update on public.conversations for update to authenticated
  using (auth.uid() in (sender_id, recipient_id))
  with check (auth.uid() in (sender_id, recipient_id));

create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_party(conversation_id) or public.is_reported_message(id));
create policy messages_mark_read on public.messages for update to authenticated
  using (public.is_conversation_party(conversation_id) and sender_id <> auth.uid())
  with check (public.is_conversation_party(conversation_id) and sender_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- Notificaciones: solo el dueño; puede marcar read_at y borrar.
-- ---------------------------------------------------------------------------
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Denuncias: las crea cualquier usuario activo; las leen moderación y el
-- propio denunciante (para poder usar insert(...).select()). Se resuelven por
-- la RPC moderate.
-- ---------------------------------------------------------------------------
grant insert, select on public.reports to authenticated;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user()
              and status = 'open' and resolved_by is null and resolved_at is null);
create policy reports_select on public.reports for select to authenticated
  using (public.is_moderator() or reporter_id = auth.uid());

-- Registro de moderación: solo lectura para moderación; se escribe por moderate.
grant select on public.moderation_actions to authenticated;
create policy moderation_actions_select on public.moderation_actions for select to authenticated
  using (public.is_moderator());
