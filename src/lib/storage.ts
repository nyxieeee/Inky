import { SavedSignature } from '../types';

const SIGNATURES_KEY = 'esign_saved_signatures';
const DEFAULT_SIG_KEY = 'esign_default_signature_id';

export function getSavedSignatures(): SavedSignature[] {
  try {
    const raw = localStorage.getItem(SIGNATURES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse saved signatures:', e);
    return [];
  }
}

export function saveSignature(sig: Omit<SavedSignature, 'id' | 'createdAt'>): SavedSignature {
  const existing = getSavedSignatures();
  const newSig: SavedSignature = {
    ...sig,
    id: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  // If this signature is marked default or is the first one, reset default flags
  if (sig.isDefault || existing.length === 0) {
    existing.forEach((s) => (s.isDefault = false));
    newSig.isDefault = true;
    localStorage.setItem(DEFAULT_SIG_KEY, newSig.id);
  }

  const updated = [newSig, ...existing];
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(updated));
  return newSig;
}

export function deleteSavedSignature(id: string): SavedSignature[] {
  const existing = getSavedSignatures().filter((s) => s.id !== id);
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(existing));
  return existing;
}

export function getDefaultSignature(): SavedSignature | null {
  const signatures = getSavedSignatures();
  if (signatures.length === 0) return null;
  const defaultId = localStorage.getItem(DEFAULT_SIG_KEY);
  return signatures.find((s) => s.id === defaultId || s.isDefault) || signatures[0];
}

export function setDefaultSignature(id: string): SavedSignature[] {
  const signatures = getSavedSignatures();
  signatures.forEach((s) => {
    s.isDefault = s.id === id;
  });
  localStorage.setItem(DEFAULT_SIG_KEY, id);
  localStorage.setItem(SIGNATURES_KEY, JSON.stringify(signatures));
  return signatures;
}
