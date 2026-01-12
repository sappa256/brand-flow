-- Create storage buckets for CRM files
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('proposals', 'proposals', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true);

-- RLS policies for contracts bucket (private - user's own files or admin access)
CREATE POLICY "Authenticated users can upload contracts"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'contracts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view contracts they uploaded or admins can view all"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can update their own contracts or admins can update all"
ON storage.objects FOR UPDATE
USING (bucket_id = 'contracts' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can delete their own contracts or admins can delete all"
ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

-- RLS policies for proposals bucket (private - user's own files or admin access)
CREATE POLICY "Authenticated users can upload proposals"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proposals' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view proposals they uploaded or admins can view all"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposals' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can update their own proposals or admins can update all"
ON storage.objects FOR UPDATE
USING (bucket_id = 'proposals' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can delete their own proposals or admins can delete all"
ON storage.objects FOR DELETE
USING (bucket_id = 'proposals' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

-- RLS policies for assets bucket (public read, authenticated write)
CREATE POLICY "Anyone can view assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');

CREATE POLICY "Authenticated users can upload assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own assets or admins can update all"
ON storage.objects FOR UPDATE
USING (bucket_id = 'assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));

CREATE POLICY "Users can delete their own assets or admins can delete all"
ON storage.objects FOR DELETE
USING (bucket_id = 'assets' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin')));