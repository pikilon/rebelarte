-- Contacto: opt-in del autor, límites por hora, privacidad, suspendidos
select t.setup();
select t.login(t.alice());
select t.mkwork('Cuadro') as _ \gset

select t.login(t.bob());
select t.fails($$select public.start_conversation(t.alice(), 'commission', 'Hola', 'Quiero un encargo', null)$$, 'recipient_not_accepting', 'no acepta encargos ni vende');
select t.anon();
select t.fails($$select public.start_conversation(t.alice(), 'commission', 'Hola', 'x', null)$$, 'permission denied', 'anónimo no puede escribir');

select t.login(t.alice());
update public.profiles set accepts_commissions = true where id = auth.uid();
select t.login(t.bob());
select public.start_conversation(t.alice(), 'commission', 'Encargo', 'Hola, ¿haces retratos?', null) as conv \gset
select t.ok(:'conv' is not null, 'conversación creada cuando el autor acepta encargos');
select t.fails($$select public.start_conversation(t.bob(), 'other', 'Yo', 'yo', null)$$, 'cannot_message_self', 'no a uno mismo');
select t.fails($$select public.start_conversation(t.alice(), 'raro', 'S', 'B', null)$$, 'invalid_kind', 'tipo inválido');
select t.fails($$select public.start_conversation(t.alice(), 'other', 'S', repeat('x', 5001), null)$$, 'invalid_body', 'cuerpo > 5000');
select t.fails($$insert into public.conversations (recipient_id, sender_id, kind, subject) values (t.alice(), auth.uid(), 'other', 'x')$$, 'permission denied', 'no hay insert directo');
select t.fails($$insert into public.messages (conversation_id, sender_id, body) values (gen_random_uuid(), auth.uid(), 'x')$$, 'permission denied', 'no hay insert directo en mensajes');

-- notificación y lectura
select t.login(t.alice());
select t.eq(t.n($$select 1 from public.notifications where type='message_new'$$), 1::bigint, 'mensaje nuevo notifica al destinatario');
select t.eq(t.n($$select 1 from public.messages$$), 1::bigint, 'el destinatario ve el mensaje');
select t.eq(t.rows($$update public.messages set read_at = now()$$), 1::bigint, 'el destinatario marca como leído');
select t.fails($$update public.messages set body = 'editado'$$, 'permission denied', 'no se edita el cuerpo');
select t.eq(t.rows($$update public.notifications set read_at = now()$$), 1::bigint, 'marca notificación leída');
select t.fails($$update public.notifications set payload = '{}'$$, 'permission denied', 'no edita el payload');
select public.send_message(:'conv'::uuid, 'Sí, claro');
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.messages$$), 2::bigint, 'el remitente ve la respuesta');
select t.eq(t.rows($$update public.messages set read_at = now() where sender_id = auth.uid()$$), 0::bigint, 'no marca como leídos sus propios mensajes');
select t.eq(t.n($$select 1 from public.notifications where type='message_new'$$), 1::bigint, 'respuesta notifica al remitente original');

-- terceros
select t.login(t.carol());
select t.eq(t.n($$select 1 from public.conversations$$), 0::bigint, 'tercero no ve conversaciones');
select t.eq(t.n($$select 1 from public.messages$$), 0::bigint, 'tercero no ve mensajes');
select t.fails(format('select public.send_message(%L, %L)', :'conv', 'intruso'), 'conversation_not_found', 'tercero no puede escribir en la conversación');
select t.eq(t.rows($$update public.conversations set deleted_by_sender = true$$), 0::bigint, 'tercero no marca borrados');
select t.login(t.mod());
select t.eq(t.n($$select 1 from public.messages$$), 0::bigint, 'moderación no lee mensajes no denunciados');

-- marcas de borrado: cada parte la suya
select t.login(t.bob());
select t.eq(t.rows($$update public.conversations set deleted_by_sender = true$$), 1::bigint, 'el remitente marca su borrado');
select t.fails($$update public.conversations set deleted_by_recipient = true$$, 'forbidden', 'no marca el borrado del otro');
select t.fails($$update public.conversations set subject = 'otro'$$, 'permission denied', 'no cambia el asunto');

-- límite de 5 conversaciones por hora
select t.login(t.bob());
do $$
declare i int;
begin
  for i in 2..5 loop
    perform public.start_conversation(t.alice(), 'other', 'Conv ' || i, 'Mensaje ' || i, null);
  end loop;
  perform t.fails($q$select public.start_conversation(t.alice(), 'other', 'Sexta', 'x', null)$q$, 'rate_limited', 'sexta conversación en una hora rechazada');
end $$;
-- límite de 30 mensajes por hora
select t.owner();
delete from public.messages where sender_id = t.bob() and body like 'Mensaje%';
select t.login(t.bob());
do $$
declare i int; v_conv uuid := (select id from public.conversations limit 1);
begin
  -- con 1 mensaje previo (el inicial), 29 más llegan a 30
  for i in 1..(30 - (select count(*) from public.messages where sender_id = auth.uid()))::int loop
    perform public.send_message(v_conv, 'm' || i);
  end loop;
  perform t.fails(format($q$select public.send_message(%L, 'uno más')$q$, v_conv), 'rate_limited', 'mensaje 31 en una hora rechazado');
end $$;

-- suspendido no escribe
select t.owner();
update public.profiles set status = 'suspended' where id = t.bob();
select t.login(t.bob());
select t.fails(format('select public.send_message(%L, %L)', :'conv', 'hola'), 'account_suspended', 'suspendido no envía mensajes');
select t.fails($$select public.start_conversation(t.alice(), 'other', 'S', 'B', null)$$, 'account_suspended', 'suspendido no inicia conversaciones');
select t.fails($$select t.mkwork('No debería')$$, 'row-level security', 'suspendido no crea obras');
select t.fails($$insert into public.reports (reporter_id, target_type, target_id, reason) values (auth.uid(), 'profile', t.alice(), 'spam')$$, 'row-level security', 'suspendido no denuncia');
