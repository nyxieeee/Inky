import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore } from '../store/useToastStore';
import type { ToastType } from '../types';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} style={{ color: 'var(--moss)' }} />,
  error:   <XCircle size={16} style={{ color: '#A85448' }} />,
  warning: <AlertTriangle size={16} style={{ color: 'var(--terracotta)' }} />,
  info:    <Info size={16} style={{ color: 'var(--moss)' }} />,
};

const badgeBgMap: Record<ToastType, string> = {
  success: 'var(--moss-dim)',
  error:   'rgba(168,84,72,0.14)',
  warning: 'var(--clay-dim)',
  info:    'var(--moss-dim)',
};

export default function Toast() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[1.75rem]"
            style={{
              background: 'var(--surface)',
              border: '1.5px solid var(--border)',
              boxShadow: '0 16px 40px -6px rgba(44,44,36,0.25), 0 4px 16px -2px rgba(93,112,82,0.12)',
              color: 'var(--fg)',
            }}
          >
            <div
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: badgeBgMap[t.type] }}
            >
              {iconMap[t.type]}
            </div>
            <span className="flex-1 text-xs font-bold leading-relaxed">{t.msg}</span>
            {t.action && (
              <button
                className="btn-primary btn-sm text-[11px] px-3 py-1 shrink-0"
                onClick={() => {
                  t.action!.onClick();
                  removeToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button
              className="h-7 w-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shrink-0"
              style={{ background: 'var(--bg-stone)', color: 'var(--fg-muted)' }}
              onClick={() => removeToast(t.id)}
              aria-label="Dismiss toast"
            >
              <X size={13} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
