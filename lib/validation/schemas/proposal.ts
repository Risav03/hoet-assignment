import { z } from "zod";

export const createProposalSchema = z.object({
  documentId: z.string().min(1, "Invalid document ID"),
  baseVersionId: z.string().optional(),
  patch: z.string().min(1, "Patch is required").max(200_000),
  proposalType: z.string().max(100).default("content_update"),
});

export const voteProposalSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});

export const listProposalsSchema = z.object({
  workspaceId: z.string().min(1),
  documentId: z.string().optional(),
  status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "COMMITTED"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type VoteProposalInput = z.infer<typeof voteProposalSchema>;
export type ListProposalsInput = z.infer<typeof listProposalsSchema>;
