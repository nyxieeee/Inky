import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToastStore } from './useToastStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  isConfigured: boolean;

  // Modal actions
  openAuthModal: () => void;
  closeAuthModal: () => void;

  // Auth actions
  initializeAuth: () => Promise<void>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithDemoGoogle: () => void;
  signInWithMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string; session?: Session | null; user?: User | null }>;
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<{ success: boolean; error?: string; session?: Session | null; needsConfirmation?: boolean }>;
  resetPasswordForEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthModalOpen: false,
  isConfigured: isSupabaseConfigured(),

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  initializeAuth: async () => {
    if (!supabase) {
      set({ isLoading: false, isConfigured: false });
      return;
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      set({
        session: data.session,
        user: data.session?.user || null,
        isLoading: false,
        isConfigured: true,
      });

      // Subscribe to auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user || null,
        });
      });
    } catch (e: any) {
      console.warn('Supabase auth initialization error:', e);
      set({ isLoading: false });
    }
  },

  signInWithGoogle: async () => {
    if (!supabase) {
      const msg = 'Supabase credentials needed. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to use Google Sign-In.';
      useToastStore.getState().showToast(msg, 'info');
      return { success: false, error: msg };
    }

    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in with Google';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithDemoGoogle: () => {
    const demoUser = {
      id: 'demo-google-user',
      app_metadata: { provider: 'google', providers: ['google'] },
      user_metadata: {
        full_name: 'Demo Google User',
        name: 'Demo Google User',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      },
      aud: 'authenticated',
      confirmation_sent_at: '',
      recovery_sent_at: '',
      email_change_sent_at: '',
      new_email: '',
      invited_at: '',
      action_link: '',
      email: 'demo.user@gmail.com',
      phone: '',
      created_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
      email_confirmed_at: new Date().toISOString(),
      phone_confirmed_at: '',
      last_sign_in_at: new Date().toISOString(),
      role: 'authenticated',
      updated_at: new Date().toISOString(),
      identities: [],
      factors: [],
    } as unknown as User;

    set({
      user: demoUser,
      session: {
        access_token: 'demo-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'demo-refresh',
        user: demoUser,
      } as unknown as Session,
      isAuthModalOpen: false,
    });
    useToastStore.getState().showToast('Signed in with Demo Google account!', 'success');
  },

  signInWithMagicLink: async (email: string) => {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured yet. Set VITE_SUPABASE_URL in .env.' };
    }

    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      useToastStore.getState().showToast('Magic link sent to your email!', 'success');
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to send magic link';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithPassword: async (email: string, password: string) => {
    if (!supabase) {
      const msg = 'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      set({ user: data.user, session: data.session, isAuthModalOpen: false });
      useToastStore.getState().showToast(`Welcome back, ${data.user.email}!`, 'success');
      return { success: true, session: data.session, user: data.user };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signUpWithPassword: async (email: string, password: string, fullName?: string) => {
    if (!supabase) {
      const msg = 'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: fullName ? { full_name: fullName, name: fullName } : undefined,
        },
      });

      if (error) throw error;

      if (data.session) {
        set({ user: data.user, session: data.session, isAuthModalOpen: false });
        useToastStore.getState().showToast('Account created and signed in!', 'success');
        return { success: true, session: data.session, user: data.user };
      } else {
        useToastStore.getState().showToast('Account created! Please check your email to confirm.', 'info');
        return { success: true, session: null, needsConfirmation: true };
      }
    } catch (err: any) {
      const msg = err.message || 'Failed to sign up';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  resetPasswordForEmail: async (email: string) => {
    if (!supabase) {
      const msg = 'Supabase is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    }

    set({ isLoading: true });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      useToastStore.getState().showToast('Password reset email sent! Check your inbox.', 'success');
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to send reset email';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, session: null });
    useToastStore.getState().showToast('Signed out successfully.', 'info');
  },
}));
