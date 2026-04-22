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
        <DialogTrigger className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-[7px] text-[13px] font-semibold cursor-pointer shadow-[0_1px_2px_rgba(79,70,229,.25)] transition-colors hover:bg-primary-hover">
          <Plus className="w-3.5 h-3.5" />
          Create
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
            <Label htmlFor="ws-name" className="text-xs font-semibold text-secondary-foreground">
              Workspace name
            </Label>
            <Input
              id="ws-name"
              placeholder="My Team"
              {...register("name")}
              className="focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="font-semibold text-primary-foreground bg-primary"
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
