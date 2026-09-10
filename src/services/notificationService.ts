// Inky Notification Service — Sender's Inbox for Signed Documents
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uid } from '../utils';

export interface SignedNotification {
  id: string;
  documentId: string;
  recipientId: string;
  ownerUserId: string;
  signerName: string;
  signerEmail: string;
  docTitle: string;
  allComplete: boolean;
  read: boolean;
  createdAt: string;
}

export const notificationService = {
  /**
   * Inserts a signed_notification for the document owner.
   * Called by deliveryService after a recipient finishes signing.
   * Uses anon-level insert (allowed by RLS for the signing portal).
   */
  async insertSignedNotification(params: {
    documentId: string;
    recipientId: string;
    ownerUserId: string;
    signerName: string;
    signerEmail: string;
    docTitle: string;
    allComplete: boolean;
  }): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('signed_notifications').insert({
        id: `notif_${uid()}`,
        document_id: params.documentId,
        recipient_id: params.recipientId,
        owner_user_id: params.ownerUserId,
        signer_name: params.signerName,
        signer_email: params.signerEmail,
        doc_title: params.docTitle,
        all_complete: params.allComplete,
        read: false,
      });
    } catch (err) {
      console.warn('Failed to insert signed_notification:', err);
    }
  },

  /**
   * Lists all signed_notifications for the currently authenticated user,
   * newest first.
   */
  async listNotifications(): Promise<SignedNotification[]> {
    if (!isSupabaseConfigured() || !supabase) return [];
    try {
      const { data, error } = await supabase
        .from('signed_notifications')
        .select('*')
        .order('created_at', { ascending: false });
      if (error || !data) return [];
      return data.map((d: any) => ({
        id: d.id,
        documentId: d.document_id,
        recipientId: d.recipient_id,
        ownerUserId: d.owner_user_id,
        signerName: d.signer_name,
        signerEmail: d.signer_email,
        docTitle: d.doc_title,
        allComplete: d.all_complete,
        read: d.read,
        createdAt: d.created_at,
      }));
    } catch (err) {
      console.warn('Failed to list notifications:', err);
      return [];
    }
  },

  /**
   * Marks a notification as read.
   */
  async markRead(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('signed_notifications').update({ read: true }).eq('id', id);
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  },

  /**
   * Marks all notifications as read.
   */
  async markAllRead(): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return;
    try {
      await supabase.from('signed_notifications').update({ read: true }).eq('read', false);
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err);
    }
  },
};
