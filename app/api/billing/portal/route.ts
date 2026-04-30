import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServiceRoleClient, createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(_req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const db = createServiceRoleClient()
  const { data: userData } = await db
    .from("users")
    .select("company_id, companies(stripe_customer_id)")
    .eq("id", user.id)
    .single()

  const companyData = (userData?.companies as unknown) as { stripe_customer_id: string | null } | null
  if (!companyData?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const session = await stripe.billingPortal.sessions.create({
    customer: companyData.stripe_customer_id,
    return_url: `${appUrl}/dashboard/settings`,
  })

  return NextResponse.json({ url: session.url })
}
