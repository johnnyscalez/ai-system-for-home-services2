import { NextRequest } from "next/server"
import { getTts } from "@/lib/tts"

export const runtime = "nodejs"

// Serves ElevenLabs audio to Twilio's <Play> tag.
//
// RELIABILITY CONTRACT: this route must NEVER return a non-200 to Twilio.
// If Twilio can't fetch the audio for a <Play> inside a live call it plays
// "we're sorry, an application error has occurred" and hangs up on the lead
// (error 11200 — this killed a real booking call). Audio is fully buffered
// by lib/tts (with retry + timeout), and usually already generated: the
// TwiML-building routes pre-warm the cache the moment the reply text exists.
// Last resort is a short silent WAV: the lead hears a pause, says "hello?",
// and the trailing Gather recovers the conversation — infinitely better
// than Twilio killing the call.

// 0.4s of 8kHz 16-bit mono silence — a valid WAV Twilio will always accept.
function silentWav(seconds = 0.4, rate = 8000): ArrayBuffer {
  const dataLen = Math.floor(seconds * rate) * 2
  const buf = Buffer.alloc(44 + dataLen) // samples stay zeroed = silence
  buf.write("RIFF", 0)
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write("WAVE", 8)
  buf.write("fmt ", 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)  // PCM
  buf.writeUInt16LE(1, 22)  // mono
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write("data", 36)
  buf.writeUInt32LE(dataLen, 40)
  const out = new ArrayBuffer(buf.length)
  new Uint8Array(out).set(buf)
  return out
}
const SILENT_WAV = silentWav()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const text = searchParams.get("t")
  if (!text) return new Response("Missing text", { status: 400 })

  try {
    const audio = await getTts(text)
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    })
  } catch (err) {
    console.error("[voice/speak] TTS failed after retries — serving silence to keep the call alive:",
      err instanceof Error ? err.message : err)
    return new Response(SILENT_WAV, {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    })
  }
}
