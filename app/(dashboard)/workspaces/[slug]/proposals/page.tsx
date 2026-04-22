import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { getWorkspaceProposals } from "@/lib/dal/proposal";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { GitPullRequest } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}

const TABS = ["PENDING", "COMMITTED", "REJECTED"] as const;

export default async function ProposalsPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const { status } = await searchParams;

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const member = await getWorkspaceMember(workspace.id, session.user.id);
  if (!member) redirect("/dashboard");

  const { proposals } = await getWorkspaceProposals(workspace.id, session.user.id, {
    status: status as "PENDING" | "COMMITTED" | "REJECTED" | undefined,
  });

  const activeTab = (TABS.find((t) => t === status) ?? "PENDING") as typeof TABS[number];

  return (
    <div className="page-animate" style={{ padding: "36px 40px" }}>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff" }}
        >
          <GitPullRequest style={{ width: 17, height: 17, color: "#4f46e5" }} />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", marginBottom: 2 }}>
            Proposals
          </h1>
          <p style={{ fontSize: 13, color: "#71717a" }}>{workspace.name}</p>
        </div>
      </div>

      {/* Segmented status tabs */}
      <div className="flex items-center mb-6">
        <div
          className="flex items-center p-1 gap-1"
          style={{ background: "#f4f4f5", borderRadius: 8 }}
        >
          {TABS.map((tab) => (
            <a key={tab} href={`?status=${tab}`}>
              <span
                className="block cursor-pointer transition-all font-semibold"
                style={{
                  padding: "4px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  background: activeTab === tab ? "#ffffff" : "transparent",
                  color: activeTab === tab ? "#18181b" : "#71717a",
                  boxShadow: activeTab === tab ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                }}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </span>
            </a>
          ))}
        </div>
      </div>

      {proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <GitPullRequest style={{ width: 40, height: 40, color: "#d4d4d8", marginBottom: 12 }} />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#3f3f46", marginBottom: 6 }}>
            No proposals
          </h3>
          <p style={{ fontSize: 13, color: "#a1a1aa" }}>
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
