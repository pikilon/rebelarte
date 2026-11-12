<script lang="ts">
  import { currentLang, tr } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import type { ProfilePublic } from '$lib/types';
  let { profile }: { profile: ProfilePublic } = $props();
  const lang = $derived(currentLang());
  const headline = $derived(tr(profile.headline, profile.lang));
</script>

<a class="pc" href={url.cv(lang, profile.alias)}>
  <Avatar path={profile.avatar_path} name={profile.display_name} size={48} />
  <span class="txt">
    <strong>{profile.display_name}</strong>
    {#if headline}<span class="muted">{headline}</span>{/if}
  </span>
</a>

<style>
  .pc { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3); border-radius: var(--radius);
    background: var(--surface); box-shadow: var(--shadow); text-decoration: none; min-width: 0; }
  .pc:hover { color: inherit; outline: 1px solid var(--accent); }
  .txt { display: grid; min-width: 0; }
  .txt > * { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .muted { font-size: 0.88rem; }
</style>
