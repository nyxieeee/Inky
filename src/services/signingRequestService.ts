// Inky Signing Request Service — Recipient Inbox for Incoming Documents to Sign
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as storage from '../lib/storage';

export interface PendingSigningRequest {
  id: string; // recipient row id
  documentId: string;
  documentTitle: string;
  senderName?: string;
  senderEmail?: string;
  recipientName: string;
  recipientEmail: string;
  signingOrder?: number;
  status: 'pending' | 'viewed' | 'signed' | 'declined';
  token: string;
  signedAt?: string;
  createdAt: string;
}

export const signingRequestService = {
  /**
   * Fetches all document signing requests where the recipient email matches the user's email.
   * Checks Supabase cloud database first, with fallback to local storage.
   */
  async listRequestsForUser(userEmail: string): Promise<PendingSigningRequest[]> {
    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail) return [];

    // 1. Check Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: recData, error: recErr } = await supabase
          .from('document_recipients')
          .select(`
            id,
            document_id,
            email,
            name,
            signing_order,
            status,
            token,
            signed_at,
            created_at,
            documents (
              id,
              title,
              sender_name,
              sender_email,
              user_id,
              created_at
            )
          `)
          .ilike('email', cleanEmail)
          .order('created_at', { ascending: false });

        if (!recErr && recData) {
          const results: PendingSigningRequest[] = recData.map((row: any) => {
            const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents;
            return {
              id: row.id,
              documentId: row.document_id,
              documentTitle: doc?.title || 'Document',
              senderName: doc?.sender_name || 'Document Owner',
              senderEmail: doc?.sender_email,
              recipientName: row.name,
              recipientEmail: row.email,
              signingOrder: row.signing_order,
              status: row.status,
              token: row.token,
              signedAt: row.signed_at,
              createdAt: row.created_at,
            };
          });

          return results;
        }

        // Fallback if join didn't work (e.g. schema foreign key constraint differences)
        const { data: simpleRecs, error: simpleErr } = await supabase
          .from('document_recipients')
          .select('*')
          .ilike('email', cleanEmail)
          .order('created_at', { ascending: false });

        if (!simpleErr && simpleRecs && simpleRecs.length > 0) {
          const docIds = Array.from(new Set(simpleRecs.map((r: any) => r.document_id)));
          const { data: docs } = await supabase
            .from('documents')
            .select('id, title, sender_name, sender_email, created_at')
            .in('id', docIds);

          const docMap = new Map((docs || []).map((d: any) => [d.id, d]));

          return simpleRecs.map((row: any) => {
            const doc: any = docMap.get(row.document_id);
            return {
              id: row.id,
              documentId: row.document_id,
              documentTitle: doc?.title || 'Document',
              senderName: doc?.sender_name || 'Document Owner',
              senderEmail: doc?.sender_email,
              recipientName: row.name,
              recipientEmail: row.email,
              signingOrder: row.signing_order,
              status: row.status,
              token: row.token,
              signedAt: row.signed_at,
              createdAt: row.created_at,
            };
          });
        }
      } catch (err) {
        console.warn('Supabase signing requests fetch notice:', err);
      }
    }

    // 2. Local offline fallback
    try {
      const localDocs = storage.getLocalDocuments();
      const results: PendingSigningRequest[] = [];

      for (const doc of localDocs) {
        const recipients = storage.getLocalDocumentRecipients(doc.id);
        const match = recipients.find((r) => r.email.toLowerCase() === cleanEmail);
        if (match) {
          results.push({
            id: match.id,
            documentId: doc.id,
            documentTitle: doc.title,
            senderName: doc.senderName || 'Document Owner',
            senderEmail: doc.senderEmail,
            recipientName: match.name,
            recipientEmail: match.email,
            signingOrder: match.signingOrder,
            status: match.status,
            token: match.token,
            signedAt: match.signedAt,
            createdAt: doc.createdAt,
          });
        }
      }

      return results;
    } catch {
      return [];
    }
  },
};
