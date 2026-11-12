<script lang="ts">
  // CV público de un autor. Pestañas «CV» y «Galería» sincronizadas con ?vista=galeria.
  import { page } from '$app/state';
  import { untrack } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { ALIAS_RE, RESERVED_ALIASES, url } from '$lib/routes';
  import { publicUrl } from '$lib/supabase';
  import { BRANCHES } from '$lib/types';
  import type { BranchId } from '$lib/types';
  import { getCvPage, type CvPageData, type CvWork } from '$lib/api/public';
  import { formatDateRange, groupByBranch, groupCvEntries, isBranch, snippet } from '$lib/api/publicUtils';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import LangText from '$lib/components/ui/LangText.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import WorkCardView from '$lib/components/ui/WorkCard.svelte';
  import ContactButton from '$lib/components/contact/ContactButton.svelte';
  import ReportButton from '$lib/components/report/ReportButton.svelte';
  import AwardList, { type AwardItem } from '$lib/components/public/AwardList.svelte';
  import Meta from '$lib/components/public/Meta.svelte';
  import NotFound from '$lib/components/public/NotFound.svelte';
  import QrCode from '$lib/components/public/QrCode.svelte';

  type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; data: CvPageData };
  let state = $state<LoadState>({ kind: 'loading' });
  const lang = $derived(currentLang());
  const alias = $derived((page.params.alias ?? '').toLowerCase());
  const validAlias = $derived(ALIAS_RE.test(alias) && !(RESERVED_ALIASES as readonly string[]).includes(alias));

  $effect(() => {
    const a = alias;
    if (!validAlias) return;
    let live = true;
    untrack(() => { state = { kind: 'loading' }; });
    getCvPage(a)
      .then((data) => { if (live) state = data ? { kind: 'ready', data } : { kind: 'missing' }; })
      .catch(() => { if (live) state = { kind: 'error' }; });
    return () => { live = false; };
  });

  const data = $derived(state.kind === 'ready' ? state.data : null);
  const profile = $derived(data?.profile ?? null);
  const gallery = $derived(page.url.searchParams.get('vista') === 'galeria');
  const isMine = $derived(!!profile && auth.userId === profile.id);
  const canContact = $derived(!!profile && (profile.accepts_commissions || profile.sells_works) && !isMine);
  const hasRate = $derived(!!profile && (!!profile.rate_price?.trim() || !!tr(profile.rate_text, profile.lang)));

  /* Roles de una obra → texto. */
  const roleName = (w: CvWork) =>
    w.roles
      .map((r) => {
        const c = r.role_id != null ? data?.catalogs.roles.find((x) => x.id === r.role_id) : null;
        return c ? tr(c.name, w.lang) : r.role_text ?? '';
      })
      .filter(Boolean)
      .join(', ');
  const catName = (w: CvWork) => {
    const c = w.category_id != null ? data?.catalogs.categories.find((x) => x.id === w.category_id) : null;
    return c ? tr(c.name) : '';
  };
  const worksByBranch = $derived(data ? groupByBranch(data.works) : []);
  const entryGroups = $derived(data ? groupCvEntries(data.entries) : []);

  const awardItems = $derived.by<AwardItem[]>(() => {
    if (!data) return [];
    const seen = new Set<string>();
    const items: AwardItem[] = [];
    for (const a of data.awards) {
      const key = `${a.id}|${a.via_work_id ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const { via_work_id, ...award } = a;
      let via: AwardItem['via'] = null;
      if (via_work_id) {
        const w = data.works.find((x) => x.id === via_work_id);
        via = { title: w ? tr(w.title, w.lang) : '', href: w ? url.work(lang, w.short_id, tr(w.title, w.lang)) : null };
      }
      items.push({ award, via });
    }
    return items.sort((x, y) => (y.award.year ?? 0) - (x.award.year ?? 0));
  });

  /* Galería: filtros locales por rama y categoría. */
  let fBranch = $state<BranchId | null>(null);
  let fCat = $state<number | null>(null);
  $effect(() => { void alias; fBranch = null; fCat = null; });
  const galleryBranches = $derived(data ? BRANCHES.filter((b) => data.works.some((w) => w.branch === b)) : []);
  const galleryCats = $derived(
    data && fBranch
      ? data.catalogs.categories.filter((c) => c.branch === fBranch && data.works.some((w) => w.category_id === c.id))
      : []
  );
  const galleryWorks = $derived(
    data ? data.works.filter((w) => (!fBranch || w.branch === fBranch) && (fCat == null || w.category_id === fCat)) : []
  );

  const hl = $derived(profile ? tr(profile.headline, profile.lang) : '');
  const metaDesc = $derived(
    profile ? snippet(hl || tr(profile.cover_letter, profile.lang)) || t('public.cv.metaFallback', { name: profile.display_name }) : ''
  );
  const since = (d: string) => t('public.cv.since', { date: d });
</script>

{#if !validAlias}
  <NotFound />
{:else if state.kind === 'loading'}
  <Meta title={t('common.loading')} />
  <div class="container pad"><Spinner /></div>
{:else if state.kind === 'error'}
  <Meta title={t('public.error.title')} />
  <div class="container pad"><Notice kind="error">{t('public.error.load')}</Notice></div>
{:else if state.kind === 'missing' || !profile || !data}
  <NotFound title={t('public.cv.notFoundTitle')} text={t('public.cv.notFoundText')} />
{:else}
  <Meta title={profile.display_name} description={metaDesc} />
  <article class="container cv">
    <header class="head">
      <Avatar path={profile.avatar_path} name={profile.display_name} size={104} />
      <div class="who">
        <h1>{profile.display_name}</h1>
        {#if hl}<p class="hl"><LangText text={profile.headline} origin={profile.lang} /></p>{/if}
        <p class="meta muted">
          {#if profile.location}
            <span class="loc">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.5" /></svg>
              <span class="sr-only">{t('public.cv.location')}:</span> {profile.location}
            </span>
          {/if}
          <span>@{profile.alias}</span>
        </p>
        {#if profile.contact_email}
          <p class="mail"><a href="mailto:{profile.contact_email}">{profile.contact_email}</a></p>
        {/if}
        {#if hasRate}
          <p class="rate">
            <span class="muted">{t('public.cv.rate')}</span>
            {#if profile.rate_price}<strong>{profile.rate_price}</strong>{/if}
            {#if tr(profile.rate_text, profile.lang)}<LangText text={profile.rate_text} origin={profile.lang} />{/if}
          </p>
        {/if}
        <div class="row actions">
          {#if canContact}
            <ContactButton recipientId={profile.id} recipientName={profile.display_name} />
          {/if}
          {#if isMine}
            <Button href={url.my(lang, 'perfil')} variant="secondary" size="sm">{t('public.cv.editMine')}</Button>
          {/if}
          <QrCode target={url.qrCv(page.url.origin, profile.short_id)} label={profile.display_name} filename="rebelarte-{profile.alias}" />
          <Button variant="ghost" size="sm" onclick={() => window.print()}>{t('public.cv.print')}</Button>
          {#if !isMine}<ReportButton targetType="profile" targetId={profile.id} />{/if}
        </div>
      </div>
    </header>

    <p class="print-only">{page.url.origin}{url.cv(lang, profile.alias)}</p>

    <nav class="tabs" aria-label={t('public.cv.views')}>
      <a href={url.cv(lang, profile.alias)} aria-current={!gallery ? 'page' : undefined} data-sveltekit-noscroll>{t('public.cv.tabCv')}</a>
      <a href={url.gallery(lang, profile.alias)} aria-current={gallery ? 'page' : undefined} data-sveltekit-noscroll>{t('public.cv.tabGallery')}</a>
    </nav>

    {#if gallery}
      <section class="gal" aria-labelledby="cv-gal">
        <h2 class="sr-only" id="cv-gal">{t('public.cv.tabGallery')}</h2>
        {#if data.works.length === 0}
          <Empty>{t('public.cv.noWorks')}</Empty>
        {:else}
          <div class="filters">
            <div class="chips" role="group" aria-label={t('public.filter.branch')}>
              <button type="button" class="chip" class:on={!fBranch} aria-pressed={!fBranch} onclick={() => { fBranch = null; fCat = null; }}>{t('public.filter.allBranches')}</button>
              {#each galleryBranches as b (b)}
                <button type="button" class="chip" class:on={fBranch === b} aria-pressed={fBranch === b} style:--c="var(--rama-{b})"
                  onclick={() => { fBranch = b; fCat = null; }}>{t(`branch.${b}`)}</button>
              {/each}
            </div>
            {#if galleryCats.length > 1}
              <div class="chips" role="group" aria-label={t('public.filter.category')}>
                <button type="button" class="chip" class:on={fCat == null} aria-pressed={fCat == null} style:--c="var(--rama-{fBranch})" onclick={() => (fCat = null)}>{t('public.filter.allCategories')}</button>
                {#each galleryCats as c (c.id)}
                  <button type="button" class="chip" class:on={fCat === c.id} aria-pressed={fCat === c.id} style:--c="var(--rama-{fBranch})" onclick={() => (fCat = c.id)}>{tr(c.name)}</button>
                {/each}
              </div>
            {/if}
          </div>
          <ul class="grid-cards plain">
            {#each galleryWorks as w (w.id)}<li><WorkCardView work={w} showAuthor={false} /></li>{/each}
          </ul>
        {/if}
      </section>
    {:else}
      <div class="sections">
        {#if profile.cover_letter && tr(profile.cover_letter, profile.lang)}
          <section aria-labelledby="cv-cover">
            <h2 id="cv-cover">{t('public.cv.coverLetter')}</h2>
            <div class="letter"><LangText text={profile.cover_letter} origin={profile.lang} multiline /></div>
          </section>
        {/if}

        <section aria-labelledby="cv-works">
          <h2 id="cv-works">{t('public.cv.works')}</h2>
          {#if worksByBranch.length === 0}
            <p class="muted">{t('public.cv.noWorks')}</p>
          {:else}
            {#each worksByBranch as g (g.branch)}
              <h3 class="bh" style:--c="var(--rama-{g.branch})">{t(`branch.${g.branch}`)}</h3>
              <ul class="wl">
                {#each g.items as w (w.id)}
                  {@const wt = tr(w.title, w.lang)}
                  {@const img = publicUrl('images', w.cover_path)}
                  <li style:--c="var(--rama-{g.branch})">
                    <a class="th" href={url.work(lang, w.short_id, wt)} tabindex="-1" aria-hidden="true">
                      {#if img}<img src={img} alt="" loading="lazy" />{/if}
                    </a>
                    <div class="wi">
                      <a class="wt" href={url.work(lang, w.short_id, wt)}>{wt}</a>
                      {#if catName(w)}<span class="muted sm">{catName(w)}</span>{/if}
                      {#if roleName(w)}<span class="sm roles">{roleName(w)}</span>{/if}
                    </div>
                  </li>
                {/each}
              </ul>
            {/each}
          {/if}
        </section>

        {#if awardItems.length}
          <section aria-labelledby="cv-awards">
            <h2 id="cv-awards">{t('public.cv.awards')}</h2>
            <AwardList awards={awardItems} />
          </section>
        {/if}

        {#each entryGroups as g (g.kind)}
          <section aria-labelledby="cv-{g.kind}">
            <h2 id="cv-{g.kind}">{t(`public.cv.kind.${g.kind}`)}</h2>
            <ul class="entries">
              {#each g.entries as e (e.id)}
                {@const range = formatDateRange(e.start_date, e.end_date, lang, since)}
                <li>
                  <p class="et"><strong><LangText text={e.title} origin={e.lang} /></strong></p>
                  {#if e.organization || range}
                    <p class="muted sm">{[e.organization, range].filter(Boolean).join(' · ')}</p>
                  {/if}
                  {#if tr(e.description, e.lang)}<div class="sm"><LangText text={e.description} origin={e.lang} multiline /></div>{/if}
                </li>
              {/each}
            </ul>
          </section>
        {/each}

        {#if !data.entries.length && !awardItems.length && !data.works.length && !(profile.cover_letter && tr(profile.cover_letter, profile.lang))}
          <Empty>{t('public.cv.empty')}</Empty>
        {/if}
      </div>
    {/if}
  </article>
{/if}

<style>
  .pad { padding-top: var(--space-7); }
  .cv { padding-top: var(--space-6); }
  .head { display: flex; gap: var(--space-5); align-items: flex-start; flex-wrap: wrap; }
  .who { flex: 1; min-width: min(100%, 260px); display: grid; gap: var(--space-2); }
  .who h1 { margin: 0; font-size: clamp(1.9rem, 5vw, 3rem); overflow-wrap: anywhere; }
  .who p { margin: 0; }
  .hl { font-size: 1.15rem; font-family: var(--font-display); }
  .meta { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); font-size: 0.92rem; }
  .loc { display: inline-flex; align-items: center; gap: 4px; }
  .mail { overflow-wrap: anywhere; }
  .rate { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: baseline; }
  .actions { margin-top: var(--space-2); gap: var(--space-2); }
  .print-only { display: none; }

  .tabs { display: flex; gap: var(--space-1); margin: var(--space-6) 0 var(--space-5); border-bottom: 1px solid var(--line); }
  .tabs a { padding: 10px 18px; text-decoration: none; font-weight: 600; border-bottom: 3px solid transparent; margin-bottom: -1px; min-height: 44px; }
  .tabs a:hover { color: var(--accent); }
  .tabs a[aria-current='page'] { border-color: var(--accent); }

  .sections { display: grid; gap: var(--space-6); max-width: 820px; }
  .sections h2 { font-size: 1.5rem; padding-bottom: var(--space-2); border-bottom: 1px solid var(--line); }
  .letter { font-size: 1.05rem; }
  .sm { font-size: 0.9rem; }
  .bh { font-size: 1rem; font-family: var(--font-ui); color: var(--c); text-transform: uppercase; letter-spacing: 0.1em; margin: var(--space-4) 0 var(--space-2); }
  .wl { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .wl li { display: flex; gap: var(--space-3); align-items: center; border-left: 4px solid var(--c); padding-left: var(--space-3); }
  .th { flex: none; width: 64px; height: 48px; border-radius: 4px; overflow: hidden; background: var(--surface-2); }
  .th img { width: 100%; height: 100%; object-fit: cover; }
  .wi { display: grid; min-width: 0; }
  .wt { font-weight: 600; font-family: var(--font-display); font-size: 1.05rem; text-decoration: none; overflow-wrap: anywhere; }
  .wt:hover { text-decoration: underline; }
  .roles { color: var(--fg); font-style: italic; }
  .entries { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
  .entries p { margin: 0; }

  .filters { display: grid; gap: var(--space-3); margin-bottom: var(--space-5); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .chip { --c: var(--fg); display: inline-flex; align-items: center; min-height: 36px; padding: 4px 14px; border-radius: 999px; border: 1px solid var(--c);
    color: var(--c); background: transparent; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
  .chip:hover { background: color-mix(in srgb, var(--c) 12%, transparent); }
  .chip.on { background: var(--c); color: var(--bg); }
  .plain { list-style: none; padding: 0; margin: 0; }
  .plain > li { display: contents; }

  @media (max-width: 480px) {
    .head { flex-direction: column; }
  }

  @media print {
    :global(.top), :global(.foot), :global(.skip) { display: none !important; }
    :global(body) { background: #fff !important; color: #000 !important; font-size: 11pt; }
    .tabs, .actions, .filters { display: none !important; }
    .print-only { display: block; font-size: 9pt; color: #444; margin-top: 4pt; }
    .cv { padding: 0; max-width: none; }
    .sections { max-width: none; gap: 14pt; }
    .sections section, .wl li, .entries li { break-inside: avoid; }
    .sections h2 { font-size: 14pt; }
    .th { display: none; }
    a { text-decoration: none; color: #000 !important; }
  }
</style>
