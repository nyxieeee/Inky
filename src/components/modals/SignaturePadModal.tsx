import React, { useRef, useState, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { X, PenTool, Type, Upload, Check, RotateCcw, ChevronDown } from 'lucide-react';
import { saveSignature, getSavedSignatures } from '../../lib/storage';
import { SavedSignature } from '../../types';
import { trimCanvas, processUploadedSignature } from '../../utils';
import { useToastStore } from '../../store/useToastStore';

import { Dropdown, DropdownOption } from '../ui/Dropdown';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSignature: (dataUrl: string, label: string) => void;
}

export const AVAILABLE_FONTS = [
  // Professional & Clean
  { id: 'Inter',           name: 'Inter',           style: 'Modern Sans',        group: 'Professional Fonts' },
  { id: 'Geist',           name: 'Geist',           style: 'Clean Geometric',    group: 'Professional Fonts' },
  { id: 'Arial',           name: 'Arial',           style: 'Universal Sans',     group: 'Professional Fonts' },
  { id: 'Times New Roman', name: 'Times New Roman', style: 'Classic Editorial',   group: 'Professional Fonts' },
  { id: 'EB Garamond',     name: 'EB Garamond',     style: 'Book Serif',         group: 'Professional Fonts' },

  // Signature & Cursive Scripts
  { id: 'Dancing Script',  name: 'Dancing Script',  style: 'Classic Cursive',    group: 'Signature Scripts' },
  { id: 'Great Vibes',     name: 'Great Vibes',     style: 'Calligraphy',        group: 'Signature Scripts' },
  { id: 'Caveat',          name: 'Caveat',          style: 'Casual Hand',        group: 'Signature Scripts' },
  { id: 'Sacramento',      name: 'Sacramento',      style: 'Delicate Script',    group: 'Signature Scripts' },
  { id: 'Allura',          name: 'Allura',          style: 'Flourish',           group: 'Signature Scripts' },
  { id: 'Satisfy',         name: 'Satisfy',         style: 'Brush Pen',          group: 'Signature Scripts' },
  { id: 'Alex Brush',      name: 'Alex Brush',      style: 'Flowing Pen',        group: 'Signature Scripts' },
  { id: 'Pacifico',        name: 'Pacifico',        style: 'Bold Retro',         group: 'Signature Scripts' },
  { id: 'Marck Script',    name: 'Marck Script',    style: 'Signature Hand',     group: 'Signature Scripts' },
];

export const SIGNATURE_FONTS = AVAILABLE_FONTS;

const INK_COLORS = [
  { value: '#2C2C24', label: 'Deep Loam'   },
  { value: '#2c3e6a', label: 'Midnight Blue'},
  { value: '#4A3728', label: 'Dark Bark'   },
];

