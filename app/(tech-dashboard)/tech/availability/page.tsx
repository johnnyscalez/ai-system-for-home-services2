import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { TechAvailabilityClient } from "@/components/tech/TechAvailabilityClient"

export const dynamic = "force-dynamic"

export default async function TechAvailabilityPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/tech/login")
  if (user.app_metadata?.role !== "technician") redirect("/dashboard")

  return <TechAvailabilityClient />
}
