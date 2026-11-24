-- Obras: visibilidad, edición, adjuntos, guardas de estado
select t.setup();

select t.login(t.alice());
create temp table w (k text primary key, id uuid);
grant all on w to public;
insert into w select 'pub',   t.mkwork('Obra pública');
insert into w select 'unl',   t.mkwork('Obra no listada', 'published', 'unlisted');
insert into w select 'priv',  t.mkwork('Obra privada', 'published', 'private');
insert into w select 'draft', t.mkwork('Borrador', 'draft', 'public');

select t.ok((select length(short_id) = 8 and short_id ~ '^[0-9A-Za-z]{8}$' from public.works where id = (select id from w where k='pub')), 'short_id de obra: 8 caracteres base62');
select t.ok((select published_at is not null from public.works where id = (select id from w where k='pub')), 'published_at se fija al publicar');
select t.ok((select published_at is null from public.works where id = (select id from w where k='draft')), 'borrador sin published_at');

-- participación del subidor: aceptada con cargo «autor»
select t.ok((select count(*) = 1 and bool_and(p.status = 'accepted' and p.profile_id = t.alice()
              and exists (select 1 from public.participation_roles r join public.role_catalog c on c.id = r.role_id
                          where r.participation_id = p.id and c.slug = 'autor' and r.status = 'accepted'))
             from public.participations p where p.work_id = (select id from w where k='pub')), 'el subidor participa automáticamente como autor');
select t.eq(t.n($$select 1 from public.notifications$$), 0::bigint, 'la autoparticipación no genera notificación');

-- visibilidad para terceros
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.works$$), 2::bigint, 'bob ve en works solo las publicadas (public y unlisted)');
select t.eq(t.n($$select 1 from public.works where id = (select id from w where k='unl')$$), 1::bigint, 'obra no listada accesible por id');
select t.eq(t.n($$select 1 from public.works where id = (select id from w where k='priv')$$), 0::bigint, 'obra privada invisible para terceros');
select t.eq(t.n($$select 1 from public.works where id = (select id from w where k='draft')$$), 0::bigint, 'borrador invisible para terceros');
select t.anon();
select t.eq(t.n($$select 1 from public.works$$), 2::bigint, 'anónimo ve solo las publicadas');
select t.eq(t.n($$select 1 from public.works_cards$$), 1::bigint, 'works_cards: solo published + public (sin unlisted)');
select t.eq(t.n($$select 1 from public.search_works('obra')$$), 1::bigint, 'search_works excluye unlisted/privadas/borradores');
select t.eq((select uploader_alias from public.works_cards limit 1), 'alice', 'works_cards trae uploader_alias');
select t.eq((select uploader_name from public.works_cards limit 1), 'Alice Prueba', 'works_cards trae uploader_name');
select t.eq(t.n($$select 1 from public.attachments$$), 0::bigint, 'sin adjuntos aún');
select t.fails($$update public.works_cards set lang = 'en'$$, '55000', 'works_cards no es actualizable');

-- el subidor ve las suyas
select t.login(t.alice());
select t.eq(t.n($$select 1 from public.works$$), 4::bigint, 'alice ve todas sus obras');

-- un tercero no edita ni borra ni adjunta
select t.login(t.bob());
select t.eq(t.rows($$update public.works set title = '{"es":"Robada"}' where id = (select id from w where k='pub')$$), 0::bigint, 'bob no puede editar la obra de alice');
select t.eq(t.rows($$delete from public.works where id = (select id from w where k='draft')$$), 0::bigint, 'bob no puede borrar la obra de alice');
select t.fails($$insert into public.works (uploader_id, branch, title, lang) values (t.alice(), 'plasticas', '{"es":"Suplantada"}', 'es')$$, 'row-level security', 'bob no puede crear obras a nombre de alice');
select t.fails($$insert into public.attachments (work_id, kind, path, mime, size_bytes)
                  values ((select id from w where k='pub'), 'image', auth.uid() || '/x.webp', 'image/webp', 100)$$, 'row-level security', 'bob no puede adjuntar a obra ajena');

-- el subidor cambia su obra; uploader_id y short_id son inmutables
select t.login(t.alice());
select t.eq(t.rows($$update public.works set description = '{"es":"Nueva"}', short_id = 'ZZZZZZZZ', uploader_id = t.bob() where id = (select id from w where k='pub')$$), 1::bigint, 'alice edita su obra');
select t.ok((select short_id <> 'ZZZZZZZZ' and uploader_id = t.alice() from public.works where id = (select id from w where k='pub')), 'short_id y uploader_id no cambian');

-- 'hidden' es solo de moderación
select t.fails($$update public.works set status = 'hidden' where id = (select id from w where k='pub')$$, 'moderation_only', 'el subidor no puede poner hidden');
select t.fails($$insert into public.works (uploader_id, branch, title, lang, status) values (auth.uid(), 'plasticas', '{"es":"x"}', 'es', 'hidden')$$, 'moderation_only', 'no se crea una obra hidden');
select t.owner();
update public.works set status = 'hidden' where id = (select id from w where k='priv');
select t.login(t.alice());
select t.fails($$update public.works set status = 'published' where id = (select id from w where k='priv')$$, 'moderation_only', 'el subidor no puede salir de hidden');
select t.eq(t.rows($$update public.works set place = 'Córdoba' where id = (select id from w where k='priv')$$), 1::bigint, 'sí puede editar contenido de una obra oculta');
select t.owner();
update public.works set status = 'draft' where id = (select id from w where k='priv');

