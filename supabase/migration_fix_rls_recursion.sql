-- ==============================================================================
-- Inky Migration: Fix Infinite Recursion in Row Level Security (RLS)
-- Uses SECURITY DEFINER helper functions to break circular references
-- between documents and document_recipients.
-- ==============================================================================

-- ── 1. Helper Functions (SECURITY DEFINER bypasses RLS within function execution) ──
CREATE OR REPLACE FUNCTION public.is_document_owner(doc_id text, check_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = doc_id AND user_id = check_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_document_recipient(doc_id text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.document_recipients
    WHERE document_id = doc_id
  );
$$;

-- ── 2. Document Recipients Policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can do all on document_recipients" ON public.document_recipients;
DROP POLICY IF EXISTS "Signers and recipients can view recipient record" ON public.document_recipients;
DROP POLICY IF EXISTS "Signers and recipients can update recipient record" ON public.document_recipients;
DROP POLICY IF EXISTS "Public can view and update their recipient record with valid token" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipient can view incoming requests by email" ON public.document_recipients;
DROP POLICY IF EXISTS "Recipient can update signing status by email or token" ON public.document_recipients;

CREATE POLICY "Owner can do all on document_recipients"
  ON public.document_recipients
  FOR ALL
  TO authenticated
  USING (public.is_document_owner(document_id, auth.uid()))
  WITH CHECK (public.is_document_owner(document_id, auth.uid()));

CREATE POLICY "Signers and recipients can view recipient record"
  ON public.document_recipients
  FOR SELECT
  TO public
  USING (
    token IS NOT NULL OR
    lower(email) = lower(auth.jwt() ->> 'email') OR
    public.is_document_owner(document_id, auth.uid())
  );

CREATE POLICY "Signers and recipients can update recipient record"
  ON public.document_recipients
  FOR UPDATE
  TO public
  USING (
    token IS NOT NULL OR
    lower(email) = lower(auth.jwt() ->> 'email') OR
    public.is_document_owner(document_id, auth.uid())
  )
  WITH CHECK (
    token IS NOT NULL OR
    lower(email) = lower(auth.jwt() ->> 'email') OR
    public.is_document_owner(document_id, auth.uid())
  );

-- ── 3. Documents Policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Recipients and signers can view document" ON public.documents;
DROP POLICY IF EXISTS "Recipients and signers can update document" ON public.documents;
DROP POLICY IF EXISTS "Recipients can view document" ON public.documents;
DROP POLICY IF EXISTS "Recipients can update document status" ON public.documents;
DROP POLICY IF EXISTS "Recipients can view document as authenticated" ON public.documents;
DROP POLICY IF EXISTS "Recipients can update document status as authenticated" ON public.documents;
DROP POLICY IF EXISTS "Owner can do all on documents" ON public.documents;

CREATE POLICY "Owner can do all on documents"
  ON public.documents
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Recipients and signers can view document"
  ON public.documents
  FOR SELECT
  TO public
  USING (
    auth.uid() = user_id OR
    public.is_document_recipient(id)
  );

CREATE POLICY "Recipients and signers can update document"
  ON public.documents
  FOR UPDATE
  TO public
  USING (
    auth.uid() = user_id OR
    public.is_document_recipient(id)
  )
  WITH CHECK (
    auth.uid() = user_id OR
    public.is_document_recipient(id)
  );

-- ── 4. Signature Fields Policies ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Owner can do all on signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients and signers can view signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients and signers can update signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients and signers can insert signature_fields" ON public.signature_fields;
DROP POLICY IF EXISTS "Recipients can delete signature_fields" ON public.signature_fields;

CREATE POLICY "Owner can do all on signature_fields"
  ON public.signature_fields
  FOR ALL
  TO authenticated
  USING (public.is_document_owner(document_id, auth.uid()))
  WITH CHECK (public.is_document_owner(document_id, auth.uid()));

CREATE POLICY "Recipients and signers can view signature_fields"
  ON public.signature_fields
  FOR SELECT
  TO public
  USING (
    public.is_document_owner(document_id, auth.uid()) OR
    public.is_document_recipient(document_id)
  );

CREATE POLICY "Recipients and signers can update signature_fields"
  ON public.signature_fields
  FOR UPDATE
  TO public
  USING (
    public.is_document_owner(document_id, auth.uid()) OR
    public.is_document_recipient(document_id)
  )
  WITH CHECK (
    public.is_document_owner(document_id, auth.uid()) OR
    public.is_document_recipient(document_id)
  );

CREATE POLICY "Recipients and signers can insert signature_fields"
  ON public.signature_fields
  FOR INSERT
  TO public
  WITH CHECK (
    public.is_document_owner(document_id, auth.uid()) OR
    public.is_document_recipient(document_id)
  );

CREATE POLICY "Recipients can delete signature_fields"
  ON public.signature_fields
  FOR DELETE
  TO public
  USING (
    public.is_document_owner(document_id, auth.uid()) OR
    public.is_document_recipient(document_id)
  );

-- ── 5. Backfill existing sent document sender fields ─────────────────────────
UPDATE public.documents
SET 
  sender_name = COALESCE(documents.sender_name, u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email, 'Document Sender'),
  sender_email = COALESCE(documents.sender_email, u.email),
  status = CASE WHEN documents.status = 'draft' THEN 'sent' ELSE documents.status END
FROM auth.users u
WHERE documents.user_id = u.id AND (documents.sender_name IS NULL OR documents.sender_email IS NULL);
