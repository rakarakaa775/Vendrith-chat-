-- Allow the authenticated uploader to see only their own short-lived pending
-- attachment metadata. Storage INSERT policy checks this row before the object exists.
DROP POLICY IF EXISTS chat_attachments_pending_upload_owner ON public.chat_attachments;
CREATE POLICY chat_attachments_pending_upload_owner
ON public.chat_attachments
FOR SELECT
TO authenticated
USING (
  status = 'pending'
  AND uploader_id = (SELECT auth.uid())
  AND created_at > now() - interval '15 minutes'
);
