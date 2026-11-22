"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Home, Search, Loader2, AlertCircle, MapPin,
  Satellite, Camera, RefreshCw, ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

// ── Types ──────────────────────────────────────────────────────────────────────

type ImageSource = "street_view" | "maps_static_fallback"

interface PropertyImageResult {
  success: true
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

interface PropertyImageError {
  success: false
  error: string
}

type PropertyImageResponse = PropertyImageResult | PropertyImageError

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Pre-fill the address field (e.g. from a lead record) */
  defaultAddress?: string
  /** Compact mode removes the title/description for use inside panels */
  compact?: boolean
}

export function PropertyImageLookup({ defaultAddress = "", compact = false }: Props) {
  const [address, setAddress]   = useState(defaultAddress)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [result, setResult]     = useState<PropertyImageResult | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = address.trim()
    if (!trimmed) { setError("Please enter a property address."); return }

    setLoading(true)
    setError(null)
    setResult(null)
    setImgLoaded(false)
    setImgError(false)

    try {
      const res = await fetch("/api/property-image", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ address: trimmed }),
      })

      const data: PropertyImageResponse = await res.json()

      if (!data.success) {
        setError(data.error)
        return
      }

      setResult(data)
    } catch {
      setError("Network error — please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setResult(null)
    setError(null)
    setImgLoaded(false)
    setImgError(false)
  }

  const sourceLabel = result?.source === "street_view" ? "Street View image" : "Satellite fallback image"
  const SourceIcon  = result?.source === "street_view" ? Camera : Satellite

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F97316]/10 flex items-center justify-center shrink-0">
            <Home className="w-4.5 h-4.5 text-[#F97316]" />
          </div>
          <div>
            <h2
              className="text-lg font-bold text-[#1C1917]"
              style={{ fontFamily: "var(--font-jakarta, 'Plus Jakarta Sans')" }}
            >
              Property Image
            </h2>
            <p className="text-sm text-[#78716C]">
              Look up a Street View or satellite image for any address.
            </p>
          </div>
        </div>
      )}

      {/* Search form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1.5">
          {!compact && <Label className="text-sm font-medium text-[#1C1917]">Property address</Label>}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" />
              <Input
                value={address}
                onChange={e => { setAddress(e.target.value); if (error) setError(null) }}
                placeholder="123 Main St, Buffalo Grove, IL"
                className="pl-9 border-[#E7E5E4] focus-visible:ring-[#F97316] h-10"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !address.trim()}
              className="bg-[#F97316] hover:bg-[#ea6d04] text-white gap-2 shrink-0 shadow-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "Loading…" : "Get Home Image"}
            </Button>
          </div>
        </div>
      </form>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-start gap-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-3"
          >
            {/* Image container */}
            <div className="relative rounded-2xl overflow-hidden border border-[#E7E5E4] shadow-[0_4px_24px_rgba(0,0,0,0.06)] bg-[#F5F4F2]">
              {/* Skeleton while loading */}
              {!imgLoaded && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-[#A8A29E] animate-spin" />
                </div>
              )}

              {/* Image error */}
              {imgError && (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                  <AlertCircle className="w-8 h-8 text-[#A8A29E]" />
                  <div>
                    <p className="text-sm font-medium text-[#1C1917]">Image unavailable</p>
                    <p className="text-xs text-[#78716C] mt-0.5">
                      The image could not be loaded. The address may be too remote or the imagery may be unavailable.
                    </p>
                  </div>
                </div>
              )}

              {/* Actual image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.imageUrl}
                alt={`Property image for ${address}`}
                className={`w-full object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"} ${imgError ? "hidden" : "block"}`}
                style={{ aspectRatio: "16/9", minHeight: 220 }}
                onLoad={() => setImgLoaded(true)}
                onError={() => { setImgError(true); setImgLoaded(true) }}
              />
            </div>

            {/* Source label + metadata */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    result.source === "street_view"
                      ? "bg-[#F97316]/8 border-[#F97316]/20 text-[#F97316] gap-1.5"
                      : "bg-sky-50 border-sky-200 text-sky-700 gap-1.5"
                  }
                >
                  <SourceIcon className="w-3 h-3" />
                  {sourceLabel}
                </Badge>

                {result.metadata.date && (
                  <span className="text-xs text-[#A8A29E]">
                    Captured {result.metadata.date}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {result.metadata.lat && result.metadata.lng && (
                  <a
                    href={`https://www.google.com/maps?q=${result.metadata.lat},${result.metadata.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-[#78716C] hover:text-[#F97316] transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open in Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="flex items-center gap-1 text-xs text-[#78716C] hover:text-[#1C1917] transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  Search again
                </button>
              </div>
            </div>

            {/* Fallback notice */}
            {result.source === "maps_static_fallback" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  No Street View imagery is available for this address. Showing a satellite map instead.
                  The view may not show the exact property.
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
