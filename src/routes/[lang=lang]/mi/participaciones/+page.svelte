<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import type { ParticipationRole, RoleCatalogItem } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import ConfirmDialog from '$lib/components/my/ConfirmDialog.svelte';
  import RolePicker from '$lib/components/my/RolePicker.svelte';
  import Section from '$lib/components/my/Section.svelte';
  import {
    findWorkByShortId, listMyParticipations, listReceivedParticipations, loadCatalogs, requestParticipation,
    setParticipationStatus, type MyParticipation, type ReceivedParticipation
  } from '$lib/api/my';
  import { dbErrorKey, parseWorkRef, rolesToInput, type RoleSelection } from '$lib/components/my/logic';

  const lang = $derived(currentLang());
  const uid = $props.id();
  let mine = $state<MyParticipation[]>([]);
  let received = $state<ReceivedParticipation[]>([]);
  let catalog = $state<RoleCatalogItem[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let error = $state<string | null>(null);

  // Solicitar participación
  let ref = $state('');
  let looking = $state(false);
  let found = $state<Awaited<ReturnType<typeof findWorkByShortId>>>(null);
  let refError = $state<string | null>(null);
  let sel = $state<RoleSelection>({ roleIds: [], others: [] });
  let requesting = $state(false);
  let requestOk = $state<string | null>(null);

  // Confirmación
  let action = $state<{ id: string; kind: 'withdraw' | 'reject'; text: string } | null>(null);
  let confirmOpen = $state(false);
  let busy = $state(false);

  const names = $derived(new Map(catalog.map((r) => [r.id, tr(r.name)])));
  const roleText = (r: ParticipationRole) => (r.role_id != null ? names.get(r.role_id) ?? '…' : r.role_text ?? '');
  const rolesLine = (rs: ParticipationRole[]) => rs.filter((r) => r.status === 'accepted').map(roleText).join(', ');
  const inbox = $derived(received.filter((r) => r.created_by !== auth.userId));

  onMount(load);
  async function load() {
    const id = auth.userId;
    if (!id) return;
    loading = true;
    failed = false;
    try {
      const [m, r, c] = await Promise.all([listMyParticipations(id), listReceivedParticipations(id), loadCatalogs()]);
      mine = m;
      received = r;
      catalog = c.roles;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  async function lookup(e: SubmitEvent) {
    e.preventDefault();
    refError = null;
    requestOk = null;
    found = null;
    const short = parseWorkRef(ref);
    if (!short) return void (refError = t('my.parts.errRef'));
    looking = true;
    try {
      found = await findWorkByShortId(short);
      if (!found) refError = t('my.parts.errNotFound');
      sel = { roleIds: [], others: [] };
    } catch {
      refError = t('common.error');
    } finally {
      looking = false;
    }
  }

  async function request() {
    if (!found) return;
    const roles = rolesToInput(sel);
    if (!roles.length) return void (refError = t('my.part.errRoles'));
    requesting = true;
    refError = null;
    try {
      await requestParticipation(found.id, roles);
      requestOk = t('my.parts.requested', { title: tr(found.title, found.lang) });
      found = null;
      ref = '';
      await load();
    } catch (e) {
      refError = t(dbErrorKey(e));
    } finally {
      requesting = false;
    }
  }

  function ask(id: string, kind: 'withdraw' | 'reject', text: string) {
    action = { id, kind, text };
    confirmOpen = true;
  }
  async function confirm() {
    if (!action) return;
    busy = true;
    error = null;
    try {
      await setParticipationStatus(action.id, action.kind === 'withdraw' ? 'withdrawn' : 'rejected');
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

<svelte:head><title>{t('my.nav.participations')} · {t('app.name')}</title></svelte:head>

<div class="stack">
  <h1>{t('my.nav.participations')}</h1>
  {#if error}<Notice kind="error">{error}</Notice>{/if}

  {#if loading}
    <Spinner />
  {:else if failed}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('my.retry')}</Button></Notice>
  {:else}
    <Section title={t('my.parts.mine')} intro={t('my.parts.mineIntro')} id="mine">
      {#if mine.length}
        <ul class="rows">
          {#each mine as p (p.id)}
            {@const title = p.work ? tr(p.work.title, p.work.lang) : t('my.parts.unavailable')}
            <li class="row-item">
              <div class="txt">
                <strong>
                  {#if p.work && p.work.status === 'published'}<a href={url.work(lang, p.work.short_id, title)}>{title}</a>{:else}{title}{/if}
                </strong>
                <span class="muted">{rolesLine(p.roles) || '—'}</span>
                <span class="badge st-{p.status}">{t(`my.part.status.${p.status}`)}</span>
              </div>
              {#if p.status === 'accepted' || p.status === 'pending'}
                <Button size="sm" variant="danger" type="button" onclick={() => ask(p.id, 'withdraw', title)}>{t('my.parts.withdraw')}</Button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <Empty>{t('my.parts.noneMine')}</Empty>
      {/if}
    </Section>

    <Section title={t('my.parts.request')} intro={t('my.parts.requestIntro')} id="request">
      <form class="stack" onsubmit={lookup} novalidate>
        <Field label={t('my.parts.ref')} id="{uid}-ref" hint={t('my.parts.refHint')} error={found ? null : refError}>
          <input id="{uid}-ref" type="text" bind:value={ref} autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://rebelarte.com/es/obra/…" />
        </Field>
        <div><Button type="submit" variant="secondary" loading={looking}>{t('my.parts.find')}</Button></div>
      </form>
      {#if requestOk}<Notice kind="ok">{requestOk}</Notice>{/if}
      {#if found}
        <div class="found stack">
          <p><strong>{tr(found.title, found.lang)}</strong> <span class="muted">· {found.uploader_name} · {t(`branch.${found.branch}`)}</span></p>
          <RolePicker {catalog} branch={found.branch} bind:selection={sel} legend={t('my.parts.yourRoles')} />
          {#if refError}<Notice kind="error">{refError}</Notice>{/if}
          <div class="row">
            <Button type="button" loading={requesting} onclick={request}>{t('my.parts.send')}</Button>
            <Button type="button" variant="ghost" onclick={() => (found = null)}>{t('common.cancel')}</Button>
          </div>
        </div>
      {/if}
    </Section>

    <Section title={t('my.parts.received')} intro={t('my.parts.receivedIntro')} id="received">
      {#if inbox.length}
        <ul class="rows">
          {#each inbox as p (p.id)}
            {@const title = tr(p.work.title, p.work.lang)}
            <li class="row-item">
              <div class="txt">
                <strong>{p.person?.display_name ?? p.guest_name ?? '—'}</strong>
                <span class="muted">{rolesLine(p.roles) || '—'} · <a href={url.my(lang, `obras/${p.work.id}`)}>{title}</a></span>
                <span class="badge st-{p.status}">{t(`my.part.status.${p.status}`)}</span>
              </div>
              {#if p.status === 'accepted' || p.status === 'pending'}
                <Button size="sm" variant="danger" type="button" onclick={() => ask(p.id, 'reject', p.person?.display_name ?? p.guest_name ?? '')}>{t('my.part.reject')}</Button>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <Empty>{t('my.parts.noneReceived')}</Empty>
      {/if}
    </Section>
  {/if}
</div>

<ConfirmDialog
  bind:open={confirmOpen} {busy} onconfirm={confirm}
  title={action?.kind === 'withdraw' ? t('my.parts.withdrawTitle') : t('my.part.rejectTitle')}
  confirmLabel={action?.kind === 'withdraw' ? t('my.parts.withdraw') : t('my.part.rejectConfirm')}
>
  {#if action?.kind === 'withdraw'}{t('my.parts.withdrawMsg', { title: action.text })}{:else if action}{t('my.part.rejectMsg', { who: action.text })}{/if}
</ConfirmDialog>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .row-item { display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: space-between; align-items: center; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); background: var(--bg); }
  .txt { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
  .badge { justify-self: start; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); }
  .st-accepted { color: var(--ok); border-color: var(--ok); }
  .st-pending { color: var(--warn); border-color: var(--warn); }
  .st-rejected, .st-withdrawn { color: var(--danger); border-color: var(--danger); }
  .found { border-top: 1px solid var(--line); padding-top: var(--space-4); }
</style>
