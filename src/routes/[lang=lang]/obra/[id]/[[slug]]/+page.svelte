<script lang="ts">
  // Ficha de obra. `id` es el short_id; el slug solo es cosmético y se corrige al canónico.
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { untrack } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import { getWorkPage, type WorkPageData } from '$lib/api/public';
  import { formatDate, formatDuration, pickCover, searchHref, snippet } from '$lib/api/publicUtils';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import LangText from '$lib/components/ui/LangText.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';
  import ContactButton from '$lib/components/contact/ContactButton.svelte';
  import ReportButton from '$lib/components/report/ReportButton.svelte';
  import AwardList from '$lib/components/public/AwardList.svelte';
  import MediaBlocks from '$lib/components/public/MediaBlocks.svelte';
  import Meta from '$lib/components/public/Meta.svelte';
  import NotFound from '$lib/components/public/NotFound.svelte';
  import ParticipantList from '$lib/components/public/ParticipantList.svelte';
  import QrCode from '$lib/components/public/QrCode.svelte';

  type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; data: WorkPageData };
  let view = $state<LoadState>({ kind: 'loading' });

  const lang = $derived(currentLang());

  $effect(() => {
    const id = page.params.id ?? '';
    let live = true;
    untrack(() => { view = { kind: 'loading' }; });
    getWorkPage(id)
      .then((data) => { if (live) view = data ? { kind: 'ready', data } : { kind: 'missing' }; })
      .catch(() => { if (live) view = { kind: 'error' }; });
    return () => { live = false; };
  });

  const data = $derived(view.kind === 'ready' ? view.data : null);
  const work = $derived(data?.work ?? null);
  const title = $derived(work ? tr(work.title, work.lang) || t('public.work.untitled') : '');
  const category = $derived(data && work?.category_id != null ? data.catalogs.categories.find((c) => c.id === work.category_id) ?? null : null);
  const license = $derived(data ? data.catalogs.licenses.find((l) => l.id === data.work.license_id) ?? null : null);
  const cover = $derived(data ? pickCover(data.work, data.attachments) : null);
  const coverId = $derived(cover?.kind === 'image' ? cover.attachment.id : null);
  const isMine = $derived(!!work && auth.userId === work.uploader_id);
  const description = $derived(work ? tr(work.description, work.lang) : '');
  const uploaderName = $derived(data?.uploader?.display_name ?? '');

  // Corrige la URL al slug canónico (título en el idioma actual) sin recargar ni añadir historial.
  $effect(() => {
    if (!work) return;
    const canon = url.work(lang, work.short_id, title);
    if (page.url.pathname !== canon) {
      try { replaceState(canon + page.url.search + page.url.hash, page.state); } catch { /* router aún no listo */ }
    }
  });

  const metaDesc = $derived(
    work ? snippet(description) || t('public.work.metaFallback', { branch: t(`branch.${work.branch}`), author: uploaderName }) : ''
  );

  const details = $derived.by(() => {
    if (!work) return [] as { k: string; v: string; href?: string }[];
    const rows: { k: string; v: string; href?: string }[] = [];
    const add = (k: string, v: string | number | null | undefined, href?: string) => {
      if (v != null && String(v).trim() !== '') rows.push({ k: t(k), v: String(v), href });
    };
    add('public.work.place', work.place);
    add('public.work.date', formatDate(work.created_on, lang));
    add('public.work.lang', t(`lang.${work.lang}`));
    add('public.work.technique', work.technique);
    add('public.work.pages', work.pages);
    add('public.work.duration', formatDuration(work.duration_seconds));
    add('public.work.channels', work.audio_channels);
    add('public.work.recordingFormat', work.recording_format);
    add('public.work.aspect', work.aspect_ratio);
    return rows;
  });
</script>

