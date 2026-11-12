-- Denuncias y moderación
select t.setup();
select t.login(t.alice());
select t.mkwork('Obra denunciada') as wid \gset
insert into public.awards (id, name, lang, created_by) values ('20000000-0000-4000-8000-0000000000bb', '{"es":"Premio dudoso"}', 'es', auth.uid());
insert into public.attachments (work_id, kind, path, mime, size_bytes)
  values (:'wid', 'image', auth.uid() || '/a.webp', 'image/webp', 10);
select t.ok((select not verified from public.awards limit 1), 'premio nuevo sin verificar');
update public.awards set verified = true where id = '20000000-0000-4000-8000-0000000000bb';
select t.ok((select not verified from public.awards limit 1), 'el creador no puede auto-verificar su premio');

-- denuncias
select t.login(t.bob());
insert into public.reports (reporter_id, target_type, target_id, reason, details) values (auth.uid(), 'work', :'wid', 'copyright', 'Es mía');
select t.fails(format($q$insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'work', %L, 'spam')$q$, :'wid'), 'duplicate', 'una denuncia abierta por objetivo');
select t.fails($$insert into public.reports (reporter_id, target_type, target_id, reason) values (t.carol(), 'profile', t.alice(), 'spam')$$, 'row-level security', 'no denuncia en nombre de otro');
select t.fails($$insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'work', gen_random_uuid(), 'spam')$$, 'target_not_found', 'el objetivo debe existir');
select t.fails($$insert into public.reports (reporter_id, target_type, target_id, reason, status) values (auth.uid(), 'profile', t.alice(), 'spam', 'actioned')$$, 'row-level security', 'no fija su propio estado');
select t.eq(t.n($$select 1 from public.reports$$), 1::bigint, 'el denunciante ve solo la suya');
select t.login(t.carol());
select t.eq(t.n($$select 1 from public.reports$$), 0::bigint, 'otro usuario no ve denuncias');
select t.anon();
select t.fails($$select 1 from public.reports$$, 'permission denied', 'anónimo no lee denuncias');
select t.fails($$insert into public.reports (reporter_id, target_type, target_id, reason) values (null, 'work', t.alice(), 'spam')$$, 'permission denied', 'anónimo no denuncia');

-- solo moderadores moderan
select t.login(t.bob());
select t.fails(format($q$select public.moderate('work', %L, 'hide', 'x', null)$q$, :'wid'), 'forbidden', 'un usuario normal no modera');
select t.eq(t.n($$select 1 from public.moderation_actions$$), 0::bigint, 'un usuario no lee el registro de moderación');
select t.anon();
select t.fails(format($q$select public.moderate('work', %L, 'hide', 'x', null)$q$, :'wid'), 'permission denied', 'anónimo no modera');

select t.login(t.mod());
select t.eq(t.n($$select 1 from public.reports where status = 'open'$$), 1::bigint, 'moderación ve la cola');
select public.moderate('work', :'wid', 'hide', 'Retirada cautelar por posible infracción',
  (select id from public.reports limit 1)) as act \gset
select t.ok(:'act' is not null, 'moderate devuelve el id de la acción');
select t.eq((select status from public.works where id = :'wid'), 'hidden', 'la obra queda oculta');
select t.eq((select status from public.reports limit 1), 'actioned', 'la denuncia pasa a actioned');
select t.ok((select resolved_by = t.mod() and resolved_at is not null from public.reports limit 1), 'denuncia con resolved_by');
select t.eq(t.n(format($q$select 1 from public.moderation_actions where action = 'hide' and target_id = %L$q$, :'wid'))::int, 1, 'acción registrada');
select t.anon();
select t.eq(t.n($$select 1 from public.works_cards$$), 0::bigint, 'obra oculta fuera de works_cards');
select t.eq(t.n($$select 1 from public.works$$), 0::bigint, 'obra oculta invisible al público');
select t.login(t.mod());
select t.eq(t.n($$select 1 from public.works$$), 1::bigint, 'moderación lee la obra oculta');
select t.eq(t.n($$select 1 from public.attachments$$), 1::bigint, 'moderación lee adjuntos');
select t.login(t.alice());
select t.eq(t.n($$select 1 from public.notifications where type = 'moderation'$$), 1::bigint, 'el autor recibe aviso de moderación');
select t.eq((select payload->>'reason' from public.notifications where type = 'moderation'), 'Retirada cautelar por posible infracción', 'con la nota');
select t.fails(format($q$update public.works set status = 'published' where id = %L$q$, :'wid'), 'moderation_only', 'el autor no restaura');

