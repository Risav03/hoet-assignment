import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const ACTION_LABELS: Record<string, string> = {
  WORKSPACE_CREATED: "created this workspace",
  MEMBER_INVITED: "invited a member",
  MEMBER_REMOVED: "removed a member",
  MEMBER_ROLE_UPDATED: "updated a member's role",
  DOCUMENT_CREATED: "created a document",
  DOCUMENT_UPDATED: "updated a document",
  DOCUMENT_ARCHIVED: "archived a document",
  DOCUMENT_RESTORED: "restored a document",
  DOCUMENT_DELETED: "deleted a document",
  PROPOSAL_CREATED: "submitted a proposal",
  PROPOSAL_ACCEPTED: "accepted a proposal",
  PROPOSAL_REJECTED: "rejected a proposal",
  PROPOSAL_COMMITTED: "committed a proposal",
  VERSION_RESTORED: "restored a version",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ActivityPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const member = await getWorkspaceMember(workspace.id, session.user.id);
  if (!member) redirect("/dashboard");

  const logs = await db.activityLog.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Activity className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold">Activity</h1>
          <p className="text-slate-500 text-sm">{workspace.name}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No activity yet</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-4 ml-10">
            {logs.map((log: typeof logs[0]) => (
              <div key={log.id} className="relative">
                <div className="absolute -left-6 top-1 w-2 h-2 rounded-full bg-slate-300 border-2 border-white dark:border-slate-950" />
                <div className="flex items-start gap-3">
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback className="text-xs bg-indigo-100 text-indigo-600">
                      {log.user.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{log.user.name}</span>{" "}
                      <span className="text-slate-500">
                        {ACTION_LABELS[log.action] ?? log.action.toLowerCase().replace(/_/g, " ")}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
