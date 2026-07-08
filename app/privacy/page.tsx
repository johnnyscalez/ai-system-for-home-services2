import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — FieldBuilt AI",
  description:
    "How FieldBuilt AI collects, uses, and protects data for home service companies and their customers.",
}

const C = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  primary: "#F97316",
  text: "#1C1917",
  muted: "#78716C",
  border: "#E7E5E4",
  subtle: "#F5F4F2",
} as const

const EFFECTIVE_DATE = "July 8, 2026"

const SECTIONS = [
  { id: "who-we-are", label: "1. Who We Are" },
  { id: "data-we-collect", label: "2. Information We Collect" },
  { id: "how-we-use", label: "3. How We Use Information" },
  { id: "ai-processing", label: "4. AI Processing & Disclosure" },
  { id: "sms-calls", label: "5. SMS, Calls & Recording" },
  { id: "facebook-meta", label: "6. Facebook & Meta Platform Data" },
  { id: "integrations", label: "7. Third-Party Services" },
  { id: "sharing", label: "8. How We Share Information" },
  { id: "retention", label: "9. Data Retention" },
  { id: "data-deletion", label: "10. Data Deletion Requests" },
  { id: "security", label: "11. Security" },
  { id: "your-rights", label: "12. Your Privacy Rights" },
  { id: "children", label: "13. Children's Privacy" },
  { id: "changes", label: "14. Changes to This Policy" },
  { id: "contact", label: "15. Contact Us" },
] as const

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-2xl font-bold mt-12 mb-4"
      style={{ color: C.text, fontFamily: "var(--font-heading, 'Plus Jakarta Sans', sans-serif)" }}
    >
      {children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] leading-7 mb-4" style={{ color: C.muted }}>
      {children}
    </p>
  )
}

