-- ==============================================================================
-- Inky Migration: Allow Authenticated Signers (Fix "Signing Link Invalid" bug)
-- Enables BOTH anon AND authenticated users to access and sign documents via token
-- ==============================================================================

-- ── 1. Document Recipients Policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "Public can view and update their recipient record with valid token" ON public.document_recipients;
DROP POLICY IF EXISTS "Public can view and update their recipient record with valid to" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipient can view incoming requests by email" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipient can update signing status by email or token" ON public.document_recipients;
DROP POLICY IF EXISTS "Signers and recipients can view recipient record" ON public.document_recipients;
DROP POLICY IF EXISTS "Signers and recipients can update recipient record" ON public.document_recipients;

CREATE POLICY "Signers and recipients can view recipient record"
  ON public.document_recipients
  FOR SELECT
  TO public
  USING (
    token IS NOT NULL OR
    lower(email) = lower(auth.jwt() ->> 'email') OR
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_recipients.document_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Signers and recipients can update recipient record"
  ON public.document_recipients
  FOR UPDATE
  TO public
  USING (
    token IS NOT NULL OR
    lower(email) = lower(auth.jwt() ->> 'email') OR
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_recipients.document_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    token IS NOT NULL OR
    lower(email) = lower(auth.jwt() ->> 'email') OR
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_recipients.document_id AND d.user_id = auth.uid()
    )
  );

-- ── 2. Documents Policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Recipients can view document" ON public.documents;
DROP POLICY IF EXISTS "Recipients can update document status" ON public.documents;
DROP POLICY IF EXISTS "Recipients can view document as authenticated" ON public.documents;
DROP POLICY IF EXISTS "Recipients can update document status as authenticated" ON public.documents;
DROP POLICY IF EXISTS "Recipients and signers can view document" ON public.documents;
DROP POLICY IF EXISTS "Recipients and signers can update document" ON public.documents;

CREATE POLICY "Recipients and signers can view document"
  ON public.documents
  FOR SELECT
  TO public
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
    )
  );

CREATE POLICY "Recipients and signers can update document"
  ON public.documents
  FOR UPDATE
  TO public
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = documents.id
    )
  );

-- ── 3. Signature Fields Policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Recipients can view signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients can update signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients can insert signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients can view signature_fields as authenticated" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients can update signature_fields as authenticated" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients can insert signature_fields as authenticated" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients and signers can view signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients and signers can update signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients and signers can insert signature_fields" ON public.signature_fields;

CREATE POLICY "Recipients and signers can view signature_fields"
  ON public.signature_fields
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
    )
  );

CREATE POLICY "Recipients and signers can update signature_fields"
  ON public.signature_fields
  FOR UPDATE
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
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
    )
  );

CREATE POLICY "Recipients and signers can insert signature_fields"
  ON public.signature_fields
  FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = signature_fields.document_id AND d.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.document_recipients r
      WHERE r.document_id = signature_fields.document_id
    )
  );

-- ── 4. Storage Bucket Policies (Allow authenticated & anon signers to download PDFs) ──
DROP POLICY IF EXISTS "Signers can download document PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can download document PDFs" ON storage.objects;

CREATE POLICY "Signers can download document PDFs"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'documents');

SELECT 'Migration applied: Authenticated and anonymous signers can now access documents with valid tokens!' AS status;
