-- Run this in Supabase SQL Editor to add cheque support

create table cheques (
  id uuid default gen_random_uuid() primary key,
  dealer_id uuid references dealers(id) on delete cascade,
  amount numeric not null,
  cheque_date date not null,
  bank_name text,
  status text not null default 'pending', -- 'pending' | 'cleared' | 'bounced'
  bounce_note text,
  created_at timestamptz default now()
);

alter table cheques enable row level security;
create policy "Allow all" on cheques for all using (true) with check (true);
