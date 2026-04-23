"use client";
import React, { useState } from "react";
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
import { useCreateWorkspace } from "@/lib/hooks/use-workspace-mutations";

interface CreateWorkspaceDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateWorkspaceDialog({
  trigger,
  open,
  onOpenChange,
}: CreateWorkspaceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { mutate: createWorkspace, isPending: loading } = useCreateWorkspace();
  const dialogOpen = open ?? internalOpen;
  const setDialogOpen = onOpenChange ?? setInternalOpen;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
  });

  function onSubmit(data: CreateWorkspaceInput) {
    createWorkspace(data, {
      onSuccess: () => {
        setDialogOpen(false);
        reset();
      },
    });
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger === undefined ? (
        <DialogTrigger className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-[7px] text-[13px] font-semibold cursor-pointer shadow-[0_1px_2px_rgba(79,70,229,.25)] transition-colors hover:bg-primary-hover">
          <Plus className="w-3.5 h-3.5" />
          Create
        </DialogTrigger>
      ) : trigger ? (
        trigger
      ) : null}
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
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
