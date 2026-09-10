import React, { useState, useEffect } from 'react';
import {
  Shield, Mail, Lock, Sparkles, ArrowRight, CheckCircle2,
  AlertCircle, Leaf, UserCheck, HelpCircle
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { deliveryService } from '../services/deliveryService';

interface SignerAuthGateProps {
  token: string;
  onContinueAsGuest: (email: string) => void;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={`${className} shrink-0`} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const SignerAuthGate: React.FC<SignerAuthGateProps> = ({ token, onContinueAsGuest }) => {
  const {
    isConfigured,
    isLoading,
    isGoogleLoading,
    signInWithGoogle,
    signInWithPassword,
    signUpWithPassword,
  } = useAuthStore();

  const [docContext, setDocContext] = useState<{
    docTitle: string;
    recipientName: string;
    recipientEmail: string;
  } | null>(null);

  const [mode, setMode] = useState<'password' | 'signup' | 'quick-email'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  useEffect(() => {
    deliveryService.getSignerContext(token).then((ctx) => {
      if (ctx) {
        setDocContext({
          docTitle: ctx.document.title,
          recipientName: ctx.recipient.name,
          recipientEmail: ctx.recipient.email,
        });
        setEmail(ctx.recipient.email || '');
      }
    });
  }, [token]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    const res = await signInWithGoogle(window.location.href);
    if (!res.success && res.error) {
      setAuthError(res.error);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setAuthError('Please enter your email address.');
      return;
    }

    if (mode === 'quick-email') {
      // Manual entry of email — continue directly to document
      onContinueAsGuest(cleanEmail);
      return;
    }

    if (!password) {
      setAuthError('Please enter your password.');
      return;
    }

    if (mode === 'password') {
      const res = await signInWithPassword(cleanEmail, password);
      if (!res.success) {
        setAuthError(res.error || 'Invalid email or password.');
      }
    } else if (mode === 'signup') {
      const res = await signUpWithPassword(cleanEmail, password, fullName.trim() || docContext?.recipientName);
      if (!res.success) {
        setAuthError(res.error || 'Failed to create account.');
      } else if (res.needsConfirmation) {
        setAuthSuccess('Account created! Please check your email to confirm your account, or continue below.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] font-sans">
      <div className="card-organic max-w-md w-full p-8 rounded-[2.5rem] space-y-6 animate-fadeIn shadow-2xl border border-[var(--border)]">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-[1.5rem] flex items-center justify-center mx-auto bg-[var(--moss-dim)] shadow-md">
            <Leaf className="h-7 w-7 text-[var(--moss)]" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-[var(--moss-dim)] text-[var(--moss)] mb-1">
              <Shield className="h-3.5 w-3.5" /> Identity Verification
            </span>
            <h1 className="font-display font-bold text-2xl text-[var(--fg)]">
              Sign In to Review & Sign
            </h1>
            <p className="text-xs text-[var(--fg-muted)] mt-1.5 leading-relaxed">
              {docContext?.docTitle ? (
                <>
                  You have been invited to sign{' '}
                  <strong className="text-[var(--fg)]">"{docContext.docTitle}"</strong>.
                  Please authenticate with Google or your email to access the document.
                </>
              ) : (
                'Please sign in with your Google account or email to securely review and sign this document.'
              )}
            </p>
          </div>
        </div>

        {/* Error / Success Banners */}
        {authError && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-tight">{authError}</span>
          </div>
        )}

        {authSuccess && (
          <div className="p-3 rounded-2xl bg-green-500/10 border border-green-500/20 text-xs text-green-700 dark:text-green-300 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-tight">{authSuccess}</span>
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl font-bold text-xs bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 dark:bg-[#1E2219] dark:text-[#E8E5DC] dark:border-white/10 dark:hover:bg-[#2A2E24] shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
          >
            {isGoogleLoading ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--moss)] border-t-transparent" />
            ) : (
              <GoogleIcon className="w-4 h-4" />
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="h-px flex-1 bg-[var(--border-light)]" />
            <span className="text-[11px] font-semibold text-[var(--fg-muted)] uppercase tracking-wider">
              or with email
            </span>
            <div className="h-px flex-1 bg-[var(--border-light)]" />
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="input-organic w-full text-xs"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)] opacity-60" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="input-organic w-full pl-10 text-xs"
                />
              </div>
            </div>

            {mode !== 'quick-email' && (
              <div>
                <label className="block text-[11px] font-bold text-[var(--fg-muted)] mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--fg-muted)] opacity-60" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="input-organic w-full pl-10 text-xs"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center text-xs py-2.5 shadow-md flex items-center gap-2 mt-2"
            >
              {isLoading ? (
                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <span>
                    {mode === 'password'
                      ? 'Sign In & Access Document'
                      : mode === 'signup'
                      ? 'Create Account & Sign'
                      : 'Continue with this Email'}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Mode Switchers */}
          <div className="pt-2 flex flex-col gap-1.5 text-center text-[11px]">
            {mode === 'password' ? (
              <>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setAuthError(null); }}
                  className="text-[var(--moss)] hover:underline font-semibold"
                >
                  Don't have an Inky account? Create one
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('quick-email'); setAuthError(null); }}
                  className="text-[var(--fg-muted)] hover:underline mt-1"
                >
                  Just want to sign quickly? Continue with manual email entry →
                </button>
              </>
            ) : mode === 'signup' ? (
              <button
                type="button"
                onClick={() => { setMode('password'); setAuthError(null); }}
                className="text-[var(--moss)] hover:underline font-semibold"
              >
                Already have an account? Sign in
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setMode('password'); setAuthError(null); }}
                className="text-[var(--moss)] hover:underline font-semibold"
              >
                ← Back to Password / Account Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
