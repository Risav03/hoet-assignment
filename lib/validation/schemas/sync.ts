import { z } from "zod";

export const syncOperationSchema = z.object({
  operationId: z.string().min(1).max(128),
  documentId: z.string().min(1),
  workspaceId: z.string().min(1),
  baseVersionId: z.string().optional(),
  operationType: z.enum([
    "CREATE_DOCUMENT",
    "UPDATE_DOCUMENT",
    "DELETE_DOCUMENT",
    "ARCHIVE_DOCUMENT",
    "RESTORE_DOCUMENT",
  ]),
  payload: z.record(z.string(), z.unknown()).refine(
    (val) => JSON.stringify(val).length <= 51_200,
    { message: "Payload must be under 50KB" }
  ),
  createdAt: z.string().datetime(),
  clientChecksum: z.string().max(128).optional(),
});

export const syncBatchSchema = z.object({
  operations: z
    .array(syncOperationSchema)
    .min(1)
    .max(50),
});

export type SyncOperationInput = z.infer<typeof syncOperationSchema>;
export type SyncBatchInput = z.infer<typeof syncBatchSchema>;
