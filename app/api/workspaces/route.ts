import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createWorkspace, getUserWorkspaces } from "@/lib/dal/workspace";
import { createWorkspaceSchema } from "@/lib/validation";
import { ZodError } from "zod";

function generateSlug(name: string, suffix: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 45) +
    "-" +
    suffix
  );
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const memberships = await getUserWorkspaces(session.user.id);
    return NextResponse.json(memberships.map((m: typeof memberships[0]) => ({ ...m.workspace, role: m.role })));
  } catch (err) {
    console.error("[workspaces GET]", err);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createWorkspaceSchema.parse(body);
    const slug = data.slug ?? generateSlug(data.name, Math.random().toString(36).slice(2, 7));

    const workspace = await createWorkspace(session.user.id, data.name, slug);
    return NextResponse.json(workspace, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Workspace slug already taken" }, { status: 409 });
    }
    console.error("[workspaces POST]", err);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
