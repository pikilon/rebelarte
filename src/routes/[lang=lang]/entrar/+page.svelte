<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onDestroy, tick } from 'svelte';
  import { auth } from '$lib/auth.svelte';
  import { currentLang, t } from '$lib/i18n';
  import { url } from '$lib/routes';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import Spinner from '$lib/components/ui/Spinner.svelte';
  import { authErrorKey, isEmail, isOtpCode, safeNext } from '$lib/components/my/logic';

  const COOLDOWN = 60;
  const lang = $derived(currentLang());
  const next = $derived(safeNext(page.url.searchParams.get('next')));

  let step = $state<'email' | 'code'>('email');
  let email = $state('');
  let code = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let cooldown = $state(0);
  let timer: ReturnType<typeof setInterval> | undefined;
  let codeInput: HTMLInputElement | undefined = $state();
  let emailInput: HTMLInputElement | undefined = $state();
  let redirecting = $state(false);

  // Indica si la URL actual viene de una redirección de autenticación (código o token)
  const hasAuthRedirect = $derived.by(() => {
    return page.url.searchParams.has('code') || page.url.hash.includes('access_token=');
  });

  // Error que Supabase devuelve en la URL cuando el enlace mágico caduca o ya se usó.
  const urlError = $derived.by(() => {
    const h = new URLSearchParams(page.url.hash.replace(/^#/, ''));
    const code = page.url.searchParams.get('error_code') ?? h.get('error_code');
    const desc = page.url.searchParams.get('error_description') ?? h.get('error_description');
    const err = page.url.searchParams.get('error') ?? h.get('error');
    if (!code && !desc && !err) return null;
    return t(authErrorKey({ code: code ?? err ?? undefined, message: desc ?? undefined }));
  });

  async function proceed() {
    if (redirecting) return;
    redirecting = true;
    if (!auth.profile) await auth.loadProfile();
    const nq = next ? `?next=${encodeURIComponent(next)}` : '';
    await goto(auth.profile ? (next ?? url.my(lang)) : `${url.my(lang, 'bienvenida')}${nq}`, { replaceState: true });
  }

  // Llega con sesión (enlace mágico o ya iniciada): fuera de aquí.
  $effect(() => {
    if (auth.ready && auth.session) void proceed();
  });

  function startCooldown() {
    cooldown = COOLDOWN;
    clearInterval(timer);
    timer = setInterval(() => {
      cooldown -= 1;
      if (cooldown <= 0) clearInterval(timer);
    }, 1000);
  }
  onDestroy(() => clearInterval(timer));

  async function send(e?: SubmitEvent) {
    e?.preventDefault();
    error = null;
    const addr = email.trim();
    if (!isEmail(addr)) return void (error = t('my.login.err.email'));
    busy = true;
    try {
      const back = `${location.origin}/${lang}/entrar${next ? `?next=${encodeURIComponent(next)}` : ''}`;
      await auth.sendCode(addr, back);
      email = addr;
      code = '';
      step = 'code';
      startCooldown();
      await tick();
      codeInput?.focus();
    } catch (err) {
      error = t(authErrorKey(err));
    } finally {
      busy = false;
    }
  }

  async function verify(e?: SubmitEvent) {
    e?.preventDefault();
    if (busy) return;
    error = null;
    if (!isOtpCode(code)) return void (error = t('my.login.err.codeFormat'));
    busy = true;
    try {
      await auth.verifyCode(email, code.trim());
      await proceed();
    } catch (err) {
      error = t(authErrorKey(err));
      code = '';
      codeInput?.focus();
    } finally {
      busy = false;
    }
  }

  function onCodeInput() {
    error = null;
    code = code.replace(/\D/g, '').slice(0, 6);
    if (code.length === 6) void verify();
  }

  async function changeEmail() {
    step = 'email';
    code = '';
    error = null;
    await tick();
    emailInput?.focus();
  }
</script>

<svelte:head><title>{t('my.login.title')} · {t('app.name')}</title></svelte:head>

<section class="container narrow">
  <div class="card stack">
    {#if redirecting || (auth.ready && auth.session) || (hasAuthRedirect && !auth.ready)}
      <Spinner />
    {:else}
      {#if urlError}<Notice kind="error">{urlError}</Notice>{/if}
      {#if step === 'email'}
        <h1>{t('my.login.title')}</h1>
        <p class="muted">{t('my.login.lead')}</p>
        <form class="stack" onsubmit={send} novalidate>
          <Field label={t('my.login.email')} id="login-email" error={error}>
            <input id="login-email" type="email" name="email" autocomplete="email" inputmode="email" required bind:value={email} bind:this={emailInput} oninput={() => { error = null; }} />
          </Field>
          <Button type="submit" loading={busy}>{t('my.login.send')}</Button>
        </form>
        <Notice>{t('my.login.noPassword')}</Notice>
      {:else}
        <h1>{t('my.login.checkTitle')}</h1>
        <p>{t('my.login.checkLead', { email })}</p>
        <Notice>{t('my.login.orLink')}</Notice>
        <form class="stack" onsubmit={verify} novalidate>
          <Field label={t('my.login.code')} id="login-code" hint={t('my.login.codeHint')} error={error}>
            <input id="login-code" class="otp" type="text" name="code" inputmode="numeric" autocomplete="one-time-code"
              pattern="[0-9]*" maxlength="6" placeholder="••••••" bind:value={code} bind:this={codeInput} oninput={onCodeInput} />
          </Field>
          <Button type="submit" loading={busy}>{t('my.login.verify')}</Button>
        </form>
        <div class="row">
          <Button variant="secondary" size="sm" type="button" disabled={cooldown > 0 || busy} onclick={() => send()}>
            {cooldown > 0 ? t('my.login.resendIn', { s: cooldown }) : t('my.login.resend')}
          </Button>
          <Button variant="ghost" size="sm" type="button" onclick={changeEmail}>{t('my.login.changeEmail')}</Button>
        </div>
        <p class="muted small" aria-live="polite">{t('my.login.spam')}</p>
      {/if}
    {/if}
  </div>
</section>

<style>
  .narrow { max-width: 520px; padding-top: var(--space-6); }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: var(--space-5) var(--space-4); box-shadow: var(--shadow); }
  h1 { font-size: clamp(1.7rem, 5vw, 2.2rem); }
  .otp { font-size: 1.6rem; letter-spacing: 0.4em; text-align: center; font-variant-numeric: tabular-nums; }
  .small { font-size: 0.85rem; margin: 0; }
  @media (min-width: 720px) { .card { padding: var(--space-6); } }
</style>
