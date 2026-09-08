export type DocumentStatus = 'draft' | 'pending' | 'partially_signed' | 'completed' | 'sent';

export type DocumentSource = 'uploaded' | 'inbound' | 'ai';

export type FieldType = 'signature' | 'initials' | 'date' | 'name' | 'text';

export type RecipientStatus = 'pending' | 'viewed' | 'signed' | 'declined';

export interface Document {
  id: string;
  ownerId: string;
  title: string;
  status: DocumentStatus;
  source: DocumentSource;
  filePath: string;
  originalFileName: string;
  fileSizeBytes: number;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
  inboxLinkId?: string;
  auditHash?: string;
}

export interface SignatureField {
  id: string;
  documentId: string;
  pageNumber: number;
  x: number; // percentage 0-100 or normalized points
  y: number;
  width: number;
  height: number;
  fieldType: FieldType;
  value?: string; // image data URL or text
  signerId?: string;
  signerEmail?: string;
  required: boolean;
}

export interface Recipient {
  id: string;
  documentId: string;
  email: string;
  name: string;
  signingOrder: number;
  status: RecipientStatus;
  signedAt?: string;
  token: string;
}

export interface InboxLink {
  id: string;
  ownerId: string;
  token: string;
  title?: string;
  note?: string;
  expiresAt?: string;
  maxUses?: number;
  currentUses: number;
  active: boolean;
  createdAt: string;
}

export interface SavedSignature {
  id: string;
  type: 'draw' | 'type' | 'upload';
  dataUrl: string;
  label: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  documentId: string;
  action: string;
  performerEmail: string;
  performerIp: string;
  timestamp: string;
  details?: string;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  documentType: string;
  fieldLayout: Omit<SignatureField, 'id' | 'documentId'>[];
  createdAt: string;
}

export interface UsageHistory {
  id: string;
  documentType: string;
  recipientEmail: string;
  fieldLayout: string;
  createdAt: string;
}
