import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMembers, getWorkspaceMember } from "@/lib/dal/workspace";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog";
import { MemberActions } from "@/components/workspace/member-actions";

interface PageProps {
  params: Promise<{ slug: string }>;
}

function getRoleBadgeStyle(role: string) {
  if (role === "OWNER")
    return { background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" };
  if (role === "EDITOR")
    return { background: "#ecfdf5", color: "#065f46", border: "1px solid #6ee7b7" };
  return { background: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" };
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
    <div className="page-animate" style={{ padding: "36px 40px" }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff" }}
          >
            <Users style={{ width: 17, height: 17, color: "#4f46e5" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", marginBottom: 2 }}>
              Members
            </h1>
            <p style={{ fontSize: 13, color: "#71717a" }}>
              {members.length} member{members.length !== 1 ? "s" : ""} · {workspace.name}
            </p>
          </div>
        </div>
        {isOwner && <InviteMemberDialog workspaceId={workspace.id} />}
      </div>

      {/* Members list card */}
      <div
        className="stagger"
        style={{
          background: "#ffffff",
          border: "1px solid #e4e4e7",
          borderRadius: 12,
          boxShadow: "0 1px 3px rgba(0,0,0,.04)",
          overflow: "hidden",
        }}
      >
        {members.map((m: typeof members[0], idx: number) => (
          <div
            key={m.id}
            className="flex items-center gap-4"
            style={{
              padding: "14px 20px",
              borderBottom:
                idx < members.length - 1 ? "1px solid #f4f4f5" : "none",
            }}
          >
            <Avatar style={{ width: 36, height: 36 }}>
              <AvatarFallback
                className="font-bold text-sm"
                style={{ background: "#eef2ff", color: "#4338ca" }}
              >
                {m.user.name?.[0]?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <p style={{ fontSize: 14, fontWeight: 600, color: "#18181b" }}>{m.user.name}</p>
              <p style={{ fontSize: 12, color: "#71717a" }}>{m.user.email}</p>
            </div>

            <div className="flex items-center gap-3">
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                Joined {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
              </span>

              <span
                className="rounded-full px-2.5 py-0.5 font-semibold text-xs"
                style={getRoleBadgeStyle(m.role)}
              >
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
