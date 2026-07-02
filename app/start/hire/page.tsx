"use client"

// ─── VARIANT 4: THE HIRING REFRAME ───────────────────────────────────────────
// Ad angle: Hiring frustration → hidden capacity
// Entry emotion: exhausted from trying to find good techs, convinced the answer
//   is one more hire. Script reframes it: the leads dying while your team is
//   slammed IS the capacity problem. AI that answers in seconds fixes it.
// Use this URL in your Facebook ad when running the "hiring" angle:
//   fieldbuiltai.com/start/hire
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion"
import { ArrowRight, Clock, PhoneCall, CheckCircle } from "lucide-react"
import {
  C,
  MinimalHeader, PaceSection, ReframeSection, ProductSection,
  ProofSection, OfferSection, BookingSection, FaqSection,
  MinimalFooter, StickyBottomCta,
} from "@/components/landing/shared"

// ─────────────────────────────────────────────────────────────────────────────
// HERO
// ─────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const leadEvents = [
    { time: "6:47 PM", lead: "Sarah M. — AC not cooling", status: "missed", delay: "4 hrs — no reply" },
    { time: "7:12 PM", lead: "David R. — Furnace estimate", status: "missed", delay: "2 days — no reply" },
    { time: "8:03 PM", lead: "Karen T. — AC unit install", status: "missed", delay: "Called competitor" },
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
      <motion.div animate={{ y: [0, -18, 0], x: [0, 12, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 700, height: 700, background: "rgba(249,115,22,0.07)", top: "-20%", left: "-10%" }} aria-hidden="true" />
      <motion.div animate={{ y: [0, 16, 0] }} transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: 450, height: 450, background: "rgba(251,191,36,0.05)", bottom: "5%", right: "5%" }} aria-hidden="true" />

      {/* ── CENTERED COPY ── */}
      <div className="relative max-w-4xl mx-auto w-full text-center">

        {/* Eyebrow */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
          style={{ background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.20)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.orange }} />
          <span className="text-xs font-semibold tracking-widest uppercase"
                style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>
            For HVAC owners convinced they need to hire
          </span>
        </motion.div>

        {/* THE HEADLINE */}
        <motion.h1 initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.7 }}
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.02] mb-8"
          style={{ color: "#F5F3F0", fontFamily: "var(--font-jakarta)", letterSpacing: "-0.03em" }}>
          You Don&rsquo;t Need Another Tech.
          <br />
          <span className="relative" style={{ color: C.orange }}>
            You Need Every Lead Answered in Seconds.
            <span className="absolute -bottom-1 left-0 right-0 h-[3px] rounded-full"
                  style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.orangeDk})`,
                           transformOrigin: "left", animation: "underlineDraw 0.8s ease forwards 1.1s", transform: "scaleX(0)" }} />
          </span>
        </motion.h1>

        {/* Body — the reframe */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
          className="max-w-2xl mx-auto mb-10">
          <p className="text-xl leading-relaxed" style={{ color: "rgba(250,250,248,0.62)" }}>
            You&rsquo;ve run the hiring ads. You&rsquo;ve raised the pay. You&rsquo;ve interviewed guys who never showed up.
            And there&rsquo;s a 100,000-tech shortage in this country — so it&rsquo;s not you.
          </p>
          <p className="text-lg leading-relaxed mt-4" style={{ color: "rgba(250,250,248,0.44)" }}>
            But here&rsquo;s what nobody tells you. While your team is slammed on jobs,
            leads are dying — calling competitors, going cold, disappearing.
            That&rsquo;s not a staffing problem. That&rsquo;s a response problem.
            AI answers every lead in seconds, books the job, and routes it to the right tech.
            Same crew. More revenue.
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
          <a href="#book"
             className="inline-flex items-center gap-2 font-bold text-white px-8 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
             style={{ background: C.orange, boxShadow: "0 8px 28px rgba(249,115,22,0.35)", fontSize: "1.05rem" }}>
            Show Me What I&rsquo;m Missing
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </a>
          <span className="text-sm" style={{ color: "rgba(250,250,248,0.35)" }}>
            Free 30-min call · No credit card · We set everything up
          </span>
        </motion.div>

        {/* ── LEAD RESPONSE MOCKUP ── */}
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
                FieldBuilt AI · Lead Response Feed
              </span>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full ml-2"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", fontFamily: "var(--font-jetbrains)" }}>
              Without AI
            </span>
          </div>

          {/* Before: leads dying */}
          <div className="p-6" style={{ background: "#1C1712" }}>
            <div className="mb-5">
              <div className="text-sm font-bold mb-1" style={{ color: "#F5F3F0" }}>Last Night — Your Team Was Slammed</div>
              <div className="text-xs" style={{ color: "rgba(250,250,248,0.35)" }}>
                3 leads came in after 6 PM. Your techs were on jobs. Here&rsquo;s what happened.
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {leadEvents.map((ev, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.1 + i * 0.15 }}
                  className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.10)" }}>
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                       style={{ background: "rgba(239,68,68,0.10)" }}>
                    <PhoneCall className="w-3.5 h-3.5" style={{ color: "rgba(239,68,68,0.60)" }} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold" style={{ color: "rgba(250,250,248,0.55)" }}>{ev.time}</span>
                      <span className="text-xs font-medium truncate" style={{ color: "rgba(250,250,248,0.75)" }}>{ev.lead}</span>
                    </div>
                    <div className="text-xs" style={{ color: "rgba(239,68,68,0.70)", fontFamily: "var(--font-jetbrains)" }}>{ev.delay}</div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full shrink-0"
                       style={{ background: "rgba(239,68,68,0.10)", color: "rgba(239,68,68,0.70)", border: "1px solid rgba(239,68,68,0.15)" }}>
                    Lost
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Divider — the flip */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
              className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <div className="text-xs px-3 py-1.5 rounded-full font-semibold"
                   style={{ background: "rgba(249,115,22,0.12)", color: C.orange, border: "1px solid rgba(249,115,22,0.20)" }}>
                With FieldBuilt AI
              </div>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </motion.div>

            {/* After: AI responds */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.65 }}
              className="p-4 rounded-xl mb-5"
              style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.15)" }}>
              <div className="flex items-start gap-3">
                <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                     style={{ background: "rgba(22,163,74,0.15)" }}>
                  <CheckCircle className="w-4 h-4" style={{ color: "#16A34A" }} aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold" style={{ color: "rgba(250,250,248,0.55)" }}>6:47 PM</span>
                    <span className="text-xs font-medium" style={{ color: "rgba(250,250,248,0.75)" }}>Sarah M. — AC not cooling</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <span className="text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5"
                            style={{ background: "rgba(249,115,22,0.12)", color: C.orange, fontFamily: "var(--font-jetbrains)" }}>AI</span>
                      <span className="text-sm" style={{ color: "rgba(250,250,248,0.65)" }}>
                        "Hi Sarah! It&rsquo;s Jake with Precision HVAC. I saw you reached out about your AC — is it not cooling at all or just not keeping up?"
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 shrink-0" style={{ color: "rgba(250,250,248,0.25)" }} aria-hidden="true" />
                      <span className="text-xs" style={{ color: "rgba(250,250,248,0.30)", fontFamily: "var(--font-jetbrains)" }}>
                        Sent 8 seconds after lead came in
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Outcome stats */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.85 }}
              className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-xl font-black mb-0.5" style={{ color: C.orange, fontFamily: "var(--font-jetbrains)" }}>8s</div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.35)" }}>Average lead response time</div>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-xl font-black mb-0.5" style={{ color: "#16A34A", fontFamily: "var(--font-jetbrains)" }}>24/7</div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.35)" }}>Nights, weekends, while your team is on jobs</div>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-xl font-black mb-0.5" style={{ color: "#FBBF24", fontFamily: "var(--font-jetbrains)" }}>$0</div>
                <div className="text-xs" style={{ color: "rgba(250,250,248,0.35)" }}>Extra payroll — same crew, more jobs closed</div>
              </div>
            </motion.div>
          </div>
        </motion.div>

      </div>

      <style>{`@keyframes underlineDraw { from { transform: scaleX(0); } to { transform: scaleX(1); } }`}</style>
    </section>
  )
}

export default function StartHirePage() {
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
