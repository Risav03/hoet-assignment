import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().max(500_000).default(""),
  tags: z.array(z.string().max(50)).max(20).default([]),
  folderId: z.string().optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500_000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  folderId: z.string().nullable().optional(),
});

export const archiveDocumentSchema = z.object({
  isArchived: z.boolean(),
});

export const searchDocumentSchema = z.object({
  query: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  isArchived: z.boolean().optional().default(false),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type SearchDocumentInput = z.infer<typeof searchDocumentSchema>;
