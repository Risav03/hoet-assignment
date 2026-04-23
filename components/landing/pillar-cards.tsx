"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { WifiOff, GitPullRequest, Bot } from "lucide-react";

const PILLARS = [
  {
    icon: WifiOff,
    color: "#22d3ee",   // cyan
    glow: "#22d3ee20",
    border: "#164e63",
    title: "Local-first & offline",
    description:
      "Your documents live directly in IndexedDB via Yjs CRDTs. You can read and write without any network connection. When you reconnect, changes are merged automatically — no conflicts, no lost work.",
    bullets: [
      "Yjs CRDT for conflict-free merging",
      "Persistent storage with Dexie + IndexedDB",
      "Background sync queue with checksums",
    ],
  },
  {
    icon: GitPullRequest,
    color: "#34d399",   // emerald
    glow: "#10b98120",
    border: "#065f46",
    title: "Real-time & auto-merge",
    description:
      "Document edits are handled by Yjs CRDTs — concurrent changes from any number of clients merge automatically with no conflicts. Canvas operations use op-based last-write-wins via Redis, with conflict events broadcast over SSE.",
    bullets: [
      "Yjs CRDT auto-merge for rich text",
      "Op-based LWW for canvas/boards",
      "SSE via Redis pub/sub (no polling)",
    ],
  },
  {
    icon: Bot,
    color: "#a78bfa",   // violet
    glow: "#7c3aed20",
    border: "#4c1d95",
    title: "AI-powered assistance",
    description:
      "An AI assistant lives inside every workspace and document. It can summarise long docs, rewrite sections, suggest tags, extract action items, and explain merge conflicts — powered by Claude, GPT, or Groq.",
    bullets: [
      "Document summarise & rewrite",
      "Action-item & tag extraction",
      "Conflict explanation on proposals",
    ],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.13, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

export function PillarCards() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="w-full px-4 py-16 sm:py-20 max-w-[960px] mx-auto">
      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center mb-10"
      >
        <span className="inline-block mb-3 text-[11px] font-semibold tracking-widest uppercase text-[#818cf8]">
          Core pillars
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Built differently, on purpose
        </h2>
      </motion.div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {PILLARS.map((p, i) => (
          <motion.div
            key={p.title}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="relative flex flex-col rounded-2xl border p-6 overflow-hidden"
            style={{
              background: "#18181b",
              borderColor: p.border,
            }}
          >
            {/* Background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 20% 20%, ${p.glow} 0%, transparent 70%)`,
              }}
            />

            {/* Icon */}
            <div
              className="relative flex items-center justify-center w-10 h-10 rounded-xl mb-5"
              style={{ background: p.glow, border: `1px solid ${p.border}` }}
            >
              <p.icon className="w-5 h-5" style={{ color: p.color }} />
            </div>

            {/* Title */}
            <h3 className="relative text-[15px] font-bold text-white mb-2">
              {p.title}
            </h3>

            {/* Description */}
            <p className="relative text-[12.5px] leading-relaxed text-[#71717a] mb-5">
              {p.description}
            </p>

            {/* Bullet points */}
            <ul className="relative mt-auto space-y-2">
              {p.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-[11.5px] text-[#a1a1aa]">
                  <span
                    className="mt-[3px] w-[5px] h-[5px] rounded-full shrink-0"
                    style={{ background: p.color }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
