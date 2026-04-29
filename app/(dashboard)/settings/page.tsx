import { redirect } from "next/navigation"
import Link from "next/link"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Zap, Phone, Link2, CreditCard, Database, ArrowRight, Sparkles, FlaskConical } from "lucide-react"
import { TestLeadButton } from "@/components/settings/TestLeadButton"

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("company_id, full_name, email, companies(name, service_type, service_area, plan, trial_ends_at, webhook_secret)")
    .eq("id", user.id)
    .single()

  const company = (Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as {
    name: string; service_type: string | null; service_area: string | null;
    plan: string; trial_ends_at: string; webhook_secret: string;
  } | null

  const { data: phoneData } = await supabase
    .from("phone_numbers")
    .select("phone_number")
    .eq("company_id", profile?.company_id ?? "")
    .eq("is_active", true)
    .single()

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
        <CardContent className="space-y-3">
          <Row label="Company name" value={company?.name ?? "—"} />
          <Row label="Service type" value={company?.service_type ?? "—"} />
          <Row label="Service area" value={company?.service_area ?? "—"} />
        </CardContent>
      </Card>

      {/* AI phone number */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">AI Phone Number</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-mono font-semibold text-primary">
            {phoneData?.phone_number ?? "Not provisioned yet"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Your AI texts and calls every lead from this number. Replies go straight to your CRM.
          </p>
        </CardContent>
      </Card>

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
            Runs a test lead through your full AI setup and shows you the exact opening message your AI would send. No real SMS is sent.
          </p>
          <TestLeadButton />
        </CardContent>
      </Card>

      {/* Webhook */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Webhook URL</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            Paste this URL into any lead source (Google Ads, Angi, your website form):
          </p>
          <div className="bg-muted rounded-lg p-3">
            <code className="text-xs text-primary break-all">
              {`https://app.leadreply.ai/api/webhooks/lead?secret=${company?.webhook_secret ?? "••••••••"}`}
            </code>
          </div>
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
              Everything your AI knows about your business — services, areas, USPs, certifications. Edit and re-scan your website anytime.
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
            <Badge variant="outline" className="bg-sky-500/15 text-sky-400 border-sky-500/20 capitalize">
              {company?.plan ?? "trial"}
            </Badge>
          </div>
          {company?.plan === "trial" && (
            <p className="text-sm text-amber-400">
              Trial ends {new Date(company.trial_ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Stripe billing integration coming soon.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium capitalize">{value}</span>
    </div>
  )
}
