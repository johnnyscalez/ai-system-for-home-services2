import { NextRequest, NextResponse } from "next/server"
import { scrapeAndExtractBusinessInfo } from "@/lib/claude"
import { getSession } from "../_lib"

export const runtime = "nodejs"

/**
 * Reads the owner's website and returns what it found: the business fields for
 * the knowledge base plus the logo, brand color, photos, phone and social links
 * read from the markup. Also used by Settings > Knowledge base, which reads the
 * same `data.businessDescription` style keys.
 */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { url, socialFacebook, socialInstagram } = (await req.json()) as {
      url?: string; socialFacebook?: string; socialInstagram?: string
    }
    if (!url?.trim()) return NextResponse.json({ error: "Enter your website address first." }, { status: 400 })

    const scan = await scrapeAndExtractBusinessInfo(url, { facebook: socialFacebook, instagram: socialInstagram })
    if (!scan.reachable) {
      return NextResponse.json(
        { error: "We could not open that website. Check the address, or fill the details in by hand." },
        { status: 422 }
      )
    }

    // Keep the raw findings (photo candidates, logo, links) so the owner can
    // come back and pick website photos later without scanning again.
    if (session.companyId) {
      const { db, companyId } = session
      const { data: kb } = await db.from("knowledge_base").select("id, scraped_raw").eq("company_id", companyId).maybeSingle()
      const raw = ((kb?.scraped_raw ?? {}) as Record<string, unknown>) ?? {}
      const scraped_raw = {
        ...raw,
        scan: {
          url: scan.pagesRead[0] ?? url,
          scannedAt: new Date().toISOString(),
          imageUrls: scan.imageUrls,
          logoUrl: scan.logoUrl,
          brandColor: scan.brandColor,
          socialLinks: scan.socialLinks,
          phone: scan.phone,
          serviceAreas: scan.serviceAreas ?? null,
          pagesRead: scan.pagesRead.length,
        },
      }
      const stamp = { scraped_raw, last_scraped_at: new Date().toISOString() }
      if (kb?.id) await db.from("knowledge_base").update(stamp).eq("id", kb.id)
      else await db.from("knowledge_base").insert({ company_id: companyId, ...stamp })
    }

    return NextResponse.json({ data: scan })
  } catch (err) {
    console.error("[onboarding/scrape] failed:", err)
    return NextResponse.json({ error: "The scan did not finish. You can fill the details in by hand." }, { status: 500 })
  }
}
