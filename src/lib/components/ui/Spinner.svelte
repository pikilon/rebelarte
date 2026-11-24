<script lang="ts">
  import { t } from '$lib/i18n';
</script>

<div class="spinner" role="status"><span class="dot" aria-hidden="true"></span><span class="sr-only">{t('common.loading')}</span></div>

<style>
  .spinner { display: flex; justify-content: center; padding: var(--space-6); }
  .dot { width: 28px; height: 28px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: s 0.8s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
</style>
