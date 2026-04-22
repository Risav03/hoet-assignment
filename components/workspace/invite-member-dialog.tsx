"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const inviteFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["EDITOR", "VIEWER"]),
});
type InviteFormInput = z.infer<typeof inviteFormSchema>;

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { useInviteMember } from "@/lib/hooks/use-member-mutations";

export function InviteMemberDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const { mutate: inviteMember, isPending: loading } = useInviteMember(workspaceId);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteFormInput>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: { role: "VIEWER" as const },
  });

  function onSubmit(data: InviteFormInput) {
    inviteMember(data, {
      onSuccess: () => {
        setOpen(false);
        reset();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground border-none rounded-lg px-3.5 py-[7px] text-[13px] font-semibold cursor-pointer shadow-[0_1px_2px_rgba(79,70,229,.25)] transition-colors hover:bg-primary-hover">
        <UserPlus className="w-3.5 h-3.5" />
        Invite
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Invite member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-secondary-foreground">Email address</Label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              {...register("email")}
              className="focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-secondary-foreground">Role</Label>
            <Select
              defaultValue="VIEWER"
              onValueChange={(v) => setValue("role", v as "EDITOR" | "VIEWER")}
            >
              <SelectTrigger className="focus-visible:border-primary focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[320px]">
                <SelectItem value="EDITOR">Editor — can create and edit documents</SelectItem>
                <SelectItem value="VIEWER">Viewer — read-only access</SelectItem>
              </SelectContent>
            </Select>
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
              Invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
