import { NextRequest } from "next/server"

export const runtime = "nodejs"

// Streams ElevenLabs audio directly to Twilio's <Play> tag.
// Twilio fetches this URL when executing TwiML — it starts playing as soon as
// the first audio bytes arrive, so latency is ~200ms vs 5-10s for Polly.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const text = searchParams.get("t")
  if (!text) return new Response("Missing text", { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    console.error("[voice/speak] ELEVENLABS_API_KEY not set")
    return new Response("TTS not configured", { status: 503 })
  }

  // Aria — warm, natural, young female. Override with ELEVENLABS_VOICE_ID env var.
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "9BWtsMINqrJLrRacOk9x"

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        // ulaw_8000 = native phone codec (~8KB/s vs 176KB/s for mp3_44100_128).
        // Phone calls are 8kHz PSTN — the higher bitrate is downsampled anyway.
        // This starts playing in Twilio ~20x faster.
        output_format: "ulaw_8000",
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.80,
          style: 0.25,
          use_speaker_boost: true,
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text().catch(() => res.status.toString())
    console.error("[voice/speak] ElevenLabs error:", res.status, err)
    // Fall back to Polly so the call doesn't die with Twilio's "application error"
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Ruth-Neural">${text.replace(/[<>&'"]/g, "")}</Say></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    )
  }

  return new Response(res.body, {
    headers: {
      // audio/basic is the MIME type for μ-law 8kHz — Twilio accepts it natively
      "Content-Type": "audio/basic",
      "Cache-Control": "no-store",
    },
  })
}
