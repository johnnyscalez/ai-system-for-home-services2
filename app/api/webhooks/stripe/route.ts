import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase-server"

export const runtime = "nodejs"

const PLAN_MAP: Record<string, string> = {
  price_starter: "starter",
  price_growth:  "growth",
  price_scale:   "scale",
}

function planFromPriceId(priceId: string): string {
  for (const [key, val] of Object.entries(PLAN_MAP)) {
    if (priceId.includes(key)) return val
  }
  return "starter"
}

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "")
  const rawBody = await req.text()
  const sig = req.headers.get("stripe-signature")

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const supabase = createServiceRoleClient()

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const priceId = sub.items.data[0]?.price?.id ?? ""
      const plan = planFromPriceId(priceId)

      const statusMap: Record<string, string> = {
        active:   plan,
        trialing: "trial",
        past_due: "past_due",
        canceled: "cancelled",
        unpaid:   "past_due",
      }

      await supabase
        .from("companies")
        .update({
          plan: statusMap[sub.status] ?? plan,
          stripe_subscription_id: sub.id,
          trial_ends_at: sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId)
      break
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from("companies")
        .update({ plan: "cancelled", stripe_subscription_id: null, updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", sub.customer as string)
      break
    }

    case "invoice.payment_succeeded": {
      const inv = event.data.object as Stripe.Invoice
      const lineItem = inv.lines?.data[0] as Stripe.InvoiceLineItem & { price?: { id: string } }
      await supabase
        .from("companies")
        .update({ plan: planFromPriceId(lineItem?.price?.id ?? ""), updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", inv.customer as string)
      break
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice
      await supabase
        .from("companies")
        .update({ plan: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", inv.customer as string)
      break
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const companyId = session.metadata?.company_id
      if (!companyId) break

      await supabase
        .from("companies")
        .update({
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId)
      break
    }
  }

  return NextResponse.json({ received: true })
}
