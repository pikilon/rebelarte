-- Storage: buckets y políticas
select t.setup();
select t.eq(t.n($$select 1 from storage.buckets where id in ('images','docs','audio','avatars') and public$$), 4::bigint, 'cuatro buckets públicos');
select t.eq((select file_size_limit from storage.buckets where id = 'images'), 10485760::bigint, 'images 10 MB');
select t.eq((select file_size_limit from storage.buckets where id = 'docs'), 20971520::bigint, 'docs 20 MB');
select t.eq((select file_size_limit from storage.buckets where id = 'audio'), 31457280::bigint, 'audio 30 MB');
select t.ok((select 'image/webp' = any(allowed_mime_types) and not 'application/pdf' = any(allowed_mime_types) from storage.buckets where id = 'images'), 'images solo imágenes');
select t.ok((select 'application/pdf' = any(allowed_mime_types) from storage.buckets where id = 'docs'), 'docs admite PDF');

select t.login(t.alice());
insert into storage.objects (bucket_id, name, owner) values ('images', t.alice() || '/w1/a.webp', t.alice());
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('images', %L, auth.uid())$q$, t.bob() || '/w1/a.webp'), 'row-level security', 'no escribe en la carpeta de otro');
select t.fails($$insert into storage.objects (bucket_id, name, owner) values ('images', 'suelto.webp', auth.uid())$$, 'row-level security', 'no escribe en la raíz');
select t.fails($$insert into storage.objects (bucket_id, name, owner) values ('otro', 'x/y', auth.uid())$$, 'violates', 'bucket no permitido');
select t.eq(t.n($$select 1 from storage.objects$$), 1::bigint, 've sus propios objetos');
select t.login(t.bob());
select t.eq(t.n($$select 1 from storage.objects$$), 0::bigint, 'no lista objetos ajenos');
select t.eq(t.rows(format($q$delete from storage.objects where name = %L$q$, t.alice() || '/w1/a.webp')), 0::bigint, 'no borra objetos ajenos');
select t.anon();
select t.fails($$insert into storage.objects (bucket_id, name) values ('images', 'x/y.webp')$$, 'row-level security', 'anónimo no sube');
select t.login(t.mod());
select t.eq(t.rows(format($q$delete from storage.objects where name = %L$q$, t.alice() || '/w1/a.webp')), 1::bigint, 'moderación borra archivos infractores');
select t.owner();
update public.profiles set status = 'suspended' where id = t.alice();
select t.login(t.alice());
select t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('images', %L, auth.uid())$q$, t.alice() || '/w2/a.webp'), 'row-level security', 'suspendido no sube');
