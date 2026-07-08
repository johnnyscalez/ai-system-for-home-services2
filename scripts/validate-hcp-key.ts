/**
 * Day-1 validation for a contractor's Housecall Pro API key.
 *
 * Usage:  npx tsx scripts/validate-hcp-key.ts <API_KEY>
 *
 * Probes auth schemes, then runs read-only checks:
 *   1. GET /employees  — proves the key works + shows techs for dispatch mapping
 *   2. GET /customers  — proves customer read access
 *   3. GET /jobs       — proves job read access
 * Prints exactly which scheme worked and sample data shapes, so the client
 * helpers in lib/housecall.ts can be locked to the real API on day one.
 * Never writes anything.
 */

const BASE = process.env.HCP_API_BASE_URL ?? "https://api.housecallpro.com"

type Scheme = { name: string; headers: (k: string) => Record<string, string> }

const SCHEMES: Scheme[] = [
  { name: "bearer",  headers: (k) => ({ Authorization: `Bearer ${k}` }) },
  { name: "token",   headers: (k) => ({ Authorization: `Token ${k}` }) },
  { name: "api-key", headers: (k) => ({ "Api-Key": k }) },
]

async function probe(path: string, scheme: Scheme, key: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { ...scheme.headers(key), Accept: "application/json" },
  })
  const text = await res.text()
  return { status: res.status, body: text }
}

async function main() {
  const key = process.argv[2]
  if (!key) {
    console.error("Usage: npx tsx scripts/validate-hcp-key.ts <API_KEY>")
    process.exit(1)
  }

  console.log(`Probing ${BASE} ...\n`)

  let working: Scheme | null = null
  for (const scheme of SCHEMES) {
    const { status, body } = await probe("/employees?page_size=1", scheme, key)
    console.log(`[auth: ${scheme.name.padEnd(7)}] GET /employees → ${status}`)
    if (status >= 200 && status < 300) {
      working = scheme
      console.log(`\n✅ Auth scheme confirmed: "${scheme.name}"\n`)
      console.log("Sample response (first 800 chars):")
      console.log(body.slice(0, 800))
      break
    }
    if (status !== 401 && status !== 403) {
      console.log(`   Unexpected status — body: ${body.slice(0, 300)}`)
    }
  }

  if (!working) {
    console.error("\n❌ No auth scheme worked. Likely causes:")
    console.error("   - Key is invalid or was revoked")
    console.error("   - Account is not on MAX/XL plan (API not enabled)")
    console.error("   - API base URL differs — check docs.housecallpro.com")
    process.exit(1)
  }

  for (const path of ["/customers?page_size=1", "/jobs?page_size=1"]) {
    const { status, body } = await probe(path, working, key)
    console.log(`\nGET ${path} → ${status}`)
    console.log(body.slice(0, 600))
  }

  console.log("\nDone. Record the confirmed scheme in hcp_connections.auth_scheme.")
}

main()
