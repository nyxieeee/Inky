import React, { useState } from 'react';
import { X, Inbox, Copy, Check, Link } from 'lucide-react';
import { createInboxLink } from '../../lib/apiClient';
import { InboxLink } from '../../types';

interface ShareInboxModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareInboxModal: React.FC<ShareInboxModalProps> = ({ isOpen, onClose }) => {
  const [title, setTitle]             = useState('Send document for my signature');
  const [note, setNote]               = useState('Please upload the contract or agreement here.');
  const [expiresHours, setExpiresHours] = useState(168);
  const [maxUses, setMaxUses]         = useState(5);
  const [generatedLink, setGeneratedLink] = useState<InboxLink | null>(null);
  const [copied, setCopied]           = useState(false);
  const [isLoading, setIsLoading]     = useState(false);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const link = await createInboxLink({ title, note, expiresHours, maxUses });
      setGeneratedLink(link);
    } catch (err: any) {
      alert(err.message || 'Failed to create link');
    } finally {
      setIsLoading(false);
    }
  };

  const fullUrl = generatedLink
    ? `${window.location.origin}/inbox-submit/${generatedLink.token}`
    : '';

  const handleCopy = () => {
    if (fullUrl) {
      navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
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
              style={{ background: 'var(--moss-dim)' }}
            >
              <Inbox style={{ height: 16, width: 16, color: 'var(--moss)' }} />
            </div>
            <h3 className="font-display font-bold text-lg" style={{ color: 'var(--fg)' }}>
              Shareable Inbox Link
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

        <div className="p-6 space-y-4">
          {!generatedLink ? (
            <>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                Create a secure, single-use or multi-use link for someone to upload a PDF directly into your signing queue — no account needed.
              </p>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg)' }}>
                  Request Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input-organic"
                  placeholder="e.g. Send contract for signing"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg)' }}>
                  Note for Sender
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="textarea-organic"
                  placeholder="Instructions shown to the uploader…"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg)' }}>
                    Expiration
                  </label>
                  <select
                    value={expiresHours}
                    onChange={(e) => setExpiresHours(Number(e.target.value))}
                    className="select-organic"
                  >
                    <option value={24}>24 Hours</option>
                    <option value={72}>3 Days</option>
                    <option value={168}>7 Days</option>
                    <option value={720}>30 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5" style={{ color: 'var(--fg)' }}>
                    Max Submissions
                  </label>
                  <select
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="select-organic"
                  >
                    <option value={1}>1 Use</option>
                    <option value={5}>5 Uses</option>
                    <option value={20}>20 Uses</option>
                  </select>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Success banner */}
              <div
                className="p-4 rounded-[1.5rem] flex items-start gap-3"
                style={{ background: 'var(--moss-dim)', border: '1px solid rgba(93,112,82,0.22)' }}
              >
                <Check style={{ height: 18, width: 18, color: 'var(--moss)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--moss)' }}>Link Ready</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                    Share with the sender — they can upload without an account.
                  </p>
                </div>
              </div>

              {/* URL display */}
              <div
                className="p-4 rounded-[1.5rem] space-y-2"
                style={{ background: 'var(--bg-stone)', border: '1px solid var(--border-light)' }}
              >
                <span
                  className="text-[10px] font-bold uppercase tracking-wider block"
                  style={{ color: 'var(--fg-subtle)' }}
                >
                  Shareable URL
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-mono select-all truncate"
                    style={{ color: 'var(--fg)' }}
                  >
                    {fullUrl}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="btn-primary btn-sm shrink-0"
                    aria-label="Copy link"
                  >
                    {copied ? <Check style={{ height: 13, width: 13 }} /> : <Copy style={{ height: 13, width: 13 }} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-0 flex items-center justify-end gap-3">
          {!generatedLink ? (
            <>
              <button
                onClick={onClose}
                className="btn-ghost"
                style={{ color: 'var(--fg-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading
                  ? <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  : <Link style={{ height: 14, width: 14 }} />
                }
                <span>Generate Link</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => { setGeneratedLink(null); onClose(); }}
              className="btn-primary"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
