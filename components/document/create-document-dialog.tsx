"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

type CreateDocumentFormInput = { title: string };

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Loader2 } from "lucide-react";
import { useCreateDocument } from "@/lib/hooks/use-document-mutations";

export function CreateDocumentDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const { mutate: createDocument, isPending: loading } = useCreateDocument(workspaceId);

  const titleOnlySchema = z.object({ title: z.string().min(1, "Title is required").max(500) });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDocumentFormInput>({
    resolver: zodResolver(titleOnlySchema),
  });

  function onSubmit(data: CreateDocumentFormInput) {
    createDocument(data, {
      onSuccess: () => {
        setOpen(false);
        reset();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-[7px] text-[13px] font-semibold cursor-pointer shadow-[0_1px_2px_rgba(79,70,229,.25)] transition-colors hover:bg-primary-hover">
        <Plus className="w-3.5 h-3.5" />
        Create
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Create document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="doc-title" className="text-xs font-semibold text-secondary-foreground">
              Title
            </Label>
            <Input
              id="doc-title"
              placeholder="Untitled Document"
              {...register("title")}
              className="focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
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
