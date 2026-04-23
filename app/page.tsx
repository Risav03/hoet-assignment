"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { FlowMap } from "@/components/landing/flow-map";
import { PillarCards } from "@/components/landing/pillar-cards";
import {
  Shield,
  Eye,
  PenLine,
  Crown,
  Activity,
  Lock,
  Zap,
} from "lucide-react";

/* ─── Animation variants ────────────────────────────────────────────────── */
const heroContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.11, delayChildren: 0.05 },
  },
} as const;

const heroItem = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1, y: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as any },
  },
} as const;

/* ─── Role table data ───────────────────────────────────────────────────── */
const ROLES = [
  {
    icon: Crown,
    name: "Owner",
    color: "#fbbf24",
    bg: "#451a03",
    border: "#92400e",
    perms: ["Full control", "Invite & remove members", "Manage versions & restore", "Delete workspace"],
  },
  {
    icon: PenLine,
    name: "Editor",
    color: "#4ade80",
    bg: "#14532d",
    border: "#166534",
    perms: ["Create & edit documents", "Canvas & board ops", "Submit doc changes", "View activity log"],
  },
  {
    icon: Eye,
    name: "Viewer",
    color: "#60a5fa",
    bg: "#1e3a5f",
    border: "#1e40af",
    perms: ["Read-only access", "View version history", "View canvas", "—"],
  },
];

const TRUST_ITEMS = [
  { icon: Lock,     text: "bcrypt password hashing + JWT sessions" },
  { icon: Shield,   text: "Server-side permission check on every route" },
  { icon: Activity, text: "Full audit log with actor, action & timestamp" },
  { icon: Zap,      text: "Rate-limiting on all API endpoints" },
];

