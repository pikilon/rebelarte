<script lang="ts">
  // Selector de cargos: catálogo filtrado por rama (más globales) y «otro» con texto libre.
  import { t, tr } from '$lib/i18n';
  import type { BranchId, RoleCatalogItem } from '$lib/types';
  import { MAX_ROLES, rolesForBranch, type RoleSelection } from './logic';

  interface Props { catalog: RoleCatalogItem[]; branch: BranchId | null; selection: RoleSelection; legend?: string }
  let { catalog, branch, selection = $bindable(), legend }: Props = $props();
  const uid = $props.id();
  const items = $derived(rolesForBranch(catalog, branch));
  const total = $derived(selection.roleIds.length + selection.others.length);
  let other = $state('');

  function toggle(id: number, on: boolean) {
    selection = {
      ...selection,
      roleIds: on ? [...selection.roleIds, id] : selection.roleIds.filter((x) => x !== id)
    };
  }
  function addOther() {
    const v = other.replace(/\s+/g, ' ').trim();
    if (!v || total >= MAX_ROLES) return;
    if (!selection.others.some((o) => o.toLowerCase() === v.toLowerCase())) selection = { ...selection, others: [...selection.others, v] };
    other = '';
  }
</script>

<fieldset>
  <legend>{legend ?? t('my.roles.legend')}</legend>
  <div class="opts">
    {#each items as r (r.id)}
      <label class="opt">
        <input type="checkbox" checked={selection.roleIds.includes(r.id)} disabled={!selection.roleIds.includes(r.id) && total >= MAX_ROLES}
          onchange={(e) => toggle(r.id, e.currentTarget.checked)} />
        <span>{tr(r.name)}</span>
      </label>
    {/each}
  </div>
  <div class="other">
    <label for="{uid}-o">{t('my.roles.other')}</label>
    <div class="row">
      <input id="{uid}-o" type="text" maxlength="80" bind:value={other} placeholder={t('my.roles.otherPh')}
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOther(); } }} />
      <button type="button" class="add" onclick={addOther} disabled={!other.trim() || total >= MAX_ROLES}>{t('common.add')}</button>
    </div>
    {#if selection.others.length}
      <ul class="chips">
        {#each selection.others as o}
          <li>{o}<button type="button" aria-label={t('my.chips.remove', { k: o })} onclick={() => (selection = { ...selection, others: selection.others.filter((x) => x !== o) })}>×</button></li>
        {/each}
      </ul>
    {/if}
  </div>
  <small class="muted">{t('my.roles.count', { n: total, max: MAX_ROLES })}</small>
</fieldset>

<style>
  fieldset { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); margin: 0; display: grid; gap: var(--space-3); min-width: 0; }
  legend { font-weight: 600; font-size: 0.9rem; padding: 0 var(--space-2); }
  .opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: var(--space-1) var(--space-3); }
  .opt { display: flex; gap: var(--space-2); align-items: center; min-height: 34px; font-size: 0.92rem; }
  .other { display: grid; gap: 6px; }
  .other label { font-size: 0.85rem; font-weight: 600; }
  .other input { flex: 1; min-width: 0; padding: 8px 10px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface); min-height: 40px; }
  .row { flex-wrap: nowrap; }
  .add { border: 1px solid var(--fg); background: transparent; border-radius: 999px; padding: 8px 14px; cursor: pointer; font-weight: 600; min-height: 40px; }
  .add:disabled { opacity: 0.5; cursor: not-allowed; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-2); }
  li { display: inline-flex; align-items: center; gap: 4px; background: var(--surface-2); border-radius: 999px; padding: 2px 4px 2px 12px; font-size: 0.85rem; }
  li button { border: 0; background: transparent; cursor: pointer; width: 26px; height: 26px; border-radius: 50%; font-size: 1.1rem; line-height: 1; }
</style>
