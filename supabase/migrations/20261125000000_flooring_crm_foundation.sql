-- Flooring CRM foundation (2026-11-25).
--
-- Run by hand in the Supabase SQL editor:
--   https://supabase.com/dashboard/project/lzeukaamhhoctahmgbha/sql/new
--
-- ADDITIVE ONLY. Nothing is dropped, renamed or rewritten, so it is safe to run
-- on the live database at any time, and safe to run twice (every statement is
-- "if not exists" or guarded).
--
-- The code shipped with this change already works WITHOUT this SQL:
--   * the onboarding intake is stored in knowledge_base.scraped_raw->'intake'
--     until companies.intake exists, and lib/intake.ts moves to the column on
--     its own within 10 minutes of it appearing (no redeploy needed);
--   * the CRM polls for lead and appointment changes until realtime covers them.
-- Running it gives: one proper home for the intake, live CRM updates without
-- polling, and the tables the texting registration (A2P) and ad account work
-- are designed around.

-- 1. Company: onboarding intake and the settings it carries --------------------
alter table public.companies add column if not exists intake jsonb not null default '{}'::jsonb;
alter table public.companies add column if not exists state text;
alter table public.companies add column if not exists service_areas jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists voice_enabled boolean not null default false;
alter table public.companies add column if not exists lead_field_map jsonb not null default '{}'::jsonb;

comment on column public.companies.intake is
  'Onboarding intake (lib/intake.ts CompanyIntake): business, service areas, qualifying questions and rules, offers, photos, ad and domain access, measure calendar, A2P business details, webhook field map. The engines read the compiled copies (ai_agent_config, knowledge_base, service_area_zips), not this.';
comment on column public.companies.service_areas is
  'Named service areas [{name, state, placeId, lat, lng, kind, viewport}]. service_area_zips is derived from these.';
comment on column public.companies.voice_enabled is
  'AI voice agent on/off for the company. Off (default): the AI never places or answers calls.';
comment on column public.companies.lead_field_map is
  'Lead webhook field overrides {"incoming field": "lead field"} for /api/webhooks/lead.';

-- Move any intake already saved in the fallback location into the column.
update public.companies c
set intake = kb.scraped_raw->'intake'
from public.knowledge_base kb
where kb.company_id = c.id
  and kb.scraped_raw ? 'intake'
  and (c.intake is null or c.intake = '{}'::jsonb);

-- 2. Facebook ad account on the integration row ---------------------------------
alter table public.integrations add column if not exists fb_ad_account_id text;
alter table public.integrations add column if not exists fb_ad_account_name text;
alter table public.integrations add column if not exists fb_ad_accounts_cache jsonb;

-- 3. Twilio messaging service per number (A2P campaigns attach to a service) -----
alter table public.phone_numbers add column if not exists messaging_service_sid text;

-- 4. A2P 10DLC registration tracking, one row per company -----------------------
create table if not exists public.a2p_registrations (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null unique references public.companies(id) on delete cascade,
  status                text not null default 'not_started',
  business              jsonb not null default '{}'::jsonb,
  customer_profile_sid  text,
  trust_product_sid     text,
  brand_sid             text,
  messaging_service_sid text,
  campaign_sid          text,
  last_error            text,
  submitted_at          timestamptz,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
alter table public.a2p_registrations enable row level security;
drop policy if exists "view own a2p registration" on public.a2p_registrations;
create policy "view own a2p registration" on public.a2p_registrations
  for select using (company_id = public.get_my_company_id());

-- 5. Realtime: live lead and appointment updates in the CRM --------------------
-- Only conversations was published, so a status or detail change the assistant
-- made did not appear until the page polled.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'leads'
  ) then
    alter publication supabase_realtime add table public.leads;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
