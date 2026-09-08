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
} from 'lucide-react';
import { SignatureField, FieldType, SavedSignature } from '@esign/shared';
import { getDefaultSignature, getSavedSignatures } from '../../lib/storage';

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

  // Signature dropdown state
  const [isSigDropdownOpen, setIsSigDropdownOpen] = useState<boolean>(false);
  const [savedSignatures, setSavedSignatures]     = useState<SavedSignature[]>([]);
  const sigDropdownRef = useRef<HTMLDivElement | null>(null);

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
    if (fieldType === 'signature' && defaultSig) initialValue = defaultSig.dataUrl;
    if (fieldType === 'date')   initialValue = nowStr;
    if (fieldType === 'name')   initialValue = 'Your Name';
    if (fieldType === 'text')   initialValue = 'Text';

    const newField: SignatureField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId,
      pageNumber: currentPage,
      x: 30 + (fields.length * 3) % 30,
      y: 35 + (fields.length * 5) % 35,
      width:  fieldType === 'signature' ? 25 : 18,
      height: fieldType === 'signature' ? 10 : 6,
      fieldType,
      value: initialValue,
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedFieldId || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pctX = Math.max(0, Math.min(90, ((e.clientX - dragOffset.x) / rect.width)  * 100));
    const pctY = Math.max(0, Math.min(90, ((e.clientY - dragOffset.y) / rect.height) * 100));
    setFields((prev) => prev.map((f) => f.id === selectedFieldId ? { ...f, x: pctX, y: pctY } : f));
  };

  const currentPageFields = fields.filter((f) => f.pageNumber === currentPage);

  const handleSelectSavedSignature = (dataUrl: string) => {
    const newField: SignatureField = {
      id: `field_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      documentId,
      pageNumber: currentPage,
      x: 30 + (fields.length * 3) % 30,
      y: 35 + (fields.length * 5) % 35,
      width: 25,
      height: 10,
      fieldType: 'signature',
      value: dataUrl,
      required: true,
    };
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setIsSigDropdownOpen(false);
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
      width: 25,
      height: 10,
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
                className="absolute top-full left-0 mt-2 w-72 rounded-2xl p-2 z-50 animate-fadeIn"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: '0 16px 40px -8px rgba(44,44,36,0.22), 0 0 0 1px rgba(93,112,82,0.12)',
                }}
              >
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-left" style={{ color: 'var(--fg-muted)' }}>
                  Your Signatures
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1 my-1">
                  {savedSignatures.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-center" style={{ color: 'var(--fg-muted)' }}>
                      No saved signatures found
                    </div>
                  ) : (
                    savedSignatures.map((sig) => (
                      <button
                        key={sig.id}
                        onClick={() => handleSelectSavedSignature(sig.dataUrl)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors hover:bg-[var(--moss-dim)] group"
                      >
                        <div className="h-8 w-28 flex items-center justify-center p-1 rounded-lg bg-white/90 border border-[var(--border-light)] shrink-0">
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
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors hover:bg-[var(--moss-dim)]"
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
          onMouseUp={() => setIsDragging(false)}
        >
          <div
            ref={containerRef}
            className="relative inline-block"
            style={{ boxShadow: '0 8px 48px rgba(44,44,36,0.12)' }}
          >
            <canvas ref={canvasRef} className="block max-w-full" />

            {/* Field Overlay */}
            {currentPageFields.map((field) => (
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
                    ? '2px solid #5D7052'
                    : '2px dashed rgba(93,112,82,0.50)',
                  borderRadius: 10,
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  transition: 'border-color 0.2s ease',
                }}
                className="group"
              >
                {field.value ? (
                  field.value.startsWith('data:image') ? (
                    <img
                      src={field.value}
                      alt="Signature"
                      className="h-full w-full object-contain pointer-events-none"
                    />
                  ) : (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded pointer-events-none font-bold"
                      style={{ color: 'var(--fg)' }}
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
                  className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{
                    background: '#A85448',
                    color: '#fff',
                    boxShadow: '0 2px 8px rgba(168,84,72,0.30)',
                  }}
                  aria-label="Remove field"
                >
                  <Trash2 style={{ height: 10, width: 10 }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
