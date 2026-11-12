<script lang="ts">
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t, tr } from '$lib/i18n';
  import type { Award, CvEntry, CvEntryKind } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Empty from '$lib/components/ui/Empty.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import AwardForm from '$lib/components/my/AwardForm.svelte';
  import ConfirmDialog from '$lib/components/my/ConfirmDialog.svelte';
  import CvEntryForm from '$lib/components/my/CvEntryForm.svelte';
  import Section from '$lib/components/my/Section.svelte';
  import {
    createCvEntry, createMyAward, deleteCvEntry, deleteMyAward, listCvEntries, listMyAwards, saveCvOrder, updateCvEntry,
    updateMyAward, type AwardInput, type CvEntryInput, type MyAward
  } from '$lib/api/my';
  import { dbErrorKey, moveItem } from '$lib/components/my/logic';

  const KINDS: CvEntryKind[] = ['education', 'degree', 'course', 'experience', 'skill', 'material', 'other'];
  const lang = $derived(currentLang());
  const origin = $derived(auth.profile?.lang ?? lang);

  let entries = $state<CvEntry[]>([]);
  let awards = $state<MyAward[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let error = $state<string | null>(null);
  let busy = $state(false);
  // Editor abierto: nueva entrada de un tipo, entrada existente, o premio.
  let editing = $state<{ type: 'entry'; kind: CvEntryKind; id: string | null } | { type: 'award'; id: string | null } | null>(null);
  let toDelete = $state<{ type: 'entry'; id: string; name: string } | { type: 'award'; award: MyAward; name: string } | null>(null);
  let confirmOpen = $state(false);

  const byKind = (k: CvEntryKind) => entries.filter((e) => e.kind === k).sort((a, b) => a.sort - b.sort);

  onMount(load);
  async function load() {
    loading = true;
    loadError = false;
    const id = auth.userId;
    if (!id) return;
    try {
      [entries, awards] = await Promise.all([listCvEntries(id), listMyAwards(id)]);
    } catch {
      loadError = true;
    } finally {
      loading = false;
    }
  }

  const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '');
  function range(e: CvEntry): string {
    if (!e.start_date && !e.end_date) return '';
    return `${fmt(e.start_date)} – ${e.end_date ? fmt(e.end_date) : t('my.cv.present')}`;
  }

  async function saveEntry(kind: CvEntryKind, id: string | null, input: CvEntryInput) {
    const uid = auth.userId;
    if (!uid) return;
    busy = true;
    error = null;
    try {
      if (id) {
        const row = await updateCvEntry(id, input);
        entries = entries.map((e) => (e.id === id ? row : e));
      } else {
        const list = byKind(kind);
        const row = await createCvEntry(uid, input, list.length ? list[list.length - 1].sort + 1 : 0);
        entries = [...entries, row];
      }
      editing = null;
    } catch (e) {
      error = t(dbErrorKey(e));
    } finally {
      busy = false;
    }
  }

  async function move(kind: CvEntryKind, i: number, delta: -1 | 1) {
    const list = byKind(kind);
    const next = moveItem(list, i, delta);
    const before = entries;
    entries = entries.map((e) => {
      const pos = next.findIndex((x) => x.id === e.id);
      return pos >= 0 ? { ...e, sort: pos } : e;
    });
    try {
      await saveCvOrder(next.map((e) => e.id));
    } catch {
      entries = before;
      error = t('common.error');
    }
  }

  async function saveAward(id: string | null, input: AwardInput) {
    const uid = auth.userId;
    if (!uid) return;
    busy = true;
    error = null;
    try {
      if (id) {
        const a: Award = await updateMyAward(id, input);
        awards = awards.map((x) => (x.award.id === id ? { ...x, award: a } : x));
      } else {
        awards = [...awards, await createMyAward(uid, input)];
      }
      editing = null;
    } catch (e) {
      error = t(dbErrorKey(e));
    } finally {
      busy = false;
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    busy = true;
    try {
      if (toDelete.type === 'entry') {
        const id = toDelete.id;
        await deleteCvEntry(id);
        entries = entries.filter((e) => e.id !== id);
      } else {
        const a = toDelete.award;
        await deleteMyAward(a);
        awards = awards.filter((x) => x.link_id !== a.link_id);
      }
    } catch (e) {
      error = t(dbErrorKey(e));
    } finally {
      busy = false;
      confirmOpen = false;
    }
  }
  function askEntry(e: CvEntry) {
    toDelete = { type: 'entry', id: e.id, name: tr(e.title, e.lang) };
    confirmOpen = true;
  }
  function askAward(a: MyAward) {
    toDelete = { type: 'award', award: a, name: tr(a.award.name, a.award.lang) };
    confirmOpen = true;
  }
</script>

<svelte:head><title>{t('my.nav.cv')} · {t('app.name')}</title></svelte:head>

<div class="stack">
  <h1>{t('my.nav.cv')}</h1>
  <p class="muted">{t('my.cv.intro')}</p>
  {#if error}<Notice kind="error">{error}</Notice>{/if}

  {#if loading}
    <Spinner />
  {:else if loadError}
    <Notice kind="error">{t('common.error')} <Button size="sm" variant="secondary" onclick={load}>{t('my.retry')}</Button></Notice>
  {:else}
    {#each KINDS as kind (kind)}
      {@const list = byKind(kind)}
      <Section title={t(`my.cv.kind.${kind}`)} id="cv-{kind}">
        {#if list.length}
          <ol class="entries">
            {#each list as e, i (e.id)}
              <li>
                {#if editing?.type === 'entry' && editing.id === e.id}
                  <CvEntryForm {kind} entry={e} {origin} {busy} onsave={(inp) => saveEntry(kind, e.id, inp)} oncancel={() => (editing = null)} />
                {:else}
                  <div class="entry">
                    <div class="txt">
                      <strong>{tr(e.title, e.lang)}</strong>
                      {#if e.organization}<span>{e.organization}</span>{/if}
                      {#if range(e)}<small class="muted">{range(e)}</small>{/if}
                      <small class="muted">{t(`visibility.${e.visibility}`)}</small>
                    </div>
                    <div class="acts">
                      <button type="button" aria-label={t('my.up')} disabled={i === 0} onclick={() => move(kind, i, -1)}>↑</button>
                      <button type="button" aria-label={t('my.down')} disabled={i === list.length - 1} onclick={() => move(kind, i, 1)}>↓</button>
                      <Button size="sm" variant="secondary" type="button" onclick={() => (editing = { type: 'entry', kind, id: e.id })}>{t('common.edit')}</Button>
                      <Button size="sm" variant="danger" type="button" onclick={() => askEntry(e)}>{t('common.delete')}</Button>
                    </div>
                  </div>
                {/if}
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">{t('my.cv.none')}</p>
        {/if}
        {#if editing?.type === 'entry' && editing.kind === kind && editing.id === null}
          <CvEntryForm {kind} entry={null} {origin} {busy} onsave={(inp) => saveEntry(kind, null, inp)} oncancel={() => (editing = null)} />
        {:else}
          <div><Button size="sm" variant="secondary" type="button" onclick={() => (editing = { type: 'entry', kind, id: null })}>{t('my.cv.add')}</Button></div>
        {/if}
      </Section>
    {/each}

    <Section title={t('my.cv.awards')} intro={t('my.cv.awardsIntro')} id="cv-awards">
      {#if awards.length}
        <ul class="entries">
          {#each awards as a (a.link_id)}
            <li>
              {#if editing?.type === 'award' && editing.id === a.award.id}
                <AwardForm award={a.award} {origin} {busy} onsave={(inp) => saveAward(a.award.id, inp)} oncancel={() => (editing = null)} />
              {:else}
                <div class="entry">
                  <div class="txt">
                    <strong>{tr(a.award.name, a.award.lang)}</strong>
                    <span>{[a.award.organization, a.award.year].filter(Boolean).join(' · ')}</span>
                    {#if a.award.verified}<span class="seal">✓ {t('my.cv.verified')}</span>{:else}<small class="muted">{t('my.cv.selfDeclared')}</small>{/if}
                  </div>
                  <div class="acts">
                    <Button size="sm" variant="secondary" type="button" onclick={() => (editing = { type: 'award', id: a.award.id })}>{t('common.edit')}</Button>
                    <Button size="sm" variant="danger" type="button" onclick={() => askAward(a)}>{t('common.delete')}</Button>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {:else}
        <Empty>{t('my.cv.noAwards')}</Empty>
      {/if}
      {#if editing?.type === 'award' && editing.id === null}
        <AwardForm award={null} {origin} {busy} onsave={(inp) => saveAward(null, inp)} oncancel={() => (editing = null)} />
      {:else}
        <div><Button size="sm" variant="secondary" type="button" onclick={() => (editing = { type: 'award', id: null })}>{t('my.cv.addAward')}</Button></div>
      {/if}
    </Section>
  {/if}
</div>

<ConfirmDialog bind:open={confirmOpen} title={t('my.cv.deleteTitle')} {busy} onconfirm={confirmDelete}>
  {t('my.cv.deleteMsg', { name: toDelete?.name ?? '' })}
</ConfirmDialog>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .entries { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .entry { display: grid; gap: var(--space-3); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: var(--space-3) var(--space-4); background: var(--bg); }
  .txt { display: grid; gap: 2px; min-width: 0; overflow-wrap: anywhere; }
  .acts { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; }
  .acts > button:not(.btn) { border: 1px solid var(--line); background: var(--surface); border-radius: 50%; width: 36px; height: 36px; cursor: pointer; }
  .acts > button:disabled { opacity: 0.4; cursor: not-allowed; }
  .seal { color: var(--ok); font-weight: 600; font-size: 0.85rem; }
  @media (min-width: 720px) { .entry { grid-template-columns: 1fr auto; align-items: center; } }
</style>
