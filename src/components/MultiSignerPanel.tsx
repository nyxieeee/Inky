import React, { useState } from 'react';
import { X, Send, UserPlus, Trash2, Users, CheckCircle2, Mail, Share2, Copy, Check, ExternalLink, CloudOff, Info } from 'lucide-react';
import { deliveryService } from '../services/deliveryService';
import { useToastStore } from '../store/useToastStore';
import { isSupabaseConfigured } from '../lib/supabase';

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
  const [copiedIdx, setCopiedIdx]   = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSend = async () => {
    const valid = recipients.filter((r) => r.email.trim() && r.name.trim());
    if (!valid.length) { 
        useToastStore.getState().showToast('Add at least one recipient with name and email.', 'warning');
        return; 
    }
    setIsLoading(true);
    try {
      await deliveryService.setRecipients(documentId, valid);
      const res = await deliveryService.sendDocument(documentId);
      setSentResult(res);
      useToastStore.getState().showToast('Document sent to recipients', 'success');
      onSuccess();
    } catch (err: any) {
      useToastStore.getState().showToast(err.message || 'Failed to send document', 'error');
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
                  Signing Links Ready!
                </h4>
                <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>
                  Click <strong>Send with Gmail</strong> or copy the link below to deliver the invitation.
                </p>
              </div>

              {!isSupabaseConfigured() && (
                <div
                  className="p-3 rounded-2xl text-[11px] text-left flex items-start gap-2"
                  style={{ background: 'rgba(217, 158, 75, 0.12)', border: '1px solid rgba(217, 158, 75, 0.3)', color: '#8C5E1A' }}
                >
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    <strong>Offline / Local Mode:</strong> Because cloud sync (Supabase) is not configured, this link works in this browser. To send documents across different devices/phones, add your Supabase project keys to Vercel Environment Variables.
                  </span>
                </div>
              )}
              <div className="space-y-3 text-left max-h-60 overflow-y-auto pr-1">
                {sentResult.recipients?.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-[1.25rem] text-xs space-y-2.5"
                    style={{ background: 'var(--bg-stone)', border: '1px solid var(--border-light)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: 'var(--terracotta)', color: '#fff' }}
                        >
                          {i + 1}
                        </span>
                        <span className="font-bold" style={{ color: 'var(--fg)' }}>
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                        {item.email}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {/* 1. Web Gmail Direct (No OS popup) */}
                      <a
                        href={item.gmailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-full text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all duration-200 hover:scale-[1.02]"
                        style={{
                          background: 'var(--terracotta)',
                          color: '#fff',
                        }}
                        title="Open composed email directly in Gmail (Web)"
                      >
                        <Mail style={{ height: 13, width: 13 }} />
                        <span>Send with Gmail</span>
                      </a>

                      {/* 2. Default Desktop Mail Client (mailto:) */}
                      <a
                        href={item.mailtoUrl}
                        className="p-2 rounded-full transition-all duration-200 hover:scale-110"
                        style={{
                          background: 'var(--bg-paper)',
                          color: 'var(--fg-muted)',
                          border: '1px solid var(--border-light)',
                        }}
                        title="Open in default desktop Mail app (Outlook / Apple Mail)"
                        aria-label="Open in default desktop Mail app"
                      >
                        <ExternalLink style={{ height: 13, width: 13 }} />
                      </a>

                      {/* 3. Device Share (WhatsApp/Slack/Messages) */}
                      {typeof navigator !== 'undefined' && !!navigator.share && (
                        <button
                          onClick={() => {
                            deliveryService.shareViaDevice(
                              'Signature Request',
                              `Hi ${item.name}, please sign this document on Inky:`,
                              item.signingUrl
                            );
                          }}
                          className="p-2 rounded-full transition-all duration-200 hover:scale-110"
                          style={{
                            background: 'var(--clay-dim)',
                            color: 'var(--terracotta)',
                            border: '1px solid rgba(193,140,93,0.25)',
                          }}
                          title="Share via device (WhatsApp, Slack, Messages)"
                          aria-label="Share via device"
                        >
                          <Share2 style={{ height: 13, width: 13 }} />
                        </button>
                      )}

                      {/* 3. Copy Link */}
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(item.signingUrl);
                          setCopiedIdx(i);
                          useToastStore.getState().showToast(`Copied signing link for ${item.name}`, 'success');
                          setTimeout(() => setCopiedIdx(null), 2500);
                        }}
                        className="p-2 rounded-full transition-all duration-200 hover:scale-110"
                        style={{
                          background: copiedIdx === i ? 'var(--moss-dim)' : 'var(--bg-paper)',
                          color: copiedIdx === i ? 'var(--moss)' : 'var(--fg-muted)',
                          border: '1px solid var(--border-light)',
                        }}
                        title="Copy signing link"
                        aria-label="Copy signing link"
                      >
                        {copiedIdx === i ? (
                          <Check style={{ height: 14, width: 14 }} />
                        ) : (
                          <Copy style={{ height: 14, width: 14 }} />
                        )}
                      </button>
                    </div>
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
