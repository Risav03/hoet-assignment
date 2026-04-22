import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { db } from "@/lib/db";
import { Activity, Check, X, FileText, Edit, Users, Building2, GitPullRequest, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";

const ACTION_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ style?: React.CSSProperties }>;
    iconColor: string;
    iconBg: string;
  }
> = {
  PROPOSAL_COMMITTED: { label: "committed a proposal", icon: Check, iconColor: "#059669", iconBg: "#ecfdf5" },
  PROPOSAL_CREATED:   { label: "submitted a proposal", icon: GitPullRequest, iconColor: "#4f46e5", iconBg: "#eef2ff" },
  DOCUMENT_CREATED:   { label: "created a document", icon: FileText, iconColor: "#0ea5e9", iconBg: "#f0f9ff" },
  DOCUMENT_UPDATED:   { label: "updated a document", icon: Edit, iconColor: "#d97706", iconBg: "#fffbeb" },
  MEMBER_INVITED:     { label: "invited a member", icon: Users, iconColor: "#7c3aed", iconBg: "#f5f3ff" },
  MEMBER_REMOVED:     { label: "removed a member", icon: Users, iconColor: "#7c3aed", iconBg: "#f5f3ff" },
  MEMBER_ROLE_UPDATED:{ label: "updated a member's role", icon: Users, iconColor: "#7c3aed", iconBg: "#f5f3ff" },
  PROPOSAL_ACCEPTED:  { label: "accepted a proposal", icon: Check, iconColor: "#059669", iconBg: "#ecfdf5" },
  PROPOSAL_REJECTED:  { label: "rejected a proposal", icon: X, iconColor: "#e11d48", iconBg: "#fff1f2" },
  VERSION_RESTORED:   { label: "restored a version", icon: Clock, iconColor: "#71717a", iconBg: "#f4f4f5" },
  WORKSPACE_CREATED:  { label: "created this workspace", icon: Building2, iconColor: "#4f46e5", iconBg: "#eef2ff" },
  DOCUMENT_ARCHIVED:  { label: "archived a document", icon: FileText, iconColor: "#d97706", iconBg: "#fffbeb" },
  DOCUMENT_RESTORED:  { label: "restored a document", icon: FileText, iconColor: "#059669", iconBg: "#ecfdf5" },
  DOCUMENT_DELETED:   { label: "deleted a document", icon: FileText, iconColor: "#e11d48", iconBg: "#fff1f2" },
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

  // Filter by category
  const filtered = logs.filter((log) => {
    if (activeFilter === "documents")
      return log.action.startsWith("DOCUMENT");
    if (activeFilter === "proposals")
      return log.action.startsWith("PROPOSAL");
    if (activeFilter === "members")
      return log.action.startsWith("MEMBER") || log.action === "WORKSPACE_CREATED";
    return true;
  });

  // Group by date
  const grouped: Record<string, typeof filtered> = {};
  for (const log of filtered) {
    const dateKey = format(new Date(log.createdAt), "PP");
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(log);
  }

  return (
    <div className="page-animate max-h-screen overflow-y-auto" style={{ padding: "36px 40px" }}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff" }}
          >
            <Activity style={{ width: 17, height: 17, color: "#4f46e5" }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", marginBottom: 2 }}>
              Activity
            </h1>
            <p style={{ fontSize: 13, color: "#71717a" }}>{workspace.name}</p>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2">
          {FILTER_CHIPS.map((chip) => (
            <a key={chip.value} href={`?filter=${chip.value}`}>
              <span
                className="inline-block cursor-pointer rounded-full font-semibold transition-all"
                style={{
                  padding: "4px 14px",
                  fontSize: 12,
                  background: activeFilter === chip.value ? "#18181b" : "#ffffff",
                  color: activeFilter === chip.value ? "#ffffff" : "#71717a",
                  border: activeFilter === chip.value
                    ? "1px solid #18181b"
                    : "1px solid #e4e4e7",
                }}
              >
                {chip.label}
              </span>
            </a>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Activity style={{ width: 40, height: 40, color: "#d4d4d8", marginBottom: 12 }} />
          <p style={{ fontSize: 13, color: "#a1a1aa" }}>No activity yet</p>
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([date, dateLogs]) => (
            <div key={date} className="mb-8">
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="uppercase"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#a1a1aa",
                    letterSpacing: "0.06em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {date}
                </span>
                <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
              </div>

              {/* Timeline — flex stepper, no absolute positioning */}
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
                      <div className="flex flex-col items-center" style={{ width: 30, flexShrink: 0 }}>
                        {/* Colored icon circle */}
                        <div
                          className="flex items-center justify-center"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "50%",
                            background: config?.iconBg ?? "#f4f4f5",
                            flexShrink: 0,
                          }}
                        >
                          <IconComponent
                            style={{
                              width: 13,
                              height: 13,
                              color: config?.iconColor ?? "#71717a",
                            }}
                          />
                        </div>
                        {/* Connector line */}
                        {!isLast && (
                          <div
                            style={{
                              width: 1,
                              flex: 1,
                              background: "#e4e4e7",
                              marginTop: 4,
                              minHeight: 20,
                            }}
                          />
                        )}
                      </div>

                      {/* Right column: text + metadata + time */}
                      <div
                        className="flex-1 flex items-start justify-between gap-4 min-w-0"
                        style={{ paddingBottom: isLast ? 0 : 20, paddingTop: 4 }}
                      >
                        <div className="flex-1 min-w-0">
                          <p style={{ fontSize: 13, color: "#18181b", lineHeight: 1.5 }}>
                            <span style={{ fontWeight: 600 }}>{log.user.name}</span>{" "}
                            <span style={{ color: "#71717a" }}>
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
                            <div
                              className="mt-1.5 inline-block"
                              style={{
                                background: "#fafafa",
                                border: "1px solid #f0f0f0",
                                borderRadius: 7,
                                padding: "2px 10px",
                                fontSize: 12,
                                color: "#71717a",
                              }}
                            >
                              {typeof log.metadata === "string"
                                ? log.metadata
                                : JSON.stringify(log.metadata).slice(0, 80)}
                            </div>
                          )}
                        </div>

                        {/* Time */}
                        <span
                          className="shrink-0"
                          style={{ fontSize: 11, color: "#a1a1aa" }}
                        >
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
