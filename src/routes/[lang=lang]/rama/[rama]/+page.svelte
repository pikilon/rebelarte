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
  import BranchIcon from '$lib/components/ui/BranchIcon.svelte';

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
  <header class="band" style:--c="var(--rama-{branch})" style:--v="var(--rama-{branch}-vivid)">
    <div class="container head">
      <BranchIcon {branch} badge size={84} />
      <div>
        <p class="eyebrow">{t('public.branch.eyebrow')}</p>
        <h1>{name}</h1>
        <p class="lead muted">{t(`public.branch.${branch}.desc`)}</p>
      </div>
    </div>
  </header>
  <div class="container wrap" style:--c="var(--rama-{branch})">
    {#if chips.length > 1}<FilterChips label={t('public.filter.category')} {chips} />{/if}
    <WorkResults list={works} />
  </div>
{/if}

<style>
  .band {
    padding: var(--space-7) 0 var(--space-6); border-bottom: 1px solid var(--line);
    background: radial-gradient(600px 260px at 10% 0%, color-mix(in srgb, var(--v) 16%, transparent), transparent 75%);
  }
  .head { display: flex; align-items: center; gap: var(--space-5); }
  .eyebrow { color: var(--c); margin-bottom: var(--space-1); }
  h1 { margin-bottom: var(--space-2); }
  .lead { margin: 0; font-size: 1.1rem; max-width: 52ch; }
  .wrap { padding-top: var(--space-5); display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }
  @media (max-width: 520px) {
    .head { flex-direction: column; align-items: flex-start; gap: var(--space-4); }
  }
</style>
