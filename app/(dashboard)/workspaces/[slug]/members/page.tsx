import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMembers, getWorkspaceMember } from "@/lib/dal/workspace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";
import { MemberActions } from "@/components/workspace/member-actions";

interface PageProps {
  params: Promise<{ slug: string }>;
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
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-slate-400" />
          <div>
            <h1 className="text-2xl font-bold">Members</h1>
            <p className="text-slate-500 text-sm">
              {members.length} member{members.length !== 1 ? "s" : ""} · {workspace.name}
            </p>
          </div>
        </div>
        {isOwner && <InviteMemberDialog workspaceId={workspace.id} />}
      </div>

      <div className="space-y-3">
        {members.map((m: typeof members[0]) => (
          <Card key={m.id}>
            <CardContent className="flex items-center gap-4 py-4">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-indigo-100 text-indigo-600">
                  {m.user.name?.[0]?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{m.user.name}</p>
                <p className="text-xs text-slate-400">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  Joined {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                </span>
                <Badge
                  className={
                    m.role === "OWNER"
                      ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                      : m.role === "EDITOR"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }
                >
                  {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                </Badge>
                {isOwner && m.user.id !== session.user.id && (
                  <MemberActions
                    workspaceId={workspace.id}
                    userId={m.user.id}
                    currentRole={m.role}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
