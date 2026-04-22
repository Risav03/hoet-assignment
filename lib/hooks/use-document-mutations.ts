import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function useCreateDocument(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create document");
      return json as { id: string };
    },
    onSuccess: (data) => {
      toast.success("Document created!");
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "documents"] });
      router.push(`/documents/${data.id}`);
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useSaveDocument(documentId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to save");
      }
    },
    onSuccess: () => {
      toast.success("Document saved");
      queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useSubmitProposal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      workspaceId: string;
      documentId: string;
      baseVersionId?: string | null;
      patch: string;
      proposalType: string;
    }) => {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to create proposal");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      toast.success("Proposal submitted! Collaborators will be notified.");
      queryClient.invalidateQueries({ queryKey: ["proposals", variables.workspaceId] });
      queryClient.invalidateQueries({
        queryKey: ["proposals", "pending-count", variables.workspaceId],
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRestoreVersion(documentId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (versionId: string) => {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to restore version");
      }
      return versionId;
    },
    onSuccess: () => {
      toast.success("Version restored! A new version was created.");
      queryClient.invalidateQueries({ queryKey: ["documents", documentId] });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
