"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
// inviteMemberSchema is the base schema; a local form schema is defined below
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
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function InviteMemberDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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

  async function onSubmit(data: InviteFormInput) {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to invite member");
        return;
      }
      toast.success(`Invited ${data.email}`);
      setOpen(false);
      reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
        <UserPlus style={{ width: 14, height: 14 }} />
        Invite member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle style={{ fontSize: 16, fontWeight: 700 }}>Invite member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}>Email address</Label>
            <Input
              type="email"
              placeholder="colleague@example.com"
              {...register("email")}
              style={{ border: "1.5px solid #e4e4e7", borderRadius: 8, fontSize: 13 }}
              className="focus-visible:border-indigo-500 focus-visible:shadow-[0_0_0_3px_rgba(79,70,229,.1)] focus-visible:ring-0"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label style={{ fontSize: 12, fontWeight: 600, color: "#3f3f46" }}>Role</Label>
            <Select
              defaultValue="VIEWER"
              onValueChange={(v) => setValue("role", v as "EDITOR" | "VIEWER")}
            >
              <SelectTrigger style={{ borderRadius: 8, fontSize: 13, border: "1.5px solid #e4e4e7" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[320px]">
                <SelectItem value="EDITOR">Editor — can create and edit documents</SelectItem>
                <SelectItem value="VIEWER">Viewer — read-only access</SelectItem>
              </SelectContent>
            </Select>
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
              Invite
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
