-- First-party traffic tracking for the marketing pages.
--
-- Why this exists: as of 2026-11-04 the only pageview signal on the site was
-- the Meta Pixel, which lives in Events Manager and only counts browsers that
-- run Meta's script. Railway's edge logs count the opposite extreme — every
-- crawler, scraper and scanner. Neither answers "how many flooring contractors
-- landed on /book and how far did they get", so we keep our own numbers.
--
-- Written only by app/api/track (service role). RLS is on with no policies, so
-- the anon key cannot read or write it: traffic data is not customer data and
-- has no company_id, so there is nothing to scope a policy to.

create table if not exists public.site_events (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),

  -- page_view | cta_click | section_view | quiz_step | quiz_submit
  event        text        not null,
  path         text        not null,

  -- First-party identity, no cookies. visitor_id lives in localStorage and
  -- survives sessions; session_id lives in sessionStorage and dies with the tab.
  -- Both can be absent when storage is blocked — fall back to ip_hash.
  visitor_id   text,
  session_id   text,

  -- Acquisition, captured on the session's first page and carried on every
  -- later event so a booking keeps the campaign that paid for it.
  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  utm_term     text,
  click_id     text,

  -- Event payload. step/step_key/value carry the quiz funnel.
  step         smallint,
  step_key     text,
  value        text,
  meta         jsonb,

  -- Request side, filled server-side only so the client cannot lie about it.
  user_agent   text,
  device       text,
  country      text,
  ip_hash      text,

  -- Kept rather than dropped: a row we refuse to count is still evidence.
  -- Every report filters both out by default.
  is_bot       boolean     not null default false,
  is_internal  boolean     not null default false
);

create index if not exists site_events_created_at_idx on public.site_events (created_at desc);
create index if not exists site_events_path_created_idx on public.site_events (path, created_at desc);
create index if not exists site_events_event_created_idx on public.site_events (event, created_at desc);
create index if not exists site_events_session_idx on public.site_events (session_id);
create index if not exists site_events_visitor_idx on public.site_events (visitor_id);

alter table public.site_events enable row level security;

comment on table public.site_events is
  'First-party marketing traffic. Written only by /api/track with the service role. Read with scripts/traffic-report.mjs.';
