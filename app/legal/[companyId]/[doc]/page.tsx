import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { loadIntake } from "@/lib/intake"

// Public SMS privacy and terms pages for a FieldBuilt client.
//
// US carriers reject a texting registration (A2P 10DLC) when the business has no
// privacy policy and no messaging terms to point at, and many contractor sites
// have neither. These two pages give every client a compliant pair from day one:
//   /legal/<companyId>/privacy
//   /legal/<companyId>/terms
// A client with their own pages enters those URLs instead and these go unused.
//
// The wording is a standard SMS program disclosure built from the company's own
// details. It makes no promise the system does not keep: opt-out by STOP is
// enforced in code, and mobile numbers are not shared for marketing.

export const dynamic = "force-dynamic"

type Params = { companyId: string; doc: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadCompany(companyId: string) {
  if (!UUID.test(companyId)) return null
  const db = createServiceRoleClient()
  const { data: company } = await db
    .from("companies").select("id, name, office_address, onboarding_completed").eq("id", companyId).maybeSingle()
  if (!company) return null
  const [intake, { data: number }, { data: kb }] = await Promise.all([
    loadIntake(db, companyId).catch(() => null),
    db.from("phone_numbers").select("phone_number").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle(),
    db.from("knowledge_base").select("website_url").eq("company_id", companyId).maybeSingle(),
  ])
  const b = intake?.a2p?.business
  const address = b?.street
    ? `${b.street}, ${b.city ?? ""}, ${b.state ?? ""} ${b.zip ?? ""}`.replace(/\s+,/g, ",").trim()
    : ((company.office_address as string | null) ?? "")
  return {
    name: (b?.legalName?.trim() || (company.name as string)) ?? "This company",
    displayName: company.name as string,
    address,
    website: b?.website?.trim() || intake?.business?.website?.trim() || (kb?.website_url as string | null) || "",
    email: b?.repEmail?.trim() || intake?.business?.ownerEmail?.trim() || "",
    phone: intake?.business?.businessPhone?.trim() || (number?.phone_number as string | undefined) || "",
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { companyId, doc } = await params
  const c = await loadCompany(companyId)
  const what = doc === "terms" ? "Messaging Terms" : "Privacy Policy"
  return { title: c ? `${what} | ${c.displayName}` : what, robots: { index: false } }
}

const UPDATED = "November 25, 2026"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1614", margin: "0 0 8px" }}>{title}</h2>
      <div style={{ fontSize: 15, lineHeight: 1.65, color: "#44403C" }}>{children}</div>
    </section>
  )
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { companyId, doc } = await params
  if (doc !== "privacy" && doc !== "terms") notFound()
  const c = await loadCompany(companyId)
  if (!c) notFound()

  const contactLine = [c.email && `email ${c.email}`, c.phone && `call or text ${c.phone}`].filter(Boolean).join(", or ")
  const contact = contactLine ? `You can ${contactLine}.` : "You can reply to any of our messages."

  return (
    <main style={{ background: "#FAFAF8", minHeight: "100vh", padding: "48px 20px" }}>
      <article style={{ maxWidth: 720, margin: "0 auto", background: "#FFFFFF", border: "1px solid #E7E5E4", borderRadius: 16, padding: "36px 32px" }}>
        <p style={{ fontSize: 13, color: "#78716C", margin: 0 }}>{c.displayName}</p>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#1A1614", margin: "6px 0 4px", fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif" }}>
          {doc === "terms" ? "Text Messaging Terms" : "Privacy Policy"}
        </h1>
        <p style={{ fontSize: 13, color: "#78716C", margin: 0 }}>Last updated {UPDATED}</p>

        {doc === "privacy" ? (
          <>
            <Section title="Who we are">
              <p>{c.name} (&quot;we&quot;, &quot;us&quot;) is a flooring contractor{c.address ? ` located at ${c.address}` : ""}.{c.website ? ` Our website is ${c.website}.` : ""} This policy explains what we collect when you ask us for a quote or contact us, and how we use it.</p>
            </Section>
            <Section title="What we collect">
              <p>When you fill in a quote request form, message us or speak with us, we collect what you give us: your name, mobile number, email, the address of the home, and details about your flooring project (the type of floor, the rooms, your timeline and similar). We also keep the text messages you exchange with us.</p>
            </Section>
            <Section title="How we use it">
              <p>We use your information to answer your request, ask about your project, schedule and confirm an in-home measure, prepare and follow up on your quote, and carry out the work if you hire us. We do not use it for anything unrelated to your request.</p>
            </Section>
            <Section title="Text messages">
              <p>If you give us your mobile number and agree to be contacted, we will text you about your request. Some replies are written by an AI assistant that works for us, and it says so. Message frequency varies with your conversation. Message and data rates may apply. You can stop texts at any time by replying STOP, and get help by replying HELP.</p>
              <p style={{ marginTop: 10 }}><strong>We do not sell, rent or share your mobile number or your text messaging consent with third parties or affiliates for their marketing.</strong> Text messaging consent is never shared with anyone for marketing purposes.</p>
            </Section>
            <Section title="Who we share it with">
              <p>We share information only with service providers who help us run our business under our instructions, such as the companies that deliver our text messages and email and host our customer records, and when the law requires it. They may not use your information for their own purposes.</p>
            </Section>
            <Section title="How long we keep it">
              <p>We keep your information for as long as we need it to serve you and to keep proper business records, and we delete it when you ask us to unless the law requires us to keep it.</p>
            </Section>
            <Section title="Your choices">
              <p>You can ask us what we hold about you, ask us to correct it, or ask us to delete it. {contact}</p>
            </Section>
          </>
        ) : (
          <>
            <Section title="The program">
              <p>When you request a flooring quote from {c.name} and provide your mobile number, you agree to receive text messages from us about that request: questions about your project, scheduling and confirming an in-home measure, appointment reminders, and follow-up on your quote. Some messages are written by an AI assistant that works for us, and it says so.</p>
            </Section>
            <Section title="Frequency and cost">
              <p>Message frequency varies with your conversation. Message and data rates may apply, depending on your mobile plan. We do not charge for the messages.</p>
            </Section>
            <Section title="How to stop">
              <p>Reply <strong>STOP</strong> to any message and we will stop texting you. You will not receive further messages unless you contact us again. Reply <strong>START</strong> to opt back in.</p>
            </Section>
            <Section title="Help">
              <p>Reply <strong>HELP</strong> for help. {contact}</p>
            </Section>
            <Section title="Consent">
              <p>Agreeing to receive text messages is not a condition of buying anything from us. Carriers are not liable for delayed or undelivered messages.</p>
            </Section>
            <Section title="Privacy">
              <p>We do not sell or share your mobile number or your messaging consent with third parties or affiliates for marketing. See our <a href={`/legal/${companyId}/privacy`} style={{ color: "#EA580C" }}>Privacy Policy</a>.</p>
            </Section>
          </>
        )}
      </article>
    </main>
  )
}
