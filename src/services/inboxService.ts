// Inky Inbox Service (matching Worklane src/services pattern)
import { InboxLink } from '../types';
import * as api from '../lib/api';

export const inboxService = {
  async listLinks(): Promise<InboxLink[]> {
    return api.fetchInboxLinks();
  },

  async createLink(payload: { title?: string; note?: string; expiresHours?: number; maxUses?: number }): Promise<InboxLink> {
    return api.createInboxLink(payload);
  },

  async validateToken(token: string) {
    return api.validateInboxToken(token);
  },

  async submitInbound(token: string, file: File, senderName: string, senderEmail: string, title?: string) {
    return api.submitInboundDocument(token, file, senderName, senderEmail, title);
  },
};
