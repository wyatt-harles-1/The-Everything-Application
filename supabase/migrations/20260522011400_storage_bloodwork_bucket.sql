-- =============================================================================
-- `bloodwork` Storage bucket - holds lab PDFs / images for
-- wellness.bloodwork_panels.file_path.
--
-- Files are uploaded by Server Actions to a path-encoded location:
--   {user_id}/{panel_id}.{ext}
--
-- The user_id prefix is what makes RLS work. The policies below pull the
-- first folder name off the object key and compare it to auth.uid() - if you
-- store under a different prefix, you can't read/write it. Same pattern
-- Supabase docs use for their own user-scoped storage examples.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Create the bucket (private; objects are not publicly accessible)
-- -----------------------------------------------------------------------------
-- ON CONFLICT DO NOTHING so re-running this migration after a bucket exists
-- (e.g. after `supabase db reset` on a fresh stack) is a no-op rather than a
-- hard error.

INSERT INTO storage.buckets (id, name, public)
VALUES ('bloodwork', 'bloodwork', false)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. RLS - users can only touch objects under their own {user_id}/ prefix
-- -----------------------------------------------------------------------------
-- One policy per operation rather than FOR ALL because the SELECT case
-- doesn't need WITH CHECK and the docs encourage explicit per-op policies for
-- storage. `(storage.foldername(name))[1]` returns the first path segment;
-- comparing it to auth.uid()::text scopes access to the owner.

CREATE POLICY "bloodwork: users select own objects"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bloodwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "bloodwork: users insert under own prefix"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bloodwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "bloodwork: users update own objects"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'bloodwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'bloodwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "bloodwork: users delete own objects"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bloodwork'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
