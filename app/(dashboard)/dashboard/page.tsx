import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getCachedUserWorkspaces } from "@/lib/dal/cached";
import Link from "next/link";
import { Users, LayoutGrid, Clock, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";
import { cn } from "@/lib/utils";

function getRoleBadgeClass(role: string) {
  if (role === "OWNER") return "bg-accent text-accent-foreground border border-accent-border";
  if (role === "EDITOR") return "bg-success-soft text-success-strong border border-success-border";
  return "bg-muted text-secondary-foreground border border-border";
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const memberships = await getCachedUserWorkspaces(session.user.id);
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="page-animate p-5 md:p-9 md:px-10">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground mb-1">
            Welcome back, {firstName}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {memberships.length} workspace{memberships.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="flex items-center justify-center mb-6 w-14 h-14 rounded-2xl bg-accent">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <h2 className="text-base font-bold text-foreground mb-2">No workspaces yet</h2>
          <p className="text-[13px] text-muted-foreground mb-5">
            Create your first workspace to start collaborating with your team.
          </p>
          <CreateWorkspaceDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger gap-3.5">
          {memberships.map((m: typeof memberships[0]) => (
            <Link key={m.workspace.id} href={`/workspaces/${m.workspace.slug}`}>
              <div className="hover-card cursor-pointer bg-card border border-border rounded-xl p-5 pb-4 shadow-sm">
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center font-extrabold w-[38px] h-[38px] rounded-[10px] bg-accent text-primary text-base shrink-0">
                    {m.workspace.name[0]?.toUpperCase()}
                  </div>
                  <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", getRoleBadgeClass(m.role))}>
                    {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                  </span>
                </div>

                {/* Name + slug */}
                <p className="text-sm font-bold text-foreground mb-0.5">{m.workspace.name}</p>
                <p className="text-[11px] text-muted-foreground mb-3.5">/{m.workspace.slug}</p>

                {/* Footer row */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {m.workspace._count.members}
                  </span>
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="w-3 h-3" />
                    {m.workspace._count.boards}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(m.workspace.updatedAt, { addSuffix: true })}
                  </span>
                </div>
              </div>
            </Link>
          ))}

        </div>
      )}
    </div>
  );
}
