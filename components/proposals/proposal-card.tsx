"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, FileText, GitPullRequest } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  document: { id: string; title: string };
  votes: Vote[];
}

interface ProposalCardProps {
  proposal: Proposal;
  userRole: string;
  userId: string;
  workspaceId: string;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PENDING: { bg: "#fffbeb", color: "#92400e", border: "#fde68a" },
  ACCEPTED: { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  REJECTED: { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
  COMMITTED: { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" },
};

export function ProposalCard({ proposal, userRole, userId }: ProposalCardProps) {
  const router = useRouter();
  const [voting, setVoting] = useState<"APPROVE" | "REJECT" | null>(null);
  const canVote =
    (userRole === "OWNER" || userRole === "EDITOR") && proposal.status === "PENDING";
  const myVote = proposal.votes.find((v) => v.user.id === userId);
  const approvals = proposal.votes.filter((v) => v.decision === "APPROVE").length;
  const rejections = proposal.votes.filter((v) => v.decision === "REJECT").length;
  const totalVotes = approvals + rejections;
  const approvePct = totalVotes > 0 ? Math.round((approvals / totalVotes) * 100) : 0;
  const statusStyle = STATUS_STYLE[proposal.status] ?? STATUS_STYLE.PENDING;

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
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e4e4e7",
        borderRadius: 12,
        padding: "18px 20px",
        boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-4">
        {/* Icon box */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff" }}
        >
          <GitPullRequest style={{ width: 16, height: 16, color: "#4f46e5" }} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="flex items-center gap-2 mb-1.5">
            <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>
              Change to{" "}
              <span style={{ color: "#4f46e5" }}>{proposal.document.title}</span>
            </p>
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold ml-auto"
              style={{
                background: statusStyle.bg,
                color: statusStyle.color,
                border: `1px solid ${statusStyle.border}`,
                whiteSpace: "nowrap",
              }}
            >
              {proposal.status.charAt(0) + proposal.status.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 12, color: "#71717a" }}>
            <Avatar style={{ width: 18, height: 18 }}>
              <AvatarFallback
                className="text-[9px] font-bold"
                style={{ background: "#eef2ff", color: "#4338ca" }}
              >
                {proposal.author.name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span style={{ fontWeight: 500, color: "#3f3f46" }}>{proposal.author.name}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <FileText style={{ width: 11, height: 11 }} />
              {proposal.document.title}
            </span>
            <span>·</span>
            <span>{formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Vote bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5" style={{ fontSize: 11, color: "#71717a" }}>
          <span className="flex items-center gap-1">
            <Check style={{ width: 11, height: 11, color: "#059669" }} />
            {approvals} approve
          </span>
          <span className="flex items-center gap-1">
            {rejections} reject
            <X style={{ width: 11, height: 11, color: "#e11d48" }} />
          </span>
        </div>
        <div
          style={{
            height: 5,
            borderRadius: 99,
            background: "#f4f4f5",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${approvePct}%`,
              background: "#059669",
              borderRadius: 99,
              transition: "width 300ms ease",
            }}
          />
        </div>
      </div>

      {/* Action buttons */}
      {canVote && (
        <div className="flex items-center gap-2 justify-end">
          {myVote && (
            <span style={{ fontSize: 12, color: "#a1a1aa" }}>
              You voted: {myVote.decision === "APPROVE" ? "✓ Approve" : "✗ Reject"}
            </span>
          )}
          <Button
            size="sm"
            disabled={!!voting}
            onClick={() => handleVote("APPROVE")}
            className="font-semibold text-white"
            style={{
              background: "#059669",
              borderRadius: 8,
              fontSize: 12,
              height: 30,
              paddingLeft: 12,
              paddingRight: 12,
            }}
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
            style={{
              borderRadius: 8,
              fontSize: 12,
              height: 30,
              paddingLeft: 12,
              paddingRight: 12,
              color: "#71717a",
              borderColor: "#e4e4e7",
            }}
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
  );
}
