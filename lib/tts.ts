// ─── ElevenLabs TTS with in-flight dedup + pre-warm cache ────────────────────
//
// The voice TwiML flow is: our route returns TwiML containing a <Play> URL,
// THEN Twilio fetches that URL for the audio. Generating the audio only when
// Twilio asks adds the full TTS generation time to the silence the caller
// hears. Instead, the route that builds the TwiML calls prewarmTts() the
// moment the reply text exists — generation runs during the TwiML round-trip
// to Twilio, and /api/voice/speak awaits the same in-flight promise.
//
// Audio is fully buffered (never streamed through) so a mid-stream ElevenLabs
// stall can't become an edge 502 — Twilio treats a failed <Play> fetch as a
// fatal application error and hangs up on the lead.

const TTS_TIMEOUT_MS = 6000
const CACHE_TTL_MS = 120_000

type Entry = { promise: Promise<ArrayBuffer>; ts: number }
const cache = new Map<string, Entry>()

function cacheKey(text: string): string {
  return text
}

async function fetchOnce(text: string): Promise<ArrayBuffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY not set")
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "DXFkLCBUTmvXpp2QwZjA"

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({
        text,
        // eleven_flash_v2_5 + these voice settings are the signed-off sound —
        // do not change them for latency reasons.
        model_id: "eleven_flash_v2_5",
        output_format: "mp3_22050_32",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
      // Covers the whole fetch including the body read
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    }
  )
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text().catch(() => "")}`)
  const audio = await res.arrayBuffer()
  if (audio.byteLength < 100) throw new Error("ElevenLabs returned empty/truncated audio")
  return audio
}

async function fetchWithRetry(text: string): Promise<ArrayBuffer> {
  try {
    return await fetchOnce(text)
  } catch (err) {
    console.error("[tts] first attempt failed, retrying:", err instanceof Error ? err.message : err)
    return await fetchOnce(text)
  }
}

/** Get TTS audio for text — joins an in-flight generation if one exists. */
export function getTts(text: string): Promise<ArrayBuffer> {
  const key = cacheKey(text)
  const now = Date.now()

  // Drop stale entries opportunistically
  for (const [k, e] of cache) {
    if (now - e.ts > CACHE_TTL_MS) cache.delete(k)
  }

  const existing = cache.get(key)
  if (existing) return existing.promise

  const promise = fetchWithRetry(text)
  cache.set(key, { promise, ts: now })
  // A failed generation must not poison the cache — the next request retries fresh
  promise.catch(() => cache.delete(key))
  return promise
}

/** Start generating TTS for text without waiting — errors are swallowed here
 *  (the /speak route has its own last-resort fallback). */
export function prewarmTts(text: string): void {
  getTts(text).catch(() => {})
}
