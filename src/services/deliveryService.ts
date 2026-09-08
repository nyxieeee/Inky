// Inky Delivery Service — Local-First + Supabase Multi-Signer Workflow
import { Recipient, Document, SignatureField } from '../types';
import * as storage from '../lib/storage';
import { uid } from '../utils';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface DispatchedRecipient extends Recipient {
  signingUrl: string;
  mailtoUrl: string;
}

export const deliveryService = {
  getRecipients(docId: string): Recipient[] {
    return storage.getLocalDocumentRecipients(docId);
  },

  async setRecipients(docId: string, recipients: { email: string; name: string; signingOrder?: number }[]): Promise<Recipient[]> {
    const list: Recipient[] = recipients.map((r, idx) => ({
      id: `rec_${uid()}`,
      documentId: docId,
      email: r.email.trim(),
      name: r.name.trim(),
      signingOrder: r.signingOrder || idx + 1,
      status: 'pending',
      token: `ink_sign_${uid()}_${Math.random().toString(36).substring(2, 10)}`,
    }));

    storage.saveLocalDocumentRecipients(docId, list);

    // If Supabase is configured, sync to cloud
    if (isSupabaseConfigured() && supabase) {
      try {
        const rows = list.map((r) => ({
          id: r.id,
          document_id: r.documentId,
          email: r.email,
          name: r.name,
          signing_order: r.signingOrder,
          status: r.status,
          token: r.token,
        }));
        await supabase.from('document_recipients').upsert(rows);
      } catch (e) {
        console.warn('Supabase recipient sync notice (using local storage):', e);
      }
    }

    return list;
  },

  async sendDocument(docId: string): Promise<{ message: string; recipients: DispatchedRecipient[] }> {
    const rawRecipients = storage.getLocalDocumentRecipients(docId);
    const docs = storage.getLocalDocuments();
    const doc = docs.find((d) => d.id === docId);
    
    if (doc) {
      doc.status = 'sent';
      doc.updatedAt = new Date().toISOString();
      storage.saveLocalDocumentMeta(doc);

      if (isSupabaseConfigured() && supabase) {
        try {
          await supabase.from('documents').update({ status: 'sent', updated_at: doc.updatedAt }).eq('id', docId);
        } catch (e) {
          console.warn('Supabase document status update notice:', e);
        }
      }
    }

    const docTitle = doc?.title || 'Document';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';

    const dispatched: DispatchedRecipient[] = rawRecipients.map((r) => {
      const signingUrl = `${origin}/sign/${r.token}`;
      const subject = encodeURIComponent(`Signature requested: ${docTitle}`);
      const body = encodeURIComponent(
        `Hello ${r.name},\n\nYou have been invited to review and sign "${docTitle}".\n\nPlease click your secure personal signing link below:\n${signingUrl}\n\n— Sent via Inky`
      );
      const mailtoUrl = `mailto:${r.email}?subject=${subject}&body=${body}`;

      return {
        ...r,
        signingUrl,
        mailtoUrl,
      };
    });

    return {
      message: `Document dispatched to ${dispatched.length} recipient${dispatched.length > 1 ? 's' : ''}`,
      recipients: dispatched,
    };
  },

  buildMailtoUrl(recipient: Recipient, docTitle: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const signingUrl = `${origin}/sign/${recipient.token}`;
    const subject = encodeURIComponent(`Signature requested: ${docTitle}`);
    const body = encodeURIComponent(
      `Hello ${recipient.name},\n\nYou have been invited to review and sign "${docTitle}".\n\nPlease click your secure personal signing link below:\n${signingUrl}\n\n— Sent via Inky`
    );
    return `mailto:${recipient.email}?subject=${subject}&body=${body}`;
  },

  async shareViaDevice(title: string, text: string, url: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch (err: any) {
        if (err.name === 'AbortError') return false;
      }
    }
    // Fallback: Copy to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
    return false;
  },

  async getSignerContext(token: string): Promise<{
    recipient: Recipient;
    document: Document;
    fields: SignatureField[];
    pdfBlob: Blob | null;
  } | null> {
    // 1. Try local storage first
    const docs = storage.getLocalDocuments();
    for (const doc of docs) {
      const recipients = storage.getLocalDocumentRecipients(doc.id);
      const rec = recipients.find((r) => r.token === token);
      if (rec) {
        const fields = storage.getLocalDocumentFields(doc.id);
        const pdfBlob = await storage.getLocalPdfBlob(doc.id);
        return { recipient: rec, document: doc, fields, pdfBlob };
      }
    }

    // 2. Try Supabase if configured
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: recData, error: recErr } = await supabase
          .from('document_recipients')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (recData && !recErr) {
          const rec: Recipient = {
            id: recData.id,
            documentId: recData.document_id,
            email: recData.email,
            name: recData.name,
            signingOrder: recData.signing_order,
            status: recData.status,
            signedAt: recData.signed_at,
            token: recData.token,
          };

          const { data: docData } = await supabase
            .from('documents')
            .select('*')
            .eq('id', rec.documentId)
            .maybeSingle();

          if (docData) {
            const document: Document = {
              id: docData.id,
              ownerId: docData.user_id,
              title: docData.title,
              status: docData.status,
              source: docData.source,
              filePath: docData.file_path,
              originalFileName: docData.original_file_name,
              pageCount: docData.page_count,
              createdAt: docData.created_at,
              updatedAt: docData.updated_at,
            };

            const { data: fieldsData } = await supabase
              .from('signature_fields')
              .select('*')
              .eq('document_id', rec.documentId);

            const fields: SignatureField[] = (fieldsData || []).map((f) => ({
              id: f.id,
              documentId: f.document_id,
              pageNumber: f.page_number,
              x: f.x,
              y: f.y,
              width: f.width,
              height: f.height,
              fieldType: f.field_type,
              value: f.value,
              fontFamily: f.font_family,
              required: f.required ?? true,
              signerId: f.signer_id,
              signerEmail: f.signer_email,
              signerOrder: f.signer_order,
            }));

            // Download PDF from storage bucket
            let pdfBlob: Blob | null = null;
            if (docData.file_path) {
              const { data: fileBlob } = await supabase.storage.from('documents').download(docData.file_path);
              pdfBlob = fileBlob;
            }

            return { recipient: rec, document, fields, pdfBlob };
          }
        }
      } catch (err) {
        console.error('Failed to get signer context from Supabase', err);
      }
    }

    return null;
  },

  async submitSignerFields(
    token: string,
    fieldUpdates: { fieldId: string; value: string; fontFamily?: string }[]
  ): Promise<{ success: boolean; message: string; allComplete: boolean }> {
    const ctx = await this.getSignerContext(token);
    if (!ctx) throw new Error('Invalid signing session');

    const { recipient, document, fields } = ctx;

    // Update field values
    const updatedFields = fields.map((f) => {
      const up = fieldUpdates.find((u) => u.fieldId === f.id);
      if (up) {
        return { ...f, value: up.value, fontFamily: up.fontFamily || f.fontFamily };
      }
      return f;
    });
    storage.saveLocalDocumentFields(document.id, updatedFields);

    // Update recipient status
    const allRecipients = storage.getLocalDocumentRecipients(document.id);
    const now = new Date().toISOString();
    const updatedRecipients = allRecipients.map((r) =>
      r.token === token ? { ...r, status: 'signed' as const, signedAt: now } : r
    );
    storage.saveLocalDocumentRecipients(document.id, updatedRecipients);

    const allComplete = updatedRecipients.every((r) => r.status === 'signed');
    const newDocStatus = allComplete ? 'completed' : 'partially_signed';

    document.status = newDocStatus;
    document.updatedAt = now;
    storage.saveLocalDocumentMeta(document);

    // Cloud sync
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase
          .from('document_recipients')
          .update({ status: 'signed', signed_at: now })
          .eq('token', token);

        for (const up of fieldUpdates) {
          await supabase
            .from('signature_fields')
            .update({ value: up.value, font_family: up.fontFamily })
            .eq('id', up.fieldId);
        }

        await supabase
          .from('documents')
          .update({ status: newDocStatus, updated_at: now })
          .eq('id', document.id);
      } catch (err) {
        console.warn('Supabase sync notice during signing submission:', err);
      }
    }

    return {
      success: true,
      message: allComplete ? 'Document successfully completed by all signers!' : 'Your signature has been recorded!',
      allComplete,
    };
  },
};

