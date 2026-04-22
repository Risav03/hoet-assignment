"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, FileText, GitPullRequest, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProposalDiff } from "./proposal-diff";

interface Vote {
  id: string;
  decision: "APPROVE" | "REJECT";
  user: { id: string; name: string };
}

interface Proposal {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "COMMITTED";
  proposalType: string;
  patch: string;
  createdAt: string;
  author: { id: string; name: string; email: string; avatarUrl?: string | null };
  document: { id: string; title: string; contentSnapshot: string };
  baseVersion?: {
    id: string;
    contentSnapshot: string;
    versionNumber: number;
  } | null;
  votes: Vote[];
}

interface ProposalCardProps {
  proposal: Proposal;
  userRole: string;
  userId: string;
  workspaceId: string;
}

const STATUS_CLASS: Record<string, string> = {
  PENDING:   "bg-warning-soft text-warning-strong border-warning-border",
  ACCEPTED:  "bg-success-soft text-success-strong border-success-border",
  REJECTED:  "bg-danger-soft text-danger-strong border-danger-border",
  COMMITTED: "bg-accent text-accent-foreground border-accent-border",
};

export function ProposalCard({ proposal, userRole, userId }: ProposalCardProps) {
  const router = useRouter();
  const [voting, setVoting] = useState<"APPROVE" | "REJECT" | null>(null);
  const [showDiff, setShowDiff] = useState(false);

  const canVote =
    (userRole === "OWNER" || userRole === "EDITOR") && proposal.status === "PENDING";
  const myVote = proposal.votes.find((v) => v.user.id === userId);
  const approvals = proposal.votes.filter((v) => v.decision === "APPROVE").length;
  const rejections = proposal.votes.filter((v) => v.decision === "REJECT").length;
  const totalVotes = approvals + rejections;
  const approvePct = totalVotes > 0 ? Math.round((approvals / totalVotes) * 100) : 0;
  const statusClass = STATUS_CLASS[proposal.status] ?? STATUS_CLASS.PENDING;

  async function handleVote(decision: "APPROVE" | "REJECT") {
    setVoting(decision);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to vote");
        return;
      }
      const result = await res.json();
      if (result.newStatus === "COMMITTED") {
        toast.success("Proposal committed! Document updated.");
      } else if (result.newStatus === "REJECTED") {
        toast.info("Proposal rejected.");
      } else {
        toast.success("Vote recorded.");
      }
      router.refresh();
    } finally {
      setVoting(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-[18px] shadow-sm">
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex items-center justify-center shrink-0 w-9 h-9 rounded-[10px] bg-accent">
          <GitPullRequest className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-start sm:items-center gap-2 mb-1.5 flex-wrap">
            <p className="text-sm font-bold text-foreground">
              Change to{" "}
              <span className="text-primary">{proposal.document.title}</span>
            </p>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold border whitespace-nowrap",
                statusClass
              )}
            >
              {proposal.status.charAt(0) + proposal.status.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <Avatar className="w-[18px] h-[18px]">
              <AvatarFallback className="text-[9px] font-bold bg-accent text-accent-foreground">
                {proposal.author.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-secondary-foreground">{proposal.author.name}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <FileText className="w-[11px] h-[11px]" />
              {proposal.document.title}
            </span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Vote bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Check className="w-[11px] h-[11px] text-success" />
            {approvals} approve
          </span>
          <span className="flex items-center gap-1">
            {rejections} reject
            <X className="w-[11px] h-[11px] text-danger" />
          </span>
        </div>
        <div className="h-[5px] rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-success rounded-full transition-[width] duration-300"
            style={{ width: `${approvePct}%` }}
          />
        </div>
      </div>

      {/* View changes toggle + action buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-between">
        {/* View changes */}
        <button
          onClick={() => setShowDiff((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDiff ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {showDiff ? "Hide changes" : "View changes"}
        </button>

        {/* Vote actions */}
        {canVote && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:justify-end">
            {myVote && (
              <span className="text-xs text-muted-foreground text-center sm:text-left">
                You voted: {myVote.decision === "APPROVE" ? "✓ Approve" : "✗ Reject"}
              </span>
            )}
            <Button
              size="sm"
              disabled={!!voting}
              onClick={() => handleVote("APPROVE")}
              className="font-semibold text-white bg-success rounded-lg text-xs h-[30px] px-3"
            >
              {voting === "APPROVE" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3 mr-1" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!!voting}
              onClick={() => handleVote("REJECT")}
              className="rounded-lg text-xs h-[30px] px-3 text-muted-foreground border-border"
            >
              {voting === "REJECT" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <X className="w-3 h-3 mr-1" />
              )}
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Diff panel */}
      {showDiff && (
        <ProposalDiff
          documentId={proposal.document.id}
          documentTitle={proposal.document.title}
          dbContent={proposal.document.contentSnapshot}
          rawPatch={proposal.patch}
          baseVersion={proposal.baseVersion}
        />
      )}
    </div>
  );
}
