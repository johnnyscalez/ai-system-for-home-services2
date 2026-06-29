"use client"

// ─── VARIANT 2: THE TAB YOU CLOSED ───────────────────────────────────────────
// Ad angle: Vindication ("The Tab You Closed")
// Entry emotion: the ServiceTitan story told back to him — he was right to walk
// Use this URL in your Facebook ad when running the "Tab You Closed" angle:
//   fieldbuiltai.com/start/tab
//
// NOTE: This variant skips the ReframeSection (ServiceTitan) in the body
// because the hero already covers that ground. The body jumps directly from
// Pace → Product → Proof → Offer → Booking.
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion"
import { ArrowRight, X, Check } from "lucide-react"
import {
  C,
  MinimalHeader, PaceSection, ProductSection,
  ProofSection, OfferSection, BookingSection, FaqSection,
  MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"

// ─────────────────────────────────────────────────────────────────────────────
// HERO — vindication: his ServiceTitan story, told back to him
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const stItems = [
    { value: "~$58K",     label: "Per year" },
    { value: "$15–25K",   label: "Just to get started" },
    { value: "12 months", label: "Before you go live" },
    { value: "A lawyer",  label: "To read the exit clause" },
  ]

  return (
    <section
      className="relative min-h-screen flex flex-col justify-center pt-32 pb-24 px-6 overflow-hidden"
      style={{ background: C.dark }}
    >
      {/* Blueprint crosshatch */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
           style={{
             backgroundImage: "linear-gradient(rgba(249,115,22,1) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,1) 1px, transparent 1px)",
             backgroundSize: "44px 44px", opacity: 0.055,
             WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
             maskImage: "radial-gradient(ellipse 90% 80% at 50% 40%, #000 20%, transparent 80%)",
           }} />
      <motion.div animate={{ y: [0, -18, 0], x: [0, 8, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 600, height: 600, background: "rgba(249,115,22,0.09)", top: "-15%", right: "-8%" }} aria-hidden="true" />
      <motion.div animate={{ y: [0, 16, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 400, height: 400, background: "rgba(251,191,36,0.05)", bottom: "5%", left: "-5%" }} aria-hidden="true" />

      <div className="relative max-w-4xl mx-auto w-full text-center">
        {/* Eyebrow — acknowledges he's solution-aware */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
            For HVAC owners who already shopped the enterprise platforms
          </span>
        </motion.div>

        {/* VINDICATION HEADLINE */}
        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-8"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
          You Were Right to Walk
          <br />
          <span className="relative" style={{ color: C.orange }}>
            Away From ServiceTitan.
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                           transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1.1s", transform: "scaleX(0)" }} />
          </span>
        </motion.h1>

        {/* The story told back — he relaxes because someone finally gets it */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-10">
          <p className="text-xl leading-relaxed" style={{ color: "rgba(250,250,248,0.62)" }}>
            The dispatch routing looked right. The performance dashboard looked right.
            Then you saw the number — and the contract. You closed the tab.
          </p>
          <p className="text-lg leading-relaxed mt-4" style={{ color: "rgba(250,250,248,0.44)" }}>
            That call was correct. You&rsquo;re not a 300-tech enterprise.
            But the problems ServiceTitan was trying to solve? Those didn&rsquo;t close with the tab.
          </p>
        </motion.div>

        {/* ServiceTitan cost breakdown — the moment of recognition */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.7, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-10">
          <div className="rounded-2xl p-6 mb-5"
               style={{ background: C.darkCard, border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-2 mb-4">
              <X className="w-4 h-4" style={{ color: "rgba(239,68,68,0.70)" }} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "rgba(250,250,248,0.35)", fontFamily: "var(--font-jetbrains)" }}>
                What you walked away from
              </span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {stItems.map((item, i) => (
                <div key={i} className="text-center p-3 rounded-xl"
                     style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}>
                  <div className="text-xl font-black mb-1 line-through decoration-red-500/40"
                       style={{ color: "rgba(250,250,248,0.22)", fontFamily: "var(--font-jetbrains)" }}>{item.value}</div>
                  <div className="text-xs" style={{ color: "rgba(250,250,248,0.30)" }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* The reframe — what you actually need */}
          <div className="rounded-2xl p-6"
               style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.20)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Check className="w-4 h-4" style={{ color: C.orange }} aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
                What you actually needed
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "rgba(250,250,248,0.60)" }}>
              The same dispatch intelligence. The same performance data. The same lead automation.
              Built around your existing tools. Running in 48 hours. No enterprise bill. No year of setup.
              No contract your lawyer needs to read.
            </p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl font-black" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>$0</span>
              <span className="text-sm" style={{ color: "rgba(250,250,248,0.45)" }}>to start · Free 14-day trial · We set it up</span>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="#book"
             className="inline-flex items-center gap-2 font-bold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
             style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)", fontSize: "1.05rem" }}>
            Get My Free Business Map
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <span className="text-sm" style={{ color: "rgba(250,250,248,0.35)" }}>
            Free 30-min call · No credit card · We set everything up
          </span>
        </motion.div>
      </div>

      <style>{`@keyframes underlineDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </section>
  )
}

export default function StartTabPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <HeroSection />
      <PaceSection />
      {/* ReframeSection intentionally omitted — hero already covers the ServiceTitan story */}
      <ProductSection />
      <ProofSection />
      <OfferSection />
      <BookingSection />
      <FaqSection />
      <MinimalFooter />
      <StickyBottomCta />
    </main>
  )
}
