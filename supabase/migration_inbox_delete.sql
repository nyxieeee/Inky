-- Migration: Allow recipients to delete / dismiss their own incoming signing requests
DROP POLICY IF EXISTS "Recipients can delete their own recipient record" ON public.document_recipients;

CREATE POLICY "Recipients can delete their own recipient record"
  ON public.document_recipients
  FOR DELETE
  TO authenticated
  USING (
    lower(email) = lower(auth.jwt()->>'email') OR
    lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  );
