import React, { useEffect, useState } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

export const PwaPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowPrompt(false);
    setDeferredPrompt(null);
  };

  if (!showPrompt) return null;

  return (
    <aside
      aria-label="Install app"
      className="fixed bottom-16 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-50 animate-slideUp"
      style={{
        background: 'rgba(253,252,248,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid rgba(222,216,207,0.70)',
        borderRadius: 9999,
        boxShadow: '0 8px 32px rgba(44,44,36,0.10)',
        padding: '0.625rem 0.75rem 0.625rem 0.875rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      {/* Left: icon + label */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--moss-dim)' }}
        >
          <Smartphone style={{ height: 17, width: 17, color: 'var(--moss)' }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold leading-tight truncate" style={{ color: 'var(--fg)' }}>
            Install E-Sign
          </p>
          <p className="text-[10px] leading-tight truncate" style={{ color: 'var(--fg-muted)' }}>
            Add to home screen for offline use
          </p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95"
          style={{
            background: 'var(--moss)',
            color: '#F3F4F1',
            boxShadow: '0 4px 14px rgba(93,112,82,0.25)',
          }}
        >
          <Download style={{ height: 12, width: 12 }} />
          <span>Install</span>
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="h-7 w-7 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
          style={{ background: 'var(--bg-stone)', color: 'var(--fg-muted)' }}
          aria-label="Dismiss"
        >
          <X style={{ height: 12, width: 12 }} />
        </button>
      </div>
    </aside>
  );
};
