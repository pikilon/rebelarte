<script lang="ts">
  // Respaldo de la redirección QR de CV (normalmente la resuelve share/index.php).
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { browserLang } from '$lib/i18n';
  import { url } from '$lib/routes';
  onMount(async () => {
    const { data } = await supabase.from('profiles_public').select('alias, lang').eq('short_id', page.params.short).maybeSingle();
    goto(data ? url.cv(data.lang, data.alias) : `/${browserLang()}`, { replaceState: true });
  });
</script>
