import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface VoteResult {
  newStatus: "COMMITTED" | "REJECTED" | "PENDING" | "ACCEPTED";
}

export function useVoteProposal(proposalId: string, workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (decision: "APPROVE" | "REJECT") => {
      const res = await fetch(`/api/proposals/${proposalId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to vote");
      }
      return res.json() as Promise<VoteResult>;
    },
    onSuccess: (result) => {
      if (result.newStatus === "COMMITTED") {
        toast.success("Proposal committed! Document updated.");
      } else if (result.newStatus === "REJECTED") {
        toast.info("Proposal rejected.");
      } else {
        toast.success("Vote recorded.");
      }
      queryClient.invalidateQueries({ queryKey: ["proposals", workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["proposals", "pending-count", workspaceId],
      });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
