import React, { useState, useEffect, useRef } from 'react';
import { FoldableLayout } from './components/FoldableLayout';
import { Dashboard } from './components/Dashboard';
import { PdfViewer } from './components/PdfViewer';
import { MultiSignerPanel } from './components/MultiSignerPanel';
import { InboundPortal } from './components/InboundPortal';
import { SignerPortal } from './components/SignerPortal';
import { HistoryView } from './components/HistoryView';
import { LoginPage } from './components/LoginPage';
import Toast from './components/Toast';

// Modals
import { SignaturePadModal } from './components/modals/SignaturePadModal';
import { ShareInboxModal } from './components/modals/ShareInboxModal';
import { ConfirmModal } from './components/modals/ConfirmModal';
import { AuthModal } from './components/modals/AuthModal';

// Stores & Services
import { useDocumentStore } from './store/useDocumentStore';
import { useSignatureStore } from './store/useSignatureStore';
import { useToastStore } from './store/useToastStore';
import { useFoldableStore } from './store/useFoldableStore';
import { useAuthStore } from './store/useAuthStore';
import { inboxService } from './services/inboxService';
import { realtimeService } from './services/realtimeService';
import { InboxLink } from './types';

// Icons
import {
  PenTool, Trash2, ArrowLeft, PlusCircle,
  Inbox, Leaf, Copy, Check, Pencil, X,
} from 'lucide-react';

const isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1' ||
   window.location.hostname === '::1');

