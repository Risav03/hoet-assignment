import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { getWorkspaceProposals } from "@/lib/dal/proposal";
import { ProposalCard } from "@/components/proposals/proposal-card";
import { Badge } from "@/components/ui/badge";
import { GitPullRequest } from "lucide-react";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string }>;
}

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

  const tabs = ["PENDING", "COMMITTED", "REJECTED"] as const;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <GitPullRequest className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold">Proposals</h1>
          <p className="text-slate-500 text-sm">{workspace.name}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {tabs.map((tab) => (
          <a key={tab} href={`?status=${tab}`}>
            <Badge
              className={`cursor-pointer ${
                (status ?? "PENDING") === tab
                  ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                  : "bg-transparent text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </Badge>
          </a>
        ))}
      </div>

      {proposals.length === 0 ? (
        <div className="text-center py-16">
          <GitPullRequest className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <h3 className="font-medium text-slate-600 mb-1">No proposals</h3>
          <p className="text-sm text-slate-400">
            {status === "PENDING"
              ? "No pending proposals. Editors can propose changes from the document editor."
              : `No ${status?.toLowerCase()} proposals yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
