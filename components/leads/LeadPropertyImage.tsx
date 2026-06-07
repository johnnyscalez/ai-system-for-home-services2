"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Camera, Satellite, ExternalLink, MapPin } from "lucide-react"

type ImageSource = "street_view" | "maps_static_fallback"

interface PropertyResult {
  source: ImageSource
  imageUrl: string
  metadata: {
    status: string
    lat?: number | null
    lng?: number | null
    date?: string | null
    pano_id?: string | null
  }
}

type FetchState = "idle" | "loading" | "ready" | "img-loading" | "done" | "error"

export function LeadPropertyImage({ address }: { address: string | null }) {
  const [fetchState, setFetchState] = useState<FetchState>("idle")
  const [result, setResult]         = useState<PropertyResult | null>(null)
  const [imgLoaded, setImgLoaded]   = useState(false)
  const [imgError, setImgError]     = useState(false)
  const fetchedRef                  = useRef(false)

  useEffect(() => {
    if (!address?.trim() || fetchedRef.current) return
    fetchedRef.current = true

    setFetchState("loading")

    fetch("/api/property-image", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ address: address.trim() }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setResult(data as PropertyResult)
          setFetchState("ready")
        } else {
          setFetchState("error")
        }
      })
      .catch(() => setFetchState("error"))
  }, [address])

  // Nothing to show without an address or after silent API failure
  if (!address?.trim() || fetchState === "idle" || fetchState === "error") return null

  const isStreetView = result?.source === "street_view"
  const mapsHref =
    result?.metadata.lat && result?.metadata.lng
      ? `https://www.google.com/maps?q=${result.metadata.lat},${result.metadata.lng}`
      : `https://www.google.com/maps/search/${encodeURIComponent(address)}`

  return (
    <div className="space-y-2">
      {/* Section label */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Property
        </p>
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-primary transition-colors"
        >
          <ExternalLink className="w-2.5 h-2.5" />
          Open in Maps
        </a>
      </div>

      {/* Image card */}
      <div
        className="relative overflow-hidden rounded-xl bg-muted/40 border border-border/50"
        style={{ aspectRatio: "16/10" }}
      >
        {/* ── Shimmer skeleton while fetching metadata or image ─────────────── */}
        <AnimatePresence>
          {(fetchState === "loading" || (fetchState === "ready" && !imgLoaded)) && (
            <motion.div
              key="skeleton"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 overflow-hidden"
            >
              {/* Shimmer base */}
              <div className="absolute inset-0 bg-gradient-to-br from-muted/80 via-muted/40 to-muted/80" />
              {/* Animated shimmer bar */}
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.3 }}
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              />
              {/* Placeholder icon */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-30">
                <MapPin className="w-6 h-6 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium tracking-wide">
                  {fetchState === "loading" ? "Looking up property…" : "Loading image…"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Actual image ────────────────────────────────────────────────────── */}
        {result && (
          <>
            <motion.img
              key={result.imageUrl}
              src={result.imageUrl}
              alt={`Street view of ${address}`}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={imgLoaded && !imgError ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="absolute inset-0 w-full h-full object-cover"
              onLoad={() => { setImgLoaded(true); setFetchState("done") }}
              onError={() => { setImgError(true); setImgLoaded(true) }}
            />

            {/* ── Bottom gradient overlay with source badge ─────────────────── */}
            <AnimatePresence>
              {imgLoaded && !imgError && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent pt-8 pb-2.5 px-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    {isStreetView ? (
                      <Camera className="w-3 h-3 text-white/90 shrink-0" />
                    ) : (
                      <Satellite className="w-3 h-3 text-white/90 shrink-0" />
                    )}
                    <span className="text-[10px] font-medium text-white/90 leading-none">
                      {isStreetView ? "Street View" : "Satellite view"}
                    </span>
                    {result.metadata.date && (
                      <span className="text-[10px] text-white/50 ml-auto leading-none">
                        {result.metadata.date}
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Image failed to decode (proxy returned non-image) ─────────── */}
            {imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                <MapPin className="w-5 h-5 text-muted-foreground/50" />
                <p className="text-[10px] text-muted-foreground/60 leading-snug">
                  No imagery available for this address
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Satellite fallback notice — only when image actually loaded */}
      {imgLoaded && !imgError && !isStreetView && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-[10px] text-muted-foreground/60 leading-snug"
        >
          No street-level imagery found — showing satellite view.
        </motion.p>
      )}
    </div>
  )
}