export function App() {
  const {
    documents,
    selectedDoc,
    fields,
    activeTab,
    isSigningLoading,
    setActiveTab,
    setFields,
    fetchDocuments,
    selectDocument,
    uploadDocument,
    signAndExport,
    deleteDocument,
    clearSelection,
  } = useDocumentStore();

  const {
    signatures,
    isSigModalOpen,
    loadSignatures,
    openSignatureModal,
    closeSignatureModal,
    removeSignature,
    makeDefault,
    renameSignature,
  } = useSignatureStore();

  const { showToast } = useToastStore();
  const updateDimensions = useFoldableStore((s) => s.updateDimensions);
  const { user, isLoading, isAuthModalOpen, closeAuthModal, initializeAuth } = useAuthStore();
  const [guestMode, setGuestMode] = useState(false);

  // Modals & Local UI state
  const [targetFieldId, setTargetFieldId] = useState<string | undefined>(undefined);
  const [isMultiSignerOpen, setIsMultiSignerOpen] = useState(false);
  const [isShareInboxOpen, setIsShareInboxOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Saved Signatures renaming state
  const [editingSigId, setEditingSigId] = useState<string | null>(null);
  const [editingSigLabel, setEditingSigLabel] = useState<string>('');

  const startRenamingSig = (sig: { id: string; label: string }) => {
    setEditingSigId(sig.id);
    setEditingSigLabel(sig.label || 'My Signature');
  };

  const handleSaveRenameSig = (id: string) => {
    if (editingSigLabel.trim()) {
      renameSignature(id, editingSigLabel.trim());
    }
    setEditingSigId(null);
  };

  const handleCancelRenameSig = () => {
    setEditingSigId(null);
  };

  // Path navigation & Route detection
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [currentSearch, setCurrentSearch] = useState(window.location.search);
  const [currentHash, setCurrentHash] = useState(window.location.hash);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      setCurrentSearch(window.location.search);
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    setCurrentSearch(window.location.search);
    setCurrentHash(window.location.hash);
  };

  // Extract signToken from /sign/:token, ?sign=:token, or #/sign/:token
  const searchParams = new URLSearchParams(currentSearch);
  const querySignToken = searchParams.get('sign');
  const queryInboxToken = searchParams.get('inbox');

  const hashSignToken = currentHash.startsWith('#/sign/') ? currentHash.slice(7) : null;
  const hashInboxToken = currentHash.startsWith('#/inbox-submit/') ? currentHash.slice(14) : null;

  const pathSignToken = currentPath.startsWith('/sign/')
    ? currentPath.split('/sign/')[1]?.split('?')[0]
    : null;
  const pathInboxToken = currentPath.startsWith('/inbox-submit/')
    ? currentPath.split('/inbox-submit/')[1]?.split('?')[0]
    : null;

  const signToken = pathSignToken || querySignToken || hashSignToken;
  const isSignRoute = Boolean(signToken);

  const inboundToken = pathInboxToken || queryInboxToken || hashInboxToken;
  const isInboxRoute = Boolean(inboundToken);

  const isPublicRoute = isInboxRoute || isSignRoute;

  // Inbox links list
  const [inboxLinks, setInboxLinks] = useState<InboxLink[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Responsive / Foldable resize watcher
  useEffect(() => {
    const handleResize = () => updateDimensions(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateDimensions]);

  // Initial load
  useEffect(() => {
    initializeAuth();
    if (!isPublicRoute) {
      fetchDocuments();
      loadSignatures();
      loadInboxLinks();
    }
  }, [isPublicRoute]);

  // Supabase Realtime Subscription (Live sync across devices & remote signers)
  useEffect(() => {
    const unsubscribe = realtimeService.subscribeToAll();
    return () => {
      unsubscribe();
    };
  }, []);

  const loadInboxLinks = async () => {
    try {
      const links = await inboxService.listLinks();
      setInboxLinks(links);
    } catch (e) {
      console.error('Failed to load inbox links', e);
    }
  };

  if (isInboxRoute && inboundToken) {
    return <InboundPortal token={inboundToken} />;
  }

  if (isSignRoute && signToken) {
    return <SignerPortal token={signToken} />;
  }

  // Initial auth check loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <img src="/inky-mark.png" alt="Inky" className="h-12 w-auto animate-pulse" />
          <span className="text-xs font-semibold text-[var(--fg-muted)]">Loading Inky…</span>
        </div>
      </div>
    );
  }

  // Show login page by default when running website unauthenticated
  // Note: Guest mode is ONLY permitted on localhost for local development with Antigravity
  const canUseGuest = isLocalhost && guestMode;
  if ((!user && !canUseGuest) || currentPath === '/login') {
    return (
      <>
        <LoginPage
          onNavigateHome={() => {
            if (isLocalhost && !user) {
              setGuestMode(true);
            }
            navigateTo('/');
          }}
        />
        <Toast />
      </>
    );
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadDocument(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenSigModal = (fieldId?: string) => {
    setTargetFieldId(fieldId);
    openSignatureModal(fieldId);
  };

  const handleSelectSignatureFromModal = (dataUrl: string) => {
    if (targetFieldId) {
      const img = new Image();
      img.onload = () => {
        const aspect = img.naturalWidth / (img.naturalHeight || 1);
        const targetHeight = aspect < 2.0 ? 10.5 : 7.5;
        const targetWidth = Math.min(50, Math.max(14, targetHeight * 1.4 * aspect));
        setFields((prev) =>
          prev.map((f) =>
            f.id === targetFieldId
              ? {
                  ...f,
                  value: dataUrl,
                  width: Math.round(targetWidth * 10) / 10,
                  height: targetHeight,
                }
              : f
          )
        );
      };
      img.src = dataUrl;
    }
    closeSignatureModal();
    loadSignatures();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    showToast('Link copied to clipboard', 'success');
    setTimeout(() => setCopiedLink(null), 2500);
  };

  return (
    <FoldableLayout
      activeTab={activeTab === 'editor' ? 'dashboard' : (activeTab as any)}
      setActiveTab={(tab) => {
        if (tab === 'dashboard' && selectedDoc) clearSelection();
        setActiveTab(tab as any);
      }}
      onUploadClick={() => fileInputRef.current?.click()}
      onGenerateInboxClick={() => setIsShareInboxOpen(true)}
      onNavigateLogin={() => navigateTo('/login')}
    >
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/pdf"
        className="hidden"
      />

      {/* ── Dashboard Tab ──────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <Dashboard
          documents={documents}
          onSelectDocument={selectDocument}
          onUploadClick={() => fileInputRef.current?.click()}
          onGenerateInboxClick={() => setIsShareInboxOpen(true)}
          onDeleteDocument={(id) => setConfirmDeleteId(id)}
        />
      )}

      {/* ── Editor Tab ─────────────────────────────────────── */}
      {activeTab === 'editor' && selectedDoc && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <button
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back to Documents</span>
            </button>
            <div className="text-right">
              <h2 className="text-sm font-bold text-foreground truncate max-w-xs sm:max-w-md">
                {selectedDoc.title}
              </h2>
              <span className="text-[11px] text-muted-foreground font-mono">
                {selectedDoc.pageCount} page{selectedDoc.pageCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <PdfViewer
            documentId={selectedDoc.id}
            pdfUrl={selectedDoc.filePath}
            fields={fields}
            setFields={setFields as any}
            onOpenSignatureModal={handleOpenSigModal}
            onSignAndExport={() => signAndExport()}
            onSendClick={() => setIsMultiSignerOpen(true)}
            isSigningLoading={isSigningLoading}
          />
        </div>
      )}

      {/* ── Signatures Tab ─────────────────────────────────── */}
      {activeTab === 'signatures' && (
        <div className="space-y-6 max-w-3xl mx-auto w-full animate-fadeIn pb-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-2xl text-foreground">
                Saved Signatures
              </h2>
              <p className="text-sm mt-0.5 text-muted-foreground">
                Stored locally on your device for one-tap placement
              </p>
            </div>
            <button onClick={() => handleOpenSigModal()} className="btn-primary">
              <PlusCircle size={15} />
              <span>New Signature</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {signatures.length === 0 ? (
              <div className="col-span-1 sm:col-span-2 card-organic rounded-[2.5rem] px-5 py-10 sm:p-12 text-center flex flex-col items-center justify-center space-y-5 w-full">
                <div className="relative h-14 w-14 rounded-[1.5rem] flex items-center justify-center bg-primary/10 text-primary">
                  <PenTool size={24} />
                </div>
                <div className="w-full text-center">
                  <h3 className="font-display font-bold text-lg text-foreground">
                    No Saved Signatures
                  </h3>
                  <p className="text-sm mt-1.5 max-w-sm mx-auto text-muted-foreground">
                    Draw, type, or upload your signature once. It's saved locally for instant placement across all documents.
                  </p>
                </div>
                <button onClick={() => handleOpenSigModal()} className="btn-primary">
                  <PlusCircle size={15} />
                  <span>Create First Signature</span>
                </button>
              </div>
            ) : (
              signatures.map((sig) => (
                <div key={sig.id} className="card-organic p-4 rounded-[2rem] flex flex-col gap-3">
                  <div className="h-24 rounded-[1.25rem] flex items-center justify-center p-3 bg-white/70 dark:bg-card/70 border border-dashed border-border">
                    <img src={sig.dataUrl} alt={sig.label} className="h-full max-w-full object-contain" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {editingSigId === sig.id ? (
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingSigLabel}
                            onChange={(e) => setEditingSigLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenameSig(sig.id);
                              if (e.key === 'Escape') handleCancelRenameSig();
                            }}
                            className="input-organic h-8 px-2.5 text-xs font-bold w-full max-w-[170px]"
                            autoFocus
                            placeholder="Signature name…"
                          />
                          <button
                            onClick={() => handleSaveRenameSig(sig.id)}
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-[var(--moss)] text-white hover:scale-105 transition-transform shrink-0"
                            title="Save name"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            onClick={handleCancelRenameSig}
                            className="h-7 w-7 rounded-full flex items-center justify-center bg-[var(--bg-stone)] text-[var(--fg-muted)] hover:scale-105 transition-transform shrink-0"
                            title="Cancel"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-1.5 group/edit cursor-pointer"
                          onClick={() => startRenamingSig(sig)}
                        >
                          <span className="text-xs font-bold truncate text-foreground group-hover/edit:text-[var(--moss)] transition-colors">
                            {sig.label}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startRenamingSig(sig);
                            }}
                            className="p-1 rounded-lg text-[var(--fg-muted)] hover:text-[var(--moss)] hover:bg-[var(--moss-dim)] transition-all"
                            title="Rename signature"
                            aria-label="Rename signature"
                          >
                            <Pencil size={12} />
                          </button>
                          {sig.isDefault && <span className="badge-moss text-[10px]">Default</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!sig.isDefault && (
                        <button
                          onClick={() => makeDefault(sig.id)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-bold text-[var(--moss)] hover:bg-[var(--moss-dim)] transition-colors"
                          title="Set as default signature"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => removeSignature(sig.id)}
                        className="p-2 rounded-xl text-rose-500 hover:scale-110 transition-transform"
                        title="Delete signature"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Inbox Tab ──────────────────────────────────────── */}
      {activeTab === 'inbox' && (
        <div className="space-y-6 max-w-3xl mx-auto w-full animate-fadeIn pb-12">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-2xl text-foreground">
                Inbox Links
              </h2>
              <p className="text-sm mt-0.5 text-muted-foreground">
                Shareable links for external senders to submit PDFs directly
              </p>
            </div>
            <button onClick={() => setIsShareInboxOpen(true)} className="btn-primary">
              <Inbox size={15} />
              <span>New Link</span>
            </button>
          </div>

          <div className="space-y-3">
            {inboxLinks.length === 0 ? (
              <div className="card-organic rounded-[2.5rem] p-12 text-center space-y-5">
                <div className="relative h-14 w-14 rounded-[1.5rem] flex items-center justify-center mx-auto bg-primary/10 text-primary">
                  <Inbox size={24} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">
                    No Active Links
                  </h3>
                  <p className="text-sm mt-1.5 max-w-sm mx-auto text-muted-foreground">
                    Create a shareable link to let clients or contractors submit documents directly into your signing queue.
                  </p>
                </div>
                <button onClick={() => setIsShareInboxOpen(true)} className="btn-primary">
                  <Leaf size={15} />
                  <span>Create First Link</span>
                </button>
              </div>
            ) : (
              inboxLinks.map((link) => {
                const url = `${window.location.origin}/inbox-submit/${link.token}`;
                return (
                  <div key={link.id} className="card-organic rounded-[2rem] px-5 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-foreground">
                        {link.title || 'Inbox Upload Link'}
                      </h4>
                      <span className="badge-clay">
                        {link.currentUses} / {link.maxUses ?? '∞'} Uses
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-muted/60 border border-border">
                      <span className="text-xs font-mono select-all truncate flex-1 text-muted-foreground">
                        {url}
                      </span>
                      <button
                        onClick={() => copyToClipboard(url)}
                        className="shrink-0 transition-transform hover:scale-110 text-muted-foreground hover:text-foreground"
                      >
                        {copiedLink === url ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── History Tab ─────────────────────────────────────── */}
      {activeTab === 'history' && (
        <HistoryView
          documents={documents}
          onSelectDocument={selectDocument}
          onDeleteDocument={(id) => setConfirmDeleteId(id)}
          onGoToQueue={() => setActiveTab('dashboard')}
        />
      )}

      {/* ── Modals & Notifications ──────────────────────────── */}
      <SignaturePadModal
        isOpen={isSigModalOpen}
        onClose={closeSignatureModal}
        onSelectSignature={handleSelectSignatureFromModal}
      />

      {selectedDoc && (
        <MultiSignerPanel
          documentId={selectedDoc.id}
          isOpen={isMultiSignerOpen}
          onClose={() => setIsMultiSignerOpen(false)}
          onSuccess={fetchDocuments}
        />
      )}

      <ShareInboxModal
        isOpen={isShareInboxOpen}
        onClose={() => {
          setIsShareInboxOpen(false);
          loadInboxLinks();
        }}
      />

      <ConfirmModal
        isOpen={Boolean(confirmDeleteId)}
        title="Delete Document"
        message="Are you sure you want to permanently delete this document? This action cannot be undone."
        confirmLabel="Delete"
        isDestructive={true}
        onConfirm={() => {
          if (confirmDeleteId) {
            deleteDocument(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
      />

      <Toast />
    </FoldableLayout>
  );
}
