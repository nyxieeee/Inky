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
  signInWithMagicLink: (email: string) => Promise<{ success: boolean; error?: string }>;
  signInWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
      return { success: false, error: 'Supabase is not configured yet.' };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      set({ user: data.user, session: data.session, isAuthModalOpen: false });
      useToastStore.getState().showToast(`Welcome back, ${data.user.email}!`, 'success');
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign in';
      useToastStore.getState().showToast(msg, 'error');
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signUpWithPassword: async (email: string, password: string) => {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured yet.' };
    }

    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      if (error) throw error;

      if (data.session) {
        set({ user: data.user, session: data.session, isAuthModalOpen: false });
        useToastStore.getState().showToast('Account created and signed in!', 'success');
      } else {
        useToastStore.getState().showToast('Account created! Please check your email to confirm.', 'info');
      }
      return { success: true };
    } catch (err: any) {
      const msg = err.message || 'Failed to sign up';
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
    useToastStore.getState().showToast('Signed out. Local offline mode active.', 'info');
  },
}));
