import { NextResponse } from "next/server"
import { loadIntake, saveIntake } from "@/lib/intake"
import { applyIntakeToRuntime } from "@/lib/intake-apply"
import { missingForLaunch } from "@/components/onboarding/logic"
import { getSession } from "../_lib"

export const runtime = "nodejs"

/**
 * Finishes onboarding: compiles the intake into the running config (service
 * area zips, knowledge base, assistant settings, measure capacity, the
 * assistant's base prompt) and opens the dashboard. On an account that is
 * already live it re-runs the same compile, which is how Settings > Account
 * setup retrains the assistant.
 *
 * Facebook, photos and the carrier registration are NOT required here:
 * FieldBuilt installs the account and chases those.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, companyId } = session
  if (!companyId) return NextResponse.json({ error: "Start with your business details." }, { status: 400 })

  try {
    const [{ data: company }, intake] = await Promise.all([
      db.from("companies").select("name, onboarding_completed, notification_phone").eq("id", companyId).maybeSingle(),
      loadIntake(db, companyId),
    ])
    if (!company) return NextResponse.json({ error: "Company not found." }, { status: 404 })

    const missing = missingForLaunch({
      companyName: (company.name as string | null) ?? "",
      ownerMobile: (company.notification_phone as string | null) ?? "",
      intake,
    })
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Still needed: ${missing.map((m) => m.message).join(", ")}.`, missing },
        { status: 400 }
      )
    }

    const result = await applyIntakeToRuntime(companyId, { prompt: "always" })

    if (!company.onboarding_completed) {
      const { error } = await db.from("companies").update({ onboarding_completed: true }).eq("id", companyId)
      if (error) throw new Error(error.message)
      await saveIntake(db, companyId, {
        progress: {
          step: 10,
          completedSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          finishedAt: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({ success: true, companyId, ...result })
  } catch (err) {
    console.error("[onboarding/complete] failed:", err)
    return NextResponse.json({ error: "Setup did not finish. Please try again." }, { status: 500 })
  }
}
