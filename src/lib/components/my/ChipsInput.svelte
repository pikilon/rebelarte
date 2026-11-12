<script lang="ts">
  // Palabras clave como chips: Enter o coma añaden; Retroceso en vacío quita la última.
  import { t } from '$lib/i18n';
  import Field from '$lib/components/ui/Field.svelte';
  import { MAX_KEYWORDS, normalizeKeyword } from './logic';

  interface Props { value: string[]; label: string; hint?: string; placeholder?: string }
  let { value = $bindable(), label, hint, placeholder }: Props = $props();
  const uid = $props.id();
  let draft = $state('');

  function commit() {
    const parts = draft.split(/[,;\n]/).map(normalizeKeyword).filter(Boolean);
    draft = '';
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.includes(p) && next.length < MAX_KEYWORDS) next.push(p);
    value = next;
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      value = value.slice(0, -1);
    }
  }
</script>

<Field {label} id={uid} {hint}>
  <div class="box">
    <ul class="chips">
      {#each value as k}
        <li>
          {k}
          <button type="button" aria-label={t('my.chips.remove', { k })} onclick={() => (value = value.filter((x) => x !== k))}>×</button>
        </li>
      {/each}
    </ul>
    {#if value.length < MAX_KEYWORDS}
      <input id={uid} type="text" bind:value={draft} onkeydown={onKey} onblur={commit} {placeholder} />
    {/if}
  </div>
</Field>

<style>
  .box { display: grid; gap: var(--space-2); }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .chips:empty { display: none; }
  li { display: inline-flex; align-items: center; gap: 4px; background: var(--surface-2); border-radius: 999px; padding: 2px 4px 2px 12px; font-size: 0.85rem; }
  li button { border: 0; background: transparent; cursor: pointer; width: 26px; height: 26px; border-radius: 50%; font-size: 1.1rem; line-height: 1; }
  li button:hover { background: var(--accent-soft); color: var(--accent); }
</style>
