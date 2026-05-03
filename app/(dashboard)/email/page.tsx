import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { EmailTemplatesClient } from "@/components/email/EmailTemplatesClient"

export default async function EmailPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) redirect("/onboarding")

  const [{ data: templates }, { data: company }, { data: gmailConn }] = await Promise.all([
    supabase.from("email_templates").select("*").eq("company_id", profile.company_id).single(),
    supabase.from("companies").select("name, service_type").eq("id", profile.company_id).single(),
    supabase.from("gmail_connections").select("gmail_email, is_connected").eq("company_id", profile.company_id).eq("is_connected", true).single(),
  ])

  return (
    <EmailTemplatesClient
      initialTemplates={templates ?? null}
      companyName={company?.name ?? "Your Company"}
      serviceType={company?.service_type ?? "home services"}
      connectedGmailEmail={gmailConn?.gmail_email ?? null}
    />
  )
}
