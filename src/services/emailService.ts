import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SendSigningEmailParams {
  to: string;
  recipientName?: string;
  docTitle: string;
  signingUrl: string;
  senderName?: string;
  customMessage?: string;
}

export interface SendCompletionEmailParams {
  to: string;
  senderName?: string;
  signerName: string;
  signerEmail: string;
  docTitle: string;
  allComplete: boolean;
  appUrl?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export const emailService = {
  /**
   * Invokes the Supabase Edge Function 'send-email' to deliver
   * an automated invitation directly through Gmail SMTP.
   */
  async sendSigningInvitation(params: SendSigningEmailParams): Promise<EmailDispatchResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: 'Cloud sync not configured — cannot send automated email in offline mode.',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'invitation',
          to: params.to,
          recipientName: params.recipientName,
          docTitle: params.docTitle,
          signingUrl: params.signingUrl,
          senderName: params.senderName,
          customMessage: params.customMessage,
        },
      });

      if (error) {
        const errMsg = error.message || 'Failed to invoke email edge function';
        console.warn('Edge function error:', error);
        return { success: false, error: errMsg };
      }

      if (data && data.success === false) {
        return { success: false, error: data.error || 'SMTP delivery failed' };
      }

      return {
        success: true,
        messageId: data?.messageId,
      };
    } catch (err: any) {
      console.error('Failed to send signing invitation email:', err);
      return {
        success: false,
        error: err.message || 'Unexpected error while dispatching email',
      };
    }
  },

  /**
   * Sends a "document signed" completion notification email to the original sender.
   * Invoked after a recipient finishes signing via the SignerPortal.
   */
  async sendSignedCompletionNotification(params: SendCompletionEmailParams): Promise<EmailDispatchResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: 'Cloud sync not configured — cannot send completion email in offline mode.',
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'completion',
          to: params.to,
          senderName: params.senderName,
          signerName: params.signerName,
          signerEmail: params.signerEmail,
          docTitle: params.docTitle,
          allComplete: params.allComplete,
          appUrl: params.appUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
        },
      });

      if (error) {
        const errMsg = error.message || 'Failed to invoke completion email edge function';
        console.warn('Edge function error (completion):', error);
        return { success: false, error: errMsg };
      }

      if (data && data.success === false) {
        return { success: false, error: data.error || 'SMTP delivery failed (completion)' };
      }

      return {
        success: true,
        messageId: data?.messageId,
      };
    } catch (err: any) {
      console.error('Failed to send completion notification email:', err);
      return {
        success: false,
        error: err.message || 'Unexpected error while dispatching completion email',
      };
    }
  },
};
