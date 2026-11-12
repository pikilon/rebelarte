// Estado de sesión y perfil propio, reactivo con runas. Acceso sin contraseña (OTP por correo).
import type { Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase';
import type { Lang, Profile } from '$lib/types';

class AuthState {
  session = $state<Session | null>(null);
  profile = $state<Profile | null>(null);
  ready = $state(false);

  get userId(): string | null {
    return this.session?.user.id ?? null;
  }
  get isModerator(): boolean {
    return this.profile?.role === 'moderator' || this.profile?.role === 'admin';
  }

  async init() {
    const { data } = await supabase.auth.getSession();
    this.session = data.session;
    await this.loadProfile();
    this.ready = true;
    supabase.auth.onAuthStateChange((_event, session) => {
      const changed = session?.user.id !== this.session?.user.id;
      this.session = session;
      if (changed) void this.loadProfile();
    });
  }

  async loadProfile() {
    if (!this.session) {
      this.profile = null;
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', this.session.user.id).maybeSingle();
    this.profile = (data as Profile | null) ?? null;
  }

  /** Envía enlace mágico + código. redirectTo: URL absoluta a la que volver. */
  async sendCode(email: string, redirectTo: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
    });
    if (error) throw error;
  }

  /** Verifica el código de 6 dígitos recibido por correo. */
  async verifyCode(email: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
    this.session = data.session;
    await this.loadProfile();
  }

  async signOut() {
    await supabase.auth.signOut();
    this.session = null;
    this.profile = null;
  }

  async createProfile(alias: string, displayName: string, lang: Lang) {
    const { error } = await supabase.rpc('create_profile', { p_alias: alias, p_display_name: displayName, p_lang: lang });
    if (error) throw error;
    await this.loadProfile();
  }
}

export const auth = new AuthState();
