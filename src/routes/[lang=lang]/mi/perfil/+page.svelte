<script lang="ts">
  import { auth } from '$lib/auth.svelte';
  import { LANGS, t } from '$lib/i18n';
  import type { I18nText, Lang, Profile, Visibility } from '$lib/types';
  import Button from '$lib/components/ui/Button.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import Notice from '$lib/components/ui/Notice.svelte';
  import AvatarEditor from '$lib/components/my/AvatarEditor.svelte';
  import I18nInput from '$lib/components/my/I18nInput.svelte';
  import Section from '$lib/components/my/Section.svelte';
  import Toggle from '$lib/components/my/Toggle.svelte';
  import VisibilitySelect from '$lib/components/my/VisibilitySelect.svelte';
  import { clearAvatar, replaceAvatar, requestEmailChange, updateProfile } from '$lib/api/my';
  import { authErrorKey, cleanI18n, dbErrorKey, hasText, isEmail } from '$lib/components/my/logic';

  const p = auth.profile as Profile;
  const vis = (k: 'location' | 'contact_email' | 'rate' | 'cover_letter'): Visibility => p.field_visibility?.[k] ?? 'public';

  let name = $state(p.display_name);
  let origin = $state<Lang>(p.lang);
  let headline = $state<I18nText>({ ...p.headline });
  let coverLetter = $state<I18nText>({ ...p.cover_letter });
  let location = $state(p.location ?? '');
  let accepts = $state(p.accepts_commissions);
  let sells = $state(p.sells_works);
  let showEmail = $state(p.show_email);
  let contactEmail = $state(p.contact_email ?? '');
  let rateText = $state<I18nText>({ ...p.rate_text });
  let ratePrice = $state(p.rate_price ?? '');
  let vLocation = $state<Visibility>(vis('location'));
  let vEmail = $state<Visibility>(vis('contact_email'));
  let vRate = $state<Visibility>(vis('rate'));
  let vCover = $state<Visibility>(vis('cover_letter'));

  let saving = $state(false);
  let msg = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
  let errName = $state<string | null>(null);
  let errEmail = $state<string | null>(null);
  let errHeadline = $state<string | null>(null);

  async function save(e: SubmitEvent) {
    e.preventDefault();
    msg = errName = errEmail = errHeadline = null;
    if (!name.trim()) errName = t('my.profile.errName');
    if (showEmail && !isEmail(contactEmail)) errEmail = t('my.profile.errContactEmail');
    if (headline && Object.values(headline).some(Boolean) && !hasText(headline, origin)) errHeadline = t('my.profile.errOriginText', { lang: t(`lang.${origin}`) });
    if (errName || errEmail || errHeadline) return void (msg = { kind: 'error', text: t('my.profile.errFix') });
    saving = true;
    try {
      auth.profile = await updateProfile(p.id, {
        display_name: name.trim(),
        lang: origin,
        headline: cleanI18n(headline),
        cover_letter: cleanI18n(coverLetter),
        location: location.trim() || null,
        accepts_commissions: accepts,
        sells_works: sells,
        show_email: showEmail,
        contact_email: contactEmail.trim() || null,
        rate_text: cleanI18n(rateText),
        rate_price: ratePrice.trim() || null,
        field_visibility: { location: vLocation, contact_email: vEmail, rate: vRate, cover_letter: vCover }
      });
      msg = { kind: 'ok', text: t('common.saved') };
    } catch (err) {
      msg = { kind: 'error', text: t(dbErrorKey(err)) };
    } finally {
      saving = false;
    }
  }

  async function saveAvatar(blob: Blob) {
    auth.profile = await replaceAvatar(p.id, blob, auth.profile?.avatar_path ?? null);
  }
  async function removeAvatar() {
    auth.profile = await clearAvatar(p.id, auth.profile?.avatar_path ?? null);
  }

  // Cambio del correo de acceso
  let newEmail = $state('');
  let emailBusy = $state(false);
  let emailMsg = $state<{ kind: 'ok' | 'error'; text: string } | null>(null);
  async function changeEmail(e: SubmitEvent) {
    e.preventDefault();
    emailMsg = null;
    if (!isEmail(newEmail)) return void (emailMsg = { kind: 'error', text: t('my.login.err.email') });
    emailBusy = true;
    try {
      await requestEmailChange(newEmail.trim());
      emailMsg = { kind: 'ok', text: t('my.profile.emailSent', { email: newEmail.trim() }) };
      newEmail = '';
    } catch (err) {
      emailMsg = { kind: 'error', text: t(authErrorKey(err)) };
    } finally {
      emailBusy = false;
    }
  }
