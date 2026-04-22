import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getUserWorkspaces } from "@/lib/dal/workspace";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await getUserWorkspaces(session.user.id);
  const workspaces = memberships.map((m: typeof memberships[0]) => m.workspace);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{ name: session.user.name ?? "", email: session.user.email ?? "" }}
        workspaces={workspaces}
      />
      <main className="flex-1 overflow-auto" style={{ background: "#f4f4f5" }}>{children}</main>
    </div>
  );
}
