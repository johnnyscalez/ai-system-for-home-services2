import { redirect } from "next/navigation"
import Link from "next/link"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Phone, Link2, CreditCard, Database, ArrowRight, Sparkles, FlaskConical, ClipboardList } from "lucide-react"
import { TestLeadButton } from "@/components/settings/TestLeadButton"
import { CompanyInfoEditor } from "@/components/settings/CompanyInfoEditor"
import { CallForwardingCard } from "@/components/settings/CallForwardingCard"
import { TextingStatusCard } from "@/components/settings/TextingStatusCard"
import { LeadWebhookCard } from "@/components/settings/LeadWebhookCard"
import { voiceEnabled } from "@/lib/voice-enabled"
import { PhoneForwarded } from "lucide-react"

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, full_name, email, companies(name, service_type, service_area, notification_phone, plan, trial_ends_at, webhook_secret, avg_job_value, integration_mode)")
    .eq("id", user.id)
    .single()

  const company = (Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as {
    name: string; service_type: string | null; service_area: string | null;
    notification_phone: string | null;
    plan: string; trial_ends_at: string; webhook_secret: string; avg_job_value: number;
    integration_mode: string | null;
  } | null

  // Call forwarding only exists for accounts with the AI voice agent switched on.
  const voiceOn = await voiceEnabled(profile?.company_id ?? null)

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your account and AI configuration</p>
      </div>

      {/* Company */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Company</CardTitle>
        </CardHeader>
        <CardContent>
          <CompanyInfoEditor
            companyId={profile?.company_id ?? ""}
            initialName={company?.name ?? ""}
            initialServiceType={company?.service_type ?? ""}
            initialServiceArea={company?.service_area ?? ""}
            initialNotificationPhone={company?.notification_phone ?? ""}
            avgJobValue={company?.avg_job_value ?? 0}
          />
        </CardContent>
      </Card>

      {/* Account setup: everything collected at onboarding, editable */}
      <Link href="/settings/setup">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">Account setup</CardTitle>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Service areas, who counts as a qualified lead, your offer, photos, ad access and your measure calendar.
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Texting number and carrier registration */}
      <Card id="texting">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Texting number</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <TextingStatusCard />
        </CardContent>
      </Card>

      {voiceOn && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <PhoneForwarded className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Connect Your Existing Business Number</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CallForwardingCard />
          </CardContent>
        </Card>
      )}

      {/* Test AI */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Test Your AI</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Runs a test lead through your full setup and shows the exact opening message your assistant would send. No text is sent.
          </p>
          <TestLeadButton />
        </CardContent>
      </Card>

      {/* Lead webhook and field mapping */}
      <Card id="lead-webhook">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Lead webhook</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <LeadWebhookCard />
        </CardContent>
      </Card>

      {/* Knowledge base */}
      <Link href="/settings/knowledge-base">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">Knowledge Base</CardTitle>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Everything your assistant knows about your business: services, areas, what sets you apart, credentials. Edit it or re-scan your website anytime.
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* AI agent */}
      <Link href="/settings/ai-agent">
        <Card className="hover:border-primary/40 transition-colors cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">AI Agent</CardTitle>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure your agent&apos;s name, tone, goal, qualifying questions, objection responses, and regenerate its system prompt.
            </p>
          </CardContent>
        </Card>
      </Link>

      {/* Billing */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Billing</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current plan</span>
            <Badge variant="outline" className="bg-muted text-foreground border-border capitalize">
              {company?.plan ?? "trial"}
            </Badge>
          </div>
          {company?.plan === "trial" && (
            <p className="text-sm text-amber-700">
              Trial ends {new Date(company.trial_ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Stripe billing integration coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}