</script>

<svelte:head><title>{t('my.nav.profile')} · {t('app.name')}</title></svelte:head>

<div class="stack">
  <h1>{t('my.nav.profile')}</h1>

  <Section title={t('my.profile.avatar')}>
    <AvatarEditor path={auth.profile?.avatar_path ?? null} name={name || p.display_name} onsave={saveAvatar} onremove={removeAvatar} />
  </Section>

  <form class="stack" onsubmit={save} novalidate>
    <Section title={t('my.profile.s.about')}>
      <Field label={t('my.profile.name')} id="p-name" error={errName}>
        <input id="p-name" type="text" maxlength="80" bind:value={name} required />
      </Field>
      <Field label={t('my.profile.lang')} id="p-lang" hint={t('my.profile.langHint')}>
        <select id="p-lang" bind:value={origin}>{#each LANGS as l}<option value={l}>{t(`lang.${l}`)}</option>{/each}</select>
      </Field>
      <I18nInput bind:value={headline} origin={origin} label={t('my.profile.headline')} maxlength={140} required={false} hint={t('my.profile.headlineHint')} error={errHeadline} />
      <div class="with-vis">
        <Field label={t('my.profile.location')} id="p-loc"><input id="p-loc" type="text" maxlength="120" bind:value={location} /></Field>
        <VisibilitySelect bind:value={vLocation} label={t('my.profile.visibility')} />
      </div>
      <I18nInput bind:value={coverLetter} origin={origin} label={t('my.profile.cover')} multiline rows={8} required={false} maxlength={5000} />
      <VisibilitySelect bind:value={vCover} label={t('my.profile.coverVisibility')} />
    </Section>

    <Section title={t('my.profile.s.contact')} intro={t('my.profile.contactIntro')}>
      <Toggle bind:checked={accepts} label={t('my.profile.accepts')} hint={t('my.profile.acceptsHint')} />
      <Toggle bind:checked={sells} label={t('my.profile.sells')} hint={t('my.profile.sellsHint')} />
      <Toggle bind:checked={showEmail} label={t('my.profile.showEmail')} hint={t('my.profile.showEmailHint')} />
      {#if showEmail}
        <div class="with-vis">
          <Field label={t('my.profile.contactEmail')} id="p-ce" error={errEmail}>
            <input id="p-ce" type="email" autocomplete="off" bind:value={contactEmail} />
          </Field>
          <VisibilitySelect bind:value={vEmail} label={t('my.profile.visibility')} />
        </div>
      {/if}
      <I18nInput bind:value={rateText} origin={origin} label={t('my.profile.rateText')} required={false} maxlength={200} hint={t('my.profile.rateHint')} />
      <div class="with-vis">
        <Field label={t('my.profile.ratePrice')} id="p-rp"><input id="p-rp" type="text" maxlength="80" bind:value={ratePrice} placeholder={t('my.profile.ratePh')} /></Field>
        <VisibilitySelect bind:value={vRate} label={t('my.profile.rateVisibility')} />
      </div>
    </Section>

    <div class="savebar">
      {#if msg}<Notice kind={msg.kind}>{msg.text}</Notice>{/if}
      <div><Button type="submit" loading={saving}>{t('common.save')}</Button></div>
    </div>
  </form>

  <Section title={t('my.profile.s.account')}>
    <p class="muted">{t('my.profile.currentEmail')} <strong>{auth.session?.user.email}</strong></p>
    <form class="stack" onsubmit={changeEmail} novalidate>
      <Field label={t('my.profile.newEmail')} id="p-ne" hint={t('my.profile.newEmailHint')}>
        <input id="p-ne" type="email" autocomplete="email" bind:value={newEmail} />
      </Field>
      {#if emailMsg}<Notice kind={emailMsg.kind}>{emailMsg.text}</Notice>{/if}
      <div><Button type="submit" variant="secondary" loading={emailBusy}>{t('my.profile.changeEmail')}</Button></div>
    </form>
  </Section>
</div>

<style>
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); }
  .with-vis { display: grid; gap: var(--space-3); align-items: end; }
  .savebar { position: sticky; bottom: 0; background: color-mix(in srgb, var(--bg) 94%, transparent); backdrop-filter: blur(6px); padding: var(--space-3) 0; display: grid; gap: var(--space-2); border-top: 1px solid var(--line); z-index: 2; }
  @media (min-width: 640px) { .with-vis { grid-template-columns: 1fr 220px; } }
</style>
