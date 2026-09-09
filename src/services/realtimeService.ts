import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useDocumentStore } from '../store/useDocumentStore';
import { useToastStore } from '../store/useToastStore';
import { RealtimeChannel } from '@supabase/supabase-js';

let activeChannel: RealtimeChannel | null = null;

export const realtimeService = {
  /**
   * Subscribes to realtime changes across documents, signature fields,
   * recipients, and inbox links using Supabase postgres_changes.
   */
  subscribeToAll(): () => void {
    if (!isSupabaseConfigured() || !supabase) return () => {};

    // Remove existing channel if already connected
    if (activeChannel) {
      supabase.removeChannel(activeChannel);
      activeChannel = null;
    }

    const channelName = 'inky-realtime-global';
    const channel = supabase.channel(channelName);

    // ── 1. Listen to Documents Table (Inserts, Updates, Deletions) ──
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'documents' },
      async (payload: any) => {
        console.log('⚡ [Realtime] Document event:', payload.eventType, payload.new);

        // Always re-fetch documents list to stay synchronized
        useDocumentStore.getState().fetchDocuments();

        if (payload.eventType === 'INSERT') {
          const newDoc = payload.new;
          if (newDoc.source === 'inbound') {
            useToastStore.getState().showToast(
              `📥 Inbound document received: "${newDoc.title || 'Document'}" from ${newDoc.sender_name || 'Anonymous'}`,
              'info'
            );
          } else {
            useToastStore.getState().showToast(
              `📄 New document added: "${newDoc.title || 'Document'}"`,
              'info'
            );
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedDoc = payload.new;
          const currentSelected = useDocumentStore.getState().selectedDoc;

          // If currently viewing this document, live update its status and metadata
          if (currentSelected && currentSelected.id === updatedDoc.id) {
            useDocumentStore.setState({
              selectedDoc: {
                ...currentSelected,
                status: updatedDoc.status,
                updatedAt: updatedDoc.updated_at,
              },
            });
          }

          if (updatedDoc.status === 'completed') {
            useToastStore.getState().showToast(
              `🎉 "${updatedDoc.title || 'Document'}" has been completed by all signers!`,
              'success'
            );
          }
        }
      }
    );

    // ── 2. Listen to Signature Fields (Live Remote Signing) ──
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'signature_fields' },
      (payload: any) => {
        console.log('⚡ [Realtime] Field event:', payload.eventType, payload.new);
        const currentSelected = useDocumentStore.getState().selectedDoc;

        if (payload.eventType === 'UPDATE') {
          const updatedField = payload.new;
          if (currentSelected && currentSelected.id === updatedField.document_id) {
            const currentFields = useDocumentStore.getState().fields;
            const updated = currentFields.map((f) =>
              f.id === updatedField.id
                ? {
                    ...f,
                    value: updatedField.value,
                    fontFamily: updatedField.font_family || f.fontFamily,
                  }
                : f
            );
            useDocumentStore.setState({ fields: updated });
          }
        } else if (payload.eventType === 'INSERT') {
          const newField = payload.new;
          if (currentSelected && currentSelected.id === newField.document_id) {
            const currentFields = useDocumentStore.getState().fields;
            if (!currentFields.some((f) => f.id === newField.id)) {
              useDocumentStore.setState({
                fields: [
                  ...currentFields,
                  {
                    id: newField.id,
                    documentId: newField.document_id,
                    pageNumber: newField.page_number,
                    x: newField.x,
                    y: newField.y,
                    width: newField.width,
                    height: newField.height,
                    fieldType: newField.field_type,
                    value: newField.value,
                    fontFamily: newField.font_family,
                    required: newField.required ?? true,
                    signerId: newField.signer_id,
                    signerEmail: newField.signer_email,
                    signerOrder: newField.signer_order,
                  },
                ],
              });
            }
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedField = payload.old;
          if (currentSelected) {
            const currentFields = useDocumentStore.getState().fields;
            useDocumentStore.setState({
              fields: currentFields.filter((f) => f.id !== deletedField.id),
            });
          }
        }
      }
    );

    // ── 3. Listen to Document Recipients (Signer Completion alerts) ──
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'document_recipients' },
      (payload: any) => {
        console.log('⚡ [Realtime] Recipient event:', payload.eventType, payload.new);
        if (payload.eventType === 'UPDATE') {
          const rec = payload.new;
          if (rec.status === 'signed') {
            useToastStore.getState().showToast(
              `✍️ ${rec.name || rec.email} signed their portion!`,
              'success'
            );
          }
          useDocumentStore.getState().fetchDocuments();
        }
      }
    );

    // ── 4. Listen to Inbox Links (Link creation & submission counts) ──
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inbox_links' },
      (payload: any) => {
        console.log('⚡ [Realtime] Inbox link event:', payload.eventType, payload.new);
      }
    );

    // ── 5. Subscribe with Auto-Reconnect ──
    channel.subscribe((status) => {
      console.log(`⚡ Supabase Realtime connected: ${status}`);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setTimeout(() => {
          channel.subscribe();
        }, 3000);
      }
    });

    activeChannel = channel;

    return () => {
      if (activeChannel === channel) {
        activeChannel = null;
      }
      supabase?.removeChannel(channel);
    };
  },
};
