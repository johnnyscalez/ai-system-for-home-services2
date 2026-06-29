"use client"

// ─── VARIANT 3: YOUR BEST TECH ───────────────────────────────────────────────
// Ad angle: Blindness ("Your Best Tech")
// Entry emotion: discomfort of not being in command of your own data
// Use this URL in your Facebook ad when running the "Best Tech" angle:
//   fieldbuiltai.com/start/tech
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
// HERO — centered like the other two variants; dashboard mockup sits below copy
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const techRows = [
    { name: "Marcus T.", closes: "81%", bar: 0.81, revenue: "$118K", best: true },
    { name: "Jake R.",   closes: "68%", bar: 0.68, revenue: "$92K",  best: false },
    { name: "Danny P.",  closes: "73%", bar: 0.73, revenue: "$87K",  best: false },
    { name: "Chris W.",  closes: "61%", bar: 0.61, revenue: "$74K",  best: false },
  ]

  return (
    <section
      className="relative flex flex-col justify-center pt-32 pb-24 px-6 overflow-hidden"
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
      <motion.div animate={{ y: [0, -20, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 600, height: 600, background: "rgba(249,115,22,0.08)", top: "-15%", left: "-8%" }} aria-hidden="true" />
      <motion.div animate={{ y: [0, 18, 0], x: [0, -10, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 400, height: 400, background: "rgba(251,191,36,0.06)", bottom: "5%", right: "5%" }} aria-hidden="true" />

      {/* ── CENTERED COPY (same structure as /start and /start/tab) ── */}
      <div className="relative max-w-4xl mx-auto w-full text-center">

        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
            For HVAC owners running on instinct
          </span>
        </motion.div>

        {/* THE BLINDNESS HEADLINE */}
        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-8"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
          Who&rsquo;s Your Best Closer?
          <br />
          <span className="relative" style={{ color: C.orange }}>
            Not Busiest. Best.
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                           transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1.1s", transform: "scaleX(0)" }} />
          </span>
        </motion.h1>

        {/* The participation moment — they try to answer and can't */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-10">
          <p className="text-xl leading-relaxed" style={{ color: "rgba(250,250,248,0.62)" }}>
            Think about your team. You know who to send on a big replacement job.
            But do you actually know the number — which tech closes at 81% and which one closes at 61%?
          </p>
          <p className="text-lg leading-relaxed mt-4" style={{ color: "rgba(250,250,248,0.44)" }}>
            Which job types make you three times more money than anything else?
            Which lead source burns your ad budget and which one books?
            Most owners can&rsquo;t answer any of that — not because they haven&rsquo;t thought about it,
            but because the data has never been in one place.
            It&rsquo;s sitting in your operation right now. You just don&rsquo;t have access to it yet.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <a href="#book"
             className="inline-flex items-center gap-2 font-bold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
             style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)", fontSize: "1.05rem" }}>
            See My Numbers
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <span className="text-sm" style={{ color: "rgba(250,250,248,0.35)" }}>
            Free 30-min call · No credit card · We set everything up
          </span>
        </motion.div>

        {/* ── DASHBOARD MOCKUP — below the centered copy, full width ── */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(249,115,22,0.18)", boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 60px rgba(249,115,22,0.08)" }}
        >
          {/* Window chrome */}
          <div className="flex items-center gap-1.5 px-4 py-3"
               style={{ background: "#141210", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400/70" />
            <div className="flex-1 mx-4 h-5 rounded px-2 flex items-center"
                 style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-xs" style={{ color: "rgba(250,250,248,0.28)", fontFamily: "var(--font-jetbrains)" }}>
                FieldBuilt AI · Technician Performance Dashboard
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full ml-2"
                  style={{ background: "rgba(249,115,22,0.15)", color: C.orange, fontFamily: "var(--font-jetbrains)" }}>Live</span>
          </div>

          {/* Dashboard body */}
          <div className="p-6" style={{ background: "#1C1712" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="text-sm font-bold" style={{ color: "#F5F3F0" }}>Technician Close Rates — This Month</div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(250,250,248,0.35)" }}>
                  Not who ran the most calls. Who won them.
                </div>
              </div>
              <div className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                   style={{ background: "rgba(22,163,74,0.10)", color: "#16A34A", border: "1px solid rgba(22,163,74,0.15)" }}>
                You now know this
              </div>
            </div>

            <div className="space-y-4 mb-6">
              {techRows.map((t, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + i * 0.1 }} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                       style={{ background: t.best ? C.orange : "rgba(255,255,255,0.07)", color: t.best ? "#fff" : "rgba(250,250,248,0.40)" }}>
                    {t.name[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: t.best ? "#F5F3F0" : "rgba(250,250,248,0.55)" }}>{t.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-black" style={{ color: t.best ? C.orange : "rgba(250,250,248,0.40)" }}>{t.closes}</span>
                        <span className="text-xs" style={{ color: "rgba(250,250,248,0.28)", fontFamily: "var(--font-jetbrains)" }}>{t.revenue}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: t.best ? `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})` : "rgba(249,115,22,0.25)" }}
                        initial={{ width: 0 }} animate={{ width: `${t.bar * 100}%` }}
                        transition={{ delay: 1.25 + i * 0.1, duration: 0.8, ease: "easeOut" }} />
                    </div>
                  </div>
                  {t.best && (
                    <span className="text-xs px-2 py-1 rounded-full shrink-0 font-semibold"
                          style={{ background: "rgba(249,115,22,0.15)", color: C.orange, border: "1px solid rgba(249,115,22,0.25)" }}>
                      Best closer
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            {/* The insight card */}
            <div className="rounded-xl p-4 grid sm:grid-cols-3 gap-4"
                 style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)" }}>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-xl font-black mb-0.5" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>+20pts</div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>Gap between best and weakest closer</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-xl font-black mb-0.5" style={{ color: "#FBBF24", fontFamily: "var(--font-jetbrains)" }}>+34%</div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>Revenue per job when Marcus runs replacements</div>
              </div>
              <div className="text-center p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="text-xl font-black mb-0.5" style={{ color: "#0EA5E9", fontFamily: "var(--font-jetbrains)" }}>$0</div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.40)" }}>Cost to see this — it&rsquo;s already in your operation</div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      <style>{`@keyframes underlineDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </section>
  )
}

export default function StartTechPage() {
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
