import { describe, it, expect } from "vitest";
import {
  signupSchema,
  createWorkspaceSchema,
  createDocumentSchema,
  createProposalSchema,
  syncBatchSchema,
} from "@/lib/validation";

describe("signupSchema", () => {
  it("accepts valid signup data", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "SecurePass1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short password", () => {
    const result = signupSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = signupSchema.safeParse({
      name: "Jane",
      email: "jane@example.com",
      password: "nouppercase1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = signupSchema.safeParse({
      name: "Jane",
      email: "not-an-email",
      password: "SecurePass1",
    });
    expect(result.success).toBe(false);
  });
});

describe("createWorkspaceSchema", () => {
  it("accepts valid workspace", () => {
    const result = createWorkspaceSchema.safeParse({ name: "My Team" });
    expect(result.success).toBe(true);
  });

  it("rejects short name", () => {
    const result = createWorkspaceSchema.safeParse({ name: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slug characters", () => {
    const result = createWorkspaceSchema.safeParse({ name: "My Team", slug: "has spaces" });
    expect(result.success).toBe(false);
  });
});

describe("createDocumentSchema", () => {
  it("accepts minimal document", () => {
    const result = createDocumentSchema.safeParse({ title: "My Doc" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = createDocumentSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("defaults content and tags", () => {
    const result = createDocumentSchema.safeParse({ title: "Test" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("");
      expect(result.data.tags).toEqual([]);
    }
  });
});

describe("createProposalSchema", () => {
  it("accepts valid proposal", () => {
    const result = createProposalSchema.safeParse({
      documentId: "clxxx123456789012345678",
      patch: JSON.stringify({ content: "new content" }),
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty patch", () => {
    const result = createProposalSchema.safeParse({
      documentId: "clxxx123456789012345678",
      patch: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("syncBatchSchema", () => {
  const validOp = {
    operationId: "op-123",
    documentId: "clxxx123456789012345678",
    workspaceId: "clyyy123456789012345678",
    operationType: "UPDATE_DOCUMENT" as const,
    payload: { content: "hello" },
    createdAt: new Date().toISOString(),
  };

  it("accepts valid sync batch", () => {
    const result = syncBatchSchema.safeParse({ operations: [validOp] });
    expect(result.success).toBe(true);
  });

  it("rejects empty operations", () => {
    const result = syncBatchSchema.safeParse({ operations: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid operationType", () => {
    const result = syncBatchSchema.safeParse({
      operations: [{ ...validOp, operationType: "INVALID" }],
    });
    expect(result.success).toBe(false);
  });
});
