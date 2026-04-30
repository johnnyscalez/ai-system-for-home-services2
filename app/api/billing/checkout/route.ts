import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServiceRoleClient, createServerSupabaseClient } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")

  const PRICE_IDS: Record<string, string> = {
    starter: process.env.STRIPE_PRICE_STARTER ?? "",
    growth:  process.env.STRIPE_PRICE_GROWTH  ?? "",
    scale:   process.env.STRIPE_PRICE_SCALE   ?? "",
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { plan = "starter" } = await req.json()
  const priceId = PRICE_IDS[plan]
  if (!priceId) return NextResponse.json({ error: "Invalid plan or price not configured" }, { status: 400 })

  const db = createServiceRoleClient()
  const { data: userData } = await db
    .from("users")
    .select("company_id, email, full_name, companies(stripe_customer_id)")
    .eq("id", user.id)
    .single()

  if (!userData?.company_id) return NextResponse.json({ error: "No company" }, { status: 400 })

  const companyData = (userData.companies as unknown) as { stripe_customer_id: string | null } | null
  let customerId = companyData?.stripe_customer_id ?? undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: (userData as { full_name?: string }).full_name ?? undefined,
      metadata: { company_id: userData.company_id },
    })
    customerId = customer.id
    await db
      .from("companies")
      .update({ stripe_customer_id: customerId })
      .eq("id", userData.company_id)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { company_id: userData.company_id },
    },
    metadata: { company_id: userData.company_id },
    success_url: `${appUrl}/dashboard?billing=success`,
    cancel_url:  `${appUrl}/dashboard?billing=cancelled`,
  })

  return NextResponse.json({ url: session.url })
}
