-- ============================================================================
-- Inky: Incremental Migration — Add RLS policies for anonymous signers
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- 1. Allow anonymous signers to view documents linked to their recipient token
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

-- 2. Allow anonymous signers to update document status upon signing completion
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

-- 3. Allow anonymous signers to view signature fields for their document
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

-- 4. Allow anonymous signers to update signature fields with their signature values
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

-- 5. Allow anonymous signers to download PDFs from documents storage bucket
CREATE POLICY "Signers can download document PDFs"
    ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'documents');
