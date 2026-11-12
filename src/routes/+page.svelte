<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browserLang } from '$lib/i18n';
  onMount(() => goto(`/${browserLang()}`, { replaceState: true }));
</script>
