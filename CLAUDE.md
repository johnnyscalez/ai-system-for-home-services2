# LeadReply (BookedAI) — AI SMS Lead Follow-Up for Contractors

## What this is
A B2B SaaS for home services contractors (roofing, solar, HVAC, windows, bath remodel).
Contractor connects Facebook Lead Ads → every lead gets an AI SMS within 60 seconds → AI qualifies them, handles objections, and books an estimate appointment → all visible in a built-in CRM.

## Core value proposition
Contractors pay $50-150/lead on Facebook ads but leads go cold. This texts every lead within 60 seconds, 24/7, and books the appointment automatically.

## Target users
US/Canadian home services contractors. Roofing, solar, HVAC, windows, bath remodel. Spending $3K+/month on Facebook ads. 1-50 employees. Non-technical.

## The AI conversation flow
5 stages:
1. **Opener** — Short, personal, question-based. Optimized for reply rate.
2. **Qualify** — 2-3 questions woven naturally. Pre-configured per service type.
3. **Handle objections** — Pre-built responses for "just getting prices", "already talked to someone", "how much does it cost", no response follow-ups.
4. **Book** — Offer 2 time slots. Log appointment when confirmed.
5. **Confirm + hand off** — Confirmation SMS to lead. Push notification to contractor.

## Follow-up sequences (auto-runs, no setup needed)
- No reply: 1hr, 24hr, 72hr, 7d → marked Cold
- Replied but didn't book: same day, 48hr, 5d → marked Nurturing
- Pre-built per service type

## CRM pipeline columns
New → Contacted → Qualified → Appointment Booked → Closed/Lost

## Onboarding (3 steps, <10 min)
1. Connect Facebook Lead Ads (OAuth) or paste webhook URL
2. Company name, service type, area, notification phone number
3. Auto-provision Twilio local number

## Pricing
- Starter $297/month — 100 leads, 1 user, 1 Facebook account
- Growth $497/month — 300 leads, 3 users, 3 Facebook accounts, custom AI script
- Scale $997/month — unlimited leads/users, white-label
- Overage: $0.05/SMS beyond plan limits

## Tech stack
- **Framework:** Next.js 16 App Router
- **Language:** TypeScript (strict mode always)
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Animations:** Framer Motion
- **Database & Auth:** Supabase (Postgres + Auth + Storage + Realtime)
- **AI:** Claude API (claude-sonnet-4-6) — system prompt generated per company from onboarding
- **SMS:** Twilio (number provisioning + send/receive)
- **Lead ingestion:** Facebook Lead Ads webhooks + generic webhook endpoint
- **Billing:** Stripe (subscriptions + metered SMS overage)
- **Email:** Resend
- **Icons:** Lucide React

## Database tables
- `companies` — contractor accounts (multi-tenant root)
- `users` — team members, linked to company
- `leads` — every lead with status, source, timestamps
- `conversations` — every SMS message linked to lead
- `appointments` — booked appointments
- `sequences` — which follow-up step each lead is on
- `settings` — per-company AI config (script, questions, objections, hours)
- `phone_numbers` — Twilio numbers provisioned per company

## Design Direction — CRITICAL, follow exactly

### Aesthetic
Modern, bright, airy SaaS. Think Lovable.dev, Linear, Notion.
NOT dark. NOT minimal. NOT boring.

### Colors
- Background: #FAFAF8 (warm off-white, almost cream)
- Surface/cards: #FFFFFF with subtle shadow
- Primary accent: #7C3AED (rich purple)
- Secondary accent: #4D7C0F (olive green)
- Text primary: #1C1917 (warm near-black)
- Text secondary: #78716C (warm gray)
- Borders: #E7E5E4 (very subtle warm gray)
- Success: #16A34A (green)
- Warning: #D97706 (amber)

### Typography
- Heading font: Plus Jakarta Sans (import from Google Fonts)
- Body font: Inter
- Numbers/data: JetBrains Mono
- Headings are bold and large, not timid

### Visual style
- Cards have soft shadows: shadow-sm with rounded-xl corners
- Floating elements: cards appear to float with box-shadow: 0 4px 24px rgba(0,0,0,0.06)
- Subtle gradients on hero sections and headers
- Purple accent used for primary buttons, active states, highlights
- Olive green used for success states, revenue numbers, positive metrics
- Glass morphism effect on modals: backdrop-blur-sm bg-white/80

### Animations — all required
- Page load: elements fade in with staggered delay (Framer Motion)
- Cards: subtle scale on hover (scale 1.01)
- Buttons: smooth color transition on hover
- Numbers on dashboard: count up animation when page loads
- Sidebar: smooth expand/collapse
- New lead arriving in pipeline: slide in from top with green flash

### Layout
- Sidebar is 240px wide, white background, subtle right border
- Main content has generous padding (p-8)
- Dashboard uses a 3-column grid for stats at top
- Cards have 24px internal padding
- Everything has breathing room — generous whitespace

