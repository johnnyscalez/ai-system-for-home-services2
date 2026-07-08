import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service — FieldBuilt AI",
  description: "The terms that govern use of the FieldBuilt AI service.",
}

const C = {
  bg: "#FAFAF8",
  surface: "#FFFFFF",
  primary: "#F97316",
  text: "#1C1917",
  muted: "#78716C",
  border: "#E7E5E4",
} as const

const EFFECTIVE_DATE = "July 8, 2026"

const SECTIONS = [
  { id: "acceptance", label: "1. Acceptance of Terms" },
  { id: "service", label: "2. The Service" },
  { id: "accounts", label: "3. Accounts & Eligibility" },
  { id: "customer-responsibilities", label: "4. Your Responsibilities" },
  { id: "messaging-compliance", label: "5. Messaging & Calling Compliance" },
  { id: "ai-limitations", label: "6. AI Limitations" },
  { id: "integrations", label: "7. Third-Party Integrations" },
  { id: "fees", label: "8. Fees & Payment" },
  { id: "data", label: "9. Data & Privacy" },
  { id: "ip", label: "10. Intellectual Property" },
  { id: "termination", label: "11. Termination" },
  { id: "disclaimers", label: "12. Disclaimers" },
  { id: "liability", label: "13. Limitation of Liability" },
  { id: "indemnification", label: "14. Indemnification" },
  { id: "general", label: "15. General Terms" },
  { id: "contact", label: "16. Contact" },
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

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="text-sm mb-10" style={{ color: C.muted }}>
          Effective date: <span style={{ color: C.text, fontWeight: 600 }}>{EFFECTIVE_DATE}</span>
        </p>

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

        <H2 id="acceptance">1. Acceptance of Terms</H2>
        <P>
          These Terms of Service (&quot;Terms&quot;) are an agreement between FieldBuilt AI (&quot;FieldBuilt,&quot;
          &quot;we,&quot; &quot;us&quot;) and the business that creates an account (&quot;you,&quot; the
          &quot;Customer&quot;). By creating an account, signing an order form, or using the Service, you accept these
          Terms on behalf of your company and confirm you have authority to do so. If you do not agree, do not use the
          Service.
        </P>

        <H2 id="service">2. The Service</H2>
        <P>
          FieldBuilt provides an AI-powered communication and scheduling system for home service businesses. The
          Service can receive customer inquiries across channels (such as SMS, phone calls, web forms, Facebook Lead
          Ads, Facebook Messenger, and WhatsApp), respond conversationally, qualify leads, schedule appointments, send
          follow-ups and reminders, and sync with business software the Customer connects. Features vary by plan and
          may evolve over time.
        </P>

        <H2 id="accounts">3. Accounts &amp; Eligibility</H2>
        <ul className="mb-4">
          <LI>The Service is for businesses, not consumers. You must be at least 18 and using the Service for commercial purposes.</LI>
          <LI>You are responsible for your account credentials and for all activity by your team members under your account.</LI>
          <LI>Information you provide (business details, service areas, team configuration) must be accurate and kept current — the AI acts on it.</LI>
        </ul>

        <H2 id="customer-responsibilities">4. Your Responsibilities</H2>
        <ul className="mb-4">
          <LI>Use the Service only for lawful business communication with people who contacted your business or otherwise consented to be contacted.</LI>
          <LI>Do not upload or import contact lists without a lawful basis to message them.</LI>
          <LI>Do not use the Service for spam, harassment, deceptive practices, emergency services dispatch (911-type services), or any illegal purpose.</LI>
          <LI>Honor commitments made to your customers, including appointments scheduled through the Service.</LI>
          <LI>Configure business rules (service areas, job types, pricing policies, working hours) accurately — the AI relies on your configuration.</LI>
        </ul>

        <H2 id="messaging-compliance">5. Messaging &amp; Calling Compliance</H2>
        <P>
          The Service sends SMS messages and places calls on your behalf. You and FieldBuilt share compliance
          responsibilities:
        </P>
        <ul className="mb-4">
          <LI>
            <Strong>FieldBuilt provides</Strong> opt-out handling (STOP/HELP), opt-out logging, quiet-hours controls,
            AI disclosure capabilities, and carrier registration of messaging traffic.
          </LI>
          <LI>
            <Strong>You are responsible for</Strong> ensuring the leads routed into the Service have an appropriate
            basis to be contacted (for example, they submitted an inquiry or ad form), and for the accuracy of any
            content and offers you configure.
          </LI>
          <LI>
            You will not instruct the Service to contact numbers on do-not-call lists or people who have opted out.
          </LI>
        </ul>

        <H2 id="ai-limitations">6. AI Limitations</H2>
        <P>
          The Service uses artificial intelligence to conduct conversations. AI output can occasionally be inaccurate
          or incomplete. The Service is designed with guardrails (for example, it does not quote job prices and does
          not provide diagnoses), but <Strong>you remain responsible for your business decisions and commitments</Strong>.
          Appointments, quotes, and work performed are between you and your customer; FieldBuilt is a communication
          tool, not a party to your service contracts. You should review AI activity through your dashboard and
          correct configuration when needed.
        </P>

        <H2 id="integrations">7. Third-Party Integrations</H2>
        <P>
          You may connect third-party accounts (such as Facebook Pages, Housecall Pro, Google Calendar, or WhatsApp).
          Your use of those platforms remains governed by their own terms. You authorize FieldBuilt to access and
          update data in connected platforms on your behalf (for example, creating jobs and customers in your field
          management software). If a platform changes or revokes API access, related features may stop working;
          FieldBuilt is not liable for third-party platform changes.
        </P>

        <H2 id="fees">8. Fees &amp; Payment</H2>
        <ul className="mb-4">
          <LI>Fees are as stated at purchase or in your order form, billed via Stripe on a recurring basis.</LI>
          <LI>Usage-based charges (such as SMS overage), where applicable, are billed per the plan terms.</LI>
          <LI>Fees are exclusive of taxes; you are responsible for applicable taxes.</LI>
          <LI>Late or failed payments may result in suspension after notice. Except where required by law or stated otherwise in writing, fees are non-refundable.</LI>
          <LI>We may change pricing with at least 30 days&apos; notice, effective at your next billing cycle.</LI>
        </ul>

        <H2 id="data">9. Data &amp; Privacy</H2>
        <P>
          Our collection and use of data is described in the{" "}
          <Link href="/privacy" className="underline" style={{ color: C.primary }}>
            Privacy Policy
          </Link>
          . As between the parties, you own your business data and your customers&apos; data processed through the
          Service; you grant FieldBuilt the license needed to operate the Service. We may use aggregated, de-identified
          usage data to improve the Service.
        </P>

        <H2 id="ip">10. Intellectual Property</H2>
        <P>
          FieldBuilt owns the Service, including software, AI configurations, designs, and documentation. You receive a
          limited, non-exclusive, non-transferable right to use the Service during your subscription. You may not
          reverse engineer, resell, or copy the Service, or use it to build a competing product.
        </P>

        <H2 id="termination">11. Termination</H2>
        <ul className="mb-4">
          <LI>You may cancel at any time; cancellation takes effect at the end of the current billing period.</LI>
          <LI>We may suspend or terminate for material breach (including compliance violations under Section 5) with notice where practicable.</LI>
          <LI>Upon termination, your data is handled per the retention terms in the Privacy Policy. You may request an export of your data within 30 days of termination.</LI>
        </ul>

        <H2 id="disclaimers">12. Disclaimers</H2>
        <P>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT PERMITTED BY
          LAW, FIELDBUILT DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
          ERROR-FREE, OR THAT EVERY LEAD WILL BE CAPTURED, EVERY MESSAGE DELIVERED, OR ANY PARTICULAR BUSINESS RESULT
          ACHIEVED.
        </P>

        <H2 id="liability">13. Limitation of Liability</H2>
        <P>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW: (A) NEITHER PARTY IS LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
          CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR LOST PROFITS OR REVENUE; AND (B) FIELDBUILT&apos;S TOTAL LIABILITY
          ARISING OUT OF THE SERVICE IS LIMITED TO THE FEES YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE EVENT
          GIVING RISE TO LIABILITY. THESE LIMITS DO NOT APPLY TO YOUR PAYMENT OBLIGATIONS OR EITHER PARTY&apos;S
          INDEMNIFICATION OBLIGATIONS.
        </P>

        <H2 id="indemnification">14. Indemnification</H2>
        <P>
          You will defend and indemnify FieldBuilt against third-party claims arising from your violation of Section 4
          or 5 (including claims that you lacked consent to contact a person), your service work, or your breach of
          these Terms. FieldBuilt will defend and indemnify you against third-party claims that the Service, as
          provided, infringes their intellectual property rights.
        </P>

        <H2 id="general">15. General Terms</H2>
        <ul className="mb-4">
          <LI><Strong>Governing law:</Strong> the laws of the State of Delaware, excluding conflict-of-law rules.</LI>
          <LI><Strong>Disputes:</Strong> the parties will first attempt good-faith resolution; unresolved disputes go to the state or federal courts located in Delaware.</LI>
          <LI><Strong>Changes:</Strong> we may update these Terms; material changes will be notified by email at least 14 days before taking effect. Continued use constitutes acceptance.</LI>
          <LI><Strong>Assignment:</Strong> you may not assign these Terms without our consent, except in a sale of your business. We may assign in connection with a merger or acquisition.</LI>
          <LI><Strong>Entire agreement:</Strong> these Terms plus the Privacy Policy and any order form are the full agreement and supersede prior discussions.</LI>
        </ul>

        <H2 id="contact">16. Contact</H2>
        <P>
          FieldBuilt AI
          <br />
          Email:{" "}
          <a href="mailto:support@fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
            support@fieldbuiltai.com
          </a>
          <br />
          Website:{" "}
          <a href="https://fieldbuiltai.com" className="underline" style={{ color: C.primary }}>
            fieldbuiltai.com
          </a>
        </P>

        <div className="mt-16 pt-8 text-xs" style={{ borderTop: `1px solid ${C.border}`, color: C.muted }}>
          © {new Date().getFullYear()} FieldBuilt AI. All rights reserved.
        </div>
      </div>
    </div>
  )
}
