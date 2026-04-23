"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Globe, Camera, Share2, RefreshCw, Scan, CheckCircle2, AlertCircle, Save } from "lucide-react"

const FIELDS: { key: string; label: string; placeholder: string; long?: boolean }[] = [
  { key: "business_description", label: "Business overview", placeholder: "What your company does, who you serve...", long: true },
  { key: "services_offered", label: "Services offered", placeholder: "Full roof replacement, storm damage repair...", long: true },
  { key: "service_areas", label: "Service areas", placeholder: "Dallas, Plano, Frisco TX..." },
  { key: "unique_selling_points", label: "Why customers choose you", placeholder: "Lifetime warranty, GAF Master Elite...", long: true },
  { key: "pricing_info", label: "Pricing & offers", placeholder: "Free inspections, financing available..." },
  { key: "team_info", label: "Team & owner", placeholder: "Family-owned, owner Mike Smith..." },
  { key: "years_in_business", label: "Years in business", placeholder: "15 years, founded 2009..." },
  { key: "certifications", label: "Certifications", placeholder: "GAF Master Elite, licensed & insured..." },
  { key: "testimonials", label: "Customer testimonials", placeholder: "\"Best in Dallas\" — John S. ★★★★★" },
  { key: "custom_facts", label: "Custom facts", placeholder: "Anything else your AI should know...", long: true },
]

export default function KnowledgeBasePage() {
  const supabase = createClient()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [data, setData] = useState<Record<string, string>>({})
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState(false)
  const [scanError, setScanError] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: kb } = await supabase.from("knowledge_base").select("*").eq("company_id", profile.company_id).single()
      if (kb) {
        const d: Record<string, string> = {}
        FIELDS.forEach((f) => { d[f.key] = kb[f.key] ?? "" })
        d.website_url = kb.website_url ?? ""
        d.social_facebook = kb.social_facebook ?? ""
        d.social_instagram = kb.social_instagram ?? ""
        setData(d)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: string, value: string) {
    setData((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleScan() {
    if (!data.website_url) return
    setScanning(true)
    setScanError("")
    try {
      const res = await fetch("/api/onboarding/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: data.website_url,
          socialFacebook: data.social_facebook || undefined,
          socialInstagram: data.social_instagram || undefined,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const ext = json.data
      const updates: Record<string, string> = {}
      Object.entries(ext).forEach(([k, v]) => {
        const snakeKey = k.replace(/([A-Z])/g, "_$1").toLowerCase()
        if (v && typeof v === "string") updates[snakeKey] = v
      })
      setData((prev) => ({ ...prev, ...updates }))
      setScanned(true)
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setScanning(false)
    }
  }

  async function handleSave() {
    if (!companyId) return
    setSaving(true)
    const payload: Record<string, string | null> = {}
    FIELDS.forEach((f) => { payload[f.key] = data[f.key] || null })
    payload.website_url = data.website_url || null
    payload.social_facebook = data.social_facebook || null
    payload.social_instagram = data.social_instagram || null

    const { error } = await supabase
      .from("knowledge_base")
      .upsert({ company_id: companyId, ...payload }, { onConflict: "company_id" })

    setSaving(false)
    if (!error) setSaved(true)
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Everything your AI knows about your business. The more detail, the better it performs.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...</> : saved ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save changes</>}
        </Button>
      </div>

      {/* URL inputs */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="space-y-1.5">
          <Label>
            <Globe className="w-3.5 h-3.5 inline mr-1.5" />Website URL
          </Label>
          <div className="flex gap-2">
            <Input
              placeholder="https://yoursite.com"
              value={data.website_url ?? ""}
              onChange={(e) => set("website_url", e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleScan} disabled={!data.website_url || scanning} variant="outline" className="shrink-0 gap-2">
              {scanning ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Scanning...</> : <><Scan className="w-3.5 h-3.5" />Re-scan</>}
            </Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label><Share2 className="w-3.5 h-3.5 inline mr-1.5 text-blue-400" />Facebook page</Label>
            <Input placeholder="facebook.com/yourpage" value={data.social_facebook ?? ""} onChange={(e) => set("social_facebook", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label><Camera className="w-3.5 h-3.5 inline mr-1.5 text-pink-400" />Instagram</Label>
            <Input placeholder="instagram.com/yourpage" value={data.social_instagram ?? ""} onChange={(e) => set("social_instagram", e.target.value)} />
          </div>
        </div>
        {scanned && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Scan complete — review and edit below</p>}
        {scanError && <p className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{scanError}</p>}
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {FIELDS.map(({ key, label, placeholder, long }) => (
          <div key={key} className="space-y-1.5">
            <Label className={data[key] ? "text-foreground" : "text-muted-foreground"}>
              {label}
              {data[key] && <span className="ml-2 text-xs text-emerald-400">✓</span>}
            </Label>
            {long ? (
              <Textarea
                placeholder={placeholder}
                value={data[key] ?? ""}
                onChange={(e) => set(key, e.target.value)}
                rows={3}
                className="resize-none"
              />
            ) : (
              <Input placeholder={placeholder} value={data[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
            )}
          </div>
        ))}
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2 w-full">
        {saving ? "Saving..." : saved ? "✓ Saved" : "Save knowledge base"}
      </Button>
    </div>
  )
}
