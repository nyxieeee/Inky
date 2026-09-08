import React, { useState } from 'react';
import { X, Send, UserPlus, Trash2, Users, CheckCircle2 } from 'lucide-react';
import { addDocumentRecipients, sendDocumentToRecipients } from '../lib/apiClient';

interface MultiSignerPanelProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MultiSignerPanel: React.FC<MultiSignerPanelProps> = ({
  documentId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [recipients, setRecipients] = useState([{ email: '', name: '', signingOrder: 1 }]);
  const [isLoading, setIsLoading]   = useState(false);
  const [sentResult, setSentResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    const valid = recipients.filter((r) => r.email.trim() && r.name.trim());
    if (!valid.length) { alert('Add at least one recipient with name and email.'); return; }
    setIsLoading(true);
    try {
      await addDocumentRecipients(documentId, valid);
      const res = await sendDocumentToRecipients(documentId);
      setSentResult(res);
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to send document');
    } finally {
      setIsLoading(false);
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
              style={{ background: 'var(--clay-dim)' }}
            >
              <Users style={{ height: 16, width: 16, color: 'var(--terracotta)' }} />
            </div>
            <h3 className="font-display font-bold text-lg" style={{ color: 'var(--fg)' }}>
              Send to Signers
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

        {/* Body */}
        <div className="p-5 space-y-4">
          {!sentResult ? (
            <>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                Add recipients in signing order. Each person receives a unique, secure signing link.
              </p>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {recipients.map((r, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-[1.5rem] space-y-3"
                    style={{
                      background: 'var(--bg-stone)',
                      border: '1px solid var(--border-light)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: 'var(--terracotta)', color: '#fff' }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-xs font-bold" style={{ color: 'var(--fg-muted)' }}>
                          Signer
                        </span>
                      </div>
                      {recipients.length > 1 && (
                        <button
                          onClick={() => setRecipients((p) => p.filter((_, idx) => idx !== i))}
                          className="p-1 rounded-lg transition-all hover:scale-110"
                          style={{ color: '#A85448' }}
                          aria-label="Remove signer"
                        >
                          <Trash2 style={{ height: 14, width: 14 }} />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Full Name"
                        value={r.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecipients((p) => p.map((item, idx) => idx === i ? { ...item, name: v } : item));
                        }}
                        className="input-organic h-10 text-xs"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={r.email}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecipients((p) => p.map((item, idx) => idx === i ? { ...item, email: v } : item));
                        }}
                        className="input-organic h-10 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setRecipients((p) => [...p, { email: '', name: '', signingOrder: p.length + 1 }])}
                className="w-full py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: 'var(--clay-dim)',
                  color: 'var(--terracotta)',
                  border: '1px solid rgba(193,140,93,0.25)',
                }}
              >
                <UserPlus style={{ height: 14, width: 14 }} />
                <span>Add Another Signer</span>
              </button>
            </>
          ) : (
            <div className="text-center py-4 space-y-4 animate-fadeIn">
              <div
                className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: 'var(--moss-dim)' }}
              >
                <CheckCircle2 style={{ height: 28, width: 28, color: 'var(--moss)' }} />
              </div>
              <div>
                <h4 className="font-display font-bold text-lg" style={{ color: 'var(--fg)' }}>
                  Document Dispatched!
                </h4>
                <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
                  Unique signing links sent to each recipient.
                </p>
              </div>
              <div className="space-y-2 text-left max-h-40 overflow-y-auto">
                {sentResult.recipients?.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="p-3 rounded-[1.25rem] text-xs"
                    style={{ background: 'var(--bg-stone)', border: '1px solid var(--border-light)' }}
                  >
                    <span className="font-bold block" style={{ color: 'var(--fg)' }}>
                      {item.name} · {item.email}
                    </span>
                    <span
                      className="font-mono text-[10px] block truncate mt-0.5"
                      style={{ color: 'var(--fg-muted)' }}
                    >
                      {window.location.origin}{item.signingLink}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 pb-5 pt-1 flex items-center justify-end gap-3"
        >
          {!sentResult ? (
            <>
              <button
                onClick={onClose}
                className="btn-ghost"
                style={{ color: 'var(--fg-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="btn-secondary"
              >
                {isLoading
                  ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  : <Send style={{ height: 14, width: 14 }} />
                }
                <span>Send Out</span>
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn-primary">Done</button>
          )}
        </div>
      </div>
    </div>
  );
};
