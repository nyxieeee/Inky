// Inky Inbox Service — Cloud-Powered (Supabase) + Local Offline-First Mode
import { InboxLink } from '../types';
import * as storage from '../lib/storage';
import { documentService } from './documentService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { uid } from '../utils';

export const inboxService = {
  async listLinks(): Promise<InboxLink[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('inbox_links')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          const links: InboxLink[] = data.map((d: any) => ({
            id: d.id,
            ownerId: d.user_id,
            token: d.token,
            title: d.title,
            note: d.note,
            expiresAt: d.expires_at,
            maxUses: d.max_uses,
            currentUses: d.current_uses,
            active: d.active,
            createdAt: d.created_at,
          }));
          return links;
        }
      } catch (e) {
        console.warn('Falling back to local links:', e);
      }
    }
    return storage.getLocalInboxLinks();
  },

  async createLink(payload: { title?: string; note?: string; expiresHours?: number; maxUses?: number }): Promise<InboxLink> {
    const token = uid() + uid();
    const now = new Date();
    const expiresHours = payload.expiresHours || 168;
    const expiresAt = new Date(now.getTime() + expiresHours * 3600 * 1000).toISOString();

    const newLink: InboxLink = {
      id: `link_${uid()}`,
      ownerId: 'local_user',
      token,
      title: payload.title || 'Send document for signature',
      note: payload.note || '',
      expiresAt,
      maxUses: payload.maxUses || 5,
      currentUses: 0,
      active: true,
      createdAt: now.toISOString(),
    };

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          newLink.ownerId = userData.user.id;
          await supabase.from('inbox_links').insert({
            id: newLink.id,
            user_id: userData.user.id,
            token: newLink.token,
            title: newLink.title,
            note: newLink.note,
            expires_at: newLink.expiresAt,
            max_uses: newLink.maxUses,
            current_uses: 0,
            active: true,
          });
        }
      } catch (e) {
        console.warn('Supabase link creation failed, saving locally:', e);
      }
    }

    storage.saveLocalInboxLink(newLink);
    return newLink;
  },

  async validateToken(token: string): Promise<{ valid: boolean; title?: string; note?: string; error?: string }> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('inbox_links')
          .select('title, note, expires_at, max_uses, current_uses, active')
          .eq('token', token)
          .single();

        if (!error && data) {
          if (!data.active) {
            return { valid: false, error: 'This upload link is no longer active.' };
          }
          if (data.expires_at && new Date(data.expires_at) < new Date()) {
            return { valid: false, error: 'This upload link has expired.' };
          }
          if (data.max_uses && data.current_uses >= data.max_uses) {
            return { valid: false, error: 'This upload link has reached its maximum submissions.' };
          }
          return { valid: true, title: data.title, note: data.note };
        }
      } catch (e) {
        console.warn('Supabase validate error, falling back to local check:', e);
      }
    }

    const links = storage.getLocalInboxLinks();
    const link = links.find((l) => l.token === token);
    if (!link) {
      return { valid: false, error: 'Invalid or expired upload link.' };
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return { valid: false, error: 'This upload link has expired.' };
    }
    if (link.maxUses && link.currentUses >= link.maxUses) {
      return { valid: false, error: 'This upload link has reached its maximum submissions.' };
    }
    return { valid: true, title: link.title, note: link.note };
  },

  async submitInbound(token: string, file: File, senderName: string, senderEmail: string, title?: string) {
    let cloudDocumentId: string | null = null;

    if (isSupabaseConfigured() && supabase) {
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `inbound/${token}_${Date.now()}.${fileExt}`;

        // 1. Upload to inbound bucket
        const { error: uploadError } = await supabase.storage
          .from('inbound')
          .upload(filePath, file, { contentType: file.type });

        if (!uploadError) {
          // 2. Fetch owner from link
          const { data: linkData } = await supabase
            .from('inbox_links')
            .select('id, user_id')
            .eq('token', token)
            .single();

          const docId = `doc_${uid()}`;
          const docTitle = title || `${file.name} (from ${senderName})`;

          // 3. Create document record
          await supabase.from('documents').insert({
            id: docId,
            user_id: linkData?.user_id,
            title: docTitle,
            original_file_name: file.name,
            file_path: filePath,
            status: 'pending',
            source: 'inbound',
            sender_name: senderName,
            sender_email: senderEmail,
            inbound_token: token,
          });

          // 4. Increment uses
          await supabase.rpc('increment_inbox_link_uses', { target_token: token });
          cloudDocumentId = docId;
        }
      } catch (e) {
        console.warn('Supabase cloud submission failed, saving to local fallback:', e);
      }
    }

    // Always mirror locally for immediate testing
    const doc = await documentService.upload(file, title || `${file.name} (from ${senderName})`);
    doc.source = 'inbound';
    doc.senderName = senderName;
    doc.senderEmail = senderEmail;
    storage.saveLocalDocumentMeta(doc);

    const links = storage.getLocalInboxLinks();
    const link = links.find((l) => l.token === token);
    if (link) {
      link.currentUses += 1;
      localStorage.setItem('inky_local_inbox_links', JSON.stringify(links));
    }

    return {
      message: 'Document submitted successfully!',
      documentId: cloudDocumentId || doc.id,
    };
  },
};
