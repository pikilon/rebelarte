<script lang="ts">
  import '$lib/styles/tokens.css';
  import '$lib/styles/base.css';
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte';

  let { children } = $props();
  onMount(() => { void auth.init(); });
</script>

{@render children()}
