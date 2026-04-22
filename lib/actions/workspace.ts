"use server";
import { auth } from "@/auth";
import { createWorkspace } from "@/lib/dal/workspace";
import { createWorkspaceSchema } from "@/lib/validation";
import { redirect } from "next/navigation";

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

export async function createWorkspaceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const raw = { name: formData.get("name") as string };
  const parsed = createWorkspaceSchema.parse(raw);
  const slug = parsed.slug ?? generateSlug(parsed.name);

  const workspace = await createWorkspace(session.user.id, parsed.name, slug);
  redirect(`/workspaces/${workspace.id}`);
}
