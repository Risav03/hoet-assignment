import { useQuery } from "@tanstack/react-query";

export function usePendingProposalCount(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["proposals", "pending-count", workspaceId],
    queryFn: async () => {
      const res = await fetch(`/api/proposals/pending-count?workspaceId=${workspaceId}`);
      if (!res.ok) return { count: 0 };
      return res.json() as Promise<{ count: number }>;
    },
    enabled: !!workspaceId,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
