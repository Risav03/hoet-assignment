"use client";
import React, { cloneElement, isValidElement, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createWorkspaceSchema, type CreateWorkspaceInput } from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CreateWorkspaceDialogProps {
  trigger?: React.ReactNode;
}

export function CreateWorkspaceDialog({ trigger }: CreateWorkspaceDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
  });

  async function onSubmit(data: CreateWorkspaceInput) {
    setLoading(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to create workspace");
        return;
      }
      toast.success("Workspace created!");
      setOpen(false);
      reset();
      router.push(`/workspaces/${json.id}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isValidElement(trigger) ? (
        cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
          onClick: () => setOpen(true),
        })
      ) : (
        <DialogTrigger
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "#4f46e5",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 1px 2px rgba(79,70,229,.25)",
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          New workspace
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            A workspace is a shared space for your team to collaborate on documents.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="ws-name"
              style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}
            >
              Workspace name
            </Label>
            <Input
              id="ws-name"
              placeholder="My Team"
              {...register("name")}
              style={{ border: "1.5px solid #e4e4e7", borderRadius: 8, fontSize: 13 }}
              className="focus-visible:border-indigo-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              style={{ borderRadius: 8, fontSize: 13 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="font-semibold text-white"
              style={{ background: "#4f46e5", borderRadius: 8, fontSize: 13 }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
