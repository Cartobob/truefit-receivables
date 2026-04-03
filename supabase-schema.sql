-- Run this in your NEW Supabase project > SQL Editor

-- Salesmen table
create table salesmen (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  password text not null,
  created_at timestamptz default now()
);

-- Dealers table
create table dealers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  area text,
  salesman_id uuid references salesmen(id) on delete cascade,
  created_at timestamptz default now()
);

-- Bills table
create table bills (
  id uuid default gen_random_uuid() primary key,
  dealer_id uuid references dealers(id) on delete cascade,
  bill_no text not null,
  amount numeric not null,
  balance numeric not null,
  bill_date date not null,
  created_at timestamptz default now()
);

-- Payments table
create table payments (
  id uuid default gen_random_uuid() primary key,
  dealer_id uuid references dealers(id) on delete cascade,
  amount numeric not null,
  payment_date date not null,
  note text,
  created_at timestamptz default now()
);

-- Payment allocations (which bills a payment cleared)
create table payment_allocations (
  id uuid default gen_random_uuid() primary key,
  payment_id uuid references payments(id) on delete cascade,
  bill_id uuid references bills(id) on delete cascade,
  amount_applied numeric not null
);

-- Enable RLS
alter table salesmen enable row level security;
alter table dealers enable row level security;
alter table bills enable row level security;
alter table payments enable row level security;
alter table payment_allocations enable row level security;

-- Allow all (access controlled by app)
create policy "Allow all" on salesmen for all using (true) with check (true);
create policy "Allow all" on dealers for all using (true) with check (true);
create policy "Allow all" on bills for all using (true) with check (true);
create policy "Allow all" on payments for all using (true) with check (true);
create policy "Allow all" on payment_allocations for all using (true) with check (true);
