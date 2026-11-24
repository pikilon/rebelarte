<script lang="ts">
  // Botones de acción + formulario de nota obligatoria. Elegir una acción es el paso de confirmación.
  import { t } from '$lib/i18n';
  import { moderate } from '$lib/api/moderation';
  import { NOTE_MAX, validateNote, type ActionSpec } from '$lib/moderation/logic';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';

  let { actions, reportId = null, ondone }: { actions: ActionSpec[]; reportId?: string | null; ondone: (spec: ActionSpec) => void } = $props();
  const uid = $props.id();
  let chosen = $state<ActionSpec | null>(null);
  let note = $state('');
  let touched = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let noteEl: HTMLTextAreaElement | undefined = $state();

  const problem = $derived(validateNote(note));

  function choose(a: ActionSpec) {
    chosen = a;
    touched = false;
    error = null;
    queueMicrotask(() => noteEl?.focus());
  }
  function cancel() {
    chosen = null;
    note = '';
    error = null;
  }
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    touched = true;
    if (!chosen || problem) return;
    busy = true;
    error = null;
    try {
      await moderate(chosen, note, reportId);
      const done = chosen;
      chosen = null;
      note = '';
      ondone(done);
    } catch (err) {
      error = `${t('mod.error')}${err instanceof Error && err.message ? ` (${err.message})` : ''}`;
    } finally {
      busy = false;
    }
  }
</script>

{#if !chosen}
  <div class="row btns">
    {#each actions as a (a.action + a.targetType + a.targetId)}
      <Button size="sm" variant={a.destructive ? 'danger' : 'secondary'} onclick={() => choose(a)}>
        {t(a.label)}{#if a.targetType === 'profile' && actions.some((x) => x.targetType !== 'profile')} {t('mod.action.ofUploader')}{/if}
      </Button>
    {/each}
  </div>
{:else}
  <form class="form" onsubmit={submit} novalidate>
    <p class="what"><strong>{t(chosen.label)}</strong>{#if chosen.destructive} — {t('mod.confirmDestructive')}{/if}</p>
    <Field label={t('mod.note')} id="{uid}-note" hint={t('mod.noteHint')}
      error={touched && problem ? t(`mod.err.note.${problem}`, { max: NOTE_MAX }) : null}>
      <textarea id="{uid}-note" bind:this={noteEl} bind:value={note} rows="3" maxlength={NOTE_MAX} aria-describedby="{uid}-note-hint" required></textarea>
    </Field>
    {#if error}<Notice kind="error">{error}</Notice>{/if}
    <div class="row">
      <Button size="sm" type="submit" variant={chosen.destructive ? 'danger' : 'primary'} loading={busy}>{t('mod.confirm')}</Button>
      <Button size="sm" type="button" variant="ghost" onclick={cancel}>{t('common.cancel')}</Button>
    </div>
  </form>
{/if}

<style>
  .btns { gap: var(--space-2); }
  .form { display: grid; gap: var(--space-3); background: var(--surface-2); padding: var(--space-3); border-radius: var(--radius-sm); }
  .what { margin: 0; }
</style>
