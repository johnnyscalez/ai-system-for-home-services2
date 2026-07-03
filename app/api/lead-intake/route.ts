import { NextRequest, NextResponse } from "next/server"

// Same-origin proxy the landing page form calls. This exists so the shared
// secret the agent requires (x-intake-secret) never ships to the browser —
// a client-side fetch straight to the agent's /api/intake would put that
// secret in plain sight in the page's JS bundle and network tab. This route
// runs server-side only; it's the one place that secret ever gets attached.
//
// AGENT_INTAKE_URL + AGENT_INTAKE_SECRET are set once the agent project is
// deployed (see the "ai agent for fieldbuilt" project). Until then this
// route responds with a clear error instead of a silent failure.

export async function POST(req: NextRequest) {
  const agentUrl = process.env.AGENT_INTAKE_URL
  const agentSecret = process.env.AGENT_INTAKE_SECRET

  if (!agentUrl || !agentSecret) {
    console.error("lead-intake: AGENT_INTAKE_URL / AGENT_INTAKE_SECRET not configured yet")
    return NextResponse.json({ error: "Intake not configured" }, { status: 503 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.phone !== "string") {
    return NextResponse.json({ error: "phone is required" }, { status: 400 })
  }

  try {
    const res = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-intake-secret": agentSecret,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error("lead-intake: forwarding to agent failed:", err)
    return NextResponse.json({ error: "Failed to reach intake" }, { status: 502 })
  }
}
