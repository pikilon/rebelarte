<script lang="ts">
  // Avatar: elegir imagen, recortar a cuadrado (zoom + desplazamiento) y subir como WebP 512 px.
  import { t } from '$lib/i18n';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import { cropRegion, cropSquare, ImageError } from '$lib/media/image';
  import { kindFromFile, maxInputBytes } from '$lib/media/rules';

  interface Props {
    path: string | null;
    name: string;
    onsave: (blob: Blob) => Promise<void>;
    onremove: () => Promise<void>;
  }
  let { path, name, onsave, onremove }: Props = $props();

  const VIEW = 240;
  const uid = $props.id();
  let file = $state<File | null>(null);
  let objectUrl = $state<string | null>(null);
  let natural = $state({ w: 0, h: 0 });
  let zoom = $state(1);
  let offsetX = $state(0);
  let offsetY = $state(0);
  let busy = $state(false);
  let error = $state<string | null>(null);

  function pick(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!f) return;
    error = null;
    if (kindFromFile(f) !== 'image') return void (error = t('my.avatar.errType'));
    if (f.size > maxInputBytes('image')) return void (error = t('my.avatar.errSize'));
    cancel();
    file = f;
    objectUrl = URL.createObjectURL(f);
    zoom = 1;
    offsetX = 0;
    offsetY = 0;
  }
  function cancel() {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    file = null;
  }
  const geo = $derived.by(() => {
    if (!natural.w || !natural.h) return null;
    const { sx, sy, side } = cropRegion(natural.w, natural.h, { zoom, offsetX, offsetY });
    const scale = VIEW / side;
    return { left: -sx * scale, top: -sy * scale, width: natural.w * scale };
  });

  async function save() {
    if (!file) return;
    busy = true;
    error = null;
    try {
      const { blob } = await cropSquare(file, { zoom, offsetX, offsetY }, 512);
      await onsave(blob);
      cancel();
    } catch (e) {
      error = e instanceof ImageError ? t('my.avatar.errType') : t('common.error');
    } finally {
      busy = false;
    }
  }
  async function remove() {
    busy = true;
    error = null;
    try {
      await onremove();
    } catch {
      error = t('common.error');
    } finally {
      busy = false;
    }
  }
</script>

<div class="avatar-editor">
  {#if objectUrl}
    <div class="crop">
      <div class="view" style:width="{VIEW}px" style:height="{VIEW}px" role="img" aria-label={t('my.avatar.preview')}>
        <img
          src={objectUrl} alt="" draggable="false"
          onload={(e) => (natural = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style:left="{geo?.left ?? 0}px" style:top="{geo?.top ?? 0}px" style:width="{geo?.width ?? VIEW}px"
        />
      </div>
      <div class="ctrls">
        <label for="{uid}-z">{t('my.avatar.zoom')}</label>
        <input id="{uid}-z" type="range" min="1" max="4" step="0.05" bind:value={zoom} />
        <label for="{uid}-x">{t('my.avatar.horizontal')}</label>
        <input id="{uid}-x" type="range" min="-1" max="1" step="0.02" bind:value={offsetX} />
        <label for="{uid}-y">{t('my.avatar.vertical')}</label>
        <input id="{uid}-y" type="range" min="-1" max="1" step="0.02" bind:value={offsetY} />
        <div class="row">
          <Button type="button" size="sm" loading={busy} onclick={save}>{t('my.avatar.use')}</Button>
          <Button type="button" size="sm" variant="ghost" onclick={cancel} disabled={busy}>{t('common.cancel')}</Button>
        </div>
      </div>
    </div>
  {:else}
    <div class="row">
      <Avatar {path} {name} size={80} />
      <div class="row">
        <label class="pick">
          {t('my.avatar.choose')}
          <input type="file" accept="image/*" class="sr-only" onchange={pick} />
        </label>
        {#if path}<Button type="button" size="sm" variant="ghost" loading={busy} onclick={remove}>{t('my.avatar.remove')}</Button>{/if}
      </div>
    </div>
  {/if}
  {#if error}<Notice kind="error">{error}</Notice>{/if}
</div>

<style>
  .avatar-editor { display: grid; gap: var(--space-3); }
  .pick { display: inline-flex; align-items: center; border: 1px solid var(--fg); border-radius: 999px; padding: 8px 14px; font-weight: 600; font-size: 0.85rem; cursor: pointer; min-height: 34px; }
  .pick:focus-within { outline: 3px solid var(--focus); outline-offset: 2px; }
  .crop { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: flex-start; }
  .view { position: relative; overflow: hidden; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--line); flex: none; }
  .view img { position: absolute; max-width: none; user-select: none; }
  .ctrls { display: grid; gap: 4px; flex: 1; min-width: 200px; }
  .ctrls label { font-size: 0.8rem; font-weight: 600; margin-top: var(--space-2); }
  .ctrls input[type='range'] { width: 100%; }
  .ctrls .row { margin-top: var(--space-3); }
</style>
