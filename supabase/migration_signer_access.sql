-- ============================================================================
-- Inky: Incremental Migration — Add RLS policies for anonymous signers
--       + Add missing columns to signature_fields
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- ── Add missing columns to signature_fields ──
ALTER TABLE public.signature_fields ADD COLUMN IF NOT EXISTS signer_id TEXT;
ALTER TABLE public.signature_fields ADD COLUMN IF NOT EXISTS signer_email TEXT;
ALTER TABLE public.signature_fields ADD COLUMN IF NOT EXISTS signer_order INTEGER;
ALTER TABLE public.signature_fields ADD COLUMN IF NOT EXISTS signer_name TEXT;

-- ── Update document status constraint to include 'sent' and 'partially_signed' ──
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
    CHECK (status IN ('draft', 'pending', 'sent', 'partially_signed', 'completed'));

-- ── RLS Policies for anonymous signers ──

-- 1. Allow anonymous signers to view documents linked to their recipient token
DO $$ BEGIN
    CREATE POLICY "Recipients can view document"
        ON public.documents FOR SELECT TO anon
        USING (EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = documents.id
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Allow anonymous signers to update document status upon signing completion
DO $$ BEGIN
    CREATE POLICY "Recipients can update document status"
        ON public.documents FOR UPDATE TO anon
        USING (EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = documents.id
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = documents.id
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Allow anonymous signers to view signature fields for their document
DO $$ BEGIN
    CREATE POLICY "Recipients can view signature_fields"
        ON public.signature_fields FOR SELECT TO anon
        USING (EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = signature_fields.document_id
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Allow anonymous signers to update signature fields with their signature values
DO $$ BEGIN
    CREATE POLICY "Recipients can update signature_fields"
        ON public.signature_fields FOR UPDATE TO anon
        USING (EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = signature_fields.document_id
        ))
        WITH CHECK (EXISTS (
            SELECT 1 FROM public.document_recipients r
            WHERE r.document_id = signature_fields.document_id
        ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. Allow anonymous signers to download PDFs from documents storage bucket
DO $$ BEGIN
    CREATE POLICY "Signers can download document PDFs"
        ON storage.objects FOR SELECT TO anon
        USING (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
