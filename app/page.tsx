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
    <div className="flex flex-col min-h-screen bg-sidebar text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-8 h-[60px] bg-sidebar border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center font-extrabold text-primary-foreground text-sm w-7 h-7 rounded-lg bg-primary">
            C
          </div>
          <span className="text-[15px] font-bold text-white">CoWork</span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-sm font-medium text-sidebar-foreground">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="text-sm font-semibold text-primary-foreground bg-primary rounded-lg shadow-[0_1px_2px_rgba(79,70,229,.25)]">
              Get started
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center">
        <section className="flex flex-col items-center text-center w-full max-w-[760px] mx-auto px-6 pt-16 pb-16 sm:pt-24 sm:pb-20">
          {/* Pill badge */}
          <div className="inline-flex items-center gap-1.5 mb-8 text-[13px] font-medium rounded-full px-[14px] py-[5px] bg-[#1e1b4b] text-[#818cf8] border border-[#312e81]">
            ⚡ Local-first · Offline-capable · Real-time
          </div>

          <h1 className="mb-6 text-4xl sm:text-5xl lg:text-[60px] font-extrabold leading-tight tracking-[-2px] text-white">
            Collaborate without
            <br />
            <span className="text-primary">compromising</span>
          </h1>

          <p className="mb-10 text-base sm:text-[17px] leading-[1.7] text-muted-foreground max-w-[520px]">
            CoWork is a team workspace platform that lets you edit offline,
            propose changes, vote on updates, and sync safely across devices —
            powered by proposal-based conflict resolution.
          </p>

          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/signup">
              <Button size="lg" className="font-semibold text-primary-foreground px-8 bg-primary rounded-lg shadow-[0_1px_2px_rgba(79,70,229,.25)]">
                Start for free →
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8 font-semibold border-sidebar-border text-sidebar-foreground bg-transparent rounded-lg">
                Sign in
              </Button>
            </Link>
          </div>
        </section>

        {/* Feature grid */}
        <section className="w-full px-4 sm:px-6 pb-16 sm:pb-24 max-w-[960px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-sidebar-accent border border-sidebar-border rounded-[14px] p-6"
              >
                <div className="flex items-center justify-center mb-4 w-9 h-9 rounded-[10px] bg-[#1e1b4b]">
                  <f.icon className="w-[17px] h-[17px] text-[#818cf8]" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-white">
                  {f.title}
                </h3>
                <p className="text-[13px] text-muted-foreground leading-[1.65]">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex flex-col sm:flex-row items-center justify-between gap-2 px-6 sm:px-10 py-4 border-t border-sidebar-border text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} CoWork</span>
        <span>Built with Next.js · Prisma · Auth.js</span>
      </footer>
    </div>
  );
}
