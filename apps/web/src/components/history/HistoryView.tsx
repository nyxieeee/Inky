import React, { useState } from 'react';
import {
  History,
  FileCheck,
  Search,
  ExternalLink,
  Trash2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Document } from '@esign/shared';

interface HistoryViewProps {
  documents: Document[];
  onSelectDocument?: (doc: Document) => void;
  onDeleteDocument: (id: string) => void;
  onGoToQueue: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  documents,
  onDeleteDocument,
  onGoToQueue,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const signedDocs = documents.filter((d) => d.status === 'completed');

  const filteredDocs = signedDocs.filter((d) => {
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.originalFileName.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12 w-full max-w-4xl mx-auto">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display font-bold text-2xl" style={{ color: 'var(--fg)' }}>
              Document History
            </h2>
            <span
              className="px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap shrink-0"
              style={{ background: 'var(--moss-dim)', color: 'var(--moss)' }}
            >
              {signedDocs.length} signed
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--fg-muted)' }}>
            All exported documents with flattened signatures and audit verification
          </p>
        </div>

        {/* Search Input */}
        {signedDocs.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ height: 15, width: 15, color: 'var(--fg-muted)' }}
            />
            <input
              type="search"
              placeholder="Search history…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-organic pl-10 h-10 text-sm w-full"
              aria-label="Search signed documents"
            />
          </div>
        )}
      </div>

      {/* ── Document List ────────────────────────────────────── */}
      <div className="space-y-3">
        {filteredDocs.length === 0 ? (
          <div className="card-organic rounded-[2.5rem] px-5 py-12 sm:p-16 text-center flex flex-col items-center justify-center space-y-5 w-full">
            {/* Ambient icon badge */}
            <div className="relative inline-block mx-auto">
              <div
                className="absolute inset-0 rounded-full blur-2xl"
                style={{ background: 'var(--moss-dim)', transform: 'scale(1.8)' }}
                aria-hidden
              />
              <div
                className="relative h-16 w-16 rounded-3xl flex items-center justify-center mx-auto"
                style={{ background: 'var(--moss-dim)' }}
              >
                <History style={{ height: 28, width: 28, color: 'var(--moss)' }} />
              </div>
            </div>

            <div className="w-full text-center">
              <h3 className="font-display font-bold text-xl" style={{ color: 'var(--fg)' }}>
                {signedDocs.length === 0 ? 'No Signed Documents Yet' : 'No Matches Found'}
              </h3>
              <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: 'var(--fg-muted)' }}>
                {signedDocs.length === 0
                  ? 'Once you sign and export documents, they will be archived here for instant viewing and downloading.'
                  : 'Try searching with a different keyword.'}
              </p>
            </div>

            {signedDocs.length === 0 && (
              <button onClick={onGoToQueue} className="btn-primary mx-auto">
                <span>Go to Queue</span>
                <ArrowRight style={{ height: 15, width: 15 }} />
              </button>
            )}
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="card-organic rounded-[2rem] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 group"
            >
              {/* Left: icon + metadata */}
              <div className="flex items-center gap-4 min-w-0">
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-105"
                  style={{ background: 'var(--moss-dim)' }}
                >
                  <FileCheck style={{ height: 22, width: 22, color: 'var(--moss)' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-bold text-base truncate" style={{ color: 'var(--fg)' }}>
                      {doc.title}
                    </h4>
                    <span className="badge-moss flex items-center gap-1">
                      <ShieldCheck style={{ height: 12, width: 12 }} />
                      <span>Signed</span>
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--fg-muted)' }}>
                    {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                    {' · '}
                    {new Date(doc.updatedAt || doc.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {/* View signed PDF */}
                <a
                  href={`/api/documents/${doc.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost btn-sm"
                  aria-label="Open signed document"
                  title="View PDF in new tab"
                >
                  <ExternalLink style={{ height: 15, width: 15 }} />
                  <span>View</span>
                </a>

                {/* Delete document */}
                <button
                  onClick={() => {
                    if (confirm('Permanently delete this signed document from history?')) {
                      onDeleteDocument(doc.id);
                    }
                  }}
                  className="p-2 rounded-xl transition-all duration-200 hover:scale-110"
                  style={{ color: 'var(--fg-muted)' }}
                  aria-label="Delete document"
                  title="Delete from history"
                >
                  <Trash2 style={{ height: 16, width: 16 }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
