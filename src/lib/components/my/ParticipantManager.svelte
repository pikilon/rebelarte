<script lang="ts">
  // Participantes de una obra (vista del subidor): estados, rechazo total o parcial, invitar y añadir sin cuenta.
  import { onMount } from 'svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { BranchId, ParticipationRole, RoleCatalogItem } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import ConfirmDialog from './ConfirmDialog.svelte';
  import RolePicker from './RolePicker.svelte';
  import {
    addGuestParticipant, inviteParticipant, listWorkParticipations, setParticipationStatus, setRoleStatus,
    type ParticipationView
  } from '$lib/api/my';
  import { dbErrorKey, normalizeAlias, rolesToInput, type RoleSelection } from './logic';

  interface Props { workId: string; branch: BranchId | null; uploaderId: string; catalog: RoleCatalogItem[] }
  let { workId, branch, uploaderId, catalog }: Props = $props();

  const lang = $derived(currentLang());
  const uid = $props.id();
  let rows = $state<ParticipationView[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let error = $state<string | null>(null);
  let ok = $state<string | null>(null);

  let mode = $state<'none' | 'invite' | 'guest'>('none');
  let alias = $state('');
  let guestName = $state('');
  let sel = $state<RoleSelection>({ roleIds: [], others: [] });
  let busy = $state(false);
  let claimCode = $state<{ name: string; code: string } | null>(null);
  let copied = $state<string | null>(null);

  type Action = { kind: 'part'; id: string; who: string } | { kind: 'role'; id: string; who: string; role: string };
  let action = $state<Action | null>(null);
  let confirmOpen = $state(false);

  const names = $derived(new Map(catalog.map((r) => [r.id, tr(r.name)])));
  const roleLabel = (r: ParticipationRole) => (r.role_id != null ? names.get(r.role_id) ?? '…' : r.role_text ?? '');
  const who = (p: ParticipationView) => p.person?.display_name ?? p.guest_name ?? '—';

  onMount(load);
  async function load() {
    loading = true;
    loadError = false;
    try {
      rows = await listWorkParticipations(workId);
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  function openMode(m: 'invite' | 'guest') {
    mode = mode === m ? 'none' : m;
    error = null;
    ok = null;
    sel = { roleIds: [], others: [] };
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = null;
    ok = null;
    const roles = rolesToInput(sel);
    if (!roles.length) return void (error = t('my.part.errRoles'));
    busy = true;
    try {
      if (mode === 'invite') {
        const a = normalizeAlias(alias.replace(/^@/, ''));
        if (!a) return void (error = t('my.part.errAlias'));
        await inviteParticipant(workId, a, roles);
        ok = t('my.part.invited', { alias: a });
        alias = '';
      } else {
        const name = guestName.replace(/\s+/g, ' ').trim();
        if (!name) return void (error = t('my.part.errName'));
        const code = await addGuestParticipant(workId, name, roles);
        claimCode = { name, code };
        guestName = '';
      }
      sel = { roleIds: [], others: [] };
      mode = 'none';
      await load();
    } catch (err) {
      error = t(dbErrorKey(err));
    } finally {
      busy = false;
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      copied = code;
      setTimeout(() => (copied = null), 2000);
    } catch {
      // sin portapapeles: el código está visible para copiarlo a mano
    }
  }

  function ask(a: Action) {
    action = a;
    confirmOpen = true;
  }
  async function confirm() {
    if (!action) return;
    busy = true;
    error = null;
    try {
      if (action.kind === 'part') await setParticipationStatus(action.id, 'rejected');
      else await setRoleStatus(action.id, 'rejected');
      confirmOpen = false;
      await load();
    } catch (e) {
      error = t(dbErrorKey(e));
      confirmOpen = false;
    } finally {
      busy = false;
    }
  }
</script>

<div class="pm stack">
  <p class="muted">{t('my.part.intro')}</p>

  {#if loading}
    <Spinner />
  {:else if loadError}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('my.retry')}</Button></Notice>
  {:else}
    {#if claimCode}
      <Notice kind="ok">
        <p><strong>{t('my.part.claimTitle', { name: claimCode.name })}</strong></p>
        <p class="codeline"><code>{claimCode.code}</code>
          <Button size="sm" variant="secondary" type="button" onclick={() => claimCode && copy(claimCode.code)}>{copied === claimCode.code ? t('my.copied') : t('my.copy')}</Button>
        </p>
        <p class="muted">{t('my.part.claimHelp')}</p>
      </Notice>
    {/if}
    {#if ok}<Notice kind="ok">{ok}</Notice>{/if}
    {#if error}<Notice kind="error">{error}</Notice>{/if}

    {#if rows.length}
      <ul class="people">
        {#each rows as p (p.id)}
          {@const mine = p.profile_id === uploaderId}
          <li class="person {p.status}">
            <div class="head">
              <strong>
                {#if p.person}<a href={url.cv(lang, p.person.alias)}>{who(p)}</a>{:else}{who(p)}{/if}
              </strong>
              {#if !p.profile_id}<span class="badge">{t('my.part.guest')}</span>{/if}
              <span class="badge st-{p.status}">{t(`my.part.status.${p.status}`)}</span>
            </div>
            <ul class="roles">
              {#each p.roles as r (r.id)}
                <li class:rej={r.status === 'rejected'}>
                  <span>{roleLabel(r)}{#if r.status === 'rejected'} <em>({t('my.part.roleRejected')})</em>{/if}</span>
                  {#if !mine && r.status === 'accepted' && p.roles.filter((x) => x.status === 'accepted').length > 1 && p.status !== 'rejected' && p.status !== 'withdrawn'}
                    <button type="button" class="link" onclick={() => ask({ kind: 'role', id: r.id, who: who(p), role: roleLabel(r) })}>{t('my.part.rejectRole')}</button>
                  {/if}
                </li>
              {/each}
            </ul>
            {#if p.claim_code && !p.profile_id}
              <p class="codeline small">{t('my.part.code')} <code>{p.claim_code}</code>
                <button type="button" class="link" onclick={() => p.claim_code && copy(p.claim_code)}>{copied === p.claim_code ? t('my.copied') : t('my.copy')}</button>
              </p>
            {/if}
            {#if !mine && (p.status === 'accepted' || p.status === 'pending')}
              <div><Button size="sm" variant="danger" type="button" onclick={() => ask({ kind: 'part', id: p.id, who: who(p) })}>{t('my.part.reject')}</Button></div>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{t('my.part.none')}</p>
    {/if}

    <div class="row">
      <Button size="sm" variant="secondary" type="button" onclick={() => openMode('invite')} aria-expanded={mode === 'invite'}>{t('my.part.invite')}</Button>
      <Button size="sm" variant="secondary" type="button" onclick={() => openMode('guest')} aria-expanded={mode === 'guest'}>{t('my.part.addGuest')}</Button>
    </div>

    {#if mode !== 'none'}
      <form class="form stack" onsubmit={submit}>
        <h3>{mode === 'invite' ? t('my.part.invite') : t('my.part.addGuest')}</h3>
        {#if mode === 'invite'}
          <Field label={t('my.part.alias')} id="{uid}-a" hint={t('my.part.aliasHint')}>
            <input id="{uid}-a" type="text" bind:value={alias} autocomplete="off" autocapitalize="none" spellcheck="false" required />
          </Field>
        {:else}
          <Field label={t('my.part.guestName')} id="{uid}-g" hint={t('my.part.guestHint')}>
            <input id="{uid}-g" type="text" bind:value={guestName} maxlength="80" required />
          </Field>
        {/if}
        <RolePicker {catalog} {branch} bind:selection={sel} />
        <div class="row">
          <Button type="submit" loading={busy}>{mode === 'invite' ? t('my.part.sendInvite') : t('my.part.createGuest')}</Button>
          <Button type="button" variant="ghost" onclick={() => (mode = 'none')}>{t('common.cancel')}</Button>
        </div>
      </form>
    {/if}
  {/if}
</div>

<ConfirmDialog bind:open={confirmOpen} title={action?.kind === 'role' ? t('my.part.rejectRoleTitle') : t('my.part.rejectTitle')} confirmLabel={t('my.part.rejectConfirm')} {busy} onconfirm={confirm}>
  {#if action?.kind === 'role'}{t('my.part.rejectRoleMsg', { who: action.who, role: action.role })}{:else if action}{t('my.part.rejectMsg', { who: action.who })}{/if}
</ConfirmDialog>

<style>
  .people { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .person { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); display: grid; gap: var(--space-2); background: var(--bg); }
  .person.rejected, .person.withdrawn { opacity: 0.7; }
  .head { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .badge { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .st-accepted { color: var(--ok); border-color: var(--ok); }
  .st-pending { color: var(--warn); border-color: var(--warn); }
  .st-rejected, .st-withdrawn { color: var(--danger); border-color: var(--danger); }
  .roles { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--space-1) var(--space-4); font-size: 0.92rem; }
  .roles li { display: inline-flex; gap: var(--space-2); align-items: center; }
  .roles .rej { text-decoration: line-through; color: var(--muted); }
  .roles .rej em { text-decoration: none; display: inline-block; }
  .link { border: 0; background: transparent; color: var(--accent); cursor: pointer; padding: 4px; text-decoration: underline; font-size: 0.82rem; }
  .codeline { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin: 0; }
  code { font-family: ui-monospace, monospace; background: var(--surface-2); padding: 3px 8px; border-radius: var(--radius-sm); letter-spacing: 0.08em; user-select: all; }
  .small { font-size: 0.85rem; }
  .form { border-top: 1px solid var(--line); padding-top: var(--space-4); }
</style>
