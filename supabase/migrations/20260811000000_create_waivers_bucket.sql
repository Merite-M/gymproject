-- Create the waivers bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('waivers', 'waivers', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the waivers bucket
-- Give authenticated users ability to upload
CREATE POLICY "Authenticated users can upload waivers"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'waivers'
);

-- Admin/staff can view waivers
CREATE POLICY "Staff can view waivers"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'waivers'
    AND (auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'staff')))
);
