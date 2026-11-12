<script lang="ts">
  // Formulario de obra (alta y edición): rama, categoría, datos comunes, campos por rama, venta y visibilidad.
  import { onMount, tick } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { LANGS, t, tr } from '$lib/i18n';
  import { parseAudioEmbed, parseVideo } from '$lib/media/embed';
  import { BRANCHES, type Category, type License, type Work } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import ChipsInput from './ChipsInput.svelte';
  import I18nInput from './I18nInput.svelte';
  import Section from './Section.svelte';
  import Toggle from './Toggle.svelte';
  import { createWork, loadCatalogs, updateWork } from '$lib/api/my';
  import {
    BRANCH_FIELDS, dbErrorKey, draftFromWork, draftToRow, emptyWorkDraft, saveActions, statusPatch, validateDraft,
    WORK_VISIBILITIES, type DraftError, type SaveAction, type WorkDraft
  } from './logic';

  interface Props { work: Work | null; onsaved: (w: Work, created: boolean) => void }
  let { work, onsaved }: Props = $props();

  const uid = $props.id();
  // svelte-ignore state_referenced_locally
  let draft = $state<WorkDraft>(work ? draftFromWork(work) : emptyWorkDraft(auth.profile?.lang ?? 'es'));
  let categories = $state<Category[]>([]);
  let licenses = $state<License[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let errors = $state<Partial<Record<DraftError, true>>>({});
  let saving = $state<SaveAction | null>(null);
  let message = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
  let summary: HTMLElement | undefined = $state();

  const fields = $derived(draft.branch ? BRANCH_FIELDS[draft.branch] : null);
  const cats = $derived(categories.filter((c) => c.branch === draft.branch));
  const license = $derived(licenses.find((l) => l.id === draft.license_id));
  const actions = $derived(saveActions(work?.status ?? null));
  const video = $derived(fields?.videoUrl ? parseVideo(draft.video_url) : null);
  const audio = $derived(fields?.audioUrl ? parseAudioEmbed(draft.audio_embed_url) : null);
  const errList = $derived(Object.keys(errors) as DraftError[]);

  onMount(async () => {
    try {
      const c = await loadCatalogs();
      categories = c.categories;
      licenses = c.licenses;
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  });

  function onBranch(b: (typeof BRANCHES)[number]) {
    draft.branch = b;
    if (!categories.some((c) => c.id === draft.category_id && c.branch === b)) draft.category_id = null;
  }

  async function save(action: SaveAction) {
    message = null;
    errors = validateDraft(draft, { video: (u) => !!parseVideo(u), audio: (u) => !!parseAudioEmbed(u) });
    if (Object.keys(errors).length) {
      await tick();
      summary?.focus();
      return;
    }
    const userId = auth.userId;
    if (!userId) return;
    saving = action;
    try {
      const row = { ...draftToRow(draft), ...statusPatch(work?.status ?? null, action, new Date().toISOString(), work?.published_at ?? null) };
      const saved = work ? await updateWork(work.id, row) : await createWork(userId, row);
      draft = draftFromWork(saved);
      message = { kind: 'ok', text: action === 'publish' ? t('my.work.published') : t('my.work.saved') };
      onsaved(saved, !work);
    } catch (e) {
      message = { kind: 'error', text: t(dbErrorKey(e)) };
      await tick();
      summary?.focus();
    } finally {
      saving = null;
    }
  }
</script>

{#if loading}
  <Spinner />
{:else if loadError}
  <Notice kind="error">{t('common.error')}</Notice>
{:else}
  <form class="stack" onsubmit={(e) => e.preventDefault()} novalidate>
    {#if work?.status === 'hidden'}<Notice kind="warn">{t('my.work.hiddenNote')}</Notice>{/if}

    <Section title={t('my.work.s.branch')} id="{uid}-branch">
      <fieldset class="branches" aria-describedby={errors.branch ? `${uid}-be` : undefined}>
        <legend class="sr-only">{t('my.work.branch')}</legend>
        {#each BRANCHES as b}
          <label class="br" style:--c="var(--rama-{b})" class:on={draft.branch === b}>
            <input type="radio" name="{uid}-branch" value={b} checked={draft.branch === b} onchange={() => onBranch(b)} />
            <span>{t(`branch.${b}`)}</span>
          </label>
        {/each}
      </fieldset>
      {#if errors.branch}<small id="{uid}-be" class="err" role="alert">{t('my.work.err.branch')}</small>{/if}
      {#if draft.branch}
        <Field label={t('my.work.category')} id="{uid}-cat">
          <select id="{uid}-cat" bind:value={draft.category_id}>
            <option value={null}>{t('my.work.noCategory')}</option>
            {#each cats as c (c.id)}<option value={c.id}>{tr(c.name)}</option>{/each}
          </select>
        </Field>
      {/if}
    </Section>

    <Section title={t('my.work.s.data')} id="{uid}-data">
      <Field label={t('my.work.lang')} id="{uid}-lang" hint={t('my.work.langHint')}>
        <select id="{uid}-lang" bind:value={draft.lang}>
          {#each LANGS as l}<option value={l}>{t(`lang.${l}`)}</option>{/each}
        </select>
      </Field>
      <I18nInput bind:value={draft.title} origin={draft.lang} label={t('my.work.title')} maxlength={160} error={errors.title ? t('my.work.err.title', { lang: t(`lang.${draft.lang}`) }) : null} />
      <I18nInput bind:value={draft.description} origin={draft.lang} label={t('my.work.description')} multiline rows={6} required={false} maxlength={5000} />
      <ChipsInput bind:value={draft.keywords} label={t('my.work.keywords')} hint={t('my.work.keywordsHint')} />
      <div class="two">
        <Field label={t('my.work.place')} id="{uid}-place">
          <input id="{uid}-place" type="text" maxlength="120" bind:value={draft.place} />
        </Field>
        <Field label={t('my.work.date')} id="{uid}-date" error={errors.date ? t('my.work.err.date') : null}>
          <input id="{uid}-date" type="date" bind:value={draft.created_on} />
        </Field>
      </div>
      <Field label={t('my.work.license')} id="{uid}-lic" hint={t('my.work.licenseHint')}>
        <select id="{uid}-lic" bind:value={draft.license_id}>
          {#each licenses as l (l.id)}<option value={l.id}>{tr(l.name)}</option>{/each}
        </select>
      </Field>
      {#if license?.url}
        <p class="small"><a href={license.url} target="_blank" rel="noopener noreferrer">{t('my.work.licenseMore')}</a></p>
      {/if}
    </Section>

    {#if draft.branch && fields}
      <Section title={t('my.work.s.branchFields', { branch: t(`branch.${draft.branch}`) })} id="{uid}-bf">
        {#if fields.technique}
          <Field label={t('my.work.technique')} id="{uid}-tech"><input id="{uid}-tech" type="text" maxlength="160" bind:value={draft.technique} /></Field>
        {/if}
        {#if fields.pages}
          <Field label={t('my.work.pages')} id="{uid}-pages" error={errors.pages ? t('my.work.err.pages') : null}>
            <input id="{uid}-pages" type="text" inputmode="numeric" bind:value={draft.pages} />
          </Field>
        {/if}
        {#if fields.duration || fields.channels || fields.format || fields.aspect}
          <div class="two">
            {#if fields.duration}
              <Field label={t('my.work.duration')} id="{uid}-dur" hint={t('my.work.durationHint')} error={errors.duration ? t('my.work.err.duration') : null}>
                <input id="{uid}-dur" type="text" inputmode="numeric" placeholder="3:25" bind:value={draft.duration} />
              </Field>
            {/if}
            {#if fields.channels}
              <Field label={t('my.work.channels')} id="{uid}-ch">
                <input id="{uid}-ch" type="text" maxlength="40" list="{uid}-chl" bind:value={draft.audio_channels} />
                <datalist id="{uid}-chl"><option value="Mono"></option><option value="Stereo"></option><option value="5.1"></option></datalist>
              </Field>
            {/if}
            {#if fields.format}
              <Field label={t('my.work.format')} id="{uid}-fmt">
                <input id="{uid}-fmt" type="text" maxlength="40" list="{uid}-fmtl" bind:value={draft.recording_format} />
                <datalist id="{uid}-fmtl">
                  {#if draft.branch === 'sonido'}<option value="WAV"></option><option value="FLAC"></option><option value="MP3"></option>
                  {:else}<option value="MP4"></option><option value="MOV"></option><option value="MKV"></option>{/if}
                </datalist>
              </Field>
            {/if}
            {#if fields.aspect}
              <Field label={t('my.work.aspect')} id="{uid}-asp">
                <input id="{uid}-asp" type="text" maxlength="20" list="{uid}-aspl" bind:value={draft.aspect_ratio} />
                <datalist id="{uid}-aspl"><option value="16:9"></option><option value="4:3"></option><option value="21:9"></option><option value="1:1"></option><option value="9:16"></option></datalist>
              </Field>
            {/if}
          </div>
        {/if}
        {#if fields.videoUrl}
          <Field label={t('my.work.videoUrl')} id="{uid}-vid" hint={t('my.work.videoHint')} error={errors.videoUrl ? t('my.work.err.video') : null}>
            <input id="{uid}-vid" type="url" placeholder="https://" bind:value={draft.video_url} />
          </Field>
          {#if video}
            <div class="embed"><iframe src={video.embed} title={t('my.work.videoPreview')} loading="lazy" allowfullscreen
              sandbox="allow-scripts allow-same-origin allow-presentation allow-popups" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
          {/if}
        {/if}
        {#if fields.audioUrl}
          <Field label={t('my.work.audioUrl')} id="{uid}-aud" hint={t('my.work.audioHint')} error={errors.audioUrl ? t('my.work.err.audio') : null}>
            <input id="{uid}-aud" type="url" placeholder="https://soundcloud.com/…" bind:value={draft.audio_embed_url} />
          </Field>
          {#if audio}
            <div class="embed audio"><iframe src={audio.embed} title={t('my.work.audioPreview')} loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-popups" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
          {/if}
        {/if}
      </Section>
    {/if}

    <Section title={t('my.work.s.sale')} id="{uid}-sale">
      <Toggle bind:checked={draft.for_sale} label={t('my.work.forSale')} hint={t('my.work.forSaleHint')} />
      <Toggle bind:checked={draft.accepts_commissions} label={t('my.work.commissions')} />
      <Field label={t('my.work.price')} id="{uid}-price" hint={t('my.work.priceHint')}>
        <input id="{uid}-price" type="text" maxlength="80" bind:value={draft.price_text} placeholder={t('my.work.pricePh')} />
      </Field>
    </Section>

    <Section title={t('my.work.s.visibility')} id="{uid}-vis">
      <fieldset class="vis">
        <legend class="sr-only">{t('my.work.s.visibility')}</legend>
        {#each WORK_VISIBILITIES as v}
          <label class="radio">
            <input type="radio" name="{uid}-vis" value={v} bind:group={draft.visibility} />
            <span><strong>{t(`my.work.vis.${v}`)}</strong><small class="muted">{t(`my.work.vis.${v}Hint`)}</small></span>
          </label>
        {/each}
      </fieldset>
    </Section>

    <div class="savebar" bind:this={summary} tabindex="-1">
      {#if errList.length}
        <Notice kind="error">
          {t('my.work.errSummary')}
          <ul>{#each errList as e}<li>{t(`my.work.errField.${e}`)}</li>{/each}</ul>
        </Notice>
      {/if}
      {#if message}<Notice kind={message.kind}>{message.text}</Notice>{/if}
      <div class="row">
        {#each actions as a}
          <Button type="button" variant={a === 'publish' || a === 'keep' ? 'primary' : 'secondary'} loading={saving === a} disabled={saving !== null} onclick={() => save(a)}>
            {t(`my.work.act.${a}`)}
          </Button>
        {/each}
      </div>
      {#if !work}<small class="muted">{t('my.work.filesAfter')}</small>{/if}
    </div>
  </form>
{/if}

<style>
  .branches { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--space-2); }
  .br { position: relative; display: block; }
  .br input { position: absolute; opacity: 0; inset: 0; }
  .br span { display: block; text-align: center; padding: 12px 8px; border: 2px solid var(--line); border-radius: var(--radius-sm); border-top: 4px solid var(--c); font-weight: 600; cursor: pointer; background: var(--bg); }
  .br.on span { border-color: var(--c); background: color-mix(in srgb, var(--c) 12%, var(--surface)); }
  .br input:focus-visible + span { outline: 3px solid var(--focus); outline-offset: 2px; }
  .two { display: grid; gap: var(--space-4); grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
  .err { color: var(--danger); font-weight: 500; }
  .small { font-size: 0.88rem; margin: 0; }
  select { max-width: 100%; }
  .embed { position: relative; aspect-ratio: 16 / 9; max-width: 560px; border-radius: var(--radius-sm); overflow: hidden; background: var(--surface-2); }
  .embed.audio { aspect-ratio: auto; height: 166px; }
  .embed iframe { width: 100%; height: 100%; border: 0; }
  .vis { border: 0; padding: 0; margin: 0; display: grid; gap: var(--space-3); }
  .radio { display: flex; gap: var(--space-3); align-items: flex-start; cursor: pointer; }
  .radio input { margin-top: 5px; }
  .radio span { display: grid; gap: 2px; }
  .savebar { position: sticky; bottom: 0; background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(6px); padding: var(--space-3) 0; display: grid; gap: var(--space-2); border-top: 1px solid var(--line); z-index: 2; }
  .savebar:focus { outline: none; }
  .savebar ul { margin: 4px 0 0; padding-left: 20px; }
</style>
