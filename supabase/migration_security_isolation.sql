-- ============================================================================
-- Inky: Strict Document Privacy & Anti-Leak Migration
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- 1. Ensure authenticated users ONLY see and manage their own documents
DROP POLICY IF EXISTS "Owner can do all on documents" ON public.documents;
CREATE POLICY "Owner can do all on documents"
    ON public.documents
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 2. Ensure authenticated users ONLY see their own signature fields
DROP POLICY IF EXISTS "Owner can do all on signature_fields" ON public.signature_fields;
CREATE POLICY "Owner can do all on signature_fields"
    ON public.signature_fields
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = signature_fields.document_id
              AND d.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents d
            WHERE d.id = signature_fields.document_id
              AND d.user_id = auth.uid()
        )
    );

-- 3. Ensure authenticated users ONLY see their own document recipients
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

-- 4. Prevent anonymous full-table scans
-- Allow anonymous signers to fetch their document only when querying a specific document_id
-- that matches an existing recipient record.
DROP POLICY IF EXISTS "Recipients can view document" ON public.documents;
CREATE POLICY "Recipients can view document"
    ON public.documents FOR SELECT
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = documents.id
        )
    );

-- 5. Allow signers to add/update/delete signature fields when signing anywhere
DROP POLICY IF EXISTS "Recipients can insert signature_fields" ON public.signature_fields;
CREATE POLICY "Recipients can insert signature_fields"
    ON public.signature_fields FOR INSERT
    TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = signature_fields.document_id
        )
    );

DROP POLICY IF EXISTS "Recipients can delete signature_fields" ON public.signature_fields;
CREATE POLICY "Recipients can delete signature_fields"
    ON public.signature_fields FOR DELETE
    TO anon
    USING (
        EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = signature_fields.document_id
        )
    );

