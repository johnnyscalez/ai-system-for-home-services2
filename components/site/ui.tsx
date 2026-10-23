"use client"

// Shared building blocks for the marketing pages (homepage and /book), so both
// pages carry the same type scale, buttons, cards and motion.

import { useRef } from "react"
import Link from "next/link"
import { motion, useInView } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { T } from "@/components/site/live"
import { FieldFMark } from "@/components/landing/shared"

export type IconType = React.ComponentType<{ className?: string; style?: React.CSSProperties }>

export function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-70px" })
  return (
    <motion.div ref={ref} className={className} initial={{ opacity: 0, y: 22 }}
                animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.6, delay, ease: "easeOut" }}>
      {children}
    </motion.div>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[12px] font-medium uppercase tracking-[0.16em]" style={{ color: T.orangeD }}>{children}</p>
}

export function H2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`font-heading text-[clamp(30px,4.2vw,48px)] font-extrabold leading-[1.08] tracking-[-0.025em] ${className}`}
        style={{ color: T.ink, textWrap: "balance" }}>
      {children}
    </h2>
  )
}

export function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: T.orangeD }}>{children}</span>
}

export function PrimaryCta({ href = "/book", children = "Book a walkthrough", big = false }: { href?: string; children?: React.ReactNode; big?: boolean }) {
  return (
    <Link href={href}
          className={`group inline-flex items-center justify-center gap-2.5 rounded-full text-center font-heading font-bold text-white transition-all hover:-translate-y-0.5 ${big ? "px-8 py-4 text-[16.5px]" : "px-6 py-3.5 text-[15px]"}`}
          style={{ background: T.orange, boxShadow: "0 12px 30px -10px rgba(249,115,22,0.6)" }}>
      {children}
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  )
}

export function GhostCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href}
       className="inline-flex items-center gap-2 rounded-full border bg-white px-6 py-3.5 font-heading text-[15px] font-bold transition-colors hover:bg-[#F4F1EC]"
       style={{ borderColor: T.line, color: T.ink }}>
      {children}
    </a>
  )
}

export function IconTile({ icon: Icon, tone = "orange" }: { icon: IconType; tone?: "orange" | "green" | "ink" }) {
  const map = { orange: [T.soft, T.orangeD], green: [T.greenS, T.green], ink: [T.sand, T.ink] } as const
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: map[tone][0] }}>
      <Icon className="h-5 w-5" style={{ color: map[tone][1] }} />
    </span>
  )
}

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={`flex items-center justify-center rounded-lg ${size === "md" ? "h-8 w-8" : "h-7 w-7"}`} style={{ background: T.ink }}>
        <FieldFMark size={size === "md" ? 18 : 16} />
      </span>
      <span className={`font-heading font-extrabold tracking-[-0.02em] ${size === "md" ? "text-[18px]" : "text-[16px]"}`} style={{ color: T.ink }}>
        FIELDBUILT
        <span className="ml-1 rounded px-1 py-0.5 align-super text-[9px] font-bold text-white" style={{ background: T.orange }}>AI</span>
      </span>
    </span>
  )
}

// A flooring plank stack, used as the ICP mark next to "For Flooring Contractors".
function PlankMark() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="h-full w-full">
      <rect x="3" y="5" width="17" height="6" rx="1.5" fill="#FFFFFF" />
      <rect x="22" y="5" width="7" height="6" rx="1.5" fill="#FFFFFF" opacity="0.7" />
      <rect x="3" y="13" width="8" height="6" rx="1.5" fill="#FFFFFF" opacity="0.7" />
      <rect x="13" y="13" width="16" height="6" rx="1.5" fill="#FFFFFF" />
      <rect x="3" y="21" width="20" height="6" rx="1.5" fill="#FFFFFF" />
      <rect x="25" y="21" width="4" height="6" rx="1.5" fill="#FFFFFF" opacity="0.7" />
    </svg>
  )
}

// The big ICP callout: the first thing a flooring contractor reads on landing.
export function IcpCallout({ align = "left", sub = "with their own install crews" }: { align?: "left" | "center"; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className={`inline-flex items-center gap-3.5 rounded-2xl border bg-white py-2.5 pl-2.5 pr-5 sm:gap-4 sm:pr-6 ${align === "center" ? "mx-auto" : ""}`}
                style={{ borderColor: "rgba(249,115,22,0.3)", boxShadow: "0 14px 34px -18px rgba(249,115,22,0.55)" }}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl p-2 sm:h-14 sm:w-14 sm:p-2.5" style={{ background: T.orange }}>
        <PlankMark />
      </span>
      <span className="text-left">
        <span className="block font-heading text-[clamp(19px,2.6vw,28px)] font-extrabold uppercase leading-none tracking-[-0.01em]" style={{ color: T.ink }}>
          For Flooring Contractors
        </span>
        {sub && (
          <span className="mt-1.5 block text-[13px] font-semibold sm:text-[15px]" style={{ color: T.orangeD }}>{sub}</span>
        )}
      </span>
    </motion.div>
  )
}

// Free-text version of the ICP line for /book: no card, no border, no icon.
// The twist is typographic — a highlighter swipe of brand orange under the crews
// line, so it reads like someone marked it up on a jobsite print.
export function IcpHeadline({ align = "center" }: { align?: "left" | "center" }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className={align === "center" ? "text-center" : "text-left"}>
      <p className="font-heading text-[clamp(27px,4.3vw,44px)] font-extrabold uppercase leading-[1.02] tracking-[-0.025em]"
         style={{ color: T.ink }}>
        Flooring Contractors
      </p>
      <p className="mt-2 text-[clamp(14px,1.6vw,17px)] font-semibold">
        <span className="inline-block px-1.5 pb-0.5" style={{
          color: T.orangeD,
          background: "linear-gradient(180deg, transparent 56%, rgba(249,115,22,0.24) 56%)",
        }}>
          with their own install crews
        </span>
      </p>
    </motion.div>
  )
}
