<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { RoleCatalogItem, Work } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import AttachmentManager from '$lib/components/my/AttachmentManager.svelte';
  import ConfirmDialog from '$lib/components/my/ConfirmDialog.svelte';
  import ParticipantManager from '$lib/components/my/ParticipantManager.svelte';
  import Section from '$lib/components/my/Section.svelte';
  import WorkForm from '$lib/components/my/WorkForm.svelte';
  import { deleteWork, getMyWork, loadCatalogs } from '$lib/api/my';
  import { dbErrorKey } from '$lib/components/my/logic';

  const lang = $derived(currentLang());
  const id = $derived(page.params.id ?? '');

  let work = $state<Work | null>(null);
  let roles = $state<RoleCatalogItem[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let notFound = $state(false);
  let confirmOpen = $state(false);
  let deleting = $state(false);
  let error = $state<string | null>(null);
  let coverId = $state<string | null>(null);

  $effect(() => {
    void load(id);
  });

  async function load(wid: string) {
    loading = true;
    failed = notFound = false;
    work = null;
    try {
      const [w, c] = await Promise.all([getMyWork(wid), loadCatalogs()]);
      roles = c.roles;
      if (!w || w.uploader_id !== auth.userId || w.status === 'deleted') notFound = true;
      else {
        work = w;
        coverId = w.cover_attachment_id;
      }
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  function onsaved(w: Work) {
    work = w;
  }

  async function remove() {
    if (!work) return;
    deleting = true;
    try {
      await deleteWork(work.id);
      await goto(url.my(lang, 'obras'), { replaceState: true });
    } catch (e) {
      error = t(dbErrorKey(e));
      confirmOpen = false;
    } finally {
      deleting = false;
    }
  }
</script>

<svelte:head><title>{work ? tr(work.title, work.lang) : t('my.nav.works')} · {t('app.name')}</title></svelte:head>

<div class="stack">
  <p><a href={url.my(lang, 'obras')}>← {t('my.nav.works')}</a></p>

  {#if loading}
    <Spinner />
  {:else if failed}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={() => load(id)}>{t('my.retry')}</Button></Notice>
  {:else if notFound || !work}
    <Empty>{t('my.work.notFound')}</Empty>
  {:else}
    <header class="head">
      <div>
        <h1>{tr(work.title, work.lang) || t('my.works.untitled')}</h1>
        <p class="muted">
          {t(`my.work.status.${work.status}`)} · {t(`my.work.vis.${work.visibility}`)}
          {#if work.status === 'published'}· <a href={url.work(lang, work.short_id, tr(work.title, work.lang))}>{t('my.works.view')}</a>{/if}
        </p>
      </div>
      <nav class="jump" aria-label={t('my.work.jump')}>
        <a href="#files">{t('my.work.s.files')}</a>
        <a href="#people">{t('my.work.s.people')}</a>
      </nav>
    </header>

    {#key work.id}
      <WorkForm {work} {onsaved} />
    {/key}

    <Section title={t('my.work.s.files')} id="files">
      <AttachmentManager workId={work.id} bind:coverId />
    </Section>

    <Section title={t('my.work.s.people')} id="people">
      <ParticipantManager workId={work.id} branch={work.branch} uploaderId={work.uploader_id} catalog={roles} />
    </Section>

    <Section title={t('my.work.s.danger')} id="danger">
      {#if error}<Notice kind="error">{error}</Notice>{/if}
      <p class="muted">{t('my.work.deleteHelp')}</p>
      <div><Button variant="danger" type="button" onclick={() => (confirmOpen = true)}>{t('my.work.delete')}</Button></div>
    </Section>
  {/if}
</div>

<ConfirmDialog bind:open={confirmOpen} title={t('my.work.deleteTitle')} confirmLabel={t('my.work.deleteConfirm')} busy={deleting} onconfirm={remove}>
  {t('my.work.deleteMsg')}
</ConfirmDialog>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); overflow-wrap: anywhere; }
  .head { display: grid; gap: var(--space-3); }
  .head p { margin: 0; }
  .jump { display: flex; gap: var(--space-4); font-size: 0.9rem; }
</style>
