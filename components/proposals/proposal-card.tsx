"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X, Loader2, FileText, Clock } from "lucide-react";
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

const STATUS_CONFIG = {
  PENDING: { label: "Pending", className: "bg-amber-100 text-amber-700 border-amber-200" },
  ACCEPTED: { label: "Accepted", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  COMMITTED: { label: "Committed", className: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

export function ProposalCard({ proposal, userRole, userId }: ProposalCardProps) {
  const router = useRouter();
  const [voting, setVoting] = useState<"APPROVE" | "REJECT" | null>(null);
  const canVote = (userRole === "OWNER" || userRole === "EDITOR") && proposal.status === "PENDING";
  const myVote = proposal.votes.find((v) => v.user.id === userId);
  const approvals = proposal.votes.filter((v) => v.decision === "APPROVE").length;
  const rejections = proposal.votes.filter((v) => v.decision === "REJECT").length;
  const statusConfig = STATUS_CONFIG[proposal.status];

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

  let patchPreview = "";
  try {
    const parsed = JSON.parse(proposal.patch) as { content?: string };
    if (parsed.content) {
      patchPreview = parsed.content.replace(/<[^>]*>/g, "").slice(0, 200);
    }
  } catch {
    patchPreview = proposal.patch.slice(0, 200);
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
              {proposal.author.name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{proposal.author.name}</span>
              <span className="text-xs text-slate-400">proposed a change to</span>
              <span className="text-sm font-medium text-indigo-600 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {proposal.document.title}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-xs ${statusConfig.className}`}>
                {statusConfig.label}
              </Badge>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(proposal.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      {patchPreview && (
        <CardContent className="pt-0 pb-3">
          <div className="bg-slate-50 dark:bg-slate-900 rounded-md p-3 text-xs text-slate-600 dark:text-slate-400 font-mono line-clamp-3">
            {patchPreview}
            {patchPreview.length >= 200 && "..."}
          </div>
        </CardContent>
      )}

      <Separator />

      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Check className="w-3 h-3 text-emerald-500" />
              {approvals} approve
            </span>
            <span className="flex items-center gap-1">
              <X className="w-3 h-3 text-red-500" />
              {rejections} reject
            </span>
          </div>

          {canVote && (
            <div className="flex items-center gap-2">
              {myVote && (
                <span className="text-xs text-slate-400">
                  You voted: {myVote.decision === "APPROVE" ? "✓ Approve" : "✗ Reject"}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                disabled={!!voting}
                onClick={() => handleVote("APPROVE")}
              >
                {voting === "APPROVE" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50"
                disabled={!!voting}
                onClick={() => handleVote("REJECT")}
              >
                {voting === "REJECT" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <X className="w-3 h-3" />
                )}
                Reject
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
