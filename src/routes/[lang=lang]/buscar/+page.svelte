<script lang="ts">
  // Búsqueda de obras y autores. Filtros en la URL: ?q=&rama=&categoria=<slug>
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount, untrack } from 'svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { BRANCHES } from '$lib/types';
  import type { Category, ProfilePublic } from '$lib/types';
  import { listWorks, loadCatalogsSafe, searchProfiles, searchWorks } from '$lib/api/public';
  import { PagedWorks } from '$lib/api/paged.svelte';
  import { isBranch, searchHref } from '$lib/api/publicUtils';
  import Button from '$lib/components/ui/Button.svelte';
  import Meta from '$lib/components/public/Meta.svelte';
  import FilterChips, { type Chip } from '$lib/components/public/FilterChips.svelte';
  import WorkResults from '$lib/components/public/WorkResults.svelte';
  import ProfileCard from '$lib/components/public/ProfileCard.svelte';

  const lang = $derived(currentLang());
  const q = $derived((page.url.searchParams.get('q') ?? '').trim());
  const rama = $derived.by(() => {
    const r = page.url.searchParams.get('rama');
    return isBranch(r) ? r : null;
  });
  const catSlug = $derived(page.url.searchParams.get('categoria'));

  let categories = $state<Category[]>([]);
  let ready = $state(false);
  let input = $state('');
  let people = $state<ProfilePublic[]>([]);
  const works = new PagedWorks();

  const branchCats = $derived(rama ? categories.filter((c) => c.branch === rama) : []);
  const category = $derived(catSlug ? branchCats.find((c) => c.slug === catSlug) ?? null : null);

  onMount(async () => {
    categories = (await loadCatalogsSafe()).categories;
    ready = true;
  });

  $effect(() => { input = q; });

  // Nueva búsqueda cada vez que cambian la consulta o los filtros.
  $effect(() => {
    if (!ready) return;
    const query = q;
    const filter = { branch: rama, categoryId: category?.id ?? null };
    let live = true;
    untrack(() => {
      void works.reset((limit, offset) =>
        query ? searchWorks(query, filter, limit, offset) : listWorks(filter, limit, offset)
      );
      people = [];
      if (query) {
        searchProfiles(query, 8).then((p) => { if (live) people = p; }).catch(() => { if (live) people = []; });
      }
    });
    return () => { live = false; };
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    void goto(searchHref(lang, { q: input, rama, categoria: category?.slug }), { keepFocus: true });
  }

  const branchChips = $derived<Chip[]>([
    { label: t('public.filter.allBranches'), href: searchHref(lang, { q }), active: !rama },
    ...BRANCHES.map((b) => ({
      label: t(`branch.${b}`), href: searchHref(lang, { q, rama: b }), active: rama === b, color: `var(--rama-${b})`
    }))
  ]);
  const categoryChips = $derived<Chip[]>(
    rama
      ? [
          { label: t('public.filter.allCategories'), href: searchHref(lang, { q, rama }), active: !category, color: `var(--rama-${rama})` },
          ...branchCats.map((c) => ({
            label: tr(c.name), href: searchHref(lang, { q, rama, categoria: c.slug }), active: category?.id === c.id, color: `var(--rama-${rama})`
          }))
        ]
      : []
  );
  const heading = $derived(q ? t('public.search.resultsFor', { q }) : t('public.search.title'));
</script>

<Meta title={heading} description={t('public.search.description')} />

<div class="container wrap">
  <h1>{heading}</h1>

  <form class="sf" role="search" onsubmit={submit}>
    <label class="sr-only" for="s-q">{t('public.home.searchLabel')}</label>
    <input id="s-q" type="search" bind:value={input} placeholder={t('public.home.searchPlaceholder')} autocomplete="off" />
    <Button type="submit">{t('nav.search')}</Button>
  </form>

  <div class="filters">
    <FilterChips label={t('public.filter.branch')} chips={branchChips} />
    {#if categoryChips.length > 1}
      <FilterChips label={t('public.filter.category')} chips={categoryChips} />
    {/if}
  </div>

  {#if q && people.length}
    <section aria-labelledby="s-people">
      <h2 id="s-people">{t('public.search.authors')}</h2>
      <ul class="people">
        {#each people as p (p.id)}<li><ProfileCard profile={p} /></li>{/each}
      </ul>
    </section>
  {/if}

  <section aria-labelledby="s-works" aria-live="polite">
    <h2 id="s-works">{q ? t('public.search.works') : t('public.search.latest')}</h2>
    {#if !ready}
      <WorkResults list={works} />
    {:else}
      <WorkResults list={works} emptyText={q ? t('public.search.noResults', { q }) : undefined} />
    {/if}
  </section>
</div>

<style>
  .wrap { padding-top: var(--space-6); display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
  .wrap > h1 { margin: 0; overflow-wrap: anywhere; font-size: clamp(1.7rem, 4.5vw, 2.6rem); }
  .sf { display: flex; gap: var(--space-2); max-width: 560px; }
  .sf input { flex: 1; min-width: 0; padding: 10px 16px; border-radius: 999px; border: 1px solid var(--fg); background: var(--surface); min-height: 44px; }
  .filters { display: grid; gap: var(--space-3); }
  .people { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  h2 { font-size: 1.3rem; }
</style>
