"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

/* ─── Layout constants ──────────────────────────────────────────────────── */
const VB_W = 870;
const VB_H = 390;
const NW = 132;
const NH = 64;
const HW = NW / 2;
const HH = NH / 2;
const RX = 11;

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Variant = "default" | "merge" | "ai";

interface NodeDef {
  id: string;
  cx: number;
  cy: number;
  label: string;
  sub: string;
  step?: number;
  variant?: Variant;
}

interface ConnDef {
  id: string;
  d: string;
  dashed?: boolean;
  color?: string;
  label?: { text: string; x: number; y: number; color: string };
}

/* ─── Node data ─────────────────────────────────────────────────────────── */
// Real flow: CRDT auto-merge for docs, LWW op-based for canvas — no voting
const NODES: NodeDef[] = [
  // Row 1 — setup
  { id: "auth",    cx: 80,  cy: 112, step: 1, label: "Sign Up",           sub: "Email · JWT"          },
  { id: "wspace",  cx: 258, cy: 112, step: 2, label: "Workspace",         sub: "Roles & Members"      },
  { id: "invite",  cx: 436, cy: 112, step: 3, label: "Invite Team",       sub: "Owner · Editor"       },
  { id: "content", cx: 614, cy: 112, step: 4, label: "Docs · Boards",     sub: "Tiptap · Konva"       },
  // Row 2 — collaboration cycle (right → left)
  { id: "edit",    cx: 614, cy: 296, step: 5, label: "Edit Offline",      sub: "Yjs · Dexie queue"    },
  { id: "merge",   cx: 436, cy: 296, step: 6, label: "Auto-merge",        sub: "CRDT · LWW",          variant: "merge" },
  { id: "sse",     cx: 258, cy: 296, step: 7, label: "SSE Broadcast",     sub: "Redis pub/sub"        },
  { id: "version", cx: 80,  cy: 296, step: 8, label: "Versions & History",sub: "Snapshot · Restore"   },
  // AI — floating, right side
  { id: "ai",      cx: 772, cy: 204, label: "AI Assistant",               sub: "Claude · GPT",        variant: "ai" },
];

/* ─── Connection data ───────────────────────────────────────────────────── */
const CONNS: ConnDef[] = [
  // Row 1: left → right
  { id: "c12", d: "M 147 112 L 191 112" },
  { id: "c23", d: "M 325 112 L 369 112" },
  { id: "c34", d: "M 503 112 L 547 112" },
  // Column: content ↓ edit
  { id: "c45", d: "M 614 145 L 614 262" },
  // Row 2: right → left
  {
    id: "c56", d: "M 547 296 L 503 296",
    label: { text: "Yjs / LWW", x: 524, y: 290, color: "#34d399" },
  },
  { id: "c67", d: "M 369 296 L 325 296" },
  { id: "c78", d: "M 191 296 L 147 296" },
  // Loop: versions → back to edit (shows cycle)
  {
    id: "loop",
    d: "M 80 329 Q 18 204 80 79",
    dashed: true,
    color: "#52525b",
    label: { text: "↻ new iteration", x: 26, y: 210, color: "#52525b" },
  },
  // AI dotted connections: to content (step 4) and merge (step 6)
  {
    id: "ai-content",
    d: "M 772 172 L 772 112 L 681 112",
    dashed: true,
    color: "#a78bfa",
  },
  {
    id: "ai-merge",
    d: "M 706 220 L 436 220 L 436 262",
    dashed: true,
    color: "#a78bfa",
  },
];

/* ─── Color palettes ────────────────────────────────────────────────────── */
const PALETTE: Record<Variant, {
  bg: string; border: string; glow: string;
  text: string; sub: string;
  badge: string; badgeText: string;
}> = {
  default: {
    bg: "#27272a", border: "#3f3f46", glow: "#4f46e530",
    text: "#ffffff", sub: "#a1a1aa",
    badge: "#4f46e5", badgeText: "#ffffff",
  },
  // Auto-merge node — teal/emerald (success/auto)
  merge: {
    bg: "#052e16", border: "#166534", glow: "#22c55e20",
    text: "#4ade80", sub: "#16a34a",
    badge: "#16a34a", badgeText: "#ffffff",
  },
  ai: {
    bg: "#1e1b4b", border: "#5b21b6", glow: "#7c3aed30",
    text: "#c4b5fd", sub: "#818cf8",
    badge: "#7c3aed", badgeText: "#ffffff",
  },
};

/* ─── SVGNode ───────────────────────────────────────────────────────────── */
function SVGNode({ node, delay }: { node: NodeDef; delay: number }) {
  const p = PALETTE[node.variant ?? "default"];
  const x = node.cx - HW;
  const y = node.cy - HH;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
    >
      {/* Glow */}
      <rect
        x={x - 4} y={y - 4}
        width={NW + 8} height={NH + 8}
        rx={RX + 4}
        fill={p.glow}
        style={{ filter: "blur(6px)" }}
      />
      {/* Card */}
      <rect
        x={x} y={y}
        width={NW} height={NH}
        rx={RX}
        fill={p.bg}
        stroke={p.border}
        strokeWidth={1.5}
      />
      {/* Step badge */}
      {node.step !== undefined && (
        <>
          <circle cx={x + 18} cy={y + 18} r={13} fill={p.badge} />
          <text
            x={x + 18} y={y + 22.5}
            textAnchor="middle"
            fill={p.badgeText}
            fontSize={10}
            fontWeight="700"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {node.step}
          </text>
        </>
      )}
      {/* Label */}
      <text
        x={node.cx} y={node.cy - 7}
        textAnchor="middle"
        fill={p.text}
        fontSize={11}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {node.label}
      </text>
      {/* Sub-label */}
      <text
        x={node.cx} y={node.cy + 12}
        textAnchor="middle"
        fill={p.sub}
        fontSize={9.5}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {node.sub}
      </text>
    </motion.g>
  );
}