-- borrado lógico
select t.login(t.alice());
select t.eq(t.rows($$update public.works set status = 'deleted' where id = (select id from w where k='draft')$$), 1::bigint, 'borrado lógico');
select t.fails($$update public.works set status = 'published' where id = (select id from w where k='draft')$$, 'moderation_only', 'no se deshace un borrado');
select t.anon();
select t.eq(t.n($$select 1 from public.works where id = (select id from w where k='draft')$$), 0::bigint, 'obra borrada invisible');

-- categoría de otra rama
select t.login(t.alice());
select t.fails($$update public.works set category_id = (select id from public.categories where slug = 'novela') where id = (select id from w where k='pub')$$,
  'category_branch_mismatch', 'la categoría debe ser de la rama de la obra');
select t.eq(t.rows($$update public.works set category_id = (select id from public.categories where slug = 'pintura') where id = (select id from w where k='pub')$$), 1::bigint, 'categoría de su rama');

-- adjuntos: máximo 6, límites de tamaño, ruta propia, portada
select t.login(t.alice());
do $$
declare i int; v_pub uuid := (select id from w where k = 'pub');
begin
  for i in 1..6 loop
    insert into public.attachments (work_id, kind, path, thumb_path, mime, size_bytes, sort)
    values (v_pub, 'image', auth.uid() || '/' || v_pub || '/img' || i || '.webp',
            auth.uid() || '/' || v_pub || '/img' || i || '-thumb.webp', 'image/webp', 5000, i);
  end loop;
  perform t.fails(format($q$insert into public.attachments (work_id, kind, path, mime, size_bytes) values (%L, 'image', %L, 'image/webp', 100)$q$,
    v_pub, auth.uid() || '/x7.webp'), 'attachment_limit', 'séptimo adjunto rechazado');
end $$;
select t.eq(t.n($$select 1 from public.attachments where work_id = (select id from w where k='pub')$$), 6::bigint, 'seis adjuntos');
select t.fails($$insert into public.attachments (work_id, kind, path, mime, size_bytes) values ((select id from w where k='unl'), 'image', auth.uid() || '/big.webp', 'image/webp', 10485761)$$,
  'check', 'imagen > 10 MB rechazada');
select t.fails($$insert into public.attachments (work_id, kind, path, mime, size_bytes) values ((select id from w where k='unl'), 'audio', auth.uid() || '/big.mp3', 'audio/mpeg', 31457281)$$,
  'check', 'audio > 30 MB rechazado');
select t.fails($$insert into public.attachments (work_id, kind, path, mime, size_bytes) values ((select id from w where k='unl'), 'pdf', auth.uid() || '/a.pdf', 'image/png', 100)$$,
  'check', 'mime incoherente con el tipo');
select t.fails($$insert into public.attachments (work_id, kind, path, mime, size_bytes) values ((select id from w where k='unl'), 'image', 'otro-usuario/x.webp', 'image/webp', 100)$$,
  'row-level security', 'la ruta debe estar en la carpeta del subidor');
select t.eq(t.rows($$delete from public.attachments where work_id = (select id from w where k='pub') and sort = 6$$), 1::bigint, 'borrar un adjunto');
select t.eq(t.rows($$insert into public.attachments (work_id, kind, path, mime, size_bytes) values ((select id from w where k='pub'), 'pdf', auth.uid() || '/doc.pdf', 'application/pdf', 100)$$), 1::bigint, 'tras borrar, cabe otro');

-- portada: cover_attachment_id o primera imagen; cover_path = thumb_path
select t.ok((select cover_path like '%img1-thumb.webp' from public.works_cards where id = (select id from w where k='pub')), 'cover_path: primera imagen (miniatura) por defecto');
update public.works set cover_attachment_id = (select id from public.attachments where work_id = (select id from w where k='pub') and sort = 3)
 where id = (select id from w where k='pub');
select t.ok((select cover_path like '%img3-thumb.webp' from public.works_cards where id = (select id from w where k='pub')), 'cover_path: la portada elegida');
select t.fails($$update public.works set cover_attachment_id = (select id from public.attachments where kind = 'pdf' limit 1) where id = (select id from w where k='pub')$$,
  'invalid_cover', 'la portada debe ser imagen');

-- adjuntos visibles solo si la obra lo es
select t.login(t.bob());
select t.eq(t.n($$select 1 from public.attachments where work_id = (select id from w where k='pub')$$), 6::bigint, 'adjuntos de obra pública legibles');
select t.eq(t.n($$select 1 from public.attachments where work_id = (select id from w where k='priv')$$), 0::bigint, 'adjuntos de obra no visible, no');

-- obra de otro tipo de rama para el siguiente test: campos de rama
select t.login(t.alice());
select t.fails($$update public.works set pages = 0 where id = (select id from w where k='pub')$$, 'check', 'páginas > 0');
select t.fails($$update public.works set video_url = 'javascript:alert(1)' where id = (select id from w where k='pub')$$, 'check', 'vídeo solo http(s)');
select t.fails($$update public.works set title = '{"en":"Only English"}' where id = (select id from w where k='pub')$$, 'check', 'título obligatorio en el idioma de origen');
select t.fails($$update public.works set title = '{"es":"x","fr":"y"}' where id = (select id from w where k='pub')$$, 'check', 'solo idiomas es/en');
