"use client";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, UserCheck, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface MemberActionsProps {
  workspaceId: string;
  userId: string;
  currentRole: string;
}

export function MemberActions({ workspaceId, userId, currentRole }: MemberActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function changeRole(role: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to update role");
        return;
      }
      toast.success("Role updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function removeMember() {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to remove member");
        return;
      }
      toast.success("Member removed");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <MoreHorizontal className="w-4 h-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentRole !== "EDITOR" && (
          <DropdownMenuItem onClick={() => changeRole("EDITOR")}>
            <UserCheck className="w-4 h-4 mr-2" />
            Make Editor
          </DropdownMenuItem>
        )}
        {currentRole !== "VIEWER" && (
          <DropdownMenuItem onClick={() => changeRole("VIEWER")}>
            <UserCheck className="w-4 h-4 mr-2" />
            Make Viewer
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600 focus:text-red-600 focus:bg-red-50"
          onClick={removeMember}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remove member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
