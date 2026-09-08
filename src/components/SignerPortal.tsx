import React, { useEffect, useState, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  FileCheck2,
  PenTool,
  Calendar,
  Type,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Send,
  Download,
  AlertCircle,
  ShieldCheck,
  Leaf,
  User,
} from 'lucide-react';
import { deliveryService } from '../services/deliveryService';
import { Recipient, Document, SignatureField } from '../types';
import { SignaturePadModal } from './modals/SignaturePadModal';
import { useToastStore } from '../store/useToastStore';
import { getSignerColor } from './PdfViewer';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface SignerPortalProps {
  token: string;
}

export const SignerPortal: React.FC<SignerPortalProps> = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<{
    recipient: Recipient;
    document: Document;
    fields: SignatureField[];
    pdfBlob: Blob | null;
  } | null>(null);

  // PDF render state
  const [pdfDoc, setPdfDoc] = useState<any | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.15);

  // Local field value changes by this signer
  const [fieldValues, setFieldValues] = useState<Record<string, { value: string; fontFamily?: string }>>({});
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [activeSigFieldId, setActiveSigFieldId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ allComplete: boolean; message: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Load context on mount
  useEffect(() => {
    let isMounted = true;
    deliveryService.getSignerContext(token)
      .then((ctx) => {
        if (!isMounted) return;
        setContext(ctx);
        if (ctx) {
          // Initialize already-filled fields
          const initial: Record<string, { value: string; fontFamily?: string }> = {};
          ctx.fields.forEach((f) => {
            if (f.value) initial[f.id] = { value: f.value, fontFamily: f.fontFamily };
          });
          setFieldValues(initial);
        }
      })
      .catch((err) => {
        console.error('Failed to load signing session', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [token]);

  // Load PDF Document when pdfBlob is available
  useEffect(() => {
    let isMounted = true;
    if (!context?.pdfBlob) return;

    const loadPdf = async () => {
      try {
        const arrayBuffer = await context.pdfBlob!.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (isMounted) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
        }
      } catch (err) {
        console.error('Error rendering PDF:', err);
      }
    };

    loadPdf();
    return () => { isMounted = false; };
  }, [context?.pdfBlob]);

  // Render current PDF page
  useEffect(() => {
    let renderTask: any = null;
    let isMounted = true;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(currentPage);
        if (!isMounted) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();
    return () => {
      isMounted = false;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, currentPage, scale]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--bg)]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 rounded-full border-3 border-[var(--terracotta)] border-t-transparent animate-spin mx-auto" />
          <p className="font-display font-medium text-sm text-[var(--fg-muted)]">
            Loading secure signing portal...
          </p>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
        <div className="card-organic max-w-md w-full p-8 text-center space-y-4 rounded-[2.5rem]">
          <div className="h-16 w-16 rounded-[1.5rem] flex items-center justify-center mx-auto bg-red-100/60 dark:bg-red-950/40">
            <AlertCircle className="h-8 w-8 text-[#A85448]" />
          </div>
          <h3 className="font-display font-bold text-xl text-[var(--fg)]">
            Signing Link Invalid or Expired
          </h3>
          <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
            This secure signing invitation is either invalid or has already expired. Please request a new link from the document sender.
          </p>
        </div>
      </div>
    );
  }

  const { recipient, document: doc, fields } = context;

  // Check if this recipient already signed previously
  if (recipient.status === 'signed' && !submittedResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)]">
        <div className="card-organic max-w-md w-full p-8 text-center space-y-5 rounded-[2.5rem] animate-fadeIn">
          <div className="h-16 w-16 rounded-[1.5rem] flex items-center justify-center mx-auto bg-[var(--moss-dim)]">
            <CheckCircle2 className="h-8 w-8 text-[var(--moss)]" />
          </div>
          <div>
            <h3 className="font-display font-bold text-xl text-[var(--fg)]">
              Document Already Signed
            </h3>
            <p className="text-xs text-[var(--fg-muted)] mt-1.5 leading-relaxed">
              Hello <strong>{recipient.name}</strong>, you have already completed your signature on <strong>"{doc.title}"</strong>.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-[var(--bg-stone)] border border-[var(--border-light)] text-xs text-left space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Signed By:</span>
              <span className="font-bold text-[var(--fg)]">{recipient.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--fg-muted)]">Email:</span>
              <span className="text-[var(--fg)]">{recipient.email}</span>
            </div>
            {recipient.signedAt && (
              <div className="flex justify-between">
                <span className="text-[var(--fg-muted)]">Timestamp:</span>
                <span className="text-[var(--fg)]">{new Date(recipient.signedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Check if successfully submitted just now
  if (submittedResult) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] font-sans">
        <div className="card-organic max-w-lg w-full p-8 text-center space-y-6 rounded-[2.5rem] animate-fadeIn">
          <div className="h-18 w-18 rounded-[1.75rem] flex items-center justify-center mx-auto bg-[var(--moss-dim)]">
            <CheckCircle2 className="h-10 w-10 text-[var(--moss)]" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 rounded-full bg-[var(--moss-dim)] text-[var(--moss)] mb-2">
              <ShieldCheck className="h-3.5 w-3.5" /> Legally Binding Signature Recorded
            </span>
            <h2 className="font-display font-bold text-2xl text-[var(--fg)]">
              Thank You, {recipient.name}!
            </h2>
            <p className="text-xs text-[var(--fg-muted)] mt-2 leading-relaxed">
              {submittedResult.message}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-stone)] border border-[var(--border-light)] text-xs text-left space-y-2">
            <div className="font-bold text-[var(--fg)]">{doc.title}</div>
            <p className="text-[11px] text-[var(--fg-muted)]">
              {submittedResult.allComplete
                ? 'All parties have signed! A sealed copy with the complete audit trail has been archived.'
                : 'The next signer in sequence has been notified to complete their signature.'}
            </p>
          </div>

          {context.pdfBlob && (
            <button
              onClick={() => {
                const url = URL.createObjectURL(context.pdfBlob!);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${doc.title}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="btn-outline w-full justify-center text-xs py-2.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download Document</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Determine which fields belong to this recipient
  const isMyField = (field: SignatureField) => {
    if (field.signerOrder) return field.signerOrder === recipient.signingOrder;
    if (field.signerEmail) return field.signerEmail.toLowerCase() === recipient.email.toLowerCase();
    if (field.signerId) return field.signerId === recipient.id;
    // If unassigned, allow signing
    return true;
  };

  const myFields = fields.filter(isMyField);
  const myRequiredFields = myFields.filter((f) => f.required);
  const filledCount = myRequiredFields.filter((f) => !!fieldValues[f.id]?.value).length;
  const isAllFilled = filledCount === myRequiredFields.length;

  const handleOpenSigModal = (fieldId: string) => {
    setActiveSigFieldId(fieldId);
    setIsSigModalOpen(true);
  };

  const handleSelectSignature = (dataUrl: string) => {
    if (!activeSigFieldId) return;
    setFieldValues((prev) => ({
      ...prev,
      [activeSigFieldId]: { value: dataUrl },
    }));
    setIsSigModalOpen(false);
    setActiveSigFieldId(null);
    useToastStore.getState().showToast('Signature placed', 'success');
  };

  const handleFinishSubmit = async () => {
    if (!isAllFilled) {
      useToastStore.getState().showToast('Please complete all your required fields before submitting', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates = Object.entries(fieldValues).map(([fieldId, data]) => ({
        fieldId,
        value: data.value,
        fontFamily: data.fontFamily,
      }));

      const res = await deliveryService.submitSignerFields(token, updates);
      setSubmittedResult(res);
      useToastStore.getState().showToast('Signature recorded successfully!', 'success');
    } catch (err: any) {
      useToastStore.getState().showToast(err.message || 'Failed to submit signature', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPageFields = fields.filter((f) => f.pageNumber === currentPage);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--fg)] font-sans">
      {/* ── Top Header ───────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 px-4 sm:px-6 py-3 border-b flex flex-wrap items-center justify-between gap-3"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(16px)',
          borderColor: 'var(--border-light)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-2xl flex items-center justify-center bg-[var(--moss-dim)]">
            <Leaf className="h-5 w-5 text-[var(--moss)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm sm:text-base truncate max-w-xs sm:max-w-md">
                {doc.title}
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shrink-0"
                style={{ background: getSignerColor(recipient.signingOrder) }}
              >
                Signer #{recipient.signingOrder}
              </span>
            </div>
            <div className="text-[11px] text-[var(--fg-muted)] flex items-center gap-1.5 mt-0.5">
              <User className="h-3 w-3" />
              <span>Signing as <strong>{recipient.name}</strong> ({recipient.email})</span>
            </div>
          </div>
        </div>

        {/* Completion Status + Finish Button */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-stone)] border border-[var(--border-light)] text-xs font-semibold">
            <span className="text-[var(--fg-muted)]">Progress:</span>
            <span className="font-bold text-[var(--terracotta)]">
              {filledCount} / {myRequiredFields.length} Completed
            </span>
          </div>

          <button
            onClick={handleFinishSubmit}
            disabled={!isAllFilled || isSubmitting}
            className="btn-primary text-xs sm:text-sm py-2 px-4 shadow-sm"
            style={{
              opacity: !isAllFilled || isSubmitting ? 0.6 : 1,
              cursor: !isAllFilled || isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            {isSubmitting ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>Finish & Submit</span>
          </button>
        </div>
      </header>

      {/* ── Subheader Controls ─────────────────────────────────── */}
      <div
        className="px-4 py-2 border-b flex items-center justify-between text-xs"
        style={{ background: 'var(--bg-paper)', borderColor: 'var(--border-light)' }}
      >
        <div className="flex items-center gap-2">
          {/* Page controls */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 border border-[var(--border-light)] font-bold">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-0.5 hover:text-[var(--terracotta)] disabled:opacity-30"
              aria-label="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-1 text-[11px]">{currentPage} / {numPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              className="p-0.5 hover:text-[var(--terracotta)] disabled:opacity-30"
              aria-label="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/70 border border-[var(--border-light)]">
          <button
            onClick={() => setScale((s) => Math.max(0.7, s - 0.15))}
            className="p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            aria-label="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono font-bold text-[11px] w-8 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.0, s + 0.15))}
            className="p-0.5 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            aria-label="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ── PDF Canvas Viewport ──────────────────────────────── */}
      <main className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start select-none bg-[var(--bg)]">
        <div
          ref={containerRef}
          className="relative inline-block card-organic overflow-hidden shadow-2xl"
          style={{ borderRadius: '0.75rem' }}
        >
          <canvas ref={canvasRef} className="block max-w-full" />

          {/* Fields Layer */}
          {currentPageFields.map((field) => {
            const mine = isMyField(field);
            const signerColor = getSignerColor(field.signerOrder);
            const currentVal = fieldValues[field.id]?.value || field.value;

            return (
              <div
                key={field.id}
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                  position: 'absolute',
                  zIndex: mine ? 25 : 10,
                  border: mine
                    ? `2px solid ${signerColor}`
                    : '1.5px dashed rgba(120,120,110,0.35)',
                  borderRadius: 10,
                  background: mine
                    ? currentVal
                      ? 'rgba(255,255,255,0.85)'
                      : `${signerColor}12`
                    : 'rgba(200,200,195,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  cursor: mine ? 'pointer' : 'not-allowed',
                  boxShadow: mine && !currentVal ? `0 0 0 3px ${signerColor}25` : 'none',
                }}
                className={mine && !currentVal ? 'animate-pulse' : ''}
              >
                {/* Signer Identification Badge */}
                <span
                  className="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white shadow-xs z-30 pointer-events-none truncate max-w-[120px]"
                  style={{ background: mine ? signerColor : '#7A7A70' }}
                >
                  {mine ? 'You' : `Signer ${field.signerOrder || ''}`}
                </span>

                {/* Field Content */}
                {currentVal ? (
                  currentVal.startsWith('data:image') ? (
                    <img
                      src={currentVal}
                      alt="Signature"
                      className="h-full w-full object-contain pointer-events-none"
                    />
                  ) : (
                    <span
                      className="text-xs font-bold px-2 py-0.5 truncate pointer-events-none"
                      style={{ color: 'var(--fg)', fontFamily: field.fontFamily || 'Inter, sans-serif' }}
                    >
                      {currentVal}
                    </span>
                  )
                ) : mine ? (
                  // Interactive Prompt
                  field.fieldType === 'signature' || field.fieldType === 'initials' ? (
                    <button
                      onClick={() => handleOpenSigModal(field.id)}
                      className="flex items-center gap-1.5 text-xs font-bold transition-transform hover:scale-105"
                      style={{ color: signerColor }}
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      <span>Click to Sign</span>
                    </button>
                  ) : field.fieldType === 'date' ? (
                    <button
                      onClick={() => {
                        const today = new Date().toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        setFieldValues((prev) => ({ ...prev, [field.id]: { value: today } }));
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold transition-transform hover:scale-105"
                      style={{ color: signerColor }}
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      <span>Insert Date</span>
                    </button>
                  ) : (
                    <input
                      type="text"
                      placeholder={field.fieldType === 'name' ? recipient.name : 'Enter text'}
                      defaultValue={field.fieldType === 'name' ? recipient.name : ''}
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v.trim()) setFieldValues((prev) => ({ ...prev, [field.id]: { value: v } }));
                      }}
                      className="w-full text-xs font-bold text-center bg-white/90 rounded border border-[var(--border-light)] p-1 outline-none"
                    />
                  )
                ) : (
                  <span className="text-[10px] font-bold text-[var(--fg-muted)] opacity-60">
                    Signer {field.signerOrder || ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Signature Modal */}
      <SignaturePadModal
        isOpen={isSigModalOpen}
        onClose={() => {
          setIsSigModalOpen(false);
          setActiveSigFieldId(null);
        }}
        onSelectSignature={handleSelectSignature}
      />
    </div>
  );
};
