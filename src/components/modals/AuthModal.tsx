import React, { useState } from 'react';
import { X, Mail, Lock, Sparkles, Shield, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const {
    user,
    isConfigured,
    isLoading,
    signInWithMagicLink,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  } = useAuthStore();

  const [mode, setMode] = useState<'magic-link' | 'password' | 'signup'>('magic-link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (mode === 'magic-link') {
      const res = await signInWithMagicLink(email.trim());
      if (res.success) onClose();
    } else if (mode === 'password') {
      const res = await signInWithPassword(email.trim(), password);
      if (res.success) onClose();
    } else if (mode === 'signup') {
      const res = await signUpWithPassword(email.trim(), password);
      if (res.success) onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn"
      style={{ background: 'rgba(44,44,36,0.50)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card-organic max-w-md w-full overflow-hidden animate-slideUp"
        style={{ borderRadius: '2.5rem' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--border-light)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--moss-dim)' }}
            >
              <Shield style={{ height: 16, width: 16, color: 'var(--moss)' }} />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg" style={{ color: 'var(--fg)' }}>
                {user ? 'Account & Cloud Sync' : 'Inky Cloud Sync'}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all hover:bg-[var(--bg-stone)]"
            style={{ color: 'var(--fg-muted)' }}
            aria-label="Close"
          >
            <X style={{ height: 15, width: 15 }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* If already signed in */}
          {user ? (
            <div className="space-y-4 text-center py-2">
              <div
                className="h-16 w-16 mx-auto rounded-3xl flex items-center justify-center"
                style={{ background: 'var(--moss-dim)' }}
              >
                <Shield style={{ height: 28, width: 28, color: 'var(--moss)' }} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
                  Signed in as
                </p>
                <p className="text-base font-bold mt-0.5" style={{ color: 'var(--fg)' }}>
                  {user.email}
                </p>
                <span className="badge-moss text-xs font-bold mt-2 inline-block">
                  Cloud Sync Active
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                Your documents, signatures, and inbound queue automatically sync across your Galaxy Z Fold, tablet, and PC.
              </p>
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                  }}
                  className="btn-outline w-full py-2.5 text-xs text-rose-500 hover:bg-rose-50 border-rose-200"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-primary w-full py-2.5 text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          ) : !isConfigured ? (
            /* Supabase Not Configured Yet Banner */
            <div className="space-y-4">
              <div
                className="p-4 rounded-2xl flex items-start gap-3"
                style={{ background: 'rgba(193,140,93,0.10)', border: '1px solid rgba(193,140,93,0.25)' }}
              >
                <AlertCircle className="shrink-0 mt-0.5" style={{ height: 18, width: 18, color: 'var(--terracotta)' }} />
                <div className="text-xs space-y-1">
                  <p className="font-bold" style={{ color: 'var(--terracotta)' }}>
                    Supabase Credentials Needed
                  </p>
                  <p style={{ color: 'var(--fg-muted)' }}>
                    Inky is currently running in <strong>100% Local Mode</strong>. To enable cloud sync across all your devices, set your keys in <code className="px-1 py-0.5 rounded bg-black/5 font-mono">.env</code>:
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--bg-stone)] text-xs font-mono space-y-1 select-all overflow-x-auto">
                <p className="text-[11px] text-[var(--fg-muted)] font-sans font-semibold">Copy into .env:</p>
                <p>VITE_SUPABASE_URL=https://xyz.supabase.co</p>
                <p>VITE_SUPABASE_ANON_KEY=eyJhbGci...</p>
              </div>

              <p className="text-xs text-center" style={{ color: 'var(--fg-muted)' }}>
                Database migration is ready in <code className="font-mono font-bold">supabase/schema.sql</code>.
              </p>

              <button onClick={onClose} className="btn-primary w-full">
                Continue in Local Mode
              </button>
            </div>
          ) : (
            /* Sign In / Sign Up Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tab segment */}
              <div className="flex gap-1 p-1 rounded-full bg-[var(--bg-stone)]">
                <button
                  type="button"
                  onClick={() => setMode('magic-link')}
                  className="flex-1 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: mode === 'magic-link' ? 'var(--moss)' : 'transparent',
                    color: mode === 'magic-link' ? '#fff' : 'var(--fg-muted)',
                  }}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  className="flex-1 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: mode === 'password' ? 'var(--moss)' : 'transparent',
                    color: mode === 'password' ? '#fff' : 'var(--fg-muted)',
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="flex-1 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: mode === 'signup' ? 'var(--moss)' : 'transparent',
                    color: mode === 'signup' ? '#fff' : 'var(--fg-muted)',
                  }}
                >
                  Register
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ height: 14, width: 14, color: 'var(--fg-muted)' }}
                    />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input-organic pl-10 h-10 text-xs"
                      autoFocus
                    />
                  </div>
                </div>

                {mode !== 'magic-link' && (
                  <div>
                    <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                      Password
                    </label>
                    <div className="relative">
                      <Lock
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        style={{ height: 14, width: 14, color: 'var(--fg-muted)' }}
                      />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-organic pl-10 h-10 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>
                      {mode === 'magic-link'
                        ? 'Send Magic Link'
                        : mode === 'password'
                        ? 'Sign In to Sync'
                        : 'Create Account'}
                    </span>
                    <ArrowRight style={{ height: 14, width: 14 }} />
                  </>
                )}
              </button>

              <p className="text-[11px] text-center" style={{ color: 'var(--fg-muted)' }}>
                {mode === 'magic-link'
                  ? 'We will send a one-click passwordless sign-in link to your email.'
                  : 'Your personal documents and saved signatures will sync securely across all your devices.'}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
