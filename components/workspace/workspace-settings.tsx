"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateWorkspaceSchema, type UpdateWorkspaceInput } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Trash2, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateWorkspace, useDeleteWorkspace } from "@/lib/hooks/use-workspace-mutations";

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface PermissionToggle {
  id: string;
  label: string;
  description: string;
}

const PERMISSIONS: PermissionToggle[] = [
  {
    id: "viewer_proposals",
    label: "Viewers can comment",
    description: "Allow viewers to leave comments on documents.",
  },
  {
    id: "public_proposals",
    label: "Public proposal history",
    description: "Show proposal history to all workspace members.",
  },
  {
    id: "require_approval",
    label: "Require owner approval",
    description: "All proposals require owner approval to be committed.",
  },
];

function SectionCard({
  title,
  description,
  children,
  variant = "default",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm overflow-hidden",
        variant === "danger" ? "border border-danger-border" : "border border-border"
      )}
    >
      <div className="px-6 py-5 border-b border-muted">
        <p
          className={cn(
            "text-sm font-bold",
            variant === "danger" ? "text-danger" : "text-foreground",
            description ? "mb-0.5" : ""
          )}
        >
          {title}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSIONS.map((p) => [p.id, false]))
  );
  const { mutate: updateWorkspace } = useUpdateWorkspace(workspace.id);
  const { mutate: deleteWorkspace, isPending: deleting } = useDeleteWorkspace(workspace.id);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: { name: workspace.name },
  });

  function onSubmit(data: UpdateWorkspaceInput) {
    updateWorkspace(data);
  }

  function handleDelete() {
    if (
      !confirm(
        "Are you sure? This will permanently delete the workspace and all its data."
      )
    )
      return;
    deleteWorkspace();
  }

  return (
    <div className="page-animate p-5 md:p-9 md:px-10 max-h-screen overflow-y-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex items-center justify-center w-9 h-9 rounded-[10px] bg-accent">
          <Settings className="w-[17px] h-[17px] text-primary" />
        </div>
        <h1 className="text-[22px] font-extrabold text-foreground">Workspace Settings</h1>
      </div>

      <div className="space-y-5 max-w-[660px]">
        {/* General */}
        <SectionCard title="General" description="Update your workspace name and details">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-secondary-foreground">
                Workspace name
              </Label>
              <Input
                {...register("name")}
                className="focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-secondary-foreground">Slug</Label>
              <Input
                value={workspace.slug}
                disabled
                className="text-muted-foreground bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Slug cannot be changed after creation.
              </p>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="font-semibold text-primary-foreground bg-primary h-9 shadow-[0_1px_2px_rgba(79,70,229,.25)]"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save changes
            </Button>
          </form>
        </SectionCard>

        {/* Danger zone */}
        <SectionCard
          title="Danger Zone"
          description="Irreversible actions — proceed with caution"
          variant="danger"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[13px] font-semibold text-foreground mb-0.5">
                Delete workspace
              </p>
              <p className="text-xs text-muted-foreground">
                Permanently deletes the workspace and all documents.
              </p>
            </div>
            <Button
              disabled={deleting}
              onClick={handleDelete}
              className="font-semibold text-white bg-danger shrink-0 h-[34px] px-3.5 text-xs"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete workspace
            </Button>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
