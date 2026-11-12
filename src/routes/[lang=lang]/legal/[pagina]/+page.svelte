<script lang="ts">
  // Textos legales provisionales. Estructura: claves public.legal.<pagina>.<n>.t / .p
  import { page } from '$app/state';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Meta from '$lib/components/public/Meta.svelte';
  import NotFound from '$lib/components/public/NotFound.svelte';

  const PAGES = { aviso: 6, condiciones: 8, privacidad: 7 } as const;
  type Pagina = keyof typeof PAGES;

  const lang = $derived(currentLang());
  const slug = $derived(page.params.pagina ?? '');
  const pagina = $derived<Pagina | null>(slug in PAGES ? (slug as Pagina) : null);
  const sections = $derived(pagina ? Array.from({ length: PAGES[pagina] }, (_, i) => i + 1) : []);
</script>

{#if !pagina}
  <NotFound />
{:else}
  <Meta title={t(`public.legal.${pagina}.title`)} description={t(`public.legal.${pagina}.description`)} />
  <div class="container wrap">
    <h1>{t(`public.legal.${pagina}.title`)}</h1>
    <Notice kind="warn"><strong>{t('public.legal.draft')}</strong> {t('public.legal.draftText')}</Notice>

    <nav class="other" aria-label={t('public.legal.nav')}>
      {#each ['aviso', 'condiciones', 'privacidad'] as const as p (p)}
        <a href={url.legal(lang, p)} aria-current={p === pagina ? 'page' : undefined}>{t(`public.legal.${p}.title`)}</a>
      {/each}
    </nav>

    {#each sections as n (n)}
      <section>
        <h2>{n}. {t(`public.legal.${pagina}.${n}.t`)}</h2>
        <p>{t(`public.legal.${pagina}.${n}.p`)}</p>
      </section>
    {/each}
  </div>
{/if}

<style>
  .wrap { padding-top: var(--space-6); display: grid; gap: var(--space-4); max-width: 760px; }
  .wrap > h1 { margin: 0; }
  .other { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); font-size: 0.95rem; }
  .other a { text-decoration: none; padding: 4px 0; border-bottom: 2px solid transparent; }
  .other a[aria-current='page'] { border-color: var(--accent); font-weight: 600; }
  section h2 { font-size: 1.25rem; margin-bottom: var(--space-2); }
  section p { margin: 0; }
</style>