{#if view.kind === 'loading'}
  <Meta title={t('common.loading')} />
  <div class="container pad"><Spinner /></div>
{:else if view.kind === 'error'}
  <Meta title={t('public.error.title')} />
  <div class="container pad"><Notice kind="error">{t('public.error.load')}</Notice></div>
{:else if view.kind === 'missing' || !data || !work}
  <NotFound title={t('public.work.notFoundTitle')} text={t('public.work.notFoundText')} />
{:else}
  <Meta title={title} description={metaDesc} />
  <article class="container work" style:--c="var(--rama-{work.branch})">
    <header class="hd">
      <div class="tags">
        <Tag branch={work.branch} href={url.branch(lang, work.branch)}>{t(`branch.${work.branch}`)}</Tag>
        {#if category}
          <Tag branch={work.branch} href="{url.branch(lang, work.branch)}?categoria={encodeURIComponent(category.slug)}">{tr(category.name)}</Tag>
        {/if}
      </div>
      <h1><LangText text={work.title} origin={work.lang} /></h1>
      <div class="by row">
        {#if data.uploader}
          <Avatar path={data.uploader.avatar_path} name={uploaderName} size={32} />
          <span>{t('public.work.by')} <a href={url.cv(lang, data.uploader.alias)}>{uploaderName}</a></span>
        {/if}
        {#if isMine}
          <Button href={url.my(lang, `obras/${work.id}`)} variant="secondary" size="sm">{t('common.edit')}</Button>
        {/if}
      </div>
      {#if isMine && (work.status !== 'published' || work.visibility !== 'public')}
        <Notice kind="warn">{t(`public.work.view.${work.status !== 'published' ? work.status : work.visibility}`)}</Notice>
      {/if}
    </header>

    <div class="cols">
      <div class="main">
        <MediaBlocks {work} attachments={data.attachments} {title} {coverId} />

        {#if description}
          <section aria-labelledby="w-desc">
            <h2 id="w-desc">{t('public.work.description')}</h2>
            <LangText text={work.description} origin={work.lang} multiline />
          </section>
        {/if}

        {#if work.keywords.length}
          <section aria-labelledby="w-kw">
            <h2 id="w-kw" class="sr-only">{t('public.work.keywords')}</h2>
            <ul class="kw">
              {#each work.keywords as k (k)}
                <li><a href={searchHref(lang, { q: k })}>#{k}</a></li>
              {/each}
            </ul>
          </section>
        {/if}
      </div>

      <aside class="side" aria-label={t('public.work.info')}>
        <section class="card" aria-labelledby="w-det">
          <h2 id="w-det">{t('public.work.details')}</h2>
          <dl>
            {#each details as d (d.k)}
              <div><dt>{d.k}</dt><dd>{d.v}</dd></div>
            {/each}
            {#if license}
              <div>
                <dt>{t('public.work.license')}</dt>
                <dd>
                  {#if license.url}<a href={license.url} target="_blank" rel="noopener noreferrer license">{tr(license.name)}</a>{:else}{tr(license.name)}{/if}
                </dd>
              </div>
            {/if}
          </dl>
        </section>

        {#if data.awards.length}
          <section class="card" aria-labelledby="w-aw">
            <h2 id="w-aw">{t('public.work.awards')}</h2>
            <AwardList awards={data.awards.map((a) => ({ award: a }))} />
          </section>
        {/if}

        {#if data.participants.length}
          <section class="card" aria-labelledby="w-part">
            <h2 id="w-part">{t('public.work.participants')}</h2>
            <ParticipantList participants={data.participants} origin={work.lang} />
            <p class="more"><a href={url.workParticipants(lang, work.short_id)}>{t('public.work.seeParticipants', { n: data.participants.length })}</a></p>
          </section>
        {/if}

        {#if (work.for_sale || work.accepts_commissions) && !isMine}
          <section class="card contact" aria-labelledby="w-contact">
            <h2 id="w-contact">{t('public.work.contact')}</h2>
            <p>
              {#if work.for_sale}{t('public.work.forSale')}{/if}
              {#if work.for_sale && work.accepts_commissions} · {/if}
              {#if work.accepts_commissions}{t('public.work.acceptsCommissions')}{/if}
            </p>
            {#if work.price_text}<p class="price"><span class="muted">{t('public.work.price')}</span> {work.price_text}</p>{/if}
            <ContactButton recipientId={work.uploader_id} workId={work.id} recipientName={uploaderName} />
          </section>
        {/if}

        <div class="row tools">
          <QrCode target={url.qrWork(page.url.origin, work.short_id)} label={title} filename="rebelarte-obra-{work.short_id}" />
          <ReportButton targetType="work" targetId={work.id} />
        </div>
      </aside>
    </div>
  </article>
{/if}

<style>
  .pad { padding-top: var(--space-7); }
  .work { padding-top: var(--space-5); }
  .hd { display: grid; gap: var(--space-3); margin-bottom: var(--space-5); border-top: 4px solid var(--c); padding-top: var(--space-4); }
  .hd h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.9rem, 5vw, 3rem); }
  .tags { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .by { gap: var(--space-2) var(--space-3); }
  .cols { display: grid; gap: var(--space-6); grid-template-columns: minmax(0, 1fr); align-items: start; }
  @media (min-width: 900px) {
    .cols { grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr); }
    .side { position: sticky; top: 80px; }
  }
  .main { display: grid; gap: var(--space-6); min-width: 0; }
  .main h2 { font-size: 1.3rem; }
  .side { display: grid; gap: var(--space-4); min-width: 0; }
  .card { background: var(--surface); border-radius: var(--radius); padding: var(--space-4); box-shadow: var(--shadow); }
  .card h2 { font-size: 1.05rem; font-family: var(--font-ui); text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); font-weight: 600; margin-bottom: var(--space-3); }
  dl { margin: 0; display: grid; gap: var(--space-2); }
  dl > div { display: grid; grid-template-columns: minmax(90px, 36%) 1fr; gap: var(--space-2); }
  dt { color: var(--muted); font-size: 0.9rem; }
  dd { margin: 0; overflow-wrap: anywhere; }
  .more { margin: var(--space-3) 0 0; font-size: 0.92rem; font-weight: 600; }
  .contact p { margin: 0 0 var(--space-3); }
  .price { font-family: var(--font-display); font-size: 1.15rem; }
  .kw { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .kw a { display: inline-block; padding: 3px 10px; border-radius: 999px; background: var(--surface-2); text-decoration: none; font-size: 0.88rem; }
  .kw a:hover { background: var(--accent-soft); }
  .tools { gap: var(--space-2); }
</style>
