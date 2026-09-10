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
   * Checks Supabase cloud database first, merges with local offline fallback, and filters
   * out any dismissed/deleted signing requests permanently.
   */
  async listRequestsForUser(userEmail: string): Promise<PendingSigningRequest[]> {
    const cleanEmail = userEmail.trim().toLowerCase();
    if (!cleanEmail) return [];

    const dismissedIds = new Set(storage.getDismissedSigningRequestIds(cleanEmail));
    const resultsMap = new Map<string, PendingSigningRequest>();

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

        if (!recErr && recData && recData.length > 0) {
          for (const row of recData) {
            const doc = Array.isArray(row.documents) ? row.documents[0] : row.documents;
            const reqId = row.id;
            const reqToken = row.token;
            const docId = row.document_id;

            // Filter out permanently dismissed requests
            if (
              dismissedIds.has(reqId) ||
              (reqToken && dismissedIds.has(reqToken)) ||
              (docId && dismissedIds.has(docId))
            ) {
              continue;
            }

            resultsMap.set(reqId, {
              id: reqId,
              documentId: docId,
              documentTitle: doc?.title || 'Document',
              senderName: doc?.sender_name || 'Document Owner',
              senderEmail: doc?.sender_email,
              recipientName: row.name,
              recipientEmail: row.email,
              signingOrder: row.signing_order,
              status: row.status,
              token: reqToken,
              signedAt: row.signed_at,
              createdAt: row.created_at,
            });
          }
        } else {
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

            for (const row of simpleRecs) {
              const reqId = row.id;
              const reqToken = row.token;
              const docId = row.document_id;

              if (
                dismissedIds.has(reqId) ||
                (reqToken && dismissedIds.has(reqToken)) ||
                (docId && dismissedIds.has(docId))
              ) {
                continue;
              }

              const doc: any = docMap.get(docId);
              resultsMap.set(reqId, {
                id: reqId,
                documentId: docId,
                documentTitle: doc?.title || 'Document',
                senderName: doc?.sender_name || 'Document Owner',
                senderEmail: doc?.sender_email,
                recipientName: row.name,
                recipientEmail: row.email,
                signingOrder: row.signing_order,
                status: row.status,
                token: reqToken,
                signedAt: row.signed_at,
                createdAt: row.created_at,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Supabase signing requests fetch notice:', err);
      }
    }

    // 2. Local offline fallback and local cache merge
    try {
      const localDocs = storage.getLocalDocuments();
      for (const doc of localDocs) {
        const recipients = storage.getLocalDocumentRecipients(doc.id);
        const matches = recipients.filter((r) => r.email.toLowerCase() === cleanEmail);

        for (const match of matches) {
          const reqId = match.id;
          const reqToken = match.token;
          const docId = doc.id;

          // Filter out permanently dismissed requests
          if (
            dismissedIds.has(reqId) ||
            (reqToken && dismissedIds.has(reqToken)) ||
            (docId && dismissedIds.has(docId))
          ) {
            continue;
          }

          if (!resultsMap.has(reqId)) {
            resultsMap.set(reqId, {
              id: reqId,
              documentId: docId,
              documentTitle: doc.title,
              senderName: doc.senderName || 'Document Owner',
              senderEmail: doc.senderEmail,
              recipientName: match.name,
              recipientEmail: match.email,
              signingOrder: match.signingOrder,
              status: match.status,
              token: reqToken,
              signedAt: match.signedAt,
              createdAt: doc.createdAt,
            });
          }
        }
      }
    } catch (e) {
      console.warn('Error reading local signing requests:', e);
    }

    return Array.from(resultsMap.values());
  },

  /**
   * Deletes a signing request from the recipient's inbox permanently.
   * Tracks dismissed IDs in local storage tombstones so they never return on refresh,
   * purges local recipient records across all stores, and cleans up from Supabase.
   */
  async deleteRequest(id: string, documentId?: string, userEmail?: string, token?: string): Promise<void> {
    // 1. Permanently record as dismissed tombstone in local storage
    storage.addDismissedSigningRequestId(id, userEmail, token, documentId);

    // 2. Purge from Supabase if configured and permitted
    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('document_recipients').delete().eq('id', id);
        if (error) {
          console.warn('Supabase recipient delete error:', error);
        }
        if (token) {
          await supabase.from('document_recipients').delete().eq('token', token);
        }
      } catch (err) {
        console.warn('Error deleting signing request from Supabase:', err);
      }
    }

    // 3. Purge recipient across all local storage stores
    storage.purgeLocalRecipient(id, token, documentId);

    // 4. If the document in local storage was purely an incoming/signing copy, clean it up
    try {
      if (documentId) {
        const remainingRecipients = storage.getLocalDocumentRecipients(documentId);
        if (remainingRecipients.length === 0) {
          const localDocs = storage.getLocalDocuments();
          const doc = localDocs.find((d) => d.id === documentId);
          if (doc && (doc.source === 'inbound' || (userEmail && doc.senderEmail?.toLowerCase() !== userEmail.toLowerCase()))) {
            await storage.deleteLocalDocumentRecord(documentId);
          }
        }
      }
    } catch (e) {
      console.warn('Error cleaning up local document record:', e);
    }
  },
};
