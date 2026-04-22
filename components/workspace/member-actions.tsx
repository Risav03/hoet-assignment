"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MoreHorizontal, UserCheck, Trash2, Loader2 } from "lucide-react";
import { useChangeRole, useRemoveMember } from "@/lib/hooks/use-member-mutations";

interface MemberActionsProps {
  workspaceId: string;
  userId: string;
  currentRole: string;
}

export function MemberActions({ workspaceId, userId, currentRole }: MemberActionsProps) {
  const { mutate: changeRole, isPending: changingRole } = useChangeRole(workspaceId, userId);
  const { mutate: removeMember, isPending: removing } = useRemoveMember(workspaceId, userId);
  const loading = changingRole || removing;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={loading}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 w-8 p-0")}
          />
        }
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreHorizontal className="w-4 h-4" />
        )}
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
          onClick={() => removeMember()}
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Remove member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
