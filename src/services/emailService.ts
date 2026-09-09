import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface SendSigningEmailParams {
  to: string;
  recipientName?: string;
  docTitle: string;
  signingUrl: string;
  senderName?: string;
  customMessage?: string;
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
          to: params.to,
          recipientName: params.recipientName,
          docTitle: params.docTitle,
          signingUrl: params.signingUrl,
          senderName: params.senderName,
          customMessage: params.customMessage,
        },
      });

      if (error) {
        // FunctionsHttpError or network error
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
};
