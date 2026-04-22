import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { Activity, Check, X, FileText, Edit, Users, Building2, GitPullRequest, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColorClass: string;
    iconBgClass: string;
  }
> = {
  PROPOSAL_COMMITTED: { label: "committed a proposal", icon: Check, iconColorClass: "text-success", iconBgClass: "bg-success-soft" },
  PROPOSAL_CREATED:   { label: "submitted a proposal", icon: GitPullRequest, iconColorClass: "text-primary", iconBgClass: "bg-accent" },
  DOCUMENT_CREATED:   { label: "created a document", icon: FileText, iconColorClass: "text-info", iconBgClass: "bg-info-soft" },
  DOCUMENT_UPDATED:   { label: "updated a document", icon: Edit, iconColorClass: "text-warning", iconBgClass: "bg-warning-soft" },
  MEMBER_INVITED:     { label: "invited a member", icon: Users, iconColorClass: "text-violet", iconBgClass: "bg-violet-soft" },
  MEMBER_REMOVED:     { label: "removed a member", icon: Users, iconColorClass: "text-violet", iconBgClass: "bg-violet-soft" },
  MEMBER_ROLE_UPDATED:{ label: "updated a member's role", icon: Users, iconColorClass: "text-violet", iconBgClass: "bg-violet-soft" },
  PROPOSAL_ACCEPTED:  { label: "accepted a proposal", icon: Check, iconColorClass: "text-success", iconBgClass: "bg-success-soft" },
  PROPOSAL_REJECTED:  { label: "rejected a proposal", icon: X, iconColorClass: "text-danger", iconBgClass: "bg-danger-soft" },
  VERSION_RESTORED:   { label: "restored a version", icon: Clock, iconColorClass: "text-muted-foreground", iconBgClass: "bg-muted" },
  WORKSPACE_CREATED:  { label: "created this workspace", icon: Building2, iconColorClass: "text-primary", iconBgClass: "bg-accent" },
  DOCUMENT_ARCHIVED:  { label: "archived a document", icon: FileText, iconColorClass: "text-warning", iconBgClass: "bg-warning-soft" },
  DOCUMENT_RESTORED:  { label: "restored a document", icon: FileText, iconColorClass: "text-success", iconBgClass: "bg-success-soft" },
  DOCUMENT_DELETED:   { label: "deleted a document", icon: FileText, iconColorClass: "text-danger", iconBgClass: "bg-danger-soft" },
};

const FILTER_CHIPS = [
  { label: "All", value: "all" },
  { label: "Documents", value: "documents" },
  { label: "Proposals", value: "proposals" },
  { label: "Members", value: "members" },
] as const;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}

export default async function ActivityPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const { filter } = await searchParams;
  const activeFilter = filter ?? "all";

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

  const filtered = logs.filter((log) => {
    if (activeFilter === "documents") return log.action.startsWith("DOCUMENT");
    if (activeFilter === "proposals") return log.action.startsWith("PROPOSAL");
    if (activeFilter === "members") return log.action.startsWith("MEMBER") || log.action === "WORKSPACE_CREATED";
    return true;
  });

  const grouped: Record<string, typeof filtered> = {};
  for (const log of filtered) {
    const dateKey = format(new Date(log.createdAt), "PP");
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(log);
  }

  return (
    <div className="page-animate max-h-screen overflow-y-auto p-5 md:p-9 md:px-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-accent">
            <Activity className="w-[17px] h-[17px] text-primary" />
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold text-foreground mb-0.5">Activity</h1>
            <p className="text-[13px] text-muted-foreground">{workspace.name}</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_CHIPS.map((chip) => (
            <a key={chip.value} href={`?filter=${chip.value}`}>
              <span
                className={cn(
                  "inline-block cursor-pointer rounded-full font-semibold transition-all text-xs px-[14px] py-1",
                  activeFilter === chip.value
                    ? "bg-foreground text-background border border-foreground"
                    : "bg-card text-muted-foreground border border-border"
                )}
              >
                {chip.label}
              </span>
            </a>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Activity className="w-10 h-10 text-muted mb-3" />
          <p className="text-[13px] text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date} className="mb-8">
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-4">
                <span className="uppercase text-[11px] font-bold text-muted-foreground tracking-[0.06em] whitespace-nowrap">
                  {date}
                </span>
                <div className="flex-1 h-px bg-muted" />
              </div>

              {/* Timeline */}
              <div>
                {dateLogs.map((log, idx) => {
                  const config = ACTION_CONFIG[log.action];
                  const IconComponent = config?.icon ?? Activity;
                  const isDocAction =
                    log.action.startsWith("DOCUMENT") || log.action.startsWith("PROPOSAL");
                  const isLast = idx === dateLogs.length - 1;

                  return (
                    <div
                      key={log.id}
                      className="activity-item flex gap-3"
                      style={{ animationDelay: `${Math.min(idx, 7) * 40}ms` }}
                    >
                      {/* Left column: icon circle + connector line */}
                      <div className="flex flex-col items-center w-[30px] shrink-0">
                        <div className={cn("flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0", config?.iconBgClass ?? "bg-muted")}>
                          <IconComponent className={cn("w-[13px] h-[13px]", config?.iconColorClass ?? "text-muted-foreground")} />
                        </div>
                        {!isLast && (
                          <div className="w-px flex-1 bg-border mt-1 min-h-5" />
                        )}
                      </div>

                      {/* Right column */}
                      <div
                        className={cn(
                          "flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4 min-w-0",
                          isLast ? "pb-0" : "pb-5",
                          "pt-1"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-foreground leading-[1.5]">
                            <span className="font-semibold">{log.user.name}</span>{" "}
                            <span className="text-muted-foreground">
                              {config?.label ?? log.action.toLowerCase().replace(/_/g, " ")}
                            </span>
                            {isDocAction && log.entityId && (
                              <>
                                {" "}
                                <Link
                                  href={`/workspaces/${slug}/documents/${log.entityId}`}
                                  className="activity-doc-link"
                                >
                                  document
                                </Link>
                              </>
                            )}
                          </p>

                          {/* Detail pill */}
                          {log.metadata && (
                            <div className="mt-1.5 inline-block bg-secondary border border-muted rounded-lg px-2.5 py-0.5 text-xs text-muted-foreground">
                              {typeof log.metadata === "string"
                                ? log.metadata
                                : JSON.stringify(log.metadata).slice(0, 80)}
                            </div>
                          )}
                        </div>

                        {/* Time */}
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
