import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createProposal, getWorkspaceProposals } from "@/lib/dal/proposal";
import { createProposalSchema, listProposalsSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/emitter";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  try {
    const opts = listProposalsSchema.parse({
      workspaceId: url.searchParams.get("workspaceId"),
      documentId: url.searchParams.get("documentId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ?? 20,
    });
    const result = await getWorkspaceProposals(opts.workspaceId, session.user.id, opts);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[proposals GET]", err);
    return NextResponse.json({ error: "Failed to fetch proposals" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const workspaceId = body.workspaceId as string;
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 422 });
    }

    const data = createProposalSchema.parse(body);
    const proposal = await createProposal(workspaceId, session.user.id, {
      documentId: data.documentId,
      patch: data.patch,
      baseVersionId: data.baseVersionId,
      proposalType: data.proposalType,
    });

    emitSSEEvent(workspaceId, {
      type: "proposal_created",
      payload: {
        proposalId: proposal.id,
        documentId: data.documentId,
        authorId: session.user.id,
      },
    });

    return NextResponse.json(proposal, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace") || msg.includes("Viewer")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error("[proposals POST]", err);
    return NextResponse.json({ error: "Failed to create proposal" }, { status: 500 });
  }
}
