import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { getWorkspaceProposals } from "@/lib/dal/proposal";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { GitPullRequest } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}

const TABS = ["PENDING", "COMMITTED", "REJECTED"] as const;

export default async function ProposalsPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [{ slug }, { status }] = await Promise.all([params, searchParams]);

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const activeTab = (TABS.find((t) => t === status) ?? "PENDING") as typeof TABS[number];

  const [member, { proposals }] = await Promise.all([
    getWorkspaceMember(workspace.id, session.user.id),
    getWorkspaceProposals(workspace.id, session.user.id, {
      status: activeTab,
    }),
  ]);
  if (!member) redirect("/dashboard");

  return (
    <div className="page-animate p-5 md:p-9 md:px-10">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-accent">
          <GitPullRequest className="w-[17px] h-[17px] text-primary" />
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground mb-0.5">Proposals</h1>
          <p className="text-[13px] text-muted-foreground">{workspace.name}</p>
        </div>
      </div>

      {/* Segmented status tabs — horizontally scrollable on mobile */}
      <div className="overflow-x-auto -mx-5 px-5 md:-mx-0 md:px-0 mb-6">
        <div className="flex items-center w-max">
          <div className="flex items-center p-1 gap-1 bg-muted rounded-lg">
            {TABS.map((tab) => (
              <a key={tab} href={`?status=${tab}`}>
                <span
                  className={cn(
                    "block cursor-pointer transition-all font-semibold text-xs px-3.5 py-1 rounded-md whitespace-nowrap",
                    activeTab === tab
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {proposals.length === 0 || !activeTab ? (
        <div className="flex flex-col items-center justify-center py-16">
          <GitPullRequest className="w-10 h-10 text-muted mb-3" />
          <h3 className="text-sm font-semibold text-secondary-foreground mb-1.5">No proposals</h3>
          <p className="text-[13px] text-muted-foreground text-center max-w-xs">
            {activeTab === "PENDING"
              ? "No pending proposals. Editors can propose changes from the document editor."
              : `No ${activeTab.toLowerCase()} proposals yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {proposals.map((proposal: typeof proposals[0]) => (
            <ProposalCard
              key={proposal.id}
              proposal={{
                ...proposal,
                createdAt: proposal.createdAt.toISOString(),
                votes: proposal.votes.map((v: typeof proposal.votes[0]) => ({
                  id: v.id,
                  decision: v.decision,
                  user: v.user,
                })),
              }}
              userRole={member.role}
              userId={session.user.id}
              workspaceId={workspace.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
