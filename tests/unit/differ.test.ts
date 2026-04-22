import { describe, it, expect } from "vitest";
import { createPatch, applyPatch, computeChecksum, parsePatch } from "@/lib/sync/differ";

describe("createPatch", () => {
  it("creates a patch with the new content", () => {
    const patch = createPatch("old content", "new content");
    expect(patch.content).toBe("new content");
  });

  it("stores baseLength", () => {
    const patch = createPatch("hello", "world");
    expect(patch.baseLength).toBe(5);
  });
});

describe("applyPatch", () => {
  it("returns patch content", () => {
    const patch = createPatch("old", "new");
    const result = applyPatch("old", patch);
    expect(result).toBe("new");
  });
});

describe("parsePatch", () => {
  it("parses valid JSON patch", () => {
    const raw = JSON.stringify({ content: "hello", baseLength: 3 });
    const patch = parsePatch(raw);
    expect(patch.content).toBe("hello");
  });

  it("handles invalid JSON gracefully", () => {
    const patch = parsePatch("not json");
    expect(patch.content).toBe("not json");
  });
});

describe("computeChecksum", () => {
  it("returns consistent hash for same input", () => {
    const a = computeChecksum("hello world");
    const b = computeChecksum("hello world");
    expect(a).toBe(b);
  });

  it("returns different hash for different input", () => {
    const a = computeChecksum("hello");
    const b = computeChecksum("world");
    expect(a).not.toBe(b);
  });

  it("returns a non-empty string", () => {
    const hash = computeChecksum("test");
    expect(hash.length).toBeGreaterThan(0);
  });
});
