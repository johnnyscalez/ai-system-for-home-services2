import { NextRequest, NextResponse } from "next/server"
import { loadIntake, saveIntake } from "@/lib/intake"
import type { IntakePhoto } from "@/lib/intake"
import { getSession } from "../_lib"

export const runtime = "nodejs"

const BUCKET = "company-assets"
const MAX_BYTES = 15 * 1024 * 1024
const MAX_PHOTOS = 60
const PHOTO_KINDS = ["before_after", "finished", "crew", "showroom", "other"]
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif",
}
const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif",
}

function extensionFor(file: File): string | null {
  const byType = EXT_BY_TYPE[file.type.toLowerCase()]
  if (byType) return byType
  // iPhones often send HEIC with an empty content type, so fall back to the name.
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return ext in TYPE_BY_EXT ? (ext === "jpeg" ? "jpg" : ext) : null
}

function prefix(companyId: string): string {
  return `intake/${companyId}/`
}

/** Upload one job photo (recorded on the intake) or the logo (returned, the form saves it). */
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, companyId } = session
  if (!companyId) return NextResponse.json({ error: "Finish the first step before adding photos." }, { status: 400 })

  const form = await req.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent." }, { status: 400 })
  const kind = String(form?.get("kind") ?? "other")
  const isLogo = kind === "logo"

  const ext = extensionFor(file)
  if (!ext) return NextResponse.json({ error: `${file.name}: only JPG, PNG, WebP or HEIC photos can be uploaded.` }, { status: 415 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: `${file.name} is larger than 15 MB.` }, { status: 413 })
  if (file.size === 0) return NextResponse.json({ error: `${file.name} is empty.` }, { status: 400 })

  const intake = await loadIntake(db, companyId)
  const photos = intake.assets?.photos ?? []
  if (!isLogo && photos.length >= MAX_PHOTOS) {
    return NextResponse.json({ error: `You can keep up to ${MAX_PHOTOS} photos. Remove one to add another.` }, { status: 400 })
  }

  const path = `${prefix(companyId)}${isLogo ? "logo-" : ""}${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    contentType: TYPE_BY_EXT[ext],
    upsert: false,
  })
  if (uploadError) {
    console.error("[onboarding/assets] upload failed:", uploadError)
    return NextResponse.json({ error: `${file.name} could not be uploaded. Please try again.` }, { status: 500 })
  }
  const url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

  if (isLogo) return NextResponse.json({ logo: { url, path } })

  const photo: IntakePhoto = {
    url,
    path,
    kind: PHOTO_KINDS.includes(kind) ? kind : "other",
    label: file.name.replace(/\.[^.]+$/, "").slice(0, 80),
  }
  const next = await saveIntake(db, companyId, {
    assets: { ...(intake.assets ?? { photos: [] }), photos: [...photos, photo] },
  })
  return NextResponse.json({ photo, photos: next.assets?.photos ?? [] })
}

/** Change how a photo is tagged. */
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, companyId } = session
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { path?: string; kind?: string; label?: string }
  if (!body.path?.startsWith(prefix(companyId))) return NextResponse.json({ error: "Photo not found." }, { status: 404 })

  const intake = await loadIntake(db, companyId)
  const photos = intake.assets?.photos ?? []
  if (!photos.some((p) => p.path === body.path)) return NextResponse.json({ error: "Photo not found." }, { status: 404 })
  const updated = photos.map((p) =>
    p.path === body.path
      ? {
          ...p,
          ...(body.kind && PHOTO_KINDS.includes(body.kind) ? { kind: body.kind } : {}),
          ...(typeof body.label === "string" ? { label: body.label.slice(0, 80) } : {}),
        }
      : p
  )
  const next = await saveIntake(db, companyId, { assets: { ...(intake.assets ?? { photos: [] }), photos: updated } })
  return NextResponse.json({ photos: next.assets?.photos ?? [] })
}

/** Remove a photo or an uploaded logo. The path must sit inside this company's folder. */
export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { db, companyId } = session
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 })

  const body = (await req.json().catch(() => ({}))) as { path?: string }
  const path = body.path ?? ""
  if (!path.startsWith(prefix(companyId)) || path.includes("..")) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 })
  }

  const { error: removeError } = await db.storage.from(BUCKET).remove([path])
  if (removeError) console.error("[onboarding/assets] storage remove failed:", removeError)

  const intake = await loadIntake(db, companyId)
  const photos = (intake.assets?.photos ?? []).filter((p) => p.path !== path)
  const next = await saveIntake(db, companyId, { assets: { ...(intake.assets ?? { photos: [] }), photos } })
  return NextResponse.json({ photos: next.assets?.photos ?? [] })
}
