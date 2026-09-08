import React, { useState, useEffect } from 'react';
import {
  Inbox,
  FileText,
  PenTool,
  PlusCircle,
  History,
  Share2,
  Cloud,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface FoldableLayoutProps {
  children: React.ReactNode;
  activeTab: 'dashboard' | 'editor' | 'inbox' | 'signatures' | 'history';
  setActiveTab: (tab: 'dashboard' | 'editor' | 'inbox' | 'signatures' | 'history') => void;
  onUploadClick: () => void;
  onGenerateInboxClick: () => void;
}

// Ambient background blob — brings depth and organic atmosphere
const Blob = ({ style, delay = '0s' }: { style: React.CSSProperties; delay?: string }) => (
  <div
    aria-hidden
    className="pointer-events-none absolute animate-blobFloat select-none"
    style={{ animationDelay: delay, filter: 'blur(72px)', opacity: 0.38, ...style }}
  />
);

export const FoldableLayout: React.FC<FoldableLayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  onUploadClick,
  onGenerateInboxClick,
}) => {
  const { user, openAuthModal } = useAuthStore();
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isFoldCover = windowWidth <= 450;

  const navItems = [
    { id: 'dashboard',  icon: FileText, label: 'Queue'      },
    { id: 'history',    icon: History,  label: 'History'    },
    { id: 'signatures', icon: PenTool,  label: 'Signatures' },
    { id: 'inbox',      icon: Inbox,    label: 'Inbox'      },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>

      {/* ── Ambient Blob Layer ──────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <Blob
          delay="0s"
          style={{
            width: 520, height: 420,
            top: -80, left: -120,
            background: 'radial-gradient(circle, #5D7052 0%, transparent 70%)',
          }}
        />
        <Blob
          delay="4s"
          style={{
            width: 440, height: 380,
            bottom: 0, right: -100,
            background: 'radial-gradient(circle, #C18C5D 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── Top Navigation (floating pill) ─────────────────── */}
      <header className="sticky top-0 z-40 px-3 pt-3 pb-1.5">
        <nav
          className="glass rounded-full max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between"
          role="navigation"
          aria-label="Main navigation"
        >
          <button
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 group focus:outline-none"
            aria-label="Go to dashboard"
          >
            <img
              src="/inky-mark.png"
              alt="Inky Logo"
              className="h-8.5 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              style={{ height: '34px' }}
            />
            <img
              src="/inky-wordmark.png"
              alt="Inky"
              className="h-6 w-auto object-contain hidden sm:block"
              style={{ height: '23px' }}
            />
          </button>



          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Account / Cloud Sync Pill */}
            <button
              onClick={openAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105"
              style={{
                background: user ? 'var(--moss-dim)' : 'rgba(255,255,255,0.60)',
                color: user ? 'var(--moss)' : 'var(--fg-muted)',
                border: '1px solid var(--border)',
              }}
              title={user ? `Signed in as ${user.email}` : 'Sign in to sync across devices'}
            >
              {user ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-[var(--moss)] animate-pulse" />
                  <span className="hidden md:inline max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                </>
              ) : (
                <>
                  <Cloud style={{ height: 13, width: 13 }} />
                  <span className="hidden sm:inline">Sync</span>
                </>
              )}
            </button>

            <button
              onClick={onGenerateInboxClick}
              className="btn-ghost btn-sm"
              aria-label="Create inbox link"
            >
              <Share2 style={{ height: 14, width: 14 }} />
              <span className="hidden sm:inline">Inbox Link</span>
            </button>
            <button
              onClick={onUploadClick}
              className="btn-primary btn-sm"
              aria-label="Upload PDF document"
            >
              <PlusCircle style={{ height: 14, width: 14 }} />
              <span>Upload PDF</span>
            </button>
          </div>
        </nav>
      </header>

      {/* ── Page Content ────────────────────────────────────── */}
      <div className="flex flex-1 max-w-5xl mx-auto w-full">

        {/* Desktop sidebar nav */}
        <nav
          className="hidden sm:flex flex-col py-6 px-3 space-y-1 w-44 shrink-0"
          aria-label="Section navigation"
        >
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-3 w-full px-4 py-2.5 rounded-2xl text-base font-bold transition-all duration-200"
              style={{
                background: activeTab === id ? 'var(--moss-dim)' : 'transparent',
                color: activeTab === id ? 'var(--moss)' : 'var(--fg-muted)',
              }}
            >
              <Icon style={{ height: 18, width: 18, flexShrink: 0 }} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="flex-1 px-3 sm:px-6 py-4 sm:py-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* ── Mobile Bottom Nav ────────────────────────────────── */}
      <nav
        className="sticky bottom-0 z-30 sm:hidden glass border-t flex items-center justify-around px-2 py-2.5"
        style={{ borderColor: 'var(--border-light)' }}
        aria-label="Mobile navigation"
      >
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-2xl transition-all duration-200"
            style={{
              color: activeTab === id ? 'var(--moss)' : 'var(--fg-muted)',
              background: activeTab === id ? 'var(--moss-dim)' : 'transparent',
            }}
          >
            <Icon style={{ height: 20, width: 20 }} />
            <span className="text-[10px] font-bold tracking-wide">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
