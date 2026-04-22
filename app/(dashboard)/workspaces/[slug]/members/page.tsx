import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMembers, getWorkspaceMember } from "@/lib/dal/workspace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";
import { MemberActions } from "@/components/workspace/member-actions";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getRoleBadgeClass(role: string) {
  if (role === "OWNER") return "bg-accent text-accent-foreground border border-accent-border";
  if (role === "EDITOR") return "bg-success-soft text-success-strong border border-success-border";
  return "bg-muted text-secondary-foreground border border-border";
}

export default async function MembersPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const currentMember = await getWorkspaceMember(workspace.id, session.user.id);
  if (!currentMember) redirect("/dashboard");

  const members = await getWorkspaceMembers(workspace.id, session.user.id);
  const isOwner = currentMember.role === "OWNER";

  return (
    <div className="page-animate p-5 md:p-9 md:px-10">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-accent">
            <Users className="w-[17px] h-[17px] text-primary" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold text-foreground mb-0.5">Members</h1>
            <p className="text-[13px] text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""} · {workspace.name}
            </p>
          </div>
        </div>
        {isOwner && <InviteMemberDialog workspaceId={workspace.id} />}
      </div>

      {/* Members list card */}
      <div className="stagger bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {members.map((m: typeof members[0], idx: number) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 sm:p-[14px] sm:px-5",
              idx < members.length - 1 ? "border-b border-muted" : ""
            )}
          >
            <Avatar className="w-9 h-9">
              <AvatarFallback className="font-bold text-sm bg-accent text-accent-foreground">
                {m.user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{m.user.name}</p>
              <p className="text-xs text-muted-foreground">{m.user.email}</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="hidden md:inline text-xs text-muted-foreground">
                Joined {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
              </span>

              <span className={cn("rounded-full px-2.5 py-0.5 font-semibold text-xs", getRoleBadgeClass(m.role))}>
                {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
              </span>

              {isOwner && m.user.id !== session.user.id && (
                <MemberActions
                  workspaceId={workspace.id}
                  userId={m.user.id}
                  currentRole={m.role}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
