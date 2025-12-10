-- Supabase Storage Policies for recipe-share bucket

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('recipe-share', 'recipe-share', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view files" ON storage.objects;

-- Policy 1: Anyone can view files (public read)
CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
USING (bucket_id = 'recipe-share');

-- Policy 2: Authenticated users can upload files
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'recipe-share' 
  AND auth.role() = 'authenticated'
);

-- Policy 3: Authenticated users can update their own files
CREATE POLICY "Users can update own files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'recipe-share' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'recipe-share' 
  AND auth.role() = 'authenticated'
);

-- Policy 4: Authenticated users can delete their own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'recipe-share' 
  AND auth.role() = 'authenticated'
);

