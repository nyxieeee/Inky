// Inky Toast Store (matching Worklane src/store/useToastStore.ts)
import { create } from 'zustand';
import { uid } from '../utils';
import { ToastItem, ToastType, ToastAction } from '../types';

interface ToastState {
  toasts: ToastItem[];
  showToast: (msg: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  showToast: (msg, type = 'info', duration = 3500, action) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, msg, type, action }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
