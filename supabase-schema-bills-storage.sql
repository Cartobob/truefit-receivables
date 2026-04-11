-- Run in Supabase SQL Editor

-- 1. Add pdf_path column to bills table
alter table bills add column if not exists pdf_path text;

-- 2. Add settled_at column to track when bill was fully paid
alter table bills add column if not exists settled_at timestamptz;

-- 3. Create Supabase Storage bucket for bill PDFs
-- (Run this separately in Storage section OR via SQL below)
insert into storage.buckets (id, name, public)
values ('bill-pdfs', 'bill-pdfs', false)
on conflict do nothing;

-- 4. Storage policy — allow all authenticated/anon reads and writes
create policy "Allow all on bill-pdfs" on storage.objects
  for all using (bucket_id = 'bill-pdfs') with check (bucket_id = 'bill-pdfs');
