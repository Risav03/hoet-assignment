import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { voteOnProposal } from "@/lib/dal/proposal";
import { voteProposalSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { emitSSEEvent } from "@/lib/sse/emitter";
import { db } from "@/lib/db";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await req.json();
    const data = voteProposalSchema.parse(body);
    const result = await voteOnProposal(id, session.user.id, data.decision);

    const proposal = await db.changeProposal.findUnique({ where: { id } });
    if (proposal) {
      const eventType =
        result.newStatus === "COMMITTED"
          ? "proposal_committed"
          : result.newStatus === "REJECTED"
          ? "proposal_rejected"
          : "proposal_updated";

      emitSSEEvent(proposal.workspaceId, {
        type: eventType,
        payload: {
          proposalId: id,
          boardId: proposal.boardId,
          operationType: proposal.operationType,
          newStatus: result.newStatus,
          voterId: session.user.id,
          decision: data.decision,
          approvals: result.approvals,
          rejections: result.rejections,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("Insufficient") || msg.includes("Not a workspace")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("no longer pending")) {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    console.error("[vote POST]", err);
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
  }
}
