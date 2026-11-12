<script lang="ts">
  // Obras de una rama, filtrables por categoría (?categoria=<slug>).
  import { page } from '$app/state';
  import { onMount, untrack } from 'svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import type { Category } from '$lib/types';
  import { listWorks, loadCatalogsSafe } from '$lib/api/public';
  import { PagedWorks } from '$lib/api/paged.svelte';
  import { isBranch } from '$lib/api/publicUtils';
  import { url } from '$lib/routes';
  import Meta from '$lib/components/public/Meta.svelte';
  import NotFound from '$lib/components/public/NotFound.svelte';
  import FilterChips, { type Chip } from '$lib/components/public/FilterChips.svelte';
  import WorkResults from '$lib/components/public/WorkResults.svelte';

  const lang = $derived(currentLang());
  const raw = $derived(page.params.rama);
  const branch = $derived(isBranch(raw) ? raw : null);
  const catSlug = $derived(page.url.searchParams.get('categoria'));

  let categories = $state<Category[]>([]);
  let ready = $state(false);
  const works = new PagedWorks();

  const cats = $derived(branch ? categories.filter((c) => c.branch === branch) : []);
  const category = $derived(catSlug ? cats.find((c) => c.slug === catSlug) ?? null : null);

  onMount(async () => {
    categories = (await loadCatalogsSafe()).categories;
    ready = true;
  });

  $effect(() => {
    if (!ready || !branch) return;
    const filter = { branch, categoryId: category?.id ?? null };
    untrack(() => void works.reset((limit, offset) => listWorks(filter, limit, offset)));
  });

  const chips = $derived<Chip[]>(
    branch && cats.length
      ? [
          { label: t('public.filter.allCategories'), href: url.branch(lang, branch), active: !category, color: `var(--rama-${branch})` },
          ...cats.map((c) => ({
            label: tr(c.name), href: `${url.branch(lang, branch)}?categoria=${encodeURIComponent(c.slug)}`,
            active: category?.id === c.id, color: `var(--rama-${branch})`
          }))
        ]
      : []
  );
  const name = $derived(branch ? t(`branch.${branch}`) : '');
</script>

{#if !branch}
  <NotFound />
{:else}
  <Meta title={category ? `${name} · ${tr(category.name)}` : name} description={t(`public.branch.${branch}.desc`)} />
  <div class="container wrap" style:--c="var(--rama-{branch})">
    <header>
      <p class="eyebrow">{t('public.branch.eyebrow')}</p>
      <h1>{name}</h1>
      <p class="lead muted">{t(`public.branch.${branch}.desc`)}</p>
    </header>
    {#if chips.length > 1}<FilterChips label={t('public.filter.category')} {chips} />{/if}
    <WorkResults list={works} />
  </div>
{/if}

<style>
  .wrap { padding-top: var(--space-6); display: grid; gap: var(--space-5); }
  header { border-left: 6px solid var(--c); padding-left: var(--space-4); }
  .eyebrow { color: var(--c); }
  h1 { margin-bottom: var(--space-2); }
  .lead { margin: 0; font-size: 1.1rem; }
</style>