/* ─── LandingPage ───────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#18181b] text-white overflow-x-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky py-2 top-0 z-50 flex items-center justify-between px-4 sm:px-8 h-[60px] bg-[#18181b]/90 backdrop-blur border-b border-[#27272a]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center font-extrabold text-white text-sm w-7 h-7 rounded-lg bg-[#4f46e5]">
            C
          </div>
          <span className="text-[15px] font-bold text-white">CoWork</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-sm font-medium text-[#a1a1aa] hover:text-white">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="text-sm font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] rounded-lg">
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center">

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative w-full flex flex-col items-center text-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-20 overflow-hidden">
          {/* Radial glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(79,70,229,0.18) 0%, transparent 70%)",
            }}
          />

          <motion.div
            variants={heroContainer}
            initial="hidden"
            animate="show"
            className="relative z-10 flex flex-col items-center max-w-[740px] mx-auto"
          >
            {/* Badge */}
            <motion.div variants={heroItem}>
              <span className="inline-flex items-center gap-1.5 mb-7 text-[12px] font-semibold rounded-full px-4 py-1.5 bg-[#1e1b4b] text-[#818cf8] border border-[#312e81]">
                ⚡ CRDT auto-merge · Offline-first · SSE real-time
              </span>
            </motion.div>

            {/* H1 */}
            <motion.h1
              variants={heroItem}
              className="mb-5 text-4xl sm:text-5xl lg:text-[62px] font-extrabold leading-[1.08] tracking-[-2.5px]"
            >
              Collaborate without
              <br />
              <span
                style={{
                  background: "linear-gradient(90deg, #818cf8 0%, #c4b5fd 50%, #60a5fa 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                compromising
              </span>
            </motion.h1>

            {/* Sub */}
            <motion.p
              variants={heroItem}
              className="mb-9 text-[15.5px] leading-[1.75] text-[#71717a] max-w-[500px]"
            >
              CoWork is a team workspace where documents auto-merge via Yjs CRDTs,
              canvas ops sync through Redis with last-write-wins conflict resolution,
              and every change is broadcast live to collaborators over SSE.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={heroItem} className="flex items-center gap-3 flex-wrap justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="font-semibold text-white px-8 bg-[#4f46e5] hover:bg-[#4338ca] rounded-xl shadow-[0_0_20px_rgba(79,70,229,0.35)]"
                >
                  Start for free →
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 font-semibold border-[#3f3f46] text-[#a1a1aa] hover:text-white bg-transparent rounded-xl hover:bg-[#27272a]"
                >
                  Sign in
                </Button>
              </Link>
            </motion.div>
          </motion.div>

          {/* Quick-stat row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
            className="relative z-10 mt-12 flex items-center gap-8 sm:gap-12 flex-wrap justify-center"
          >
            {[
              ["Yjs", "CRDT merge"],
              ["3", "user roles"],
              ["SSE", "real-time sync"],
              ["∞", "version history"],
            ].map(([val, label]) => (
              <div key={label} className="flex flex-col items-center gap-0.5">
                <span className="text-2xl font-extrabold text-white">{val}</span>
                <span className="text-[11px] text-[#52525b] uppercase tracking-wide">{label}</span>
              </div>
            ))}
          </motion.div>
        </section>

        {/* ── Flow map ───────────────────────────────────────────────────── */}
        <FlowMap />

        {/* ── Pillar cards ───────────────────────────────────────────────── */}
        <PillarCards />

        {/* ── Built for teams ─────────────────────────────────────────────── */}
        <TeamsSection />

      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 sm:px-10 py-5 border-t border-[#27272a] text-[11.5px] text-[#52525b]">
        <span>© {new Date().getFullYear()} CoWork</span>
        <span>Built with Next.js · Prisma · Auth.js · Yjs CRDT · Tiptap</span>
      </footer>
    </div>
  );
}

/* ─── TeamsSection ──────────────────────────────────────────────────────── */
function TeamsSection() {
  return (
    <section className="w-full max-w-[960px] mx-auto px-4 py-16 sm:py-20">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-10"
      >
        <span className="inline-block mb-3 text-[11px] font-semibold tracking-widest uppercase text-[#818cf8]">
          Permissions
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Built for teams of every size
        </h2>
        <p className="mt-2.5 text-[13px] text-[#71717a]">
          Granular roles ensure every collaborator has exactly the access they need.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Role cards */}
        <div className="flex flex-col gap-4">
          {ROLES.map((role, i) => (
            <motion.div
              key={role.name}
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="flex gap-4 rounded-xl border p-4"
              style={{ background: role.bg + "80", borderColor: role.border }}
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                style={{ background: role.bg, border: `1px solid ${role.border}` }}
              >
                <role.icon className="w-4 h-4" style={{ color: role.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold mb-1.5" style={{ color: role.color }}>
                  {role.name}
                </p>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {role.perms.map((perm) => (
                    <li key={perm} className="text-[11px] text-[#a1a1aa] flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#3f3f46] shrink-0" />
                      {perm}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust & reliability */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col justify-between rounded-2xl border border-[#27272a] bg-[#1c1c1f] p-6"
        >
          <div>
            <h3 className="text-[15px] font-bold text-white mb-1">Trust & reliability</h3>
            <p className="text-[12.5px] text-[#52525b] mb-6 leading-relaxed">
              Every layer of CoWork is designed with security and auditability as first-class
              concerns — not afterthoughts.
            </p>

            <ul className="space-y-4">
              {TRUST_ITEMS.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#1e1b4b] border border-[#312e81] shrink-0">
                    <Icon className="w-[15px] h-[15px] text-[#818cf8]" />
                  </div>
                  <span className="text-[12.5px] text-[#a1a1aa] leading-[1.6] pt-1">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-8 pt-6 border-t border-[#27272a]">
            <p className="text-[12px] text-[#52525b] mb-3">
              Ready to collaborate without constraints?
            </p>
            <Link href="/signup">
              <Button className="w-full font-semibold text-white bg-[#4f46e5] hover:bg-[#4338ca] rounded-xl">
                Create your workspace →
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
