import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToastStore } from './useToastStore';
import { useDocumentStore } from './useDocumentStore';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitializing: boolean;
  isGoogleLoading: boolean;
  isAuthModalOpen: boolean;
  isConfigured: boolean;

  // Modal actions
  openAuthModal: () => void;
  closeAuthModal: () => void;

  // Auth actions
  initializeAuth: () => Promise<void>;
  signInWithGoogle: (redirectTo?: string) => Promise<{ success: boolean; error?: string }>;
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
  isLoading: false,
  isInitializing: true,
  isGoogleLoading: false,
  isAuthModalOpen: false,
  isConfigured: isSupabaseConfigured(),

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  initializeAuth: async () => {
    if (!supabase) {
      set({ isLoading: false, isInitializing: false, isConfigured: false });
      return;
    }

    try {
      // 1. Check for OAuth hash tokens in URL (recovers from double-hash "##access_token=..." or single-hash "#access_token=...")
      if (typeof window !== 'undefined' && window.location.hash) {
        const rawHash = window.location.hash;
        const cleanHash = rawHash.replace(/^#+/, '');
        if (cleanHash.includes('access_token=')) {
          const params = new URLSearchParams(cleanHash);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken) {
            try {
              const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              });
              if (!sessionErr && sessionData?.session) {
                set({
                  session: sessionData.session,
                  user: sessionData.session.user,
                  isLoading: false,
                  isInitializing: false,
                  isConfigured: true,
                });
                // Remove the raw tokens from URL address bar for clean display and security
                window.history.replaceState({}, '', window.location.pathname + window.location.search);
              }
            } catch (recoveryErr) {
              console.warn('Manual hash token recovery notice:', recoveryErr);
            }
          }
        }
      }

      // 2. Fetch existing session
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data?.session?.user) {
        set({
          session: data.session,
          user: data.session.user,
          isLoading: false,
          isInitializing: false,
          isConfigured: true,
        });
      } else {
        set({
          session: null,
          user: null,
          isLoading: false,
          isInitializing: false,
          isConfigured: true,
        });
      }

      // 3. Subscribe to auth state changes
      supabase.auth.onAuthStateChange((event, session) => {
        const prevUser = get().user;
        const nextUser = session?.user || null;
        if (event === 'SIGNED_OUT' || (prevUser && (!nextUser || prevUser.id !== nextUser.id))) {
          useDocumentStore.getState().resetStore();
        }
        set({
          session,
          user: nextUser,
          isInitializing: false,
          isLoading: false,
          isGoogleLoading: false,
        });
      });
    } catch (e: any) {
      console.warn('Supabase auth initialization error:', e);
      set({ isLoading: false, isInitializing: false });
    }
  },

  signInWithGoogle: async (redirectTo?: string) => {
    if (!supabase) {
      const msg = 'Supabase credentials needed. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env to use Google Sign-In.';
      useToastStore.getState().showToast(msg, 'info');
      return { success: false, error: msg };
    }

    set({ isGoogleLoading: true, isLoading: true });
    try {
      // Clean redirect URL: strip any existing hashes to prevent double-hash (##access_token=)
      let targetRedirect: string | undefined;
      if (redirectTo) {
        targetRedirect = redirectTo.split('#')[0];
      } else if (typeof window !== 'undefined') {
        const path = window.location.pathname === '/login' ? '/' : window.location.pathname;
        targetRedirect = window.location.origin + path;
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: targetRedirect,
        },
      });

      if (error) throw error;
      // Do not reset isGoogleLoading to false on success so the button shows a stable loading spinner until the browser navigates away
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in with Google';
      useToastStore.getState().showToast(msg, 'error');
      set({ isGoogleLoading: false, isLoading: false });
      return { success: false, error: msg };
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
    useDocumentStore.getState().resetStore();
    set({ user: null, session: null });
    useToastStore.getState().showToast('Signed out successfully.', 'info');
  },
}));
