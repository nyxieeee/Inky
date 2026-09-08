// Inky Document Service (matching Worklane src/services pattern)
import { Document, SignatureField, Recipient } from '../types';
import * as api from '../lib/api';

export const documentService = {
  async listDocuments(params?: { status?: string; source?: string; search?: string }): Promise<Document[]> {
    return api.fetchDocuments(params);
  },

  async upload(file: File, title?: string): Promise<Document> {
    return api.uploadDocumentFile(file, title);
  },

  async getDetails(id: string): Promise<Document & { fields: SignatureField[]; recipients: Recipient[] }> {
    return api.getDocumentDetails(id);
  },

  async saveFields(id: string, fields: SignatureField[]): Promise<void> {
    await api.saveDocumentFields(id, fields);
  },

  async signAndFlatten(
    id: string,
    options?: { signerEmail?: string; signerName?: string; addAuditPage?: boolean }
  ) {
    return api.signAndFlattenDocument(id, options);
  },

  async delete(id: string): Promise<void> {
    await api.deleteDocument(id);
  },
};
