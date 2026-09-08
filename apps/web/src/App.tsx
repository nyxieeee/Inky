import React, { useState, useEffect } from 'react';
import { FoldableLayout } from './components/layout/FoldableLayout';
import { DashboardView } from './components/dashboard/DashboardView';
import { PdfViewer } from './components/document/PdfViewer';
import { SignaturePadModal } from './components/signature/SignaturePadModal';
import { MultiSignerPanel } from './components/document/MultiSignerPanel';
import { ShareInboxModal } from './components/inbox/ShareInboxModal';
import { InboundPortal } from './components/inbox/InboundPortal';
import { PwaPrompt } from './components/pwa/PwaPrompt';
import {
  fetchDocuments,
  uploadDocumentFile,
  getDocumentDetails,
  saveDocumentFields,
  signAndFlattenDocument,
  deleteDocument,
  fetchInboxLinks,
} from './lib/apiClient';
import { getSavedSignatures, deleteSavedSignature } from './lib/storage';
import { Document, SignatureField, InboxLink, SavedSignature } from '@esign/shared';
import {
  PenTool, Trash2, ArrowLeft, PlusCircle,
  Inbox, Leaf, Copy, Check,
} from 'lucide-react';
import { HistoryView } from './components/history/HistoryView';

export function App() {
  const [activeTab, setActiveTab]       = useState<'dashboard' | 'editor' | 'inbox' | 'signatures' | 'history'>('dashboard');
  const [documents, setDocuments]       = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc]   = useState<Document | null>(null);
  const [fields, setFields]             = useState<SignatureField[]>([]);
  const [isLoading, setIsLoading]       = useState<boolean>(true);
  const [isSigningLoading, setIsSigningLoading] = useState<boolean>(false);

  // Modals
  const [isSigModalOpen, setIsSigModalOpen]   = useState<boolean>(false);
  const [targetFieldId, setTargetFieldId]     = useState<string | undefined>(undefined);
  const [isMultiSignerOpen, setIsMultiSignerOpen] = useState<boolean>(false);
  const [isShareInboxOpen, setIsShareInboxOpen]   = useState<boolean>(false);

  // Inbound portal route
  const pathname        = window.location.pathname;
  const isInboxRoute    = pathname.startsWith('/inbox-submit/');
  const inboundToken    = isInboxRoute ? pathname.split('/inbox-submit/')[1] : null;

  const [inboxLinks, setInboxLinks] = useState<InboxLink[]>([]);
  const [savedSigs, setSavedSigs]   = useState<SavedSignature[]>([]);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const list = await fetchDocuments();
      setDocuments(list);
    } catch (e) {
      console.error('Failed to load documents:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isInboxRoute) {
      loadDocs();
      setSavedSigs(getSavedSignatures());
    }
  }, [isInboxRoute]);

  if (isInboxRoute && inboundToken) {
    return <InboundPortal token={inboundToken} />;
  }

  const handleSelectDocument = async (doc: Document) => {
    try {
      const details = await getDocumentDetails(doc.id);
      setSelectedDoc(details);
      setFields(details.fields);
      setActiveTab('editor');
    } catch {
      alert('Failed to load document details');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const newDoc = await uploadDocumentFile(file);
      await loadDocs();
      await handleSelectDocument(newDoc);
    } catch (err: any) {
      alert(err.message || 'Failed to upload document');
    }
  };

  const handleSignAndExport = async () => {
    if (!selectedDoc) return;
    setIsSigningLoading(true);
    try {
      await saveDocumentFields(selectedDoc.id, fields);
      await signAndFlattenDocument(selectedDoc.id, {
        signerEmail: 'signer@esign.app',
        signerName:  'Signature Verification',
        addAuditPage: true,
      });
      alert('Document signed successfully. Flattened PDF ready.');
      window.open(`/api/documents/${selectedDoc.id}/file`, '_blank');
      await loadDocs();
      setActiveTab('history');
    } catch (err: any) {
      alert(err.message || 'Failed to sign document');
    } finally {
      setIsSigningLoading(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await deleteDocument(id);
      if (selectedDoc?.id === id) { setSelectedDoc(null); setActiveTab('dashboard'); }
      await loadDocs();
    } catch {
      alert('Failed to delete document');
    }
  };

  const handleSelectSignatureFromModal = (dataUrl: string, label: string) => {
    if (targetFieldId) {
      setFields((prev) => prev.map((f) => f.id === targetFieldId ? { ...f, value: dataUrl } : f));
    }
    setSavedSigs(getSavedSignatures());
  };

  const handleLoadInboxLinks = async () => {
    try { setInboxLinks(await fetchInboxLinks()); } catch { /* silent */ }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <FoldableLayout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveTab(tab);
        if (tab === 'inbox')      handleLoadInboxLinks();
        if (tab === 'signatures') setSavedSigs(getSavedSignatures());
      }}
      onUploadClick={() => document.getElementById('hiddenFileInput')?.click()}
      onGenerateInboxClick={() => setIsShareInboxOpen(true)}
    >
      {/* Hidden file input */}
      <input
        type="file"
        id="hiddenFileInput"
        accept="application/pdf"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ── Dashboard ───────────────────────────────────────── */}
      {activeTab === 'dashboard' && (
        <DashboardView
          documents={documents}
          onSelectDocument={handleSelectDocument}
          onUploadClick={() => document.getElementById('hiddenFileInput')?.click()}
          onGenerateInboxClick={() => setIsShareInboxOpen(true)}
          onDeleteDocument={handleDeleteDoc}
        />
      )}

      {/* ── PDF Editor ──────────────────────────────────────── */}
      {activeTab === 'editor' && selectedDoc && (
        <div className="flex-1 flex flex-col gap-3 h-[calc(100vh-7rem)]">
          {/* Editor breadcrumb */}
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className="btn-ghost btn-sm"
            >
              <ArrowLeft style={{ height: 14, width: 14 }} />
              <span>Documents</span>
            </button>
            <span
              className="text-xs font-bold truncate max-w-xs px-3 py-1.5 rounded-full"
              style={{
                background: 'var(--bg-stone)',
                color: 'var(--fg-muted)',
                border: '1px solid var(--border-light)',
              }}
            >
              {selectedDoc.title}
            </span>
          </div>

          <PdfViewer
            documentId={selectedDoc.id}
            pdfUrl={`/api/documents/${selectedDoc.id}/file`}
            fields={fields}
            setFields={setFields}
            onOpenSignatureModal={(fieldId) => { setTargetFieldId(fieldId); setIsSigModalOpen(true); }}
            onSignAndExport={handleSignAndExport}
            onSendClick={() => setIsMultiSignerOpen(true)}
            isSigningLoading={isSigningLoading}
          />
        </div>
      )}

      {/* ── Signatures Tab ──────────────────────────────────── */}
      {activeTab === 'signatures' && (
        <div className="space-y-6 max-w-3xl mx-auto w-full animate-fadeIn pb-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-2xl" style={{ color: 'var(--fg)' }}>
                Saved Signatures
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                Stored locally on your device for one-tap placement
              </p>
            </div>
            <button
              onClick={() => { setTargetFieldId(undefined); setIsSigModalOpen(true); }}
              className="btn-primary"
            >
              <PlusCircle style={{ height: 15, width: 15 }} />
              <span>New Signature</span>
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {savedSigs.length === 0 ? (
              <div
                className="col-span-1 sm:col-span-2 card-organic rounded-[2.5rem] px-5 py-10 sm:p-12 text-center flex flex-col items-center justify-center space-y-5 w-full"
              >
                {/* Ambient blob */}
                <div className="relative inline-block mx-auto">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl"
                    style={{ background: 'var(--moss-dim)', transform: 'scale(2)' }}
                    aria-hidden
                  />
                  <div
                    className="relative h-14 w-14 rounded-[1.5rem] flex items-center justify-center mx-auto"
                    style={{ background: 'var(--moss-dim)' }}
                  >
                    <PenTool style={{ height: 24, width: 24, color: 'var(--moss)' }} />
                  </div>
                </div>
                <div className="w-full text-center">
                  <h3 className="font-display font-bold text-lg text-center" style={{ color: 'var(--fg)' }}>
                    No Saved Signatures
                  </h3>
                  <p className="text-sm mt-1.5 max-w-sm mx-auto text-center" style={{ color: 'var(--fg-muted)' }}>
                    Draw, type, or upload your signature once. It's saved locally for instant placement across all documents.
                  </p>
                </div>
                <button
                  onClick={() => { setTargetFieldId(undefined); setIsSigModalOpen(true); }}
                  className="btn-primary mx-auto"
                >
                  <PlusCircle style={{ height: 15, width: 15 }} />
                  <span>Create First Signature</span>
                </button>
              </div>
            ) : (
              savedSigs.map((sig) => (
                <div
                  key={sig.id}
                  className="card-organic p-4 rounded-[2rem] flex flex-col gap-3"
                >
                  {/* Signature preview */}
                  <div
                    className="h-24 rounded-[1.25rem] flex items-center justify-center p-3"
                    style={{
                      background: 'rgba(255,255,255,0.65)',
                      border: '1px dashed rgba(93,112,82,0.25)',
                    }}
                  >
                    <img src={sig.dataUrl} alt={sig.label} className="h-full max-w-full object-contain" />
                  </div>
                  {/* Footer row */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold block" style={{ color: 'var(--fg)' }}>
                        {sig.label}
                      </span>
                      {sig.isDefault && <span className="badge-moss text-[10px] mt-0.5">Default</span>}
                    </div>
                    <button
                      onClick={() => setSavedSigs(deleteSavedSignature(sig.id))}
                      className="p-2 rounded-xl transition-all hover:scale-110"
                      style={{ color: '#A85448' }}
                      title="Delete signature"
                      aria-label="Delete signature"
                    >
                      <Trash2 style={{ height: 15, width: 15 }} />
                    </button>
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display font-bold text-2xl" style={{ color: 'var(--fg)' }}>
                Inbox Links
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                Shareable links for external senders to submit PDFs directly
              </p>
            </div>
            <button onClick={() => setIsShareInboxOpen(true)} className="btn-primary">
              <Inbox style={{ height: 15, width: 15 }} />
              <span>New Link</span>
            </button>
          </div>

          {/* Link list */}
          <div className="space-y-3">
            {inboxLinks.length === 0 ? (
              <div className="card-organic rounded-[2.5rem] p-12 text-center space-y-5">
                <div className="relative inline-block mx-auto">
                  <div
                    className="absolute inset-0 rounded-full blur-2xl"
                    style={{ background: 'var(--clay-dim)', transform: 'scale(2)' }}
                    aria-hidden
                  />
                  <div
                    className="relative h-14 w-14 rounded-[1.5rem] flex items-center justify-center mx-auto"
                    style={{ background: 'var(--clay-dim)' }}
                  >
                    <Inbox style={{ height: 24, width: 24, color: 'var(--terracotta)' }} />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg" style={{ color: 'var(--fg)' }}>
                    No Active Links
                  </h3>
                  <p className="text-sm mt-1.5 max-w-sm mx-auto" style={{ color: 'var(--fg-muted)' }}>
                    Create a shareable link to let clients or contractors submit documents directly into your signing queue.
                  </p>
                </div>
                <button onClick={() => setIsShareInboxOpen(true)} className="btn-primary">
                  <Leaf style={{ height: 15, width: 15 }} />
                  Create First Link
                </button>
              </div>
            ) : (
              inboxLinks.map((link) => {
                const url = `${window.location.origin}/inbox-submit/${link.token}`;
                return (
                  <div
                    key={link.id}
                    className="card-organic rounded-[2rem] px-5 py-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm" style={{ color: 'var(--fg)' }}>
                        {link.title || 'Inbox Upload Link'}
                      </h4>
                      <span className="badge-clay">
                        {link.currentUses} / {link.maxUses ?? '∞'} Uses
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-2 rounded-full px-4 py-2"
                      style={{
                        background: 'var(--bg-stone)',
                        border: '1px solid var(--border-light)',
                      }}
                    >
                      <span
                        className="text-xs font-mono select-all truncate flex-1"
                        style={{ color: 'var(--fg-muted)' }}
                      >
                        {url}
                      </span>
                      <button
                        onClick={() => copyToClipboard(url)}
                        className="shrink-0 transition-all hover:scale-110"
                        style={{ color: copiedLink === url ? 'var(--moss)' : 'var(--fg-muted)' }}
                        aria-label="Copy link"
                      >
                        {copiedLink === url
                          ? <Check style={{ height: 14, width: 14 }} />
                          : <Copy  style={{ height: 14, width: 14 }} />
                        }
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
          onSelectDocument={handleSelectDocument}
          onDeleteDocument={handleDeleteDoc}
          onGoToQueue={() => setActiveTab('dashboard')}
        />
      )}

      {/* ── Signature Pad Modal ──────────────────────────────── */}
      <SignaturePadModal
        isOpen={isSigModalOpen}
        onClose={() => setIsSigModalOpen(false)}
        onSelectSignature={handleSelectSignatureFromModal}
      />

      {/* ── Multi-Signer Panel ───────────────────────────────── */}
      {selectedDoc && (
        <MultiSignerPanel
          documentId={selectedDoc.id}
          isOpen={isMultiSignerOpen}
          onClose={() => setIsMultiSignerOpen(false)}
          onSuccess={loadDocs}
        />
      )}

      {/* ── Share Inbox Modal ────────────────────────────────── */}
      <ShareInboxModal
        isOpen={isShareInboxOpen}
        onClose={() => {
          setIsShareInboxOpen(false);
          handleLoadInboxLinks();
        }}
      />

      {/* ── PWA Prompt ──────────────────────────────────────── */}
      <PwaPrompt />
    </FoldableLayout>
  );
}
