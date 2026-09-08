// Inky Document Service — Cloud-Synced (Supabase) + Local Offline-First Mode
import { Document, SignatureField, Recipient } from '../types';
import * as storage from '../lib/storage';
import { getPdfInfo, flattenPdfSignatures } from '../lib/pdf';
import { downloadBlob, uid } from '../utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// In-memory cache for active blob URLs so they can be rendered in <canvas> / pdf.js
const blobUrlCache = new Map<string, string>();

export const documentService = {
  async listDocuments(params?: { status?: string; source?: string; search?: string }): Promise<Document[]> {
    let docs = storage.getLocalDocuments();

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const cloudDocs: Document[] = data.map((d: any) => ({
            id: d.id,
            ownerId: d.user_id,
            title: d.title,
            status: d.status,
            source: d.source,
            filePath: d.file_path,
            originalFileName: d.original_file_name || d.title,
            pageCount: d.page_count,
            senderName: d.sender_name,
            senderEmail: d.sender_email,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));

          const mergedMap = new Map<string, Document>();
          docs.forEach((d) => mergedMap.set(d.id, d));
          cloudDocs.forEach((d) => mergedMap.set(d.id, { ...mergedMap.get(d.id), ...d }));
          docs = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        }
      } catch (e) {
        console.warn('Falling back to local documents:', e);
      }
    }

    if (params?.status) {
      docs = docs.filter((d) => d.status === params.status);
    }
    if (params?.source) {
      docs = docs.filter((d) => d.source === params.source);
    }
    if (params?.search) {
      const q = params.search.toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q) || d.originalFileName.toLowerCase().includes(q));
    }

    return docs;
  },

  async upload(file: File, title?: string): Promise<Document> {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const { pageCount } = await getPdfInfo(bytes);

    const docId = `doc_${uid()}`;
    await storage.storePdfBytes(docId, bytes);

    const blob = new Blob([bytes as any], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(docId, blobUrl);

    const now = new Date().toISOString();
    const doc: Document = {
      id: docId,
      ownerId: 'local_user',
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      status: 'draft',
      source: 'uploaded',
      filePath: blobUrl,
      originalFileName: file.name,
      fileSizeBytes: file.size,
      pageCount,
      createdAt: now,
      updatedAt: now,
    };

    storage.saveLocalDocumentMeta(doc);

    // Sync to Supabase if authenticated
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getUser().then(async ({ data: userData }) => {
        if (userData?.user) {
          doc.ownerId = userData.user.id;
          storage.saveLocalDocumentMeta(doc);
          const cloudPath = `${userData.user.id}/${docId}.pdf`;
          await supabase!.storage.from('documents').upload(cloudPath, file);
          await supabase!.from('documents').insert({
            id: docId,
            user_id: userData.user.id,
            title: doc.title,
            original_file_name: doc.originalFileName,
            file_path: cloudPath,
            page_count: doc.pageCount,
            status: 'draft',
            source: 'uploaded',
          });
        }
      }).catch(console.warn);
    }

    return doc;
  },

  async getDetails(id: string): Promise<Document & { fields: SignatureField[]; recipients: Recipient[] }> {
    const docs = storage.getLocalDocuments();
    const doc = docs.find((d) => d.id === id);
    if (!doc) throw new Error('Document not found');

    let blobUrl = blobUrlCache.get(id);
    if (!blobUrl) {
      let bytes = await storage.getPdfBytes(id);

      // If bytes not in IndexedDB but file exists in Supabase Storage, download it!
      if (!bytes && isSupabaseConfigured() && supabase && doc.filePath && !doc.filePath.startsWith('blob:')) {
        try {
          const bucket = doc.source === 'inbound' ? 'inbound' : 'documents';
          const { data: fileBlob, error: downloadError } = await supabase.storage.from(bucket).download(doc.filePath);
          if (!downloadError && fileBlob) {
            const arrayBuffer = await fileBlob.arrayBuffer();
            bytes = new Uint8Array(arrayBuffer);
            await storage.storePdfBytes(id, bytes);
          }
        } catch (e) {
          console.warn('Failed to download PDF from Supabase storage:', e);
        }
      }

      if (bytes) {
        const blob = new Blob([bytes as any], { type: 'application/pdf' });
        blobUrl = URL.createObjectURL(blob);
        blobUrlCache.set(id, blobUrl);
      } else {
        blobUrl = doc.filePath;
      }
    }

    const fields = storage.getLocalDocumentFields(id);
    const recipients = storage.getLocalDocumentRecipients(id);

    return {
      ...doc,
      filePath: blobUrl,
      fields,
      recipients,
    };
  },

  async saveFields(id: string, fields: SignatureField[]): Promise<void> {
    storage.saveLocalDocumentFields(id, fields);

    if (isSupabaseConfigured() && supabase) {
      (async () => {
        try {
          await supabase.from('signature_fields').delete().eq('document_id', id);
          if (fields.length > 0) {
            const rows = fields.map((f) => ({
              id: f.id,
              document_id: id,
              page_number: f.pageNumber,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              field_type: f.fieldType,
              value: f.value,
              font_family: f.fontFamily,
              required: f.required,
            }));
            await supabase.from('signature_fields').insert(rows);
          }
        } catch (err) {
          console.warn('Supabase fields save error:', err);
        }
      })();
    }
  },

  async signAndFlatten(
    id: string,
    options?: { signerEmail?: string; signerName?: string; addAuditPage?: boolean }
  ) {
    const bytes = await storage.getPdfBytes(id);
    if (!bytes) throw new Error('PDF file data not found in local storage');

    const fields = storage.getLocalDocumentFields(id);
    const signedBytes = await flattenPdfSignatures(bytes, fields, options);

    // Save signed bytes separately WITHOUT overwriting the original base PDF
    await storage.storeSignedPdfBytes(id, signedBytes);

    // Create download blob for signed document
    const signedBlob = new Blob([signedBytes as any], { type: 'application/pdf' });

    // Update document status
    const docs = storage.getLocalDocuments();
    const doc = docs.find((d) => d.id === id);
    if (doc) {
      doc.status = 'completed';
      doc.updatedAt = new Date().toISOString();
      storage.saveLocalDocumentMeta(doc);
    }

    // Automatically trigger download of signed PDF
    const filename = `${(doc?.title || 'signed_document').replace(/\s+/g, '_')}_signed.pdf`;
    downloadBlob(signedBlob, filename);

    // Sync signed PDF to Supabase Storage if authenticated
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getUser().then(async ({ data: userData }) => {
        if (userData?.user) {
          const signedPath = `${userData.user.id}/${id}_signed.pdf`;
          const signedFile = new File([signedBytes as any], filename, { type: 'application/pdf' });
          await supabase!.storage.from('documents').upload(signedPath, signedFile, { upsert: true });
          await supabase!.from('documents').update({
            status: 'completed',
            signed_file_path: signedPath,
            updated_at: new Date().toISOString(),
          }).eq('id', id);
        }
      }).catch(console.warn);
    }

    return {
      message: 'Document signed and flattened successfully!',
      documentId: id,
      status: 'completed',
      auditHash: uid(),
    };
  },

  async delete(id: string): Promise<void> {
    const existingBlob = blobUrlCache.get(id);
    if (existingBlob) {
      URL.revokeObjectURL(existingBlob);
      blobUrlCache.delete(id);
    }
    await storage.deleteLocalDocumentRecord(id);

    if (isSupabaseConfigured() && supabase) {
      supabase.from('documents').delete().eq('id', id).then();
    }
  },
};
