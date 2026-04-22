import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sidebar, MobileHeader } from "@/components/layout/sidebar";
import { getSession } from "@/lib/session";
import { getCachedUserWorkspaces } from "@/lib/dal/cached";

export const metadata: Metadata = {
  title: {
    default: "CoWork",
    template: "%s — CoWork",
  },
  description:
    "Collaborate on documents in real time. Propose changes, review history, and use AI — all in one workspace.",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const memberships = await getCachedUserWorkspaces(session.user.id);
  const workspaces = memberships.map((m: typeof memberships[0]) => m.workspace);

  const user = { name: session.user.name ?? "", email: session.user.email ?? "" };

  return (
    <div className="flex h-full">
      <Sidebar user={user} workspaces={workspaces} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <MobileHeader user={user} workspaces={workspaces} />
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
