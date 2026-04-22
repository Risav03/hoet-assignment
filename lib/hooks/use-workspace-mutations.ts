import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@/lib/validation";

export function useCreateWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateWorkspaceInput) => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create workspace");
      return json as { slug: string };
    },
    onSuccess: (data) => {
      toast.success("Workspace created!");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push(`/workspaces/${data.slug}`);
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateWorkspace(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateWorkspaceInput) => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update workspace");
      }
    },
    onSuccess: () => {
      toast.success("Workspace updated");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteWorkspace(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to delete workspace");
      }
    },
    onSuccess: () => {
      toast.success("Workspace deleted");
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