/* ─── SVGConnection ─────────────────────────────────────────────────────── */
function SVGConnection({ conn, delay }: { conn: ConnDef; delay: number }) {
  const color = conn.color ?? "#4f46e5";
  const markerId =
    conn.dashed
      ? conn.color === "#a78bfa" ? "arrow-violet" : "arrow-muted"
      : "arrow-indigo";

  return (
    <>
      {conn.dashed ? (
        <motion.path
          d={conn.d}
          stroke={color}
          strokeWidth={conn.id === "loop" ? 1 : 1.5}
          fill="none"
          strokeDasharray={conn.id === "loop" ? "4 5" : "5 4"}
          markerEnd={conn.id === "loop" ? undefined : `url(#${markerId})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: conn.id === "loop" ? 0.4 : 0.85 }}
          transition={{ duration: 0.5, delay }}
        />
      ) : (
        <motion.path
          d={conn.d}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          markerEnd={`url(#${markerId})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.65, delay, ease: "easeInOut" }}
        />
      )}
      {conn.label && (
        <motion.text
          x={conn.label.x}
          y={conn.label.y}
          textAnchor="middle"
          fill={conn.label.color}
          fontSize={8.5}
          fontFamily="system-ui, -apple-system, sans-serif"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: delay + 0.35 }}
        >
          {conn.label.text}
        </motion.text>
      )}
    </>
  );
}

/* ─── Legend ─────────────────────────────────────────────────────────────── */
function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={24} height={4} style={{ flexShrink: 0 }}>
        <line x1="0" y1="2" x2="24" y2="2" stroke={color} strokeWidth={2}
          strokeDasharray={dashed ? "4 3" : undefined} />
      </svg>
      <span className="text-[11px] text-[#71717a]">{label}</span>
    </div>
  );
}

/* ─── FlowMap (main export) ─────────────────────────────────────────────── */
export function FlowMap() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="w-full px-4 py-16 sm:py-20">
      {/* Section heading */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="text-center mb-10 max-w-xl mx-auto"
      >
        <span className="inline-block mb-3 text-[11px] font-semibold tracking-widest uppercase text-[#818cf8]">
          App flow
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3 tracking-tight">
          How CoWork works
        </h2>
        <p className="text-[13.5px] text-[#71717a] leading-relaxed">
          Edits merge automatically via Yjs CRDT for docs and last-write-wins ops
          for canvas — then broadcast instantly to every collaborator over SSE.
        </p>
      </motion.div>

      {/* SVG diagram */}
      <div className="w-full max-w-[900px] mx-auto overflow-x-auto rounded-2xl border border-[#27272a] bg-[#18181b]">
        <div style={{ minWidth: 640 }}>
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            style={{ width: "100%", height: "auto", display: "block" }}
            aria-label="CoWork application flow diagram"
          >
            <defs>
              <pattern id="flow-grid" width="36" height="36" patternUnits="userSpaceOnUse">
                <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#27272a" strokeWidth="0.6" />
              </pattern>
              <marker id="arrow-indigo" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#4f46e5" />
              </marker>
              <marker id="arrow-violet" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#a78bfa" />
              </marker>
              <marker id="arrow-muted" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#52525b" />
              </marker>
            </defs>

            {/* Background grid */}
            <rect width={VB_W} height={VB_H} fill="url(#flow-grid)" />

            {/* Row labels */}
            <text x={347} y={40} textAnchor="middle" fill="#3f3f46" fontSize={9.5}
              fontFamily="system-ui" fontWeight="600" letterSpacing="2">
              SETUP &amp; ONBOARDING
            </text>
            <text x={347} y={380} textAnchor="middle" fill="#3f3f46" fontSize={9.5}
              fontFamily="system-ui" fontWeight="600" letterSpacing="2">
              REAL-TIME COLLABORATION CYCLE
            </text>

            {/* Track hints */}
            <text x={580} y={278} textAnchor="middle" fill="#3f3f46" fontSize={8}>
              ← auto-merged
            </text>

            {/* Doc / Canvas track indicator */}
            <text x={524} y={260} textAnchor="middle" fill="#166534" fontSize={8}>
              docs: Yjs CRDT
            </text>
            <text x={524} y={272} textAnchor="middle" fill="#0e7490" fontSize={8}>
              canvas: op LWW
            </text>

            {/* Connections (under nodes) */}
            {inView && CONNS.map((c, i) => (
              <SVGConnection key={c.id} conn={c} delay={0.15 + i * 0.07} />
            ))}

            {/* Nodes */}
            {inView && NODES.map((n, i) => (
              <SVGNode key={n.id} node={n} delay={0.05 + i * 0.055} />
            ))}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.4, delay: 0.9 }}
        className="flex items-center justify-center gap-6 mt-5 flex-wrap"
      >
        <LegendItem color="#4f46e5" label="Main flow" />
        <LegendItem color="#4ade80" label="Auto-merge (CRDT / LWW)" />
        <LegendItem color="#a78bfa" label="AI assistance" dashed />
        <LegendItem color="#52525b" label="Cycle repeats" dashed />
      </motion.div>
    </section>
  );
}
