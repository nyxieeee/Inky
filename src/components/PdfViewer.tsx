import React, { useRef, useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  PenTool,
  Calendar,
  Type,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Send,
  ChevronDown,
  PlusCircle,
  Users,
} from 'lucide-react';
import { SignatureField, FieldType, SavedSignature, Recipient } from '../types';
import { getDefaultSignature, getSavedSignatures } from '../lib/storage';
import { deliveryService } from '../services/deliveryService';
import { Dropdown } from './ui/Dropdown';

export const getSignerColor = (order?: number) => {
  if (order === 1) return '#C18C5D'; // Terracotta
  if (order === 2) return '#5D7052'; // Moss
  if (order === 3) return '#D99E4B'; // Ochre
  if (order === 4) return '#4E5F70'; // Slate
  return '#5D7052'; // Default
};

export const TEXT_FONT_OPTIONS = [
  { value: 'Inter',           label: 'Inter',           group: 'Professional Sans', fontFamily: 'Inter' },
  { value: 'Geist',           label: 'Geist',           group: 'Professional Sans', fontFamily: 'Geist' },
  { value: 'Arial',           label: 'Arial',           group: 'Professional Sans', fontFamily: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman', group: 'Professional Serif', fontFamily: 'Times New Roman' },
  { value: 'EB Garamond',     label: 'EB Garamond',     group: 'Professional Serif', fontFamily: 'EB Garamond' },
  { value: 'Dancing Script',  label: 'Dancing Script',  group: 'Handwriting Script', fontFamily: 'Dancing Script' },
  { value: 'Caveat',          label: 'Caveat',          group: 'Handwriting Script', fontFamily: 'Caveat' },
];

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PdfViewerProps {
  documentId: string;
  pdfUrl: string;
  fields: SignatureField[];
  setFields: React.Dispatch<React.SetStateAction<SignatureField[]>>;
  onOpenSignatureModal: (fieldId?: string) => void;
  onSignAndExport: () => void;
  onSendClick: () => void;
  isSigningLoading: boolean;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  documentId,
  pdfUrl,
  fields,
  setFields,
  onOpenSignatureModal,
  onSignAndExport,
  onSendClick,
  isSigningLoading,
}) => {
  const [pdfDoc, setPdfDoc]               = useState<any | null>(null);
  const [numPages, setNumPages]           = useState<number>(1);
  const [currentPage, setCurrentPage]     = useState<number>(1);
  const [scale, setScale]                 = useState<number>(1.2);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragging, setIsDragging]       = useState<boolean>(false);
  const [dragOffset, setDragOffset]       = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isResizing, setIsResizing]       = useState<boolean>(false);
  const [resizeStart, setResizeStart]     = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Signature dropdown state
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState<boolean>(false);
  const [savedSignatures, setSavedSignatures]     = useState<SavedSignature[]>([]);
  const sigDropdownRef = useRef<HTMLDivElement | null>(null);

  // Recipient list for field assignment
  const [recipients, setRecipients]               = useState<Recipient[]>([]);

  useEffect(() => {
    if (documentId) {
      const list = deliveryService.getRecipients(documentId);
      setRecipients(list);
    }
  }, [documentId]);

  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sigDropdownRef.current && !sigDropdownRef.current.contains(e.target as Node)) {
        setIsSigDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSigDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      try {
        const doc = await pdfjsLib.getDocument(pdfUrl).promise;
        if (isMounted) { setPdfDoc(doc); setNumPages(doc.numPages); }
      } catch (err) { console.error('Error loading PDF:', err); }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [pdfUrl]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let renderTask: any = null;
    const renderPage = async () => {
      try {
        const page     = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas   = canvasRef.current!;
        const ctx      = canvas.getContext('2d');
        if (!ctx) return;
        canvas.height = viewport.height;
        canvas.width  = viewport.width;
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') console.error(err);
      }
    };
    renderPage();
    return () => { if (renderTask) renderTask.cancel(); };
  }, [pdfDoc, currentPage, scale]);

  const addField = (fieldType: FieldType) => {
    const defaultSig = getDefaultSignature();
    const nowStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    let initialValue = '';
    if (fieldType === 'signature' && defaultSig) {
      handleSelectSavedSignature(defaultSig.dataUrl);
      return;
    }
    if (fieldType === 'date') initialValue = nowStr;
    if (fieldType === 'name') initialValue = 'Your Name';
    if (fieldType === 'text') initialValue = 'Text';

    const newField: SignatureField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId,
      pageNumber: currentPage,
      x: 30 + (fields.length * 3) % 30,
      y: 35 + (fields.length * 5) % 35,
      width:  fieldType === 'signature' ? 24 : 20,
      height: fieldType === 'signature' ? 8 : 5,
      fieldType,
      value: initialValue,
      fontFamily: fieldType === 'text' || fieldType === 'date' || fieldType === 'name' ? 'Inter' : undefined,
      required: true,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    if (fieldType === 'signature' && !defaultSig) onOpenSignatureModal(newField.id);
  };

  const removeField = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleMouseDown = (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setIsDragging(true);
    if (!containerRef.current) return;
    const rect  = containerRef.current.getBoundingClientRect();
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    setDragOffset({
      x: e.clientX - (field.x / 100) * rect.width,
      y: e.clientY - (field.y / 100) * rect.height,
    });
  };

  const handleResizeMouseDown = (fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setIsResizing(true);
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: field.width,
      height: field.height,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectedFieldId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    if (isDragging) {
      const pctX = Math.max(0, Math.min(92, ((e.clientX - dragOffset.x) / rect.width) * 100));
      const pctY = Math.max(0, Math.min(95, ((e.clientY - dragOffset.y) / rect.height) * 100));
      setFields((prev) => prev.map((f) => (f.id === selectedFieldId ? { ...f, x: pctX, y: pctY } : f)));
    } else if (isResizing) {
      const deltaX = ((e.clientX - resizeStart.x) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStart.y) / rect.height) * 100;
      const field = fields.find((f) => f.id === selectedFieldId);
      if (!field) return;

      const newWidth = Math.max(8, Math.min(85, resizeStart.width + deltaX));
      const aspect = resizeStart.width / (resizeStart.height || 1);
      // For signature fields, preserve proportional aspect ratio
      const newHeight = field.fieldType === 'signature'
        ? Math.max(3, Math.min(50, newWidth / aspect))
        : Math.max(3, Math.min(50, resizeStart.height + deltaY));

      setFields((prev) =>
        prev.map((f) => (f.id === selectedFieldId ? { ...f, width: newWidth, height: newHeight } : f))
      );
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const currentPageFields = fields.filter((f) => f.pageNumber === currentPage);

  const handleSelectSavedSignature = (dataUrl: string) => {
    setIsSigDropdownOpen(false);
    const img = new Image();
    img.onload = () => {
      const naturalAspect = img.naturalWidth / img.naturalHeight;
      const defaultHeight = 7.5;
      const rect = containerRef.current?.getBoundingClientRect();
      const pageAspect = rect ? rect.height / rect.width : 1.4;
      const targetWidth = Math.min(48, Math.max(12, defaultHeight * pageAspect * naturalAspect));

      const newField: SignatureField = {
        id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        documentId,
        pageNumber: currentPage,
        x: 30 + (fields.length * 3) % 30,
        y: 35 + (fields.length * 5) % 35,
        width: Math.round(targetWidth * 10) / 10,
        height: defaultHeight,
        fieldType: 'signature',
        value: dataUrl,
        required: true,
      };
      setFields((prev) => [...prev, newField]);
      setSelectedFieldId(newField.id);
    };
    img.src = dataUrl;
  };

  const handleAddNewSignature = () => {
    setIsSigDropdownOpen(false);
    const newFieldId = `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newField: SignatureField = {
      id: newFieldId,
      documentId,
      pageNumber: currentPage,
      x: 30 + (fields.length * 3) % 30,
      y: 35 + (fields.length * 5) % 35,
      width: 24,
      height: 8,
      fieldType: 'signature',
      value: '',
      required: true,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newFieldId);
    onOpenSignatureModal(newFieldId);
  };

  // Shared pill button for toolbar tools
  const toolBtn = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap hover:scale-105"
      style={{
        background: 'rgba(93,112,82,0.10)',
        color: 'var(--moss)',
        border: '1px solid rgba(93,112,82,0.18)',
      }}
    >
      {icon}{label}
    </button>
  );

  return (
    <div
      className="card-organic rounded-[2rem] overflow-hidden flex flex-col"
      style={{ minHeight: 0, flex: 1 }}
    >
      {/* ── Floating Toolbar ─────────────────────────────── */}
      <div
        className="glass px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 z-30 relative"
        style={{ borderBottom: '1px solid var(--border-light)' }}
      >
        {/* Field type tools */}
        <div className="flex items-center gap-1.5 py-0.5">
          {/* + Sig Dropdown Menu */}
          <div className="relative" ref={sigDropdownRef}>
            <button
              onClick={() => {
                setSavedSignatures(getSavedSignatures());
                setIsSigDropdownOpen((prev) => !prev);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 whitespace-nowrap hover:scale-105"
              style={{
                background: isSigDropdownOpen ? 'var(--moss)' : 'rgba(93,112,82,0.10)',
                color: isSigDropdownOpen ? '#F3F4F1' : 'var(--moss)',
                border: '1px solid rgba(93,112,82,0.18)',
              }}
              aria-label="Add signature"
              aria-haspopup="true"
              aria-expanded={isSigDropdownOpen}
            >
              <PenTool style={{ height: 13, width: 13 }} />
              <span>+ Sig</span>
              <ChevronDown
                style={{
                  height: 11,
                  width: 11,
                  transform: isSigDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>

            {isSigDropdownOpen && (
              <div
                className="absolute top-full left-0 mt-2 w-72 rounded-[1.75rem] p-2.5 z-50 animate-fadeIn"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 16px 40px -8px rgba(44,44,36,0.22), 0 0 0 1px rgba(93,112,82,0.12)',
                }}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-left" style={{ color: 'var(--fg-muted)' }}>
                  Your Signatures
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 my-1 pr-1">
                  {savedSignatures.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-center font-medium" style={{ color: 'var(--fg-muted)' }}>
                      No saved signatures found
                    </div>
                  ) : (
                    savedSignatures.map((sig) => (
                      <button
                        key={sig.id}
                        onClick={() => handleSelectSavedSignature(sig.dataUrl)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-2xl text-left transition-colors hover:bg-[var(--moss-dim)] group"
                      >
                        <div className="h-8 w-28 flex items-center justify-center p-1 rounded-xl bg-white/90 border border-[var(--border-light)] shrink-0">
                          <img src={sig.dataUrl} alt={sig.label} className="h-full max-w-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold truncate block" style={{ color: 'var(--fg)' }}>
                            {sig.label || 'Saved Signature'}
                          </span>
                          {sig.isDefault && (
                            <span className="text-[10px] font-bold" style={{ color: 'var(--moss)' }}>Default</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <div className="h-px my-1" style={{ background: 'var(--border-light)' }} />
                <button
                  onClick={handleAddNewSignature}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl text-xs font-bold transition-colors hover:bg-[var(--moss-dim)]"
                  style={{ color: 'var(--moss)' }}
                >
                  <PlusCircle style={{ height: 16, width: 16 }} />
                  <span>Add New Signature</span>
                </button>
              </div>
            )}
          </div>
          {toolBtn('+ Date',     <Calendar style={{ height: 13, width: 13 }} />, () => addField('date'))}
          {toolBtn('+ Text',     <Type     style={{ height: 13, width: 13 }} />, () => addField('text'))}

          {/* Active Text Field Font Selector */}
          {(() => {
            const activeField = fields.find((f) => f.id === selectedFieldId);
            if (activeField && (activeField.fieldType === 'text' || activeField.fieldType === 'date' || activeField.fieldType === 'name')) {
              return (
                <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-[var(--border)] animate-fadeIn">
                  <span className="text-[11px] font-bold hidden sm:inline" style={{ color: 'var(--fg-muted)' }}>Font:</span>
                  <div className="w-36 sm:w-44">
                    <Dropdown
                      value={activeField.fontFamily || 'Inter'}
                      onChange={(val) => {
                        const font = String(val);
                        setFields((prev) =>
                          prev.map((f) => (f.id === activeField.id ? { ...f, fontFamily: font } : f))
                        );
                      }}
                      options={TEXT_FONT_OPTIONS}
                      buttonClassName="py-1 px-3 text-xs bg-white/80"
                    />
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Active Field Signer Assignment Selector */}
          {(() => {
            const activeField = fields.find((f) => f.id === selectedFieldId);
            if (!activeField) return null;

            const signerOptions = [
              { value: '0', label: 'Assign: Anyone / Owner' },
              ...recipients.map((r) => ({
                value: String(r.signingOrder),
                label: `Signer ${r.signingOrder}: ${r.name}`,
              })),
              { value: '__add__', label: '+ Add / Edit Signers...' },
            ];

            return (
              <div className="flex items-center gap-1.5 pl-2 ml-1 border-l border-[var(--border)] animate-fadeIn">
                <Users style={{ height: 12, width: 12, color: 'var(--fg-muted)' }} />
                <div className="w-36 sm:w-44">
                  <Dropdown
                    value={String(activeField.signerOrder || 0)}
                    onChange={(val) => {
                      if (val === '__add__') {
                        onSendClick();
                        return;
                      }
                      const order = Number(val);
                      const targetRec = recipients.find((r) => r.signingOrder === order);
                      setFields((prev) =>
                        prev.map((f) =>
                          f.id === activeField.id
                            ? {
                                ...f,
                                signerOrder: order === 0 ? undefined : order,
                                signerName: targetRec?.name,
                                signerEmail: targetRec?.email,
                                signerId: targetRec?.id,
                              }
                            : f
                        )
                      );
                    }}
                    options={signerOptions}
                    buttonClassName="py-1 px-2.5 text-xs bg-white/80"
                  />
                </div>
              </div>
            );
          })()}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Page nav */}
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
          >
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft style={{ height: 16, width: 16 }} />
            </button>
            <span className="font-bold px-1" style={{ color: 'var(--fg)' }}>{currentPage}</span>
            <span>/ {numPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage >= numPages}
              aria-label="Next page"
            >
              <ChevronRight style={{ height: 16, width: 16 }} />
            </button>
          </div>

          {/* Zoom */}
          <div
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs"
            style={{ background: 'rgba(255,255,255,0.60)', border: '1px solid var(--border)' }}
          >
            <button
              onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
              style={{ color: 'var(--fg-muted)' }}
              aria-label="Zoom out"
            >
              <ZoomOut style={{ height: 14, width: 14 }} />
            </button>
            <span className="font-mono font-bold text-[11px] w-10 text-center" style={{ color: 'var(--fg)' }}>
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
              style={{ color: 'var(--fg-muted)' }}
              aria-label="Zoom in"
            >
              <ZoomIn style={{ height: 14, width: 14 }} />
            </button>
          </div>

          {/* Send */}
          <button onClick={onSendClick} className="btn-outline btn-sm">
            <Send style={{ height: 13, width: 13 }} />
            <span className="hidden md:inline">Send</span>
          </button>

          {/* Sign & Export */}
          <button
            onClick={onSignAndExport}
            disabled={isSigningLoading || fields.length === 0}
            className="btn-primary btn-sm"
          >
            {isSigningLoading
              ? <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              : <Download style={{ height: 13, width: 13 }} />
            }
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Page thumbnail sidebar */}
        {numPages > 1 && (
          <div
            className="w-16 hidden sm:flex flex-col gap-2 p-2 overflow-y-auto shrink-0"
            style={{ background: 'var(--bg-stone)', borderRight: '1px solid var(--border-light)' }}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-center block" style={{ color: 'var(--fg-muted)' }}>
              Pages
            </span>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pg) => (
              <button
                key={pg}
                onClick={() => setCurrentPage(pg)}
                className="text-xs font-bold py-2 rounded-xl transition-all duration-200"
                style={{
                  background: currentPage === pg ? 'var(--moss)' : 'rgba(255,255,255,0.50)',
                  color: currentPage === pg ? '#F3F4F1' : 'var(--fg-muted)',
                  border: currentPage === pg ? 'none' : '1px solid var(--border)',
                  boxShadow: currentPage === pg ? '0 4px 12px rgba(93,112,82,0.25)' : 'none',
                }}
              >
                {pg}
              </button>
            ))}
          </div>
        )}

        {/* PDF Canvas + Field Overlay */}
        <div
          className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start select-none"
          style={{ background: 'var(--bg)' }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            ref={containerRef}
            className="relative inline-block"
            style={{ boxShadow: '0 8px 48px rgba(44,44,36,0.12)' }}
          >
            <canvas ref={canvasRef} className="block max-w-full" />

            {/* Field Overlay */}
            {currentPageFields.map((field) => {
              const fieldSignerColor = getSignerColor(field.signerOrder);
              return (
              <div
                key={field.id}
                onMouseDown={(e) => handleMouseDown(field.id, e)}
                onClick={() => setSelectedFieldId(field.id)}
                style={{
                  left:     `${field.x}%`,
                  top:      `${field.y}%`,
                  width:    `${field.width}%`,
                  height:   `${field.height}%`,
                  position: 'absolute',
                  cursor:   'move',
                  zIndex:   selectedFieldId === field.id ? 20 : 10,
                  border:   selectedFieldId === field.id
                    ? `2px solid ${fieldSignerColor}`
                    : `2px dashed ${fieldSignerColor}99`,
                  borderRadius: 10,
                  background: field.signerOrder ? `${fieldSignerColor}08` : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  transition: 'border-color 0.2s ease',
                }}
                className="group"
              >
                {/* Signer Tag Badge */}
                {field.signerOrder ? (
                  <span
                    className="absolute -top-2.5 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold text-white shadow-xs z-30 pointer-events-none truncate max-w-[120px]"
                    style={{ background: fieldSignerColor }}
                  >
                    {field.signerName ? `${field.signerOrder}: ${field.signerName}` : `Signer ${field.signerOrder}`}
                  </span>
                ) : null}
                {field.value ? (
                  field.value.startsWith('data:image') ? (
                    <img
                      src={field.value}
                      alt="Signature"
                      className="h-full w-full object-contain pointer-events-none select-none"
                    />
                  ) : selectedFieldId === field.id ? (
                    <input
                      type="text"
                      value={field.value || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFields((prev) =>
                          prev.map((f) => (f.id === field.id ? { ...f, value: val } : f))
                        );
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{ fontFamily: field.fontFamily || 'Inter, sans-serif' }}
                      className="text-xs font-bold px-1.5 py-0.5 rounded bg-white/95 dark:bg-card/95 border border-primary text-foreground outline-none w-full text-center"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded pointer-events-none font-bold"
                      style={{ color: 'var(--fg)', fontFamily: field.fontFamily || 'Inter, sans-serif' }}
                    >
                      {field.value}
                    </span>
                  )
                ) : (
                  <div
                    onClick={(e) => { e.stopPropagation(); onOpenSignatureModal(field.id); }}
                    className="flex items-center gap-1 text-xs font-bold cursor-pointer"
                    style={{ color: 'var(--moss)' }}
                  >
                    <PenTool style={{ height: 12, width: 12 }} />
                    <span>Sign</span>
                  </div>
                )}

                {/* Delete handle */}
                <button
                  onClick={(e) => removeField(field.id, e)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`absolute -top-2.5 -right-2.5 h-6 w-6 rounded-full flex items-center justify-center transition-all duration-200 z-30 cursor-pointer ${
                    selectedFieldId === field.id ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  style={{
                    background: '#A85448',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(168,84,72,0.40)',
                  }}
                  title="Remove field"
                  aria-label="Remove field"
                >
                  <Trash2 style={{ height: 11, width: 11 }} />
                </button>

                {/* Corner Resize handle */}
                {selectedFieldId === field.id && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(field.id, e)}
                    className="absolute -bottom-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center cursor-se-resize z-30 transition-transform hover:scale-125"
                    style={{
                      background: 'var(--moss)',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.30)',
                      border: '2px solid #ffffff',
                    }}
                    title="Drag to resize"
                    aria-label="Resize handle"
                  />
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
