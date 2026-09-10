-- ==============================================================================
-- Inky: Migration — signed_notifications + document status enum fix
-- Run this script in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- ==============================================================================

-- 1. Fix document status enum to include 'sent' and 'partially_signed'
--    (code already writes these values; the old constraint caused silent failures)
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('draft', 'pending', 'sent', 'partially_signed', 'completed'));

-- 2. Fix document source enum to include 'ai'
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_source_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_source_check
  CHECK (source IN ('uploaded', 'inbound', 'ai'));

-- 3. Add signer_name, signer_email, signer_order, signer_id columns to signature_fields
--    (these were used in code but may be missing in older databases)
ALTER TABLE public.signature_fields
  ADD COLUMN IF NOT EXISTS signer_id TEXT,
  ADD COLUMN IF NOT EXISTS signer_email TEXT,
  ADD COLUMN IF NOT EXISTS signer_order INTEGER,
  ADD COLUMN IF NOT EXISTS signer_name TEXT;

-- 4. Signed Notifications Table — sender's Inbox for completed signatures
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

-- 5. Enable RLS on signed_notifications
ALTER TABLE public.signed_notifications ENABLE ROW LEVEL SECURITY;

-- 6. Owner can view/update their own notifications
CREATE POLICY "Owner can do all on signed_notifications"
  ON public.signed_notifications
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- 7. Anonymous signers (SignerPortal) can INSERT notifications for the document owner
CREATE POLICY "Anon can insert signed_notifications"
  ON public.signed_notifications
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 8. Enable Realtime on signed_notifications so the sender's browser
--    receives the INSERT event live without polling
ALTER PUBLICATION supabase_realtime ADD TABLE public.signed_notifications;

-- Done!
SELECT 'Migration applied successfully.' AS status;
