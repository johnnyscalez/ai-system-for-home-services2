"use client"

// ─── VARIANT 1: SWITCHBOARD ──────────────────────────────────────────────────
// Ad angle: Loss / anxiety ("The Switchboard")
// Entry emotion: resignation + invisible leak
// Use this URL in your Facebook ad when running the "Switchboard" angle:
//   fieldbuiltai.com/start
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import {
  C,
  MinimalHeader, PaceSection, ReframeSection, ProductSection,
  ProofSection, OfferSection, BookingSection, FaqSection,
  MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"

// ─────────────────────────────────────────────────────────────────────────────
// HERO — the wound question: they try to answer and fail
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
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
      <motion.div animate={{ y: [0, -20, 0], x: [0, 10, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 700, height: 700, background: "rgba(249,115,22,0.08)", top: "-20%", left: "-10%" }} aria-hidden="true" />
      <motion.div animate={{ y: [0, 14, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 400, height: 400, background: "rgba(251,191,36,0.05)", bottom: "5%", right: "5%" }} aria-hidden="true" />

      <div className="relative max-w-4xl mx-auto w-full text-center">
        {/* Eyebrow — sizes the buyer immediately */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
            For HVAC owners running 5+ trucks
          </span>
        </motion.div>

        {/* THE WOUND HEADLINE */}
        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-8"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
          How Many Leads Did You
          <br />
          <span className="relative" style={{ color: C.orange }}>
            Lose Last Month?
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                           transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1.1s", transform: "scaleX(0)" }} />
          </span>
        </motion.h1>

        {/* The pause — let the question land */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-10">
          <p className="text-xl leading-relaxed" style={{ color: "rgba(250,250,248,0.62)" }}>
            Take a second. Try to answer it. Not &ldquo;probably a few&rdquo; — the actual number.
          </p>
          <p className="text-lg leading-relaxed mt-4" style={{ color: "rgba(250,250,248,0.44)" }}>
            The leads that came in while your team was slammed on a big install. The 8pm calls nobody picked up.
            The follow-up that went out four days late. You can&rsquo;t say — because a lead that never
            gets logged never shows up on a report.
          </p>
        </motion.div>

        {/* Invisible leak stat */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.75, duration: 0.6 }}
          className="inline-flex items-center gap-4 px-8 py-5 rounded-2xl mb-12"
          style={{ background: C.darkCard, border: "1px solid rgba(249,115,22,0.18)", boxShadow: "0 0 40px rgba(249,115,22,0.06)" }}>
          <div className="text-left">
            <div className="text-3xl font-black mb-0.5" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>12–18</div>
            <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>qualified leads lost<br />per month, on average</div>
          </div>
          <div className="w-px h-12 self-center" style={{ background: "rgba(249,115,22,0.15)" }} />
          <div className="text-left">
            <div className="text-3xl font-black mb-0.5" style={{ color: "#FBBF24", fontFamily: "var(--font-jetbrains)" }}>$48K–$144K</div>
            <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>walking out the door<br />quietly, every month</div>
          </div>
          <div className="w-px h-12 self-center hidden sm:block" style={{ background: "rgba(249,115,22,0.15)" }} />
          <div className="text-left hidden sm:block">
            <div className="text-3xl font-black mb-0.5" style={{ color: "rgba(250,250,248,0.25)", fontFamily: "var(--font-jetbrains)" }}>$0</div>
            <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>shows up anywhere<br />on your reports</div>
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

export default function StartPage() {
  return (
    <main style={{ fontFamily: "var(--font-inter), Inter, sans-serif" }}>
      <MinimalHeader />
      <HeroSection />
      <PaceSection />
      <ReframeSection />
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
