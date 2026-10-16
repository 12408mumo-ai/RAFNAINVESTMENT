-- Run in the Supabase SQL editor. Browser clients cannot modify products.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Orthopaedic Mattresses', 'Beddings', 'Households')),
  price numeric(12,2) not null check (price > 0),
  description text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);
alter table public.products enable row level security;
-- The server uses the service-role key; no anonymous write policies are needed.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,8388608,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;
-- Public image reads are served by Storage's public URL endpoint.
-- Uploads are made only by the authenticated server using its service-role key.