function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="text-[15px] leading-7 mb-2 ml-5 list-disc" style={{ color: C.muted }}>
      {children}
    </li>
  )
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: C.text, fontWeight: 600 }}>{children}</strong>
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen relative" style={{ background: C.bg }}>
      {/* Visual background layer */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(249,115,22,0.12) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-3xl"
          style={{ background: "rgba(249,115,22,0.06)", top: "-10%", left: "-5%" }}
        />
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-3xl"
          style={{ background: "rgba(22,163,74,0.05)", bottom: "-5%", right: "-5%" }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold mb-10 hover:opacity-80 transition-opacity"
          style={{ color: C.primary }}
        >
          ← FieldBuilt AI
        </Link>

        <h1
          className="text-4xl md:text-5xl font-extrabold mb-3"
          style={{ color: C.text, fontFamily: "var(--font-heading, 'Plus Jakarta Sans', sans-serif)" }}
        >
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: C.muted }}>
          Effective date: <span style={{ color: C.text, fontWeight: 600 }}>{EFFECTIVE_DATE}</span>
        </p>

        {/* TOC */}
        <nav
          className="rounded-xl p-6 mb-12"
          style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 4px 24px rgba(249,115,22,0.06)" }}
        >
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: C.muted }}>
            Contents
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="text-sm hover:underline" style={{ color: C.primary }}>
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        <P>
          FieldBuilt AI (&quot;FieldBuilt,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) provides an AI-powered
          communication and scheduling system for home service companies. This Privacy Policy explains what
          information we collect, how we use it, and the choices available to you. It applies to our website at
          fieldbuiltai.com, our application, and all related services (together, the &quot;Service&quot;).
        </P>
        <P>
          We serve two groups of people, and this policy covers both: <Strong>business users</Strong> — the home
          service companies (and their team members) who subscribe to FieldBuilt — and{" "}
          <Strong>consumers</Strong> — the homeowners and customers who communicate with those companies through our
          Service.
        </P>

        <H2 id="who-we-are">1. Who We Are</H2>
        <P>
          FieldBuilt AI operates the Service on behalf of home service companies (our business customers). When you —
          a homeowner — text, call, or message a company that uses FieldBuilt, your communication is processed by our
          Service on that company&apos;s behalf. For that data, the company you contacted is the data controller and
          FieldBuilt acts as a service provider / processor.
        </P>

        <H2 id="data-we-collect">2. Information We Collect</H2>
        <P>
          <Strong>From business users (subscribing companies):</Strong>
        </P>
        <ul className="mb-4">
          <LI>Account information: name, email address, phone number, company name, service area, business hours</LI>
          <LI>Team member details: names, roles, phone numbers, service zones, and job-type assignments for technicians</LI>
          <LI>Billing information: processed by Stripe; we do not store full payment card numbers</LI>
          <LI>Business configuration: AI conversation settings, scheduling rules, service offerings, pricing policies</LI>
          <LI>Connected account data: information from integrations the company authorizes (see Sections 6 and 7)</LI>
        </ul>
        <P>
          <Strong>From consumers (homeowners contacting a company):</Strong>
        </P>
        <ul className="mb-4">
          <LI>Contact details: name, phone number, email address, and service address</LI>
          <LI>
            Communication content: SMS messages, voice call audio and transcripts, Facebook Messenger and WhatsApp
            messages, and any details you share about your service needs
          </LI>
          <LI>Appointment details: scheduled dates, job descriptions, and related notes</LI>
          <LI>Lead source information: for example, that an inquiry originated from a Facebook Lead Ad or a website form</LI>
        </ul>
        <P>
          <Strong>Collected automatically:</Strong> log data, device and browser type, IP address, and usage
          information about how the Service is accessed, used for security and service improvement.
        </P>

        <H2 id="how-we-use">3. How We Use Information</H2>
        <ul className="mb-4">
          <LI>To respond to consumer inquiries on behalf of the company they contacted, and to qualify, schedule, and confirm service appointments</LI>
          <LI>To route appointments to the appropriate technician based on location, availability, and job type</LI>
          <LI>To send appointment confirmations, reminders, and follow-up messages</LI>
          <LI>To sync appointments and customer records with the company&apos;s field-management software when the company connects one (for example, Housecall Pro)</LI>
          <LI>To provide companies with reporting on conversations, bookings, and business outcomes</LI>
          <LI>To operate, maintain, secure, and improve the Service</LI>
          <LI>To comply with legal obligations</LI>
        </ul>
        <P>
          <Strong>We do not sell personal information.</Strong> We do not use consumer conversation content for
          advertising, and we do not use it to train our own or third-party foundation AI models.
        </P>

        <H2 id="ai-processing">4. AI Processing &amp; Disclosure</H2>
        <P>
          Conversations handled by the Service are processed by artificial intelligence to understand inquiries,
          generate responses, and schedule appointments. AI-generated messages and calls are made on behalf of the
          company you contacted. Message and call content is processed through our AI infrastructure provider
          (Anthropic) under agreements that prohibit use of the data for model training.
        </P>
        <P>
          A human team member at the company can review conversations and take over at any time. If you prefer to speak
          with a person, say so in the conversation and your request will be passed to the company&apos;s team.
        </P>

        <H2 id="sms-calls">5. SMS, Calls &amp; Recording</H2>
        <ul className="mb-4">
          <LI>
            <Strong>SMS consent:</Strong> consumers receive text messages because they submitted an inquiry to the
            company (for example, through an ad, form, or by texting or calling first). Reply <Strong>STOP</Strong> at
            any time to opt out of further messages, or <Strong>HELP</Strong> for assistance. Message frequency varies;
            message and data rates may apply.
          </LI>
          <LI>
            <Strong>Voice calls:</Strong> calls handled by the Service may be recorded and transcribed for scheduling
            accuracy and quality purposes. Where recording notice is required, it is disclosed on the call.
          </LI>
          <LI>
            <Strong>Do not contact:</Strong> opt-out requests are honored across the Service and logged.
          </LI>
        </ul>

        <H2 id="facebook-meta">6. Facebook &amp; Meta Platform Data</H2>
        <P>
          Companies may connect their Facebook Page and ad account to the Service. When they do, we access Meta
          Platform data strictly to provide the Service to that company:
        </P>
        <ul className="mb-4">
          <LI>
            <Strong>Lead Ads data:</Strong> when a consumer submits a Facebook Lead Ad form, we receive the submitted
            fields (such as name, phone number, and email) to respond to the inquiry on the company&apos;s behalf.
          </LI>
          <LI>
            <Strong>Messenger data:</Strong> when a consumer messages the company&apos;s Facebook Page, we receive and
            process those messages to respond and schedule service.
          </LI>
          <LI>
            <Strong>Page metadata:</Strong> basic Page information needed to operate the connection (Page name, ID, and
            access tokens authorized by the company).
          </LI>
        </ul>
        <P>
          We use Meta Platform data only to provide and improve the Service for the company that authorized the
          connection. We do not sell it, use it for advertising, share it with data brokers, or use it for any purpose
          unrelated to the Service. Data obtained from Meta is handled in accordance with the{" "}
          <a
            href="https://developers.facebook.com/terms/"
            className="underline"
            style={{ color: C.primary }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Meta Platform Terms
          </a>
          . Companies can disconnect their Facebook Page at any time from Settings, which stops further collection.
        </P>

        <H2 id="integrations">7. Third-Party Services</H2>
        <P>The Service is built on trusted infrastructure providers that process data on our behalf:</P>
        <ul className="mb-4">
          <LI><Strong>Twilio</Strong> — SMS delivery, phone numbers, voice calls, and WhatsApp messaging</LI>
          <LI><Strong>Anthropic</Strong> — AI language processing for conversations</LI>
          <LI><Strong>Supabase</Strong> — database and authentication infrastructure</LI>
          <LI><Strong>Stripe</Strong> — subscription billing and payments</LI>
          <LI><Strong>Resend</Strong> — transactional email delivery</LI>
          <LI><Strong>Meta Platforms</Strong> — Facebook Lead Ads, Messenger, and WhatsApp connections authorized by the company</LI>
          <LI><Strong>Housecall Pro and similar field-management platforms</Strong> — when a company connects its account, we create and update customers, jobs, and schedules in that platform on the company&apos;s behalf and receive job status updates back</LI>
          <LI><Strong>Google</Strong> — calendar synchronization when a company connects Google Calendar</LI>
        </ul>
        <P>Each provider processes data under its own security and privacy obligations and only as needed to deliver the Service.</P>

        <H2 id="sharing">8. How We Share Information</H2>
        <ul className="mb-4">
          <LI><Strong>With the company you contacted:</Strong> consumer conversations, contact details, and appointments are visible to the company handling your service request — that is the purpose of the Service.</LI>
          <LI><Strong>With service providers:</Strong> the infrastructure providers listed in Section 7, only as necessary to operate the Service.</LI>
          <LI><Strong>With connected platforms:</Strong> when a company links its field-management software or calendar, we sync relevant customer and appointment data to it.</LI>
          <LI><Strong>For legal reasons:</Strong> if required by law, subpoena, or to protect rights, safety, or the integrity of the Service.</LI>
          <LI><Strong>Business transfers:</Strong> in connection with a merger, acquisition, or sale of assets, with notice where required.</LI>
        </ul>
        <P>We never sell personal information to third parties.</P>

        <H2 id="retention">9. Data Retention</H2>
        <P>
          We retain business account data for as long as the account is active and as needed afterward for legal,
          billing, and dispute-resolution purposes. Consumer conversation data is retained while the company&apos;s
          account is active so the company can maintain its customer history. When a company closes its account, its
          data — including its consumers&apos; conversation data — is deleted or anonymized within 90 days, except
          where retention is required by law.
        </P>

        <H2 id="data-deletion">10. Data Deletion Requests</H2>
        <P>You can request deletion of your personal data at any time:</P>
        <ul className="mb-4">
          <LI>
            <Strong>Consumers (homeowners):</Strong> email{" "}
            <a href="mailto:privacy@fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
              privacy@fieldbuiltai.com
            </a>{" "}
            with the phone number or email address you used, or reply <Strong>DELETE MY DATA</Strong> in any SMS
            conversation with a company using the Service. You may also contact the company you communicated with
            directly.
          </LI>
          <LI>
            <Strong>Business users:</Strong> email{" "}
            <a href="mailto:privacy@fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
              privacy@fieldbuiltai.com
            </a>{" "}
            from your account email, or delete your account from Settings.
          </LI>
          <LI>
            <Strong>Facebook data:</Strong> if you interacted with the Service through Facebook and want data obtained
            from Meta deleted, use either method above — deletion requests cover Meta-sourced data as well.
          </LI>
        </ul>
        <P>
          We verify and complete deletion requests within 30 days and will confirm when deletion is complete. Some
          records may be retained where legally required (for example, opt-out logs, which must be kept to honor your
          opt-out).
        </P>

        <H2 id="security">11. Security</H2>
        <P>
          We protect data with industry-standard measures: encryption in transit (TLS) and at rest, row-level access
          controls that isolate each company&apos;s data, role-based team permissions, secrets management for
          credentials and tokens, and audited infrastructure providers. No system is perfectly secure; if a breach
          affecting your personal data occurs, we will notify affected parties as required by law.
        </P>

        <H2 id="your-rights">12. Your Privacy Rights</H2>
        <P>
          Depending on where you live (including California, Colorado, Virginia, and other U.S. states with privacy
          laws, and Canada under PIPEDA), you may have the right to:
        </P>
        <ul className="mb-4">
          <LI>Know what personal information we hold about you and request a copy</LI>
          <LI>Correct inaccurate personal information</LI>
          <LI>Delete your personal information (see Section 10)</LI>
          <LI>Opt out of marketing communications</LI>
          <LI>Not be discriminated against for exercising these rights</LI>
        </ul>
        <P>
          To exercise any of these rights, email{" "}
          <a href="mailto:privacy@fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
            privacy@fieldbuiltai.com
          </a>
          . We respond to verified requests within the timelines required by applicable law. We do not sell personal
          information, so no &quot;Do Not Sell&quot; opt-out is necessary.
        </P>

        <H2 id="children">13. Children&apos;s Privacy</H2>
        <P>
          The Service is intended for business use and for adults arranging home services. It is not directed to
          children under 16, and we do not knowingly collect personal information from children. If you believe a
          child has provided us personal information, contact us and we will delete it.
        </P>

        <H2 id="changes">14. Changes to This Policy</H2>
        <P>
          We may update this policy as the Service evolves. Material changes will be announced to business users by
          email and reflected by the effective date above. Continued use of the Service after changes take effect
          constitutes acceptance.
        </P>

        <H2 id="contact">15. Contact Us</H2>
        <P>
          FieldBuilt AI
          <br />
          Email:{" "}
          <a href="mailto:privacy@fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
            privacy@fieldbuiltai.com
          </a>
          <br />
          Website:{" "}
          <a href="https://fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
            fieldbuiltai.com
          </a>
        </P>

        <div
          className="mt-16 pt-8 text-xs"
          style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}
        >
          © {new Date().getFullYear()} FieldBuilt AI. All rights reserved.
        </div>
      </div>
    </div>
  )
}
