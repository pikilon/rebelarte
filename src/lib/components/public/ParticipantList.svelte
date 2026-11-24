<script lang="ts">
  // Participantes de una obra con sus cargos aceptados. Sin cuenta: nombre sin enlace.
  import { currentLang, t, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import type { ParticipantView } from '$lib/api/public';
  import type { Lang } from '$lib/types';

  let { participants, origin, detailed = false }: { participants: ParticipantView[]; origin: Lang; detailed?: boolean } = $props();
  const lang = $derived(currentLang());
  const roleText = (p: ParticipantView) =>
    p.roles.map((r) => (r.name ? tr(r.name, origin) : r.text ?? '')).filter(Boolean).join(', ');
</script>

<ul class="pl" class:detailed>
  {#each participants as p (p.id)}
    {@const name = p.profile?.display_name ?? p.guestName ?? ''}
    {@const roles = roleText(p)}
    <li>
      <Avatar path={p.profile?.avatar_path} {name} size={detailed ? 56 : 36} />
      <div class="info">
        {#if p.profile}
          <a class="name" href={url.cv(lang, p.profile.alias)}>{name}</a>
        {:else}
          <span class="name">{name}</span>
          {#if detailed}<small class="muted">{t('public.participants.noAccount')}</small>{/if}
        {/if}
        {#if roles}<span class="roles muted">{roles}</span>{:else if detailed}<span class="roles muted">{t('public.participants.noRoles')}</span>{/if}
        {#if detailed && p.profile}
          {@const hl = tr(p.profile.headline, p.profile.lang)}
          {#if hl}<span class="hl muted">{hl}</span>{/if}
        {/if}
      </div>
    </li>
  {/each}
</ul>

<style>
  .pl { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
  .detailed { gap: var(--space-4); }
  li { display: flex; gap: var(--space-3); align-items: center; min-width: 0; }
  .detailed li { padding: var(--space-3) var(--space-4); background: var(--surface); border-radius: var(--radius); box-shadow: var(--shadow); }
  .info { display: grid; min-width: 0; }
  .name { font-weight: 600; overflow-wrap: anywhere; }
  a.name { text-decoration: none; }
  a.name:hover { text-decoration: underline; }
  .roles, .hl { font-size: 0.88rem; overflow-wrap: anywhere; }
  .detailed .name { font-size: 1.1rem; font-family: var(--font-display); }
</style>
