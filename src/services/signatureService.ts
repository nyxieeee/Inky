// Inky Signature Service — Cloud-Synced (Supabase) + Local Storage
import { SavedSignature } from '../types';
import * as storage from '../lib/storage';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const signatureService = {
  getSignatures(): SavedSignature[] {
    return storage.getSavedSignatures();
  },

  async loadFromCloud(): Promise<SavedSignature[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('saved_signatures')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const list: SavedSignature[] = data.map((d: any) => ({
            id: d.id,
            label: d.label,
            type: d.type,
            dataUrl: d.data_url,
            isDefault: d.is_default,
            createdAt: d.created_at,
          }));
          localStorage.setItem('inky_signatures', JSON.stringify(list));
          return list;
        }
      } catch (e) {
        console.warn('Supabase signatures load error:', e);
      }
    }
    return storage.getSavedSignatures();
  },

  saveSignature(sig: Omit<SavedSignature, 'id' | 'createdAt'>): SavedSignature {
    const saved = storage.saveSignature(sig);

    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          supabase!.from('saved_signatures').insert({
            id: saved.id,
            user_id: data.user.id,
            label: saved.label,
            type: saved.type,
            data_url: saved.dataUrl,
            is_default: saved.isDefault,
          }).then();
        }
      });
    }

    return saved;
  },

  deleteSignature(id: string): void {
    storage.deleteSavedSignature(id);

    if (isSupabaseConfigured() && supabase) {
      supabase.from('saved_signatures').delete().eq('id', id).then();
    }
  },

  setDefaultSignature(id: string): void {
    storage.setDefaultSignature(id);

    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          supabase!.from('saved_signatures').update({ is_default: false }).eq('user_id', data.user.id).then(() => {
            supabase!.from('saved_signatures').update({ is_default: true }).eq('id', id).then();
          });
        }
      });
    }
  },

  renameSignature(id: string, label: string): void {
    storage.updateSavedSignatureLabel(id, label);

    if (isSupabaseConfigured() && supabase) {
      supabase.from('saved_signatures').update({ label }).eq('id', id).then();
    }
  },
};