export const SignaturePadModal: React.FC<SignaturePadModalProps> = ({
  isOpen,
  onClose,
  onSelectSignature,
}) => {
  const [activeTab, setActiveTab]     = useState<'draw' | 'type' | 'upload' | 'saved'>('draw');
  const [typedText, setTypedText]     = useState('Your Name');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].id);
  const [penColor, setPenColor]       = useState(INK_COLORS[0].value);
  const [sigLabel, setSigLabel]       = useState('');
  const [isDefault, setIsDefault]     = useState(true);
  const [savedSigs, setSavedSigs]     = useState<SavedSignature[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigPadRef = useRef<any | null>(null);

  useEffect(() => {
    if (isOpen) setSavedSigs(getSavedSignatures());
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'draw' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio  = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width  = canvas.offsetWidth  * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(ratio, ratio);
      sigPadRef.current = new SignaturePad(canvas, {
        penColor,
        minWidth: 1.5,
        maxWidth: 3.5,
      });
    }
  }, [isOpen, activeTab, penColor]);

  if (!isOpen) return null;

  const generateTypedDataUrl = (text: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `600 88px '${selectedFont}', cursive`;
    ctx.fillStyle = penColor;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    return trimCanvas(canvas, 12);
  };

  const handleSaveAndSelect = () => {
    let dataUrl = ''; let label = 'Signature';
    if (activeTab === 'draw') {
      if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
        useToastStore.getState().showToast('Please draw a signature first', 'warning');
        return;
      }
      dataUrl = trimCanvas(canvasRef.current!, 8);
      label = sigLabel.trim() || 'Drawn Signature';
    } else if (activeTab === 'type') {
      if (!typedText.trim()) {
        useToastStore.getState().showToast('Please enter your name', 'warning');
        return;
      }
      dataUrl = generateTypedDataUrl(typedText);
      label = sigLabel.trim() || `Typed: ${typedText}`;
    }
    if (dataUrl) {
      saveSignature({ type: activeTab as any, dataUrl, label, isDefault });
      onSelectSignature(dataUrl, label);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawResult = event.target?.result as string;
      if (rawResult) {
        const cleanResult = await processUploadedSignature(rawResult);
        const label = sigLabel.trim() || 'Uploaded Signature';
        saveSignature({ type: 'upload', dataUrl: cleanResult, label, isDefault });
        onSelectSignature(cleanResult, label);
        onClose();
      }
    };
    reader.readAsDataURL(file);
  };

  const tabs = [
    { id: 'draw',   label: 'Draw',   icon: <PenTool style={{ height: 14, width: 14 }} /> },
    { id: 'type',   label: 'Type',   icon: <Type    style={{ height: 14, width: 14 }} /> },
    { id: 'upload', label: 'Upload', icon: <Upload  style={{ height: 14, width: 14 }} /> },
    ...(savedSigs.length > 0
      ? [{ id: 'saved', label: `Saved (${savedSigs.length})`, icon: <Check style={{ height: 14, width: 14 }} /> }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      style={{ background: 'rgba(44,44,36,0.50)', backdropFilter: 'blur(10px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="card-organic animate-slideUp w-full sm:max-w-lg overflow-hidden"
        style={{
          borderRadius: '2.5rem 2.5rem 0 0',
          /* On sm+: full organic round */
          ...(window.innerWidth >= 640 ? { borderRadius: '2.5rem' } : {}),
        }}
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
              <PenTool style={{ height: 16, width: 16, color: 'var(--moss)' }} />
            </div>
            <h3 className="font-display font-bold text-lg" style={{ color: 'var(--fg)' }}>
              Create Signature
            </h3>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{ background: 'var(--bg-stone)', color: 'var(--fg-muted)' }}
            aria-label="Close"
          >
            <X style={{ height: 15, width: 15 }} />
          </button>
        </div>

        {/* Tab Bar — pill segment */}
        <div
          className="flex gap-1 p-2 mx-4 mt-4 rounded-full"
          style={{ background: 'var(--bg-stone)' }}
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all duration-200"
              style={{
                background: activeTab === tab.id ? 'var(--moss)' : 'transparent',
                color: activeTab === tab.id ? '#F3F4F1' : 'var(--fg-muted)',
                boxShadow: activeTab === tab.id ? '0 4px 12px rgba(93,112,82,0.25)' : 'none',
              }}
            >
              {tab.icon}
              <span className="hidden xs:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-5 space-y-4">

          {/* ── Draw ─────────────────────────────────────── */}
          {activeTab === 'draw' && (
            <div className="space-y-3">
              {/* Canvas well */}
              <div
                className="relative rounded-[1.5rem] overflow-hidden"
                style={{
                  height: 180,
                  background: 'rgba(255,255,255,0.65)',
                  border: '2px dashed rgba(93,112,82,0.30)',
                  boxShadow: 'inset 0 2px 12px rgba(44,44,36,0.06)',
                }}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full touch-none cursor-crosshair"
                  style={{ background: 'transparent' }}
                />
                <button
                  onClick={() => sigPadRef.current?.clear()}
                  className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-200 hover:scale-105"
                  style={{
                    background: 'rgba(253,252,248,0.85)',
                    color: 'var(--fg-muted)',
                    border: '1px solid var(--border)',
                  }}
                  aria-label="Clear signature"
                >
                  <RotateCcw style={{ height: 11, width: 11 }} />
                  <span>Clear</span>
                </button>
              </div>

              {/* Ink color swatches */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Ink color</span>
                <div className="flex gap-2.5">
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setPenColor(c.value)}
                      title={c.label}
                      className="h-7 w-7 rounded-full transition-all duration-200 hover:scale-110"
                      style={{
                        backgroundColor: c.value,
                        outline: penColor === c.value ? `3px solid var(--moss)` : '3px solid transparent',
                        outlineOffset: 2,
                      }}
                      aria-label={c.label}
                      aria-pressed={penColor === c.value}
                    />
                  ))}
                </div>
              </div>

              {/* Signature Name Input */}
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                  Signature Name <span className="font-normal opacity-70">(optional)</span>
                </label>
                <input
                  type="text"
                  value={sigLabel}
                  onChange={(e) => setSigLabel(e.target.value)}
                  className="input-organic h-9 text-xs"
                  placeholder="e.g. My Formal Signature, Initial…"
                />
              </div>
            </div>
          )}

          {/* ── Type ─────────────────────────────────────── */}
          {activeTab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2" style={{ color: 'var(--fg-muted)' }}>
                  Your Name
                </label>
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  className="input-organic"
                  placeholder="Full name…"
                />
              </div>

              {/* Custom Redesigned Font Dropdown */}
              <div>
                <Dropdown
                  label="Signature Font Style"
                  value={selectedFont}
                  onChange={(val) => setSelectedFont(String(val))}
                  options={AVAILABLE_FONTS.map((f) => ({
                    value: f.id,
                    label: f.name,
                    sublabel: f.style,
                    group: f.group,
                    fontFamily: f.id,
                  }))}
                />
              </div>

              {/* Preview card */}
              <div>
                <span className="block text-xs font-bold mb-2" style={{ color: 'var(--fg-muted)' }}>
                  Preview — {selectedFont}
                </span>
                <div
                  className="w-full p-5 rounded-[1.5rem] flex items-center justify-center overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.60)',
                    border: '2px solid rgba(93,112,82,0.20)',
                    boxShadow: 'inset 0 2px 10px rgba(44,44,36,0.05)',
                    minHeight: 100,
                  }}
                >
                  <span
                    className="text-center select-none"
                    style={{ fontFamily: selectedFont, color: penColor, fontSize: 44, lineHeight: 1.2 }}
                  >
                    {typedText || 'Your Name'}
                  </span>
                </div>
              </div>

              {/* Ink color row */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Ink color</span>
                <div className="flex gap-2.5">
                  {INK_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setPenColor(c.value)}
                      title={c.label}
                      className="h-7 w-7 rounded-full transition-all duration-200 hover:scale-110"
                      style={{
                        backgroundColor: c.value,
                        outline: penColor === c.value ? `3px solid var(--moss)` : '3px solid transparent',
                        outlineOffset: 2,
                      }}
                      aria-label={c.label}
                      aria-pressed={penColor === c.value}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Upload ───────────────────────────────────── */}
          {activeTab === 'upload' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
                  Signature Name <span className="font-normal opacity-70">(optional)</span>
                </label>
                <input
                  type="text"
                  value={sigLabel}
                  onChange={(e) => setSigLabel(e.target.value)}
                  className="input-organic h-9 text-xs"
                  placeholder="e.g. Uploaded Signature, Stamp…"
                />
              </div>

              <label
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-[1.5rem] cursor-pointer transition-all duration-300 hover:scale-[1.01]"
                style={{
                  background: 'rgba(255,255,255,0.60)',
                  border: '2px dashed rgba(93,112,82,0.35)',
                  boxShadow: 'inset 0 2px 10px rgba(44,44,36,0.05)',
                }}
              >
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--moss-dim)' }}
                >
                  <Upload style={{ height: 22, width: 22, color: 'var(--moss)' }} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold" style={{ color: 'var(--fg)' }}>Upload signature image</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                    PNG with transparent background works best
                  </p>
                </div>
                <span className="btn-ghost btn-sm">Browse File</span>
                <input type="file" accept="image/png,image/jpeg" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          )}

          {/* ── Saved ────────────────────────────────────── */}
          {activeTab === 'saved' && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {savedSigs.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onSelectSignature(s.dataUrl, s.label); onClose(); }}
                  className="card-organic w-full p-3 rounded-[1.5rem] flex items-center justify-between transition-all duration-300"
                >
                  <img src={s.dataUrl} alt={s.label} className="h-10 max-w-[200px] object-contain" />
                  <div className="text-right ml-3">
                    <span className="text-xs font-semibold block" style={{ color: 'var(--fg-muted)' }}>
                      {s.label}
                    </span>
                    {s.isDefault && <span className="badge-moss text-[10px] mt-0.5">Default</span>}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Save as default checkbox */}
          {activeTab !== 'saved' && activeTab !== 'upload' && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 rounded accent-[#5D7052]"
              />
              <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>
                Save as default for one-tap placement
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        {activeTab !== 'saved' && activeTab !== 'upload' && (
          <div
            className="px-5 pb-5 pt-0 flex items-center justify-end gap-3"
          >
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ color: 'var(--fg-muted)' }}
            >
              Cancel
            </button>
            <button onClick={handleSaveAndSelect} className="btn-primary">
              <Check style={{ height: 15, width: 15 }} />
              <span>Use Signature</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
