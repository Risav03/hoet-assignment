import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function useInviteMember(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; role: "EDITOR" | "VIEWER" }) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to invite member");
      return json;
    },
    onSuccess: (_, variables) => {
      toast.success(`Invited ${variables.email}`);
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useChangeRole(workspaceId: string, userId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to update role");
      }
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRemoveMember(workspaceId: string, userId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Failed to remove member");
      }
    },
    onSuccess: () => {
      toast.success("Member removed");
      queryClient.invalidateQueries({ queryKey: ["workspaces", workspaceId, "members"] });
      router.refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
