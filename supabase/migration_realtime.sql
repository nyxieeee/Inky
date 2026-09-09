-- ============================================================================
-- Inky: Enable Realtime for all core tables
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- 1. Ensure publication exists and add Inky tables
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
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_links;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Set REPLICA IDENTITY to FULL so updates send complete row payloads
ALTER TABLE public.documents REPLICA IDENTITY FULL;
ALTER TABLE public.signature_fields REPLICA IDENTITY FULL;
ALTER TABLE public.document_recipients REPLICA IDENTITY FULL;
ALTER TABLE public.inbox_links REPLICA IDENTITY FULL;
