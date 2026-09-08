// Inky Signature Service (matching Worklane src/services pattern)
import { SavedSignature } from '../types';
import * as storage from '../lib/storage';

export const signatureService = {
  getSignatures(): SavedSignature[] {
    return storage.getSavedSignatures();
  },

  saveSignature(sig: Omit<SavedSignature, 'id' | 'createdAt'>): SavedSignature {
    return storage.saveSignature(sig);
  },

  deleteSignature(id: string): void {
    storage.deleteSavedSignature(id);
  },

  setDefaultSignature(id: string): void {
    storage.setDefaultSignature(id);
  },
};
