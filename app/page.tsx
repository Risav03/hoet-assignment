import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-sm">
            C
          </div>
          <span className="font-semibold text-lg">CoWork</span>
        </div>
        <nav className="flex items-center gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-indigo-500 hover:bg-indigo-400 text-white">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 max-w-5xl mx-auto w-full">
        <Badge className="mb-6 bg-indigo-500/20 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20">
          Local-first · Offline-capable · Real-time
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight mb-6">
          Collaborate without
          <br />
          <span className="text-indigo-400">compromising</span>
        </h1>
        <p className="text-xl text-white/60 max-w-2xl mb-10 leading-relaxed">
          CoWork is a team workspace platform that lets you edit offline, propose changes, vote on
          updates, and sync safely across devices — powered by proposal-based conflict resolution.
        </p>
        <div className="flex items-center gap-4 flex-wrap justify-center">
          <Link href="/signup">
            <Button size="lg" className="bg-indigo-500 hover:bg-indigo-400 text-white px-8">
              Start for free
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 text-white bg-transparent hover:bg-white/10 px-8"
            >
              Sign in
            </Button>
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
          {[
            {
              title: "Local-first editing",
              desc: "Your documents live in IndexedDB. Edit offline, sync when you reconnect — no interruptions.",
              icon: "⚡",
            },
            {
              title: "Proposal-based changes",
              desc: "All edits become proposals. Owners and editors vote. Only approved changes are committed.",
              icon: "🗳️",
            },
            {
              title: "Real-time updates",
              desc: "Server-Sent Events push updates to all connected collaborators instantly without polling.",
              icon: "📡",
            },
            {
              title: "Version history",
              desc: "Every committed proposal creates an immutable version. Travel back in time safely.",
              icon: "🕐",
            },
            {
              title: "AI assistant",
              desc: "Summarize documents, extract action items, rewrite content, and explain conflicts with AI.",
              icon: "🤖",
            },
            {
              title: "Role-based access",
              desc: "Owners, Editors, and Viewers. Every action is permission-checked at the server level.",
              icon: "🔐",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-white/30 text-sm">
        © {new Date().getFullYear()} CoWork. Built with Next.js 16 + Prisma + Auth.js
      </footer>
    </div>
  );
}
