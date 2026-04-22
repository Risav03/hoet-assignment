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
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
  borderColor,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  borderColor?: string;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${borderColor ?? "#e4e4e7"}`,
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,.04)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #f4f4f5" }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: borderColor ? borderColor : "#18181b",
            marginBottom: description ? 2 : 0,
          }}
        >
          {title}
        </p>
        {description && (
          <p style={{ fontSize: 12, color: "#71717a" }}>{description}</p>
        )}
      </div>
      <div style={{ padding: "20px 24px" }}>{children}</div>
    </div>
  );
}

export function WorkspaceSettings({ workspace }: { workspace: Workspace }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMISSIONS.map((p) => [p.id, false]))
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues: { name: workspace.name },
  });

  async function onSubmit(data: UpdateWorkspaceInput) {
    const res = await fetch(`/api/workspaces/${workspace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to update workspace");
      return;
    }
    toast.success("Workspace updated");
    router.refresh();
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure? This will permanently delete the workspace and all its data."
      )
    )
      return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/${workspace.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to delete workspace");
        return;
      }
      toast.success("Workspace deleted");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-animate" style={{ padding: "36px 40px" }}>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-8">
        <div
          className="flex items-center justify-center"
          style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff" }}
        >
          <Settings style={{ width: 17, height: 17, color: "#4f46e5" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b" }}>
          Workspace Settings
        </h1>
      </div>

      <div className="space-y-5" style={{ maxWidth: 660 }}>
        {/* General */}
        <SectionCard title="General" description="Update your workspace name and details">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}
              >
                Workspace name
              </Label>
              <Input
                {...register("name")}
                style={{
                  border: "1.5px solid #e4e4e7",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 500,
                }}
                className="focus-visible:border-indigo-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label
                style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}
              >
                Slug
              </Label>
              <Input
                value={workspace.slug}
                disabled
                style={{
                  border: "1.5px solid #e4e4e7",
                  borderRadius: 8,
                  fontSize: 13,
                  color: "#a1a1aa",
                  background: "#f4f4f5",
                }}
              />
              <p style={{ fontSize: 12, color: "#a1a1aa" }}>
                Slug cannot be changed after creation.
              </p>
            </div>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="font-semibold text-white"
              style={{
                background: "#4f46e5",
                borderRadius: 8,
                height: 36,
                fontSize: 13,
                boxShadow: "0 1px 2px rgba(79,70,229,.25)",
              }}
            >
              {isSubmitting && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              Save changes
            </Button>
          </form>
        </SectionCard>

        {/* Permissions */}
        <SectionCard
          title="Permissions"
          description="Control what members can do in this workspace"
        >
          <div className="space-y-4">
            {PERMISSIONS.map((perm) => (
              <div
                key={perm.id}
                className="flex items-center justify-between"
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#18181b",
                      marginBottom: 2,
                    }}
                  >
                    {perm.label}
                  </p>
                  <p style={{ fontSize: 12, color: "#71717a" }}>
                    {perm.description}
                  </p>
                </div>
                <Switch
                  checked={permissions[perm.id]}
                  onCheckedChange={(checked) =>
                    setPermissions((prev) => ({ ...prev, [perm.id]: checked }))
                  }
                  className="ml-4"
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Danger zone */}
        <SectionCard
          title="Danger Zone"
          description="Irreversible actions — proceed with caution"
          borderColor="#fecdd3"
        >
          <div className="flex items-center justify-between">
            <div>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#18181b",
                  marginBottom: 2,
                }}
              >
                Delete workspace
              </p>
              <p style={{ fontSize: 12, color: "#71717a" }}>
                Permanently deletes the workspace and all documents.
              </p>
            </div>
            <Button
              disabled={deleting}
              onClick={handleDelete}
              className="font-semibold text-white shrink-0 ml-4"
              style={{
                background: "#e11d48",
                borderRadius: 8,
                height: 34,
                fontSize: 12,
                paddingLeft: 14,
                paddingRight: 14,
              }}
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
