import { Document, SignatureField, Recipient, InboxLink } from '@esign/shared';

const API_BASE = '/api';

export async function fetchDocuments(params?: { status?: string; source?: string; search?: string }): Promise<Document[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.source) query.append('source', params.source);
  if (params?.search) query.append('search', params.search);

  const res = await fetch(`${API_BASE}/documents?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export async function uploadDocumentFile(file: File, title?: string): Promise<Document> {
  const formData = new FormData();
  formData.append('file', file);
  if (title) formData.append('title', title);

  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(errorData.error || 'Failed to upload document');
  }

  return res.json();
}

export async function getDocumentDetails(id: string): Promise<Document & { fields: SignatureField[]; recipients: Recipient[] }> {
  const res = await fetch(`${API_BASE}/documents/${id}`);
  if (!res.ok) throw new Error('Failed to fetch document details');
  return res.json();
}

export async function saveDocumentFields(id: string, fields: SignatureField[]): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/documents/${id}/fields`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error('Failed to save document fields');
  return res.json();
}

export async function signAndFlattenDocument(
  id: string,
  options?: { signerEmail?: string; signerName?: string; addAuditPage?: boolean }
): Promise<{ message: string; documentId: string; status: string; auditHash: string }> {
  const res = await fetch(`${API_BASE}/documents/${id}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Signing failed' }));
    throw new Error(err.error || 'Failed to sign document');
  }
  return res.json();
}

export async function deleteDocument(id: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/documents/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete document');
  return res.json();
}

export async function createInboxLink(payload: { title?: string; note?: string; expiresHours?: number; maxUses?: number }): Promise<InboxLink> {
  const res = await fetch(`${API_BASE}/inbox/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create inbox link');
  return res.json();
}

export async function fetchInboxLinks(): Promise<InboxLink[]> {
  const res = await fetch(`${API_BASE}/inbox/links`);
  if (!res.ok) throw new Error('Failed to fetch inbox links');
  return res.json();
}

export async function validateInboxToken(token: string): Promise<{ valid: boolean; title?: string; note?: string; error?: string }> {
  const res = await fetch(`${API_BASE}/inbox/validate/${token}`);
  return res.json();
}

export async function submitInboundDocument(token: string, file: File, senderName: string, senderEmail: string, title?: string): Promise<{ message: string; documentId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('senderName', senderName);
  formData.append('senderEmail', senderEmail);
  if (title) formData.append('title', title);

  const res = await fetch(`${API_BASE}/inbox/upload/${token}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Failed to submit document');
  }

  return res.json();
}

export async function addDocumentRecipients(docId: string, recipients: { email: string; name: string; signingOrder?: number }[]): Promise<Recipient[]> {
  const res = await fetch(`${API_BASE}/documents/${docId}/recipients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients }),
  });
  if (!res.ok) throw new Error('Failed to set recipients');
  return res.json();
}

export async function sendDocumentToRecipients(docId: string): Promise<{ message: string; recipients: any[] }> {
  const res = await fetch(`${API_BASE}/documents/${docId}/send`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Send failed' }));
    throw new Error(err.error || 'Failed to send document');
  }
  return res.json();
}
