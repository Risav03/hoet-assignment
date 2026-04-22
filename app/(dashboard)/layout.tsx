import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar, MobileHeader } from "@/components/layout/sidebar";
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

  const user = { name: session.user.name ?? "", email: session.user.email ?? "" };

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} workspaces={workspaces} />
      <div className="flex flex-col flex-1 min-w-0">
        <MobileHeader user={user} workspaces={workspaces} />
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
