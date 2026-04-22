import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Zap, GitPullRequest, Radio, Clock, Bot, Shield } from "lucide-react";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const features = [
    {
      icon: Zap,
      title: "Local-first editing",
      desc: "Your documents live in IndexedDB. Edit offline, sync when you reconnect — no interruptions.",
    },
    {
      icon: GitPullRequest,
      title: "Proposal-based changes",
      desc: "All edits become proposals. Owners and editors vote. Only approved changes are committed.",
    },
    {
      icon: Radio,
      title: "Real-time updates",
      desc: "Server-Sent Events push updates to all connected collaborators instantly without polling.",
    },
    {
      icon: Clock,
      title: "Version history",
      desc: "Every committed proposal creates an immutable version. Travel back in time safely.",
    },
    {
      icon: Bot,
      title: "AI assistant",
      desc: "Summarize documents, extract action items, rewrite content, and explain conflicts with AI.",
    },
    {
      icon: Shield,
      title: "Role-based access",
      desc: "Owners, Editors, and Viewers. Every action is permission-checked at the server level.",
    },
  ];

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ background: "#09090b", color: "#ffffff" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-8"
        style={{
          height: 60,
          background: "#09090b",
          borderBottom: "1px solid #27272a",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center font-extrabold text-white text-sm"
            style={{ width: 28, height: 28, borderRadius: 8, background: "#4f46e5" }}
          >
            C
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#ffffff" }}>
            CoWork
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button
              variant="ghost"
              className="text-sm font-medium"
              style={{ color: "#a1a1aa" }}
            >
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button
              className="text-sm font-semibold text-white"
              style={{
                background: "#4f46e5",
                borderRadius: 8,
                boxShadow: "0 1px 2px rgba(79,70,229,.25)",
              }}
            >
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center">
        <section
          className="flex flex-col items-center text-center w-full"
          style={{ maxWidth: 760, margin: "0 auto", padding: "96px 24px 80px" }}
        >
          {/* Pill badge */}
          <div
            className="inline-flex items-center gap-1.5 mb-8 text-sm font-medium"
            style={{
              background: "#1e1b4b",
              color: "#818cf8",
              border: "1px solid #312e81",
              borderRadius: 99,
              padding: "5px 14px",
              fontSize: 13,
            }}
          >
            ⚡ Local-first · Offline-capable · Real-time
          </div>

          <h1
            className="mb-6"
            style={{
              fontSize: 60,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-2px",
              color: "#ffffff",
            }}
          >
            Collaborate without
            <br />
            <span style={{ color: "#4f46e5" }}>compromising</span>
          </h1>

          <p
            className="mb-10"
            style={{
              fontSize: 17,
              lineHeight: 1.7,
              color: "#71717a",
              maxWidth: 520,
            }}
          >
            CoWork is a team workspace platform that lets you edit offline,
            propose changes, vote on updates, and sync safely across devices —
            powered by proposal-based conflict resolution.
          </p>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/signup">
              <Button
                size="lg"
                className="font-semibold text-white px-8"
                style={{
                  background: "#4f46e5",
                  borderRadius: 8,
                  boxShadow: "0 1px 2px rgba(79,70,229,.25)",
                }}
              >
                Start for free →
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="px-8 font-semibold"
                style={{
                  borderColor: "#27272a",
                  color: "#a1a1aa",
                  background: "transparent",
                  borderRadius: 8,
                }}
              >
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section
          className="w-full px-6 pb-24"
          style={{ maxWidth: 960, margin: "0 auto" }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                style={{
                  background: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: 14,
                  padding: 24,
                }}
              >
                <div
                  className="flex items-center justify-center mb-4"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "#1e1b4b",
                  }}
                >
                  <f.icon style={{ width: 17, height: 17, color: "#818cf8" }} />
                </div>
                <h3
                  className="mb-2"
                  style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}
                >
                  {f.title}
                </h3>
                <p style={{ fontSize: 13, color: "#71717a", lineHeight: 1.65 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="flex items-center justify-between px-10"
        style={{
          borderTop: "1px solid #27272a",
          height: 52,
          fontSize: 12,
          color: "#71717a",
        }}
      >
        <span>© {new Date().getFullYear()} CoWork</span>
        <span>Built with Next.js · Prisma · Auth.js</span>
      </footer>
    </div>
  );
}
