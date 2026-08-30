-- WhatsApp Business Platform (Cloud API) integration — Step 3. Reuses the
-- Step 1 `business_integrations` table as-is (provider='whatsapp' already
-- allowed, `metadata jsonb` already generic — no ALTER needed there) and the
-- Step 2 `oauth_states` table for binding the Embedded Signup flow to the
-- authenticated business, widened here to allow provider='whatsapp'.
--
-- New in this migration: conversation/message storage for the WhatsApp
-- inbox. Named `whatsapp_*` (not a generic `business_conversations`) to
-- match this codebase's existing convention of concrete, feature-named
-- tables (business_offers, business_items) rather than speculative generic
-- ones — see docs/ for the reasoning if a second messaging provider is ever
-- added.

begin;

alter table public.oauth_states drop constraint if exists oauth_states_provider_check;
alter table public.oauth_states add constraint oauth_states_provider_check
  check (provider in ('instagram', 'whatsapp'));

-- Widen the safe integrations view to also expose `metadata` — needed so the
-- frontend can show the connected WABA's display phone number
-- (metadata.displayPhoneNumber). Still no token columns, ever; metadata never
-- holds one (see business-integrations migration's column comment).
create or replace view public.my_business_integrations
with (security_invoker = true, security_barrier = true)
as
select
  id, user_id, provider, status, provider_account_id, provider_account_name,
  token_expires_at, metadata, created_at, updated_at
from public.business_integrations
where user_id = auth.uid()::text;

grant select (metadata) on public.business_integrations to authenticated;

-- ── whatsapp_conversations ──────────────────────────────────────────────────
-- One row per (business, integration, customer) — the same customer phone
-- number talking to two different businesses is two separate rows, never one
-- global customer identity.
create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.users(uid) on delete cascade,
  integration_id uuid not null references public.business_integrations(id) on delete cascade,
  customer_wa_id text not null,
  customer_phone text,
  customer_name text,
  last_message_at timestamptz,
  last_customer_message_at timestamptz,
  status text not null default 'open' check (status in ('open', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, integration_id, customer_wa_id)
);

create index if not exists whatsapp_conversations_business_id_idx
  on public.whatsapp_conversations (business_id, last_message_at desc);

alter table public.whatsapp_conversations enable row level security;

create policy "owner can read own whatsapp conversations"
  on public.whatsapp_conversations for select
  to authenticated
  using (business_id = auth.uid()::text);

-- Archiving is the one self-service write allowed — everything else
-- (creation on inbound webhook, last_message_at bookkeeping) is backend-only.
create policy "owner can archive/reopen own conversation"
  on public.whatsapp_conversations for update
  to authenticated
  using (business_id = auth.uid()::text)
  with check (business_id = auth.uid()::text);

-- ── whatsapp_messages ────────────────────────────────────────────────────────
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  business_id text not null references public.users(uid) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  integration_id uuid not null references public.business_integrations(id) on delete cascade,
  provider_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  type text not null check (type in ('text', 'image', 'video', 'document', 'audio', 'template', 'unknown')),
  text_body text,
  provider_media_id text,
  media_url text,
  status text not null default 'received'
    check (status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_message text,
  provider_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duplicate webhook deliveries of the same wamid must not create a second
-- row — partial unique index (provider_message_id is null for
-- not-yet-sent outbound rows, which must NOT collide with each other).
create unique index if not exists whatsapp_messages_provider_message_id_key
  on public.whatsapp_messages (provider_message_id)
  where provider_message_id is not null;

create index if not exists whatsapp_messages_conversation_id_idx
  on public.whatsapp_messages (conversation_id, created_at desc);
create index if not exists whatsapp_messages_business_id_idx
  on public.whatsapp_messages (business_id);

alter table public.whatsapp_messages enable row level security;

create policy "owner can read own whatsapp messages"
  on public.whatsapp_messages for select
  to authenticated
  using (business_id = auth.uid()::text);

-- No insert/update policies for `authenticated` — every message row (inbound
-- via webhook, outbound via the send endpoint, status updates via delivery
-- webhooks) is written by the backend (service-role) only, after it has
-- already verified conversation/business ownership itself.

commit;
