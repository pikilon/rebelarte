<script lang="ts">
  // Adjuntos de una obra: subida múltiple con progreso, orden, título, portada y borrado.
  import { onMount } from 'svelte';
  import { t } from '$lib/i18n';
  import { LIMITS, type Attachment } from '$lib/types';
  import { publicUrl } from '$lib/supabase';
  import Button from '$lib/components/ui/Button.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import { deleteAttachment, listAttachments, renameAttachment, saveAttachmentOrder, setCover } from '$lib/api/my';
  import { uploadAttachment, UploadError, type UploadStage } from '$lib/media/upload';
  import { formatBytes, slotsLeft, validateFile, bucketFor } from '$lib/media/rules';
  import { moveItem } from './logic';

  interface Props { workId: string; coverId: string | null; oncover?: (id: string | null) => void }
  let { workId, coverId = $bindable(), oncover }: Props = $props();

  interface Pending { key: number; name: string; stage: UploadStage; fraction: number; error: string | null }

  let items = $state<Attachment[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let message = $state<string | null>(null);
  let pending = $state<Pending[]>([]);
  let nextKey = 0;
  let toDelete = $state<Attachment | null>(null);
  let confirmOpen = $state(false);
  let deleting = $state(false);
  let drag = $state(false);

  const uploading = $derived(pending.some((p) => !p.error));
  const left = $derived(slotsLeft(items.length));

  onMount(load);
  async function load() {
    loading = true;
    loadError = false;
    try {
      items = await listAttachments(workId);
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  function problemText(e: unknown): string {
    if (e instanceof UploadError) {
      switch (e.code) {
        case 'type': return t('my.att.errType');
        case 'size': return t('my.att.errSize');
        case 'too-big': return t('my.att.errTooBig');
        case 'empty': return t('my.att.errEmpty');
        case 'image': return t('my.att.errImage');
        case 'auth': return t('my.att.errAuth');
        default: return t('my.att.errUpload');
      }
    }
    return t('my.att.errUpload');
  }

  async function onFiles(list: FileList | File[]) {
    message = null;
    const files = Array.from(list);
    if (!files.length) return;
    let room = left;
    for (const file of files) {
      const entry: Pending = { key: nextKey++, name: file.name, stage: 'processing', fraction: 0, error: null };
      pending = [...pending, entry];
      const patch = (p: Partial<Pending>) => (pending = pending.map((x) => (x.key === entry.key ? { ...x, ...p } : x)));
      if (room <= 0) {
        patch({ error: t('my.att.errLimit', { max: LIMITS.attachmentsPerWork }) });
        continue;
      }
      const check = validateFile(file);
      if (!check.ok) {
        patch({ error: problemText(new UploadError(check.problem)) });
        continue;
      }
      try {
        const sort = items.length ? Math.max(...items.map((i) => i.sort)) + 1 : 0;
        const row = await uploadAttachment(workId, file, { sort, onProgress: (p) => patch({ stage: p.stage, fraction: p.fraction }) });
        items = [...items, row];
        room--;
        pending = pending.filter((x) => x.key !== entry.key);
      } catch (e) {
        patch({ error: problemText(e) });
      }
    }
  }

  function chosen(e: Event & { currentTarget: HTMLInputElement }) {
    const files = e.currentTarget.files;
    if (files) void onFiles(files);
    e.currentTarget.value = '';
  }
  function dropped(e: DragEvent) {
    e.preventDefault();
    drag = false;
    if (e.dataTransfer?.files) void onFiles(e.dataTransfer.files);
  }

  async function move(i: number, delta: -1 | 1) {
    const before = items;
    const next = moveItem(items, i, delta);
    if (next === before) return;
    items = next;
    try {
      await saveAttachmentOrder(next.map((a) => a.id));
    } catch {
      items = before;
      message = t('common.error');
    }
  }

  async function rename(a: Attachment, title: string) {
    if ((a.title ?? '') === title.trim()) return;
    try {
      await renameAttachment(a.id, title);
      items = items.map((x) => (x.id === a.id ? { ...x, title: title.trim() || null } : x));
    } catch {
      message = t('common.error');
    }
  }

  async function makeCover(a: Attachment) {
    try {
      await setCover(workId, a.id);
      coverId = a.id;
      oncover?.(a.id);
    } catch {
      message = t('common.error');
    }
  }

  function ask(a: Attachment) {
    toDelete = a;
    confirmOpen = true;
  }
  async function confirmDelete() {
    if (!toDelete) return;
    deleting = true;
    try {
      const a = toDelete;
      await deleteAttachment(a, coverId === a.id);
      items = items.filter((x) => x.id !== a.id);
      if (coverId === a.id) {
        coverId = null;
        oncover?.(null);
      }
      confirmOpen = false;
    } catch {
      message = t('common.error');
      confirmOpen = false;
    } finally {
      deleting = false;
    }
  }

  const canCover = (a: Attachment) => a.kind === 'image' || !!a.thumb_path;
  const thumb = (a: Attachment) => publicUrl('images', a.thumb_path ?? (a.kind === 'image' ? a.path : null));
</script>

<div class="att stack">
  <p class="muted">
    {t('my.att.intro', { max: LIMITS.attachmentsPerWork, img: LIMITS.bytes.image / 1048576, pdf: LIMITS.bytes.pdf / 1048576, zip: LIMITS.bytes.zip / 1048576, audio: LIMITS.bytes.audio / 1048576 })}
  </p>

  {#if loading}
    <Spinner />
  {:else if loadError}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('my.retry')}</Button></Notice>
  {:else}
    <div
      class="drop" class:over={drag} role="group" aria-label={t('my.att.drop')}
      ondragover={(e) => { e.preventDefault(); drag = true; }} ondragleave={() => (drag = false)} ondrop={dropped}
    >
      <label class="pick" class:disabled={left === 0}>
        {t('my.att.choose')}
        <input type="file" multiple class="sr-only" disabled={left === 0}
          accept="image/*,application/pdf,application/zip,.zip,audio/*" onchange={chosen} />
      </label>
      <span class="muted">{t('my.att.slots', { n: items.length, max: LIMITS.attachmentsPerWork })}</span>
    </div>

    {#if message}<Notice kind="error">{message}</Notice>{/if}

    {#if pending.length}
      <ul class="pending" aria-live="polite">
        {#each pending as p (p.key)}
          <li>
            <span class="name">{p.name}</span>
            {#if p.error}
              <span class="err" role="alert">{p.error}</span>
              <button type="button" class="x" aria-label={t('common.close')} onclick={() => (pending = pending.filter((x) => x.key !== p.key))}>×</button>
            {:else}
              <progress max="1" value={p.fraction} aria-label={p.name}></progress>
              <small class="muted">{t(`my.att.stage.${p.stage}`)}</small>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    {#if items.length}
      <ol class="list">
        {#each items as a, i (a.id)}
          <li class="item" class:cover={coverId === a.id}>
            <div class="media">
              {#if thumb(a)}
                <img src={thumb(a)} alt="" loading="lazy" />
              {:else if a.kind === 'audio'}
                <span class="ico" aria-hidden="true">♪</span>
              {:else}
                <span class="ico" aria-hidden="true">{a.kind === 'zip' ? 'ZIP' : 'PDF'}</span>
              {/if}
            </div>
            <div class="info">
              <label class="sr-only" for="att-t-{a.id}">{t('my.att.title')}</label>
              <input id="att-t-{a.id}" type="text" maxlength="120" value={a.title ?? ''} placeholder={t('my.att.title')}
                onblur={(e) => rename(a, e.currentTarget.value)} />
              <small class="muted">{t(`my.att.kind.${a.kind}`)} · {formatBytes(a.size_bytes)}{#if a.width && a.height} · {a.width}×{a.height}{/if}</small>
              {#if a.kind === 'audio'}
                <!-- svelte-ignore a11y_media_has_caption -->
                <audio controls preload="none" src={publicUrl(bucketFor('audio'), a.path) ?? undefined}></audio>
              {/if}
              {#if coverId === a.id}<strong class="cv">{t('my.att.isCover')}</strong>{/if}
            </div>
            <div class="acts">
              <button type="button" aria-label={t('my.att.up')} disabled={i === 0} onclick={() => move(i, -1)}>↑</button>
              <button type="button" aria-label={t('my.att.down')} disabled={i === items.length - 1} onclick={() => move(i, 1)}>↓</button>
              {#if canCover(a) && coverId !== a.id}
                <Button size="sm" variant="secondary" type="button" onclick={() => makeCover(a)}>{t('my.att.makeCover')}</Button>
              {/if}
              <Button size="sm" variant="danger" type="button" onclick={() => ask(a)}>{t('common.delete')}</Button>
            </div>
          </li>
        {/each}
      </ol>
    {:else if !pending.length}
      <p class="muted">{t('my.att.none')}</p>
    {/if}
    {#if uploading}<small class="muted">{t('my.att.wait')}</small>{/if}
  {/if}
</div>

<ConfirmDialog bind:open={confirmOpen} title={t('my.att.deleteTitle')} busy={deleting} onconfirm={confirmDelete}>
  {t('my.att.deleteMsg', { name: toDelete?.title ?? '' })}
</ConfirmDialog>

<style>
  .drop { border: 2px dashed var(--line); border-radius: var(--radius); padding: var(--space-4); display: flex; gap: var(--space-3); align-items: center; flex-wrap: wrap; }
  .drop.over { border-color: var(--accent); background: var(--accent-soft); }
  .pick { display: inline-flex; align-items: center; background: var(--accent); color: var(--accent-fg); border-radius: 999px; padding: 12px 20px; font-weight: 600; cursor: pointer; min-height: 44px; }
  .pick.disabled { opacity: 0.5; cursor: not-allowed; }
  .pick:focus-within { outline: 3px solid var(--focus); outline-offset: 2px; }
  .pending, .list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .pending li { display: grid; grid-template-columns: 1fr auto; gap: 4px var(--space-3); align-items: center; }
  .pending .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.9rem; }
  .pending progress { width: 120px; }
  .err { color: var(--danger); font-size: 0.85rem; grid-column: 1; }
  .x { border: 0; background: transparent; cursor: pointer; font-size: 1.2rem; width: 32px; height: 32px; grid-column: 2; grid-row: 1; }
  .item { display: grid; grid-template-columns: 80px 1fr; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--bg); }
  .item.cover { border-color: var(--accent); }
  .media { width: 80px; height: 80px; border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-2); display: grid; place-items: center; }
  .media img { width: 100%; height: 100%; object-fit: cover; }
  .ico { font-weight: 700; color: var(--muted); font-size: 1.1rem; }
  .info { display: grid; gap: 4px; min-width: 0; align-content: start; }
  .info input { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); min-height: 40px; }
  .info audio { width: 100%; max-width: 360px; }
  .cv { color: var(--accent); font-size: 0.8rem; }
  .acts { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .acts > button:not(.btn) { border: 1px solid var(--line); background: var(--surface); border-radius: 50%; width: 36px; height: 36px; cursor: pointer; }
  .acts > button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
