import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { saveA2pBusiness, autoSubmitA2p, publicA2pState } from "@/lib/a2p"
import type { A2pBusiness } from "@/lib/intake"

export const runtime = "nodejs"

// POST /api/a2p/register  { business?: Partial<A2pBusiness> }
// Saves the business details for the texting registration. There is no submit
// button: on a finished account, complete details are filed right away by
// autoSubmitA2p (when A2P_SUBMIT_ENABLED is on and the company has a number).
// During onboarding the filing waits for the end of setup.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { business?: Partial<A2pBusiness> }

  const FIELDS: Array<keyof A2pBusiness> = [
    "legalName", "businessType", "ein", "street", "city", "state", "zip", "website",
    "repFirstName", "repLastName", "repTitle", "repEmail", "repPhone", "privacyPolicyUrl", "termsUrl",
  ]
  const clean: Partial<A2pBusiness> = {}
  for (const f of FIELDS) {
    const v = body.business?.[f]
    if (typeof v === "string") clean[f] = v.trim().slice(0, 300)
  }

  let state = Object.keys(clean).length > 0
    ? await saveA2pBusiness(profile.company_id, clean)
    : undefined
  state = (await autoSubmitA2p(profile.company_id)) ?? state

  return NextResponse.json({ ...publicA2pState(state), business: state?.business ?? clean })
}
