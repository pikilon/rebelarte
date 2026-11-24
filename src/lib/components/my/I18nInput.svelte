<script lang="ts">
  // Editor bilingüe: pestañas es/en sobre un mismo campo. El idioma de origen es obligatorio.
  import { LANGS, t } from '$lib/i18n';
  import type { I18nText, Lang } from '$lib/types';
  import Field from '$lib/components/ui/Field.svelte';

  interface Props {
    value: I18nText;
    origin: Lang;
    label: string;
    multiline?: boolean;
    rows?: number;
    maxlength?: number;
    hint?: string;
    error?: string | null;
    required?: boolean;
  }
  let { value = $bindable(), origin, label, multiline = false, rows = 6, maxlength, hint, error, required = true }: Props = $props();

  const uid = $props.id();
  let active = $state<Lang>('es');
  let touched = false;
  // Al abrir, la pestaña activa es el idioma de origen; después manda el usuario.
  $effect(() => {
    if (!touched) active = origin;
  });

  function pick(l: Lang) {
    touched = true;
    active = l;
  }
  function onKey(e: KeyboardEvent) {
    const i = LANGS.indexOf(active);
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % LANGS.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + LANGS.length) % LANGS.length;
    else return;
    e.preventDefault();
    pick(LANGS[n]);
    document.getElementById(`${uid}-tab-${LANGS[n]}`)?.focus();
  }
  function set(v: string) {
    value = { ...value, [active]: v };
  }
  const current = $derived(value[active] ?? '');
</script>

<Field {label} id="{uid}-f" {hint} {error}>
  <div class="tabs" role="tablist" aria-label={t('my.i18n.tabs')} tabindex="-1" onkeydown={onKey}>
    {#each LANGS as l}
      <button
        type="button" role="tab" id="{uid}-tab-{l}" aria-selected={active === l} aria-controls="{uid}-f"
        tabindex={active === l ? 0 : -1} class:on={active === l} onclick={() => pick(l)}
      >
        {l.toUpperCase()}
        {#if l === origin && required}<span class="req" title={t('my.i18n.required')}>*</span>{/if}
        {#if value[l]?.trim()}<span class="dot" aria-label={t('my.i18n.filled')}></span>{/if}
      </button>
    {/each}
  </div>
  {#if multiline}
    <textarea id="{uid}-f" {rows} {maxlength} lang={active} role="tabpanel" aria-labelledby="{uid}-tab-{active}" value={current} oninput={(e) => set(e.currentTarget.value)}></textarea>
  {:else}
    <input id="{uid}-f" type="text" {maxlength} lang={active} role="tabpanel" aria-labelledby="{uid}-tab-{active}" value={current} oninput={(e) => set(e.currentTarget.value)} />
  {/if}
  <small class="muted note">
    {active === origin ? t('my.i18n.originNote', { lang: t(`lang.${origin}`) }) : t('my.i18n.optionalNote')}
  </small>
</Field>

<style>
  .tabs { display: flex; gap: var(--space-1); }
  button { border: 1px solid var(--line); background: transparent; border-radius: 999px; padding: 4px 12px; font-size: 0.8rem; font-weight: 700; cursor: pointer; display: inline-flex; gap: 4px; align-items: center; min-height: 32px; }
  button.on { background: var(--fg); color: var(--bg); border-color: var(--fg); }
  .req { color: var(--accent); }
  .on .req { color: var(--accent-soft); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
  .note { font-size: 0.8rem; }
</style>