-- inmutabilidad del registro
select t.login(t.mod());
select t.fails($$update public.moderation_actions set note = 'cambiada'$$, 'permission denied', 'el moderador no edita el registro');
select t.fails($$delete from public.moderation_actions$$, 'permission denied', 'ni lo borra');
select t.owner();
select t.fails($$update public.moderation_actions set note = 'cambiada'$$, 'moderation_actions_immutable', 'ni siquiera el propietario (trigger)');
select t.fails($$delete from public.moderation_actions$$, 'moderation_actions_immutable', 'ni borra (trigger)');

-- restore, acciones inválidas, otros objetivos
select t.login(t.mod());
select public.moderate('work', :'wid', 'restore', null, null);
select t.eq((select status from public.works where id = :'wid'), 'published', 'restore devuelve a published');
select t.fails(format($q$select public.moderate('work', %L, 'suspend_user', null, null)$q$, :'wid'), 'invalid_action_for_target', 'acción incompatible con el objetivo');
select t.fails($$select public.moderate('work', gen_random_uuid(), 'hide', null, null)$$, 'target_not_found', 'objetivo inexistente');
select t.fails(format($q$select public.moderate('attachment', %L, 'hide', null, null)$q$, :'wid'), 'invalid_action_for_target', 'hide no aplica a adjuntos (error claro)');
select public.moderate('award', '20000000-0000-4000-8000-0000000000bb', 'verify_award', null, null);
select t.ok((select verified and verified_by = t.mod() from public.awards limit 1), 'moderación verifica el premio');
select t.login(t.alice());
update public.awards set organization = 'Nueva org' where id = '20000000-0000-4000-8000-0000000000bb';
select t.ok((select not verified from public.awards limit 1), 'editar un premio verificado pierde el sello');
select t.login(t.mod());
select public.moderate('attachment', (select id from public.attachments limit 1), 'delete', 'Sin derechos', null);
select t.eq(t.n($$select 1 from public.attachments$$), 0::bigint, 'adjunto eliminado');

-- suspensión de usuarios
select public.moderate('profile', t.alice(), 'suspend_user', 'Reincidencia', null);
select t.anon();
select t.eq(t.n($$select 1 from public.profiles_public where alias = 'alice'$$), 0::bigint, 'suspendida fuera de profiles_public');
select t.eq(t.n($$select 1 from public.works_cards$$), 0::bigint, 'sus obras salen de works_cards');
select t.eq(t.n($$select 1 from public.works$$), 0::bigint, 'y no son legibles');
select t.login(t.alice());
select t.fails($$select t.mkwork('Nueva')$$, 'row-level security', 'suspendida no sube obras');
select t.login(t.mod());
select t.fails($$select public.moderate('profile', t.mod(), 'suspend_user', null, null)$$, 'cannot_moderate_self', 'no se suspende a sí misma');
select public.moderate('profile', t.alice(), 'unsuspend_user', null, null);
select t.eq(t.n($$select 1 from public.profiles_public where alias = 'alice'$$), 1::bigint, 'reactivada');

-- denuncia de mensaje: moderación lee solo lo denunciado; dismiss
select t.login(t.alice());
update public.profiles set accepts_commissions = true where id = auth.uid();
select t.login(t.bob());
select public.start_conversation(t.alice(), 'other', 'Asunto', 'Mensaje denunciable', null) as conv \gset
select t.login(t.alice());
insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'message', (select id from public.messages limit 1), 'offensive');
select t.login(t.mod());
select t.eq(t.n($$select 1 from public.messages$$), 1::bigint, 'moderación lee el mensaje denunciado');
select t.eq(t.n($$select 1 from public.conversations$$), 1::bigint, 'y su conversación');
select public.moderate('message', (select id from public.messages limit 1), 'dismiss_report', 'No infringe', (select id from public.reports where target_type = 'message')) is not null as ok \gset
select t.eq((select status from public.reports where target_type = 'message'), 'dismissed', 'dismiss_report cierra la denuncia');
select t.eq(t.n($$select 1 from public.messages$$), 1::bigint, 'dismiss no borra el mensaje');
