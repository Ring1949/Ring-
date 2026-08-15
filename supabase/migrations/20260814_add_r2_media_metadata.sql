-- Additive only: no legacy rows or URLs are rewritten.
alter table public.media add column if not exists object_key text default '';
alter table public.media add column if not exists storage_provider text default 'supabase';
alter table public.media add column if not exists width integer default 0;
alter table public.media add column if not exists height integer default 0;

create index if not exists idx_media_storage_object
  on public.media(storage_provider, object_key);

comment on column public.media.file_path is 'Stable delivery URL; legacy URLs remain unchanged.';
comment on column public.media.storage_path is 'Legacy-compatible object path.';
comment on column public.media.object_key is 'Cloudflare R2 object key for new uploads.';
comment on column public.media.storage_provider is 'supabase, vercel-blob, public, or r2.';
