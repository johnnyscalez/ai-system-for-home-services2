import { NextResponse } from "next/server"
import { getTwilioClient } from "@/lib/twilio"
import { zipFromAddress, zipToPoint } from "@/lib/routing"
import { loadIntake } from "@/lib/intake"
import { getSession } from "../_lib"

export const runtime = "nodejs"

/** Toll-free and non-geographic codes say nothing about where the business is. */
const NON_LOCAL_CODES = new Set(["800", "833", "844", "855", "866", "877", "888", "500", "521", "522", "533", "544", "566", "577", "588", "900"])

/** The 3-digit area code of a US phone number, or null when it is not a local one. */
function localAreaCode(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "")
  if (d.length !== 10 || !/^[2-9]/.test(d)) return null
  const code = d.slice(0, 3)
  return NON_LOCAL_CODES.has(code) ? null : code
}

/**
 * Reserves the company's local texting number and records it. Safe to call
 * twice: a company that already has a number gets that number back, and a
 * number bought on an attempt whose database write failed is found again by
 * its Twilio label instead of buying a second one.
 */
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, companyId } = session
  if (!companyId) return NextResponse.json({ error: "Finish the first step before reserving a number." }, { status: 400 })

  const { data: existing } = await db
    .from("phone_numbers").select("phone_number, twilio_sid").eq("company_id", companyId).eq("is_active", true).limit(1).maybeSingle()
  if (existing?.phone_number) {
    return NextResponse.json({ phoneNumber: existing.phone_number, twilioSid: existing.twilio_sid, alreadyReserved: true })
  }

  const [{ data: company }, intake] = await Promise.all([
    db.from("companies").select("name, office_address").eq("id", companyId).maybeSingle(),
    loadIntake(db, companyId),
  ])
  const state = intake.business?.state
  if (!state) return NextResponse.json({ error: "Pick your state on the first step so we can find a local number." }, { status: 400 })

  const client = getTwilioClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const webhooks = {
    smsUrl: `${appUrl}/api/webhooks/sms`,
    smsMethod: "POST",
    voiceUrl: `${appUrl}/api/voice/inbound`,
    voiceMethod: "POST",
    statusCallback: `${appUrl}/api/voice/status`,
    statusCallbackMethod: "POST",
  } as const
  // The short company id keeps the label unique when two companies share a name.
  const label = `FieldBuilt — ${String(company?.name ?? "Company").slice(0, 40)} · ${companyId.slice(0, 8)}`

  const record = async (phoneNumber: string, twilioSid: string) => {
    const { error } = await db.from("phone_numbers").insert({
      company_id: companyId, phone_number: phoneNumber, twilio_sid: twilioSid, is_active: true,
    })
    if (error) throw new Error(`The number ${phoneNumber} was reserved but could not be saved: ${error.message}`)
  }

  try {
    const labelled = await client.incomingPhoneNumbers.list({ friendlyName: label, limit: 1 })
    if (labelled.length > 0) {
      await client.incomingPhoneNumbers(labelled[0].sid).update(webhooks)
      await record(labelled[0].phoneNumber, labelled[0].sid)
      return NextResponse.json({ phoneNumber: labelled[0].phoneNumber, twilioSid: labelled[0].sid })
    }

    // The number must look local to the homeowners it texts, so the search goes
    // from most local to least, and never leaves the company's state:
    //   1. the area code of the business's own phone (the code its customers
    //      already know), inside the state
    //   2. numbers in the office's zip code
    //   3. numbers within 25, 50, then 100 miles of the office
    //   4. anywhere in the state
    // A statewide-only search once handed a Chicago contractor a Springfield
    // number, 200 miles from its homeowners. An out-of-state number is never
    // bought: FieldBuilt sorts that out by hand instead.
    const officeZip = zipFromAddress(company?.office_address as string | null)
    const officePoint = zipToPoint(officeZip)
    const areaCode = localAreaCode(intake.business?.businessPhone)
    const base = { smsEnabled: true, voiceEnabled: true, limit: 5 } as const
    const search = (filters: Record<string, string | number>) =>
      client.availablePhoneNumbers("US").local.list({ ...base, ...filters })

    let available: Array<{ phoneNumber: string }> = []
    let matchedBy = ""
    if (areaCode) {
      available = await search({ areaCode: Number(areaCode), inRegion: state })
      if (available.length) matchedBy = `area code ${areaCode}`
    }
    if (!available.length && officeZip) {
      available = await search({ inPostalCode: officeZip })
      if (available.length) matchedBy = `zip ${officeZip}`
    }
    if (!available.length && officePoint) {
      for (const distance of [25, 50, 100]) {
        available = await search({ nearLatLong: `${officePoint.lat},${officePoint.lng}`, distance, inRegion: state })
        if (available.length) { matchedBy = `within ${distance} miles of the office`; break }
      }
    }
    if (!available.length) {
      available = await search({ inRegion: state })
      if (available.length) matchedBy = `in ${state}`
    }
    if (!available.length) {
      return NextResponse.json({
        error: `No local numbers are free in ${state} right now. FieldBuilt will get your number set up with you on the install call.`,
      }, { status: 422 })
    }
    console.log(`[onboarding/provision-phone] company ${companyId}: buying ${available[0].phoneNumber} (${matchedBy})`)

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      friendlyName: label,
      ...webhooks,
    })
    await record(purchased.phoneNumber, purchased.sid)
    return NextResponse.json({ phoneNumber: purchased.phoneNumber, twilioSid: purchased.sid })
  } catch (err) {
    console.error("[onboarding/provision-phone] failed:", err)
    return NextResponse.json({ error: "We could not reserve a number. Please try again." }, { status: 500 })
  }
}
