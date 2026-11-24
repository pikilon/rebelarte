<script lang="ts">
  // QR de un CV o una obra. `target` es la URL estable /c/<id> o /o/<id> (absoluta).
  // Genera SVG y PNG en el navegador con la librería `qrcode` (carga diferida).
  import { t } from '$lib/i18n';
  import Button from '$lib/components/ui/Button.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';

  let { target, label, filename }: { target: string; label: string; filename: string } = $props();

  let dlg = $state<HTMLDialogElement>();
  let svg = $state('');
  let png = $state('');
  let failed = $state(false);
  let busy = $state(false);
  const titleId = `qr-${Math.random().toString(36).slice(2, 8)}`;

  $effect(() => {
    void target;
    svg = '';
    png = '';
    failed = false;
  });

  async function generate() {
    if ((svg && png) || busy) return;
    busy = true;
    failed = false;
    const url = target;
    try {
      const QR = (await import('qrcode')).default;
      const [s, p] = await Promise.all([
        QR.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' }),
        QR.toDataURL(url, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      ]);
      if (url === target) {
        svg = s;
        png = p;
      }
    } catch {
      failed = true;
    } finally {
      busy = false;
    }
  }

  function open() {
    dlg?.showModal();
    void generate();
  }

  function saveHref(href: string, name: string) {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
  }

  function downloadSvg() {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const href = URL.createObjectURL(blob);
    saveHref(href, `${filename}.svg`);
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  /** Imprime solo el QR: documento mínimo en un iframe oculto. */
  function print() {
    const f = document.createElement('iframe');
    f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
    f.srcdoc = `<!doctype html><meta charset="utf-8"><title>${esc(label)}</title>
      <style>body{font-family:Georgia,serif;text-align:center;margin:2cm}img{width:10cm;height:10cm}h1{font-size:20pt}p{font-family:sans-serif;font-size:10pt;word-break:break-all}</style>
      <h1>${esc(label)}</h1><img src="${png}" alt=""><p>${esc(target)}</p>`;
    f.onload = () => {
      f.contentWindow?.focus();
      f.contentWindow?.print();
      setTimeout(() => f.remove(), 2000);
    };
    document.body.append(f);
  }

  function onBackdrop(e: MouseEvent) {
    if (e.target === dlg) dlg?.close();
  }
</script>

<Button variant="secondary" size="sm" onclick={open} aria-haspopup="dialog">
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" />
  </svg>
  {t('public.qr.open')}
</Button>

<!-- Esc cierra el diálogo de forma nativa; el clic en el fondo es solo un atajo para ratón. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dlg} class="qr" aria-labelledby={titleId} onclick={onBackdrop}>
  <div class="in">
    <h2 id={titleId}>{label}</h2>
    <div class="img">
      {#if png}
        <img src={png} alt={t('public.qr.alt', { label })} width="256" height="256" />
      {:else if failed}
        <Notice kind="error">{t('public.qr.error')}</Notice>
      {:else}
        <Spinner />
      {/if}
    </div>
    <p class="muted small">{t('public.qr.hint')}</p>
    <p class="small url">{target}</p>
    <div class="row actions">
      <Button size="sm" onclick={downloadSvg} disabled={!svg}>{t('public.qr.svg')}</Button>
      <Button size="sm" onclick={() => saveHref(png, `${filename}.png`)} disabled={!png}>{t('public.qr.png')}</Button>
      <Button size="sm" variant="secondary" onclick={print} disabled={!png}>{t('public.qr.print')}</Button>
      <Button size="sm" variant="ghost" onclick={() => dlg?.close()}>{t('common.close')}</Button>
    </div>
  </div>
</dialog>

<style>
  .qr { border: 0; border-radius: var(--radius); padding: 0; background: var(--surface); color: var(--fg);
    width: min(92vw, 380px); box-shadow: 0 20px 60px rgb(0 0 0 / 0.35); }
  .qr::backdrop { background: rgb(20 18 15 / 0.6); }
  .in { padding: var(--space-5); text-align: center; }
  h2 { font-size: 1.25rem; overflow-wrap: anywhere; }
  .img { background: #fff; border-radius: var(--radius-sm); padding: var(--space-2); min-height: 200px; display: grid; place-items: center; margin: 0 auto var(--space-3); max-width: 280px; }
  .img img { width: 100%; height: auto; }
  .small { font-size: 0.85rem; margin: 0 0 var(--space-2); }
  .url { color: var(--muted); word-break: break-all; }
  .actions { justify-content: center; margin-top: var(--space-4); }
</style>
