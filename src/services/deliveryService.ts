// Inky Delivery Service (matching Worklane src/services pattern)
import { Recipient } from '../types';
import * as api from '../lib/api';

export const deliveryService = {
  async setRecipients(docId: string, recipients: { email: string; name: string; signingOrder?: number }[]): Promise<Recipient[]> {
    return api.addDocumentRecipients(docId, recipients);
  },

  async sendDocument(docId: string): Promise<{ message: string; recipients: any[] }> {
    return api.sendDocumentToRecipients(docId);
  },
};
