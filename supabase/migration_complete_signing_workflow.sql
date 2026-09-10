-- ==============================================================================
-- Inky: Master Migration — End-to-End Signing Workflow & Realtime Sync
-- Run this complete script in Supabase Dashboard → SQL Editor → New Query
-- ==============================================================================

-- ── 1. Document Status & Source Enum Fixes ─────────────────────────────────────
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'pending', 'sent', 'partially_signed', 'completed'));

ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_source_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_source_check
  CHECK (source IN ('uploaded', 'inbound', 'ai'));

-- ── 2. Signature Fields Columns ───────────────────────────────────────────────
ALTER TABLE public.signature_fields
  ADD COLUMN IF NOT EXISTS signer_id TEXT,
  ADD COLUMN IF NOT EXISTS signer_email TEXT,
  ADD COLUMN IF NOT EXISTS signer_order INTEGER,
  ADD COLUMN IF NOT EXISTS signer_name TEXT;

-- ── 3. Signed Notifications Table (Sender's Inbox for Returned Docs) ──────────
CREATE TABLE IF NOT EXISTS public.signed_notifications (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES public.documents(id) ON DELETE CASCADE,
  recipient_id TEXT,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  signer_name TEXT,
  signer_email TEXT,
  doc_title TEXT NOT NULL,
  all_complete BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.signed_notifications ENABLE ROW LEVEL SECURITY;

-- ── 4. RLS for signed_notifications ──────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can do all on signed_notifications" ON public.signed_notifications;
CREATE POLICY "Owner can do all on signed_notifications"
  ON public.signed_notifications
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Anon can insert signed_notifications" ON public.signed_notifications;
CREATE POLICY "Anon can insert signed_notifications"
  ON public.signed_notifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated signers can insert signed_notifications" ON public.signed_notifications;
CREATE POLICY "Authenticated signers can insert signed_notifications"
  ON public.signed_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── 5. RLS for document_recipients (Receiver Inbox & Signer Access) ───────────
ALTER TABLE public.document_recipients ENABLE ROW LEVEL SECURITY;

-- Document owner full access
DROP POLICY IF EXISTS "Owner can do all on document_recipients" ON public.document_recipients;
CREATE POLICY "Owner can do all on document_recipients"
  ON public.document_recipients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_recipients.document_id
        AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_recipients.document_id
        AND d.user_id = auth.uid()
    )
  );

-- Authenticated recipient can view their incoming signing requests by email
DROP POLICY IF EXISTS "Recipient can view incoming requests by email" ON public.document_recipients;
CREATE POLICY "Recipient can view incoming requests by email"
  ON public.document_recipients
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt() ->> 'email')
  );

-- Authenticated recipient can update their signing status
DROP POLICY IF EXISTS "Recipient can update signing status by email or token" ON public.document_recipients;
CREATE POLICY "Recipient can update signing status by email or token"
  ON public.document_recipients
  FOR UPDATE
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt() ->> 'email') OR token IS NOT NULL
  )
  WITH CHECK (
    lower(email) = lower(auth.jwt() ->> 'email') OR token IS NOT NULL
  );

-- Public / Anonymous signer access by token
DROP POLICY IF EXISTS "Public can view and update their recipient record with valid token" ON public.document_recipients;
CREATE POLICY "Public can view and update their recipient record with valid token"
  ON public.document_recipients
  FOR ALL
  TO anon
  USING (token IS NOT NULL)
  WITH CHECK (token IS NOT NULL);

-- ── 6. RLS for documents (Authenticated & Anonymous Recipient View/Update) ────
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Authenticated recipient can view document if they are a recipient or the owner
DROP POLICY IF EXISTS "Recipients can view document as authenticated" ON public.documents;
CREATE POLICY "Recipients can view document as authenticated"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  );

-- Authenticated recipient can update document status upon completion
DROP POLICY IF EXISTS "Recipients can update document status as authenticated" ON public.documents;
CREATE POLICY "Recipients can update document status as authenticated"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  );

-- Anonymous signers can view document
DROP POLICY IF EXISTS "Recipients can view document" ON public.documents;
CREATE POLICY "Recipients can view document"
  ON public.documents
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
    )
  );

-- Anonymous signers can update document status upon completion
DROP POLICY IF EXISTS "Recipients can update document status" ON public.documents;
CREATE POLICY "Recipients can update document status"
  ON public.documents
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
    )
  );

-- ── 7. RLS for signature_fields (Authenticated & Anonymous Recipient Access) ──
ALTER TABLE public.signature_fields ENABLE ROW LEVEL SECURITY;

-- Authenticated recipient can view fields
DROP POLICY IF EXISTS "Recipients can view signature_fields as authenticated" ON public.signature_fields;
CREATE POLICY "Recipients can view signature_fields as authenticated"
  ON public.signature_fields
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  );

-- Authenticated recipient can update signature fields with their signatures
DROP POLICY IF EXISTS "Recipients can update signature_fields as authenticated" ON public.signature_fields;
CREATE POLICY "Recipients can update signature_fields as authenticated"
  ON public.signature_fields
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  );

-- Authenticated recipient can insert dynamically placed signature fields
DROP POLICY IF EXISTS "Recipients can insert signature_fields as authenticated" ON public.signature_fields;
CREATE POLICY "Recipients can insert signature_fields as authenticated"
  ON public.signature_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
        AND (lower(r.email) = lower(auth.jwt() ->> 'email') OR r.token IS NOT NULL)
    )
  );

-- Anonymous signers can view signature fields
DROP POLICY IF EXISTS "Recipients can view signature_fields" ON public.signature_fields;
CREATE POLICY "Recipients can view signature_fields"
  ON public.signature_fields
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
    )
  );

-- Anonymous signers can update signature fields
DROP POLICY IF EXISTS "Recipients can update signature_fields" ON public.signature_fields;
CREATE POLICY "Recipients can update signature_fields"
  ON public.signature_fields
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
    )
  );

-- Anonymous signers can insert signature fields
DROP POLICY IF EXISTS "Recipients can insert signature_fields" ON public.signature_fields;
CREATE POLICY "Recipients can insert signature_fields"
  ON public.signature_fields
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
    )
  );

-- ── 8. Storage Policies for PDF Viewing/Downloading ───────────────────────────
DROP POLICY IF EXISTS "Authenticated users can download document PDFs" ON storage.objects;
CREATE POLICY "Authenticated users can download document PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Signers can download document PDFs" ON storage.objects;
CREATE POLICY "Signers can download document PDFs"
  ON storage.objects
  FOR SELECT
  TO anon
  USING (bucket_id = 'documents');

-- ── 9. Supabase Realtime Publication ──────────────────────────────────────────
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.signature_fields;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.document_recipients;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.signed_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_links;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Replica identity FULL ensures complete updated rows are passed to client
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.signature_fields REPLICA IDENTITY FULL;
ALTER TABLE public.document_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.signed_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_links REPLICA IDENTITY FULL;

SELECT 'Master signing workflow migration executed successfully!' AS status;
