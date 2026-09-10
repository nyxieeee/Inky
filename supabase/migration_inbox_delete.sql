-- Migration: Allow recipients and document owners to delete / dismiss recipient records
DROP POLICY IF EXISTS "Recipients can delete their own recipient record" ON public.document_recipients;

CREATE POLICY "Recipients can delete their own recipient record"
  ON public.document_recipients
  FOR DELETE
  TO public
  USING (
    lower(email) = lower(coalesce(auth.jwt()->>'email', '')) OR
    lower(email) = lower(coalesce((SELECT email FROM auth.users WHERE id = auth.uid()), '')) OR
    token IS NOT NULL OR
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_recipients.document_id AND d.user_id = auth.uid()
    )
  );

