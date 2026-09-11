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
  Move,
  Plus,
  Trash2,
  Home,
  FileSignature,
  Pencil,
} from 'lucide-react';
import { deliveryService } from '../services/deliveryService';
import { Recipient, Document, SignatureField, SavedSignature } from '../types';
import { SignaturePadModal } from './modals/SignaturePadModal';
import { useToastStore } from '../store/useToastStore';
import { getSignerColor } from './PdfViewer';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getSavedSignatures, getDefaultSignature } from '../lib/storage';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface SignerPortalProps {
  token: string;
  onBack?: () => void;
}

export const SignerPortal: React.FC<SignerPortalProps> = ({ token, onBack }) => {
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

  // Dynamic fields state (starts with context.fields, supports signer adding fields on the fly)
  const [fields, setFields] = useState<SignatureField[]>([]);
  // Local field value changes by this signer
  const [fieldValues, setFieldValues] = useState<Record<string, { value: string; fontFamily?: string }>>({});
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [recentSignature, setRecentSignature] = useState<SavedSignature | null>(() => {
    return getDefaultSignature() || getSavedSignatures()[0] || null;
  });
  const [activeSigFieldId, setActiveSigFieldId] = useState<string | null>(null);
  const [pendingAddCoords, setPendingAddCoords] = useState<{ x: number; y: number } | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>({ x: 0, y: 0, width: 0, height: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ allComplete: boolean; message: string } | null>(null);
  const [isReopening, setIsReopening] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hasDraggedRef = useRef(false);
  const dragJustEndedRef = useRef(false);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // Load context on mount / when token changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setContext(null);
    setFields([]);
    setFieldValues({});
    setSelectedFieldId(null);
    setSubmittedResult(null);
    setIsReopening(false);

    deliveryService.getSignerContext(token)
      .then((ctx) => {
        if (!isMounted) return;
        setContext(ctx);
        if (ctx) {
          setFields(ctx.fields);
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

  // Realtime subscription for live field updates from other signers
  useEffect(() => {
    if (!context?.document?.id || !isSupabaseConfigured() || !supabase) return;

    const channelName = `signer-fields-${context.document.id}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'signature_fields',
          filter: `document_id=eq.${context.document.id}`,
        },
        (payload: any) => {
          const updated = payload.new;
          if (updated && updated.value) {
            setFieldValues((prev) => ({
              ...prev,
              [updated.id]: { value: updated.value, fontFamily: updated.font_family },
            }));
            setFields((prev) =>
              prev.map((f) =>
                f.id === updated.id
                  ? { ...f, value: updated.value, fontFamily: updated.font_family }
                  : f
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'signature_fields',
          filter: `document_id=eq.${context.document.id}`,
        },
        (payload: any) => {
          const inserted = payload.new;
          if (inserted) {
            setFields((prev) => {
              if (prev.some((f) => f.id === inserted.id)) return prev;
              return [
                ...prev,
                {
                  id: inserted.id,
                  documentId: inserted.document_id,
                  pageNumber: inserted.page_number,
                  x: inserted.x,
                  y: inserted.y,
                  width: inserted.width,
                  height: inserted.height,
                  fieldType: inserted.field_type,
                  value: inserted.value,
                  fontFamily: inserted.font_family,
                  required: inserted.required,
                  signerId: inserted.signer_id,
                  signerEmail: inserted.signer_email,
                  signerOrder: inserted.signer_order,
                  signerName: inserted.signer_name,
                },
              ];
            });
            if (inserted.value) {
              setFieldValues((prev) => ({
                ...prev,
                [inserted.id]: { value: inserted.value, fontFamily: inserted.font_family },
              }));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [context?.document?.id]);

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

  // Dragging event handlers for mouse & touch
  const startDrag = (fieldId: string, clientX: number, clientY: number, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (isResizing) return;
    setSelectedFieldId(fieldId);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentFields = fieldsRef.current;
    const field = currentFields.find((f) => f.id === fieldId);
    if (!field) return;

    const fieldPxX = (field.x / 100) * rect.width;
    const fieldPxY = (field.y / 100) * rect.height;

    hasDraggedRef.current = false;
    dragJustEndedRef.current = false;
    setDraggingFieldId(fieldId);
    setDragOffset({
      x: clientX - rect.left - fieldPxX,
      y: clientY - rect.top - fieldPxY,
    });
  };

  const onDragMove = (clientX: number, clientY: number) => {
    if (!draggingFieldId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentFields = fieldsRef.current;
    const field = currentFields.find((f) => f.id === draggingFieldId);
    if (!field) return;

    const mouseX = clientX - rect.left - dragOffset.x;
    const mouseY = clientY - rect.top - dragOffset.y;

    const pctX = Math.max(0, Math.min(100 - field.width, (mouseX / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100 - field.height, (mouseY / rect.height) * 100));

    hasDraggedRef.current = true;

    setFields((prev) =>
      prev.map((f) =>
        f.id === draggingFieldId
          ? { ...f, x: Math.round(pctX * 10) / 10, y: Math.round(pctY * 10) / 10 }
          : f
      )
    );
  };

  // Corner Resizing event handlers
  const startResize = (fieldId: string, clientX: number, clientY: number, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    const field = fieldsRef.current.find((f) => f.id === fieldId);
    if (!field) return;

    setIsResizing(true);
    setSelectedFieldId(fieldId);
    setResizeStart({
      x: clientX,
      y: clientY,
      width: field.width,
      height: field.height,
    });
  };

  const onResizeMove = (clientX: number, clientY: number) => {
    if (!isResizing || !selectedFieldId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentFields = fieldsRef.current;
    const field = currentFields.find((f) => f.id === selectedFieldId);
    if (!field) return;

    const deltaX = ((clientX - resizeStart.x) / rect.width) * 100;
    const deltaY = ((clientY - resizeStart.y) / rect.height) * 100;

    const minWidth = 8;
    const maxWidth = Math.min(85, 100 - field.x);
    const newWidth = Math.max(minWidth, Math.min(maxWidth, resizeStart.width + deltaX));

    const aspect = resizeStart.width / (resizeStart.height || 1);
    const newHeight = field.fieldType === 'signature' || field.fieldType === 'initials'
      ? Math.max(3, Math.min(50, newWidth / aspect))
      : Math.max(3, Math.min(50, resizeStart.height + deltaY));

    setFields((prev) =>
      prev.map((f) =>
        f.id === selectedFieldId
          ? {
              ...f,
              width: Math.round(newWidth * 10) / 10,
              height: Math.round(newHeight * 10) / 10,
            }
          : f
      )
    );
  };

  useEffect(() => {
    if (!draggingFieldId && !isResizing) return;

    const handlePointerMove = (e: MouseEvent) => {
      if (isResizing) {
        onResizeMove(e.clientX, e.clientY);
      } else if (draggingFieldId) {
        onDragMove(e.clientX, e.clientY);
      }
    };
    const handlePointerUp = () => {
      if (hasDraggedRef.current) {
        dragJustEndedRef.current = true;
        setTimeout(() => {
          dragJustEndedRef.current = false;
          hasDraggedRef.current = false;
        }, 200);
      }
      setDraggingFieldId(null);
      setIsResizing(false);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (isResizing) {
          onResizeMove(e.touches[0].clientX, e.touches[0].clientY);
        } else if (draggingFieldId) {
          onDragMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }
    };
    const handleTouchEnd = () => {
      if (hasDraggedRef.current) {
        dragJustEndedRef.current = true;
        setTimeout(() => {
          dragJustEndedRef.current = false;
          hasDraggedRef.current = false;
        }, 200);
      }
      setDraggingFieldId(null);
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggingFieldId, isResizing, resizeStart, selectedFieldId, dragOffset]);

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

  const { recipient, document: doc } = context;

  const handleGoHome = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/';
    }
  };

  // Check if this recipient already signed previously (and hasn't chosen to reopen/edit)
  if (recipient.status === 'signed' && !submittedResult && !isReopening) {
    return (
      <div
        onClick={handleGoHome}
        className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] cursor-pointer"
        title="Click anywhere to return to home page"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="card-organic max-w-md w-full p-8 text-center space-y-5 rounded-[2.5rem] animate-fadeIn cursor-default shadow-xl border border-[var(--border-light)]"
        >
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
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={() => setIsReopening(true)}
              className="btn-primary w-full justify-center text-xs py-3 flex items-center gap-2 shadow-sm cursor-pointer"
              style={{ background: 'var(--moss)' }}
            >
              <Pencil className="h-4 w-4" />
              <span>Reopen & Edit Signature</span>
            </button>

            {context.pdfBlob && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = URL.createObjectURL(context.pdfBlob!);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${doc.title}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn-outline w-full justify-center text-xs py-2.5 flex items-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download Signed Document</span>
              </button>
            )}

            <button
              onClick={handleGoHome}
              className="btn-ghost w-full justify-center text-xs py-2 flex items-center gap-2 opacity-80 hover:opacity-100 cursor-pointer"
            >
              <Home className="h-4 w-4" />
              <span>Back to Home Page</span>
            </button>
          </div>
          <p className="text-[10px] text-[var(--fg-muted)] opacity-70">
            Click anywhere outside or a button above to proceed
          </p>
        </div>
      </div>
    );
  }

  // Check if successfully submitted just now
  if (submittedResult) {
    return (
      <div
        onClick={handleGoHome}
        className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg)] font-sans cursor-pointer"
        title="Click anywhere to return to home page"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="card-organic max-w-lg w-full p-8 text-center space-y-6 rounded-[2.5rem] animate-fadeIn cursor-default shadow-2xl border border-[var(--border-light)]"
        >
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

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={() => {
                setSubmittedResult(null);
                setIsReopening(true);
              }}
              className="btn-outline flex-1 justify-center text-xs py-3 flex items-center gap-2 cursor-pointer"
            >
              <Pencil className="h-4 w-4" />
              <span>Edit / Re-sign</span>
            </button>

            {context.pdfBlob && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const url = URL.createObjectURL(context.pdfBlob!);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${doc.title}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="btn-outline flex-1 justify-center text-xs py-3 flex items-center gap-2 cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </button>
            )}

            <button
              onClick={handleGoHome}
              className="btn-primary flex-1 justify-center text-xs py-3 flex items-center gap-2 shadow-sm cursor-pointer"
              style={{ background: 'var(--moss)' }}
            >
              <Home className="h-4 w-4" />
              <span>Back to Home</span>
            </button>
          </div>

          <p className="text-[11px] text-[var(--fg-muted)] opacity-70">
            Click anywhere outside or the button above to return to the home page
          </p>
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
  const myPendingFields = myRequiredFields.filter((f) => !fieldValues[f.id]?.value && !f.value);
  const filledCount = myFields.filter((f) => !!(fieldValues[f.id]?.value || f.value)).length;
  // If pre-assigned fields exist, require them all; if 0 pre-assigned, require at least 1 placed signature
  const isAllFilled = myRequiredFields.length > 0
    ? filledCount >= myRequiredFields.length
    : filledCount > 0;
  const nextPendingField = myPendingFields[0];



  const handleOpenSigModal = (fieldId: string) => {
    setActiveSigFieldId(fieldId);
    setPendingAddCoords(null);
    setIsSigModalOpen(true);
  };

  const handleStartAddSignature = (coords?: { x: number; y: number }) => {
    setPendingAddCoords(coords || null);
    setActiveSigFieldId(null);
    setIsSigModalOpen(true);
  };

  const handleSelectSignature = (dataUrl: string, targetFieldId?: string) => {
    const fieldToFill = targetFieldId || activeSigFieldId;
    if (fieldToFill) {
      setFieldValues((prev) => ({
        ...prev,
        [fieldToFill]: { value: dataUrl },
      }));
      setFields((prev) =>
        prev.map((f) => (f.id === fieldToFill ? { ...f, value: dataUrl } : f))
      );
      setSelectedFieldId(fieldToFill);
      useToastStore.getState().showToast('Signature placed', 'success');
    } else {
      const newFieldId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const posX = pendingAddCoords ? pendingAddCoords.x : 32;
      const posY = pendingAddCoords ? pendingAddCoords.y : 68;

      const newField: SignatureField = {
        id: newFieldId,
        documentId: doc.id,
        pageNumber: currentPage,
        x: Math.round(posX * 10) / 10,
        y: Math.round(posY * 10) / 10,
        width: 35,
        height: 9,
        fieldType: 'signature',
        value: dataUrl,
        required: true,
        signerId: recipient.id,
        signerEmail: recipient.email,
        signerOrder: recipient.signingOrder,
        signerName: recipient.name,
      };

      setFields((prev) => [...prev, newField]);
      setFieldValues((prev) => ({
        ...prev,
        [newFieldId]: { value: dataUrl },
      }));
      setSelectedFieldId(newFieldId);
      useToastStore.getState().showToast('Signature placed! Drag to position, drag corner to resize.', 'success');
    }

    // Keep recent signature fresh
    const sigs = getSavedSignatures();
    setRecentSignature(getDefaultSignature() || sigs[0] || null);

    setIsSigModalOpen(false);
    setActiveSigFieldId(null);
    setPendingAddCoords(null);
  };

  const handleAddDate = () => {
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const newFieldId = `date_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const newField: SignatureField = {
      id: newFieldId,
      documentId: doc.id,
      pageNumber: currentPage,
      x: 35,
      y: 78,
      width: 24,
      height: 5,
      fieldType: 'date',
      value: today,
      required: true,
      signerId: recipient.id,
      signerEmail: recipient.email,
      signerOrder: recipient.signingOrder,
      signerName: recipient.name,
    };

    setFields((prev) => [...prev, newField]);
    setFieldValues((prev) => ({
      ...prev,
      [newFieldId]: { value: today },
    }));
    useToastStore.getState().showToast('Date placed! Drag to position.', 'success');
  };

  const handleRemoveField = (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
    setFieldValues((prev) => {
      const copy = { ...prev };
      delete copy[fieldId];
      return copy;
    });
    useToastStore.getState().showToast('Field removed', 'info');
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // If clicking on an existing field, button, or dragging/resizing, ignore
    if (draggingFieldId || isResizing || hasDraggedRef.current || dragJustEndedRef.current) return;
    if ((e.target as HTMLElement).closest('.signature-field-box')) return;
    if ((e.target as HTMLElement).closest('button')) return;

    // If a field is currently selected, clicking outside on the canvas deselects it to see signature clearly!
    if (selectedFieldId) {
      setSelectedFieldId(null);
      return;
    }

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const targetX = Math.max(2, Math.min(65, clickX - 17));
    const targetY = Math.max(2, Math.min(90, clickY - 4.5));

    handleStartAddSignature({ x: targetX, y: targetY });
  };

  const handleFinishSubmit = async () => {
    const myFilled = fields.filter((f) => isMyField(f) && (fieldValues[f.id]?.value || f.value));
    if (myFilled.length === 0) {
      useToastStore.getState().showToast('Please place your signature on the document before submitting', 'warning');
      handleStartAddSignature();
      return;
    }

    if (myRequiredFields.length > 0 && !isAllFilled) {
      useToastStore.getState().showToast('Please complete all your required fields before submitting', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const updates = myFilled.map((f) => ({
        fieldId: f.id,
        value: fieldValues[f.id]?.value || f.value || '',
        fontFamily: fieldValues[f.id]?.fontFamily || f.fontFamily,
        fieldMeta: {
          pageNumber: f.pageNumber,
          x: f.x,
          y: f.y,
          width: f.width,
          height: f.height,
          fieldType: f.fieldType,
        },
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
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              if (onBack) onBack();
              else window.location.href = '/';
            }}
            className="h-9 w-9 rounded-2xl border border-[var(--border-light)] bg-white/80 dark:bg-black/20 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all text-[var(--fg-muted)] hover:text-[var(--fg)]"
            title="Back to Inky"
            aria-label="Back to Inky"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
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
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-stone)] border border-[var(--border-light)] text-[10px] sm:text-xs font-semibold">
            <span className="text-[var(--fg-muted)]">Fields:</span>
            <span className="font-bold text-[var(--terracotta)]">
              {filledCount} / {myRequiredFields.length}
            </span>
          </div>

          <button
            onClick={handleFinishSubmit}
            disabled={!isAllFilled || isSubmitting}
            className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-4 shadow-sm"
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
            <span>{isReopening || recipient.status === 'signed' ? 'Update & Resubmit' : 'Finish & Submit'}</span>
          </button>
        </div>
      </header>

      {/* ── Reopen Alert Banner (when editing an already-signed document) ── */}
      {(isReopening || recipient.status === 'signed') && (
        <div className="mx-4 sm:mx-6 my-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-[var(--fg)]">
              <strong>Editing Signed Document:</strong> You previously signed this document on{' '}
              {recipient.signedAt ? new Date(recipient.signedAt).toLocaleString() : 'earlier'}.
              You can reposition, resize, or replace your signature, then click <strong>Update & Resubmit</strong>.
            </span>
          </div>
          <button
            onClick={() => setIsReopening(false)}
            className="text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline shrink-0 cursor-pointer px-2 py-1 rounded-lg hover:bg-amber-500/10"
          >
            Back to Summary
          </button>
        </div>
      )}

      {/* ── Subheader Controls ─────────────────────────────────── */}
      <div
        className="px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs"
        style={{ background: 'var(--bg-stone)', borderColor: 'var(--border-light)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {/* Page controls */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/20 border border-[var(--border-light)] font-bold">
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

          {/* Quick "Add Signature" Button & Recent Signature Preview */}
          <div className="flex items-center gap-1.5">
            {recentSignature && (
              <button
                type="button"
                onClick={() => handleSelectSignature(recentSignature.dataUrl)}
                className="h-8 px-2.5 rounded-full border border-[var(--border-light)] bg-white/90 dark:bg-black/40 hover:bg-[var(--moss-dim)] transition-all duration-200 hover:scale-105 flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                title={`Quick sign with recent signature: ${recentSignature.label || 'Signature'}`}
                aria-label="Quick sign with recent signature"
              >
                <img
                  src={recentSignature.dataUrl}
                  alt={recentSignature.label || 'Recent signature'}
                  className="h-5 w-auto max-w-[65px] object-contain select-none"
                />
              </button>
            )}

            <button
              onClick={() => handleStartAddSignature()}
              className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-sm"
              style={{ background: 'var(--moss)', color: '#F3F4F1' }}
            >
              <PenTool className="h-3.5 w-3.5" />
              <span>+ Add Signature</span>
            </button>
          </div>

          {/* Quick "Add Date" Button */}
          <button
            onClick={handleAddDate}
            className="px-2.5 py-1.5 rounded-full text-xs font-bold border border-[var(--border-light)] bg-white/80 dark:bg-black/20 hover:bg-white text-[var(--fg)] flex items-center gap-1 transition-all shadow-xs"
            title="Add today's date"
          >
            <Calendar className="h-3.5 w-3.5 text-[var(--terracotta)]" />
            <span className="hidden sm:inline">+ Date</span>
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 dark:bg-black/20 border border-[var(--border-light)]">
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
      <main
        onClick={() => setSelectedFieldId(null)}
        className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center select-none bg-[var(--bg)]"
      >
        {/* Subtle helper instruction */}
        <div className="text-center text-[11px] text-[var(--fg-muted)] pb-2.5 select-none flex items-center justify-center gap-1.5 font-medium">
          <PenTool className="h-3 w-3 text-[var(--moss)]" />
          <span>Tap anywhere on the page to sign, or drag your signature into place.</span>
        </div>

        <div
          ref={containerRef}
          onClick={handleCanvasClick}
          className="relative inline-block card-organic overflow-hidden shadow-2xl cursor-crosshair"
          style={{ borderRadius: '0.75rem' }}
          title="Click anywhere to place signature"
        >
          <canvas ref={canvasRef} className="block max-w-full pointer-events-auto" />

          {/* Fields Layer */}
          {currentPageFields.map((field) => {
            const mine = isMyField(field);
            const signerColor = getSignerColor(field.signerOrder);
            const currentVal = fieldValues[field.id]?.value || field.value;
            const isDraggingThis = draggingFieldId === field.id;
            const isSelected = selectedFieldId === field.id;
            const isHovered = hoveredFieldId === field.id;

            // Border & background styling based on selection state
            let borderStyle = '2px solid transparent';
            let backgroundStyle = 'transparent';
            let boxShadowStyle = 'none';

            if (mine) {
              if (isDraggingThis || (isResizing && isSelected)) {
                borderStyle = '2px solid var(--moss)';
                backgroundStyle = 'rgba(255, 255, 255, 0.70)';
                boxShadowStyle = '0 12px 28px rgba(0,0,0,0.18)';
              } else if (isSelected) {
                borderStyle = `2px solid ${signerColor}`;
                backgroundStyle = currentVal ? 'rgba(255, 255, 255, 0.40)' : `${signerColor}18`;
                boxShadowStyle = `0 0 0 3px ${signerColor}25, 0 4px 14px rgba(0,0,0,0.10)`;
              } else if (!currentVal) {
                borderStyle = `2px dashed ${signerColor}`;
                backgroundStyle = `${signerColor}12`;
                boxShadowStyle = `0 0 0 3px ${signerColor}15`;
              } else if (isHovered) {
                borderStyle = `1.5px dashed ${signerColor}90`;
                backgroundStyle = 'rgba(255, 255, 255, 0.20)';
              }
            } else {
              borderStyle = '1.5px dashed rgba(120,120,110,0.35)';
              backgroundStyle = 'rgba(200,200,195,0.15)';
            }

            return (
              <div
                key={field.id}
                onMouseEnter={() => setHoveredFieldId(field.id)}
                onMouseLeave={() => setHoveredFieldId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mine) {
                    setSelectedFieldId(field.id);
                  }
                }}
                onMouseDown={mine ? (e) => startDrag(field.id, e.clientX, e.clientY, e) : undefined}
                onTouchStart={
                  mine
                    ? (e) => {
                        if (e.touches.length === 1) {
                          startDrag(field.id, e.touches[0].clientX, e.touches[0].clientY, e);
                        }
                      }
                    : undefined
                }
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.width}%`,
                  height: `${field.height}%`,
                  position: 'absolute',
                  zIndex: isDraggingThis || (isResizing && isSelected) ? 35 : isSelected ? 30 : mine ? 25 : 10,
                  border: borderStyle,
                  borderRadius: 10,
                  background: backgroundStyle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  cursor: mine ? (isDraggingThis ? 'grabbing' : isSelected ? 'move' : 'pointer') : 'not-allowed',
                  boxShadow: boxShadowStyle,
                  touchAction: 'none',
                  transition: isDraggingThis || isResizing ? 'none' : 'box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                className={`signature-field-box group ${mine && !currentVal ? 'animate-pulse' : ''}`}
              >
                {/* Signer Identification Badge (visible if selected or unfilled) */}
                {(isSelected || !currentVal) && (
                  <span
                    className="absolute -top-2.5 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold text-white shadow-xs z-30 pointer-events-none truncate max-w-[120px]"
                    style={{ background: mine ? signerColor : '#7A7A70' }}
                  >
                    {mine ? 'You' : `Signer ${field.signerOrder || ''}`}
                  </span>
                )}

                {/* Remove Field Button (visible when selected or hovered) */}
                {mine && (isSelected || isHovered) && (
                  <button
                    onClick={(e) => handleRemoveField(field.id, e)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center shadow-md z-40 transition-transform hover:scale-110"
                    title="Remove field"
                    aria-label="Remove field"
                  >
                    ✕
                  </button>
                )}

                {/* Animated "Sign Here" beacon for active unfilled fields */}
                {mine && !currentVal && (
                  <div
                    className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md z-30 flex items-center gap-1 animate-bounce pointer-events-none whitespace-nowrap"
                    style={{ background: 'var(--terracotta)' }}
                  >
                    <span>Sign Here</span>
                    <span>↓</span>
                  </div>
                )}

                {/* Drag to Reposition Indicator & Change Button (visible when selected) */}
                {mine && currentVal && isSelected && (
                  <div className="absolute -bottom-6 left-2 flex items-center gap-1.5 z-40 whitespace-nowrap">
                    {field.fieldType === 'signature' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSigModal(field.id);
                        }}
                        className="px-2 py-0.5 rounded-md bg-[var(--moss)] hover:bg-[var(--moss)]/90 text-white text-[9px] font-bold shadow-sm cursor-pointer flex items-center gap-1"
                        title="Change signature"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        <span>Change</span>
                      </button>
                    )}
                    <div className="px-1.5 py-0.5 rounded-md bg-black/75 text-white text-[8px] font-semibold flex items-center gap-1 pointer-events-none shadow-sm">
                      <Move className="h-2 w-2" />
                      <span>Drag to move · Corner to resize</span>
                    </div>
                  </div>
                )}

                {/* Corner Resize Handle (visible when selected) */}
                {mine && isSelected && (
                  <div
                    onMouseDown={(e) => startResize(field.id, e.clientX, e.clientY, e)}
                    onTouchStart={(e) => {
                      if (e.touches.length === 1) {
                        startResize(field.id, e.touches[0].clientX, e.touches[0].clientY, e);
                      }
                    }}
                    className="absolute -bottom-2.5 -right-2.5 w-5 h-5 rounded-full flex items-center justify-center cursor-se-resize z-40 transition-transform hover:scale-125 shadow-md"
                    style={{
                      background: 'var(--moss)',
                      border: '2px solid #ffffff',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                    }}
                    title="Drag to resize signature"
                    aria-label="Resize signature"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                )}

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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSigModal(field.id);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold transition-transform hover:scale-105"
                      style={{ color: signerColor }}
                    >
                      <PenTool className="h-3.5 w-3.5" />
                      <span>Click to Sign</span>
                    </button>
                  ) : field.fieldType === 'date' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
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

      {/* ── Sticky Mobile/Desktop Signer Navigation Guidance Bar ───────── */}
      {/* 1. If user has pending required fields */}
      {nextPendingField && (
        <aside className="sticky bottom-4 z-40 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-lg w-full shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center justify-between gap-2 sm:gap-3 border backdrop-blur-xl animate-slideUp bg-[var(--surface)]/95 border-[var(--border)]">
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="h-2 w-2 rounded-full bg-[var(--terracotta)] animate-ping shrink-0" />
              <span className="font-bold text-[var(--fg)] truncate">
                {nextPendingField.pageNumber !== currentPage
                  ? `Signature is on Page ${nextPendingField.pageNumber}`
                  : `Signature field ready on this page`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {recentSignature && nextPendingField.pageNumber === currentPage && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectSignature(recentSignature.dataUrl, nextPendingField.id);
                  }}
                  className="h-9 px-2.5 sm:px-3 rounded-full border border-[var(--moss)]/40 bg-white/90 dark:bg-black/40 hover:bg-[var(--moss-dim)] transition-all duration-200 hover:scale-105 flex items-center gap-1.5 sm:gap-2 shadow-sm shrink-0 group cursor-pointer"
                  title={`Quick sign with recent signature: ${recentSignature.label || 'Signature'}`}
                  aria-label="Quick sign with recent signature"
                >
                  <img
                    src={recentSignature.dataUrl}
                    alt={recentSignature.label || 'Recent signature'}
                    className="h-5 sm:h-6 w-auto max-w-[65px] sm:max-w-[90px] object-contain select-none"
                  />
                  <span className="text-[11px] font-bold text-[var(--moss)] hidden sm:inline group-hover:underline">
                    Quick Sign
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  if (nextPendingField.pageNumber !== currentPage) {
                    setCurrentPage(nextPendingField.pageNumber);
                  } else {
                    handleOpenSigModal(nextPendingField.id);
                  }
                }}
                className="py-2 px-3.5 sm:px-4 rounded-full text-xs font-bold text-white flex items-center gap-1.5 transition-all duration-200 hover:scale-105 shadow-md shrink-0"
                style={{ background: 'var(--terracotta)' }}
              >
                <span>
                  {nextPendingField.pageNumber !== currentPage
                    ? `Go to Page ${nextPendingField.pageNumber} →`
                    : `Sign Here ✍️`}
                </span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 2. If NO fields assigned to this signer yet: provide Add Signature action */}
      {myFields.length === 0 && (
        <aside className="sticky bottom-4 z-40 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-lg w-full shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center justify-between gap-2 sm:gap-3 border backdrop-blur-xl animate-slideUp bg-[var(--surface)]/95 border-[var(--border)]">
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="h-2 w-2 rounded-full bg-[var(--moss)] animate-pulse shrink-0" />
              <span className="font-bold text-[var(--fg)] truncate">
                Tap anywhere or click to sign
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {recentSignature && (
                <button
                  type="button"
                  onClick={() => handleSelectSignature(recentSignature.dataUrl)}
                  className="h-9 px-2.5 sm:px-3 rounded-full border border-[var(--moss)]/40 bg-white/90 dark:bg-black/40 hover:bg-[var(--moss-dim)] transition-all duration-200 hover:scale-105 flex items-center gap-1.5 sm:gap-2 shadow-sm shrink-0 group cursor-pointer"
                  title={`Quick sign with recent signature: ${recentSignature.label || 'Signature'}`}
                  aria-label="Quick sign with recent signature"
                >
                  <img
                    src={recentSignature.dataUrl}
                    alt={recentSignature.label || 'Recent signature'}
                    className="h-5 sm:h-6 w-auto max-w-[65px] sm:max-w-[90px] object-contain select-none"
                  />
                  <span className="text-[11px] font-bold text-[var(--moss)] hidden sm:inline group-hover:underline">
                    Quick Sign
                  </span>
                </button>
              )}

              <button
                onClick={() => handleStartAddSignature()}
                className="btn-primary text-xs py-2 px-3 sm:px-4 shadow-md flex items-center gap-1.5 shrink-0"
                style={{ background: 'var(--moss)', color: '#F3F4F1' }}
              >
                <PenTool className="h-3.5 w-3.5" />
                <span>Add Signature ✍️</span>
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 3. If signer has placed signature and all required fields are filled */}
      {myFields.length > 0 && isAllFilled && !nextPendingField && (
        <aside className="sticky bottom-4 z-40 px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-md w-full shadow-2xl rounded-full p-1.5 pl-4 pr-1.5 flex items-center justify-between gap-3 border backdrop-blur-xl animate-slideUp bg-[var(--surface)]/95 border-[var(--border)]">
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="h-2 w-2 rounded-full bg-[var(--moss)] shrink-0" />
              <span className="font-bold text-[var(--fg)] truncate">
                ✓ Ready! Drag to position or submit
              </span>
            </div>

            <button
              onClick={handleFinishSubmit}
              disabled={isSubmitting}
              className="btn-primary text-xs py-2 px-4 shadow-md flex items-center gap-1.5 shrink-0"
              style={{ background: 'var(--moss)', color: '#F3F4F1' }}
            >
              {isSubmitting ? (
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              <span>Finish & Submit</span>
            </button>
          </div>
        </aside>
      )}

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