### Components style
- Buttons: rounded-lg, purple background, white text, slight shadow, smooth hover
- Input fields: white background, warm gray border, focus ring in purple
- Badges: rounded-full, soft colored backgrounds
- Stats cards: white, floating shadow, colored icon in top-left, large bold number, small label below
- Pipeline columns: light gray background (#F5F4F2), rounded-xl, cards inside are white and floating

## Visual Layer Requirements — EVERY PAGE

Every page must have both a functional layer AND a visual layer. Never ship a page without the visual layer.

### Visual layer always includes:
1. Background texture (dot grid, line grid, or subtle noise — never solid color)
2. Atmospheric glow orbs behind content (3 blurred color circles at low opacity)
3. Colored shadows on cards (not gray shadows — purple/brand-tinted)
4. Framer Motion on everything that loads
5. Stats and numbers count up on scroll
6. Gradient accents on section backgrounds
7. Decorative elements that aren't functional (lines, shapes, patterns) to add richness

### Reference sites to match quality of:
- linear.app (floating product UI, depth, dark)
- vercel.com (grid backgrounds, glow, geometric)
- stripe.com (gradient sections, large numbers, particle effects, light purple backgrounds)

### Never acceptable:
- Solid white or solid gray backgrounds with nothing on them
- Cards without shadows
- Pages that look like they have no designer involved
- Any section that feels flat or dimensionless

### Implementation pattern (use on every page):
```tsx
{/* Visual background layer — always z-0, pointer-events-none */}
<div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
  {/* Dot grid */}
  <div className="absolute inset-0 opacity-40"
    style={{ backgroundImage: 'radial-gradient(rgba(124,58,237,0.15) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
  {/* Glow orb 1 — purple */}
  <motion.div animate={{ y:[0,-20,0], x:[0,10,0] }} transition={{ duration:8, repeat:Infinity, ease:"easeInOut" }}
    className="absolute w-[600px] h-[600px] rounded-full blur-3xl"
    style={{ background: 'rgba(124,58,237,0.07)', top:'-10%', left:'-5%' }} />
  {/* Glow orb 2 — green */}
  <motion.div animate={{ y:[0,20,0], x:[0,-15,0] }} transition={{ duration:11, repeat:Infinity, ease:"easeInOut" }}
    className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
    style={{ background: 'rgba(77,124,15,0.06)', bottom:'-5%', right:'-5%' }} />
  {/* Glow orb 3 — sky blue accent */}
  <motion.div animate={{ y:[0,-12,0] }} transition={{ duration:9, repeat:Infinity, ease:"easeInOut", delay:2 }}
    className="absolute w-[400px] h-[400px] rounded-full blur-3xl"
    style={{ background: 'rgba(6,182,212,0.05)', top:'40%', right:'20%' }} />
</div>
{/* Content always z-10 relative */}
<div className="relative z-10"> ... </div>
```

## Folder structure
```
/app
  /(auth)              — login, signup, forgot password
  /(onboarding)        — 3-step onboarding flow
  /(dashboard)         — protected app routes
    /dashboard         — main dashboard with KPIs + pipeline
    /leads             — CRM pipeline board + lead detail
    /conversations     — SMS conversation threads
    /appointments      — booked appointments list
    /settings          — AI config, team, integrations, billing
/api
  /webhooks
    /facebook          — Facebook Lead Ads webhook receiver
    /lead              — Generic webhook for other sources
    /twilio            — Twilio inbound SMS webhook
  /ai                  — Claude conversation generation
  /sms                 — Twilio send/receive helpers
/components
  /ui                  — shadcn components (DO NOT modify)
  /layout              — Sidebar, header, nav
  /leads               — Lead card, pipeline board, conversation thread
  /dashboard           — KPI cards, chart, activity feed, ROI calculator
  /onboarding          — 3-step onboarding components
  /shared              — Reusable components
/lib
  /supabase.ts         — Supabase browser client
  /supabase-server.ts  — Supabase server client (for API routes)
  /twilio.ts           — Twilio client helpers
  /claude.ts           — Claude API conversation engine
  /facebook.ts         — Facebook Lead Ads helpers
  /stripe.ts           — Stripe billing helpers
  /utils.ts            — General utilities
/hooks                 — Custom React hooks
/types                 — TypeScript types
```

## Rules Claude must always follow
- Always TypeScript, never plain JavaScript
- Always use shadcn components before building custom ones
- All database calls go through `/lib/supabase.ts` (client) or `/lib/supabase-server.ts` (server/API)
- Never hardcode API keys — always environment variables
- Every page must work on mobile
- Light mode only — warm cream background, no dark theme
- Multi-tenant: every table with company data must have `company_id` column with RLS
- RLS enabled on all Supabase tables — each company sees only their own data
- Form validation with react-hook-form + zod
- Real-time CRM updates via Supabase subscriptions

## Supabase project
- Project: ai system for home services (ID: lzeukaamhhoctahmgbha)
- Organization: johny (ID: zvagbbliuyauqvehwuuf)
- URL: https://lzeukaamhhoctahmgbha.supabase.co
- Region: us-west-1
- Use Supabase MCP tools for all database operations

## Environment variables (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://lzeukaamhhoctahmgbha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

## Build order (MVP)
1. Supabase schema + RLS policies ← START HERE
2. Auth (signup/login) + onboarding 3-step flow
3. Dashboard layout (sidebar, header, nav shell)
4. CRM pipeline board + lead detail view
5. Lead ingestion webhook endpoint
6. Twilio SMS send/receive
7. Claude AI conversation engine
8. Follow-up sequence scheduler
9. Facebook Lead Ads OAuth
10. Stripe billing integration
