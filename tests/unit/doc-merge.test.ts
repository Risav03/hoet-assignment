import { describe, it, expect } from "vitest";
import { replayOps, mergeDocs } from "@/lib/sync/doc-merge";

// ── replayOps ────────────────────────────────────────────────────────────────

describe("replayOps", () => {
  it("returns the snapshot unchanged when there are no ops", () => {
    const snap = { text: "hello" };
    expect(replayOps(snap, [])).toEqual(snap);
  });

  it("applies a single replace patch", () => {
    const snap = { text: "hello" };
    const ops = [{ diff: [{ op: "replace", path: "/text", value: "world" }] }];
    expect(replayOps(snap, ops)).toEqual({ text: "world" });
  });

  it("applies multiple patches sequentially", () => {
    const snap = { a: 1, b: 2 };
    const ops = [
      { diff: [{ op: "replace", path: "/a", value: 10 }] },
      { diff: [{ op: "replace", path: "/b", value: 20 }] },
    ];
    expect(replayOps(snap, ops)).toEqual({ a: 10, b: 20 });
  });

  it("skips malformed patches without throwing", () => {
    const snap = { text: "safe" };
    const ops = [{ diff: [{ op: "replace", path: "/nonexistent/deep", value: "boom" }] }];
    // Should not throw — patch is skipped, snapshot returned as-is.
    expect(() => replayOps(snap, ops)).not.toThrow();
  });

  it("handles non-array diff entries gracefully", () => {
    const snap = { x: 1 };
    const ops = [{ diff: null }, { diff: "not-an-array" }];
    expect(replayOps(snap, ops)).toEqual({ x: 1 });
  });
});

// ── mergeDocs ────────────────────────────────────────────────────────────────

describe("mergeDocs", () => {
  it("applies non-conflicting local and remote ops", () => {
    const base = { a: 1, b: 2 };
    const localOps = [[{ op: "replace" as const, path: "/a", value: 10 }]];
    const remoteOps = [[{ op: "replace" as const, path: "/b", value: 20 }]];

    const { merged, conflicts } = mergeDocs(base, localOps, remoteOps);
    expect(merged).toEqual({ a: 10, b: 20 });
    expect(conflicts).toHaveLength(0);
  });

  it("detects a conflict when both sides touch the same path", () => {
    const base = { text: "hello" };
    const localOps = [[{ op: "replace" as const, path: "/text", value: "local" }]];
    const remoteOps = [[{ op: "replace" as const, path: "/text", value: "remote" }]];

    const { conflicts } = mergeDocs(base, localOps, remoteOps);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].path).toBe("/text");
  });

  it("excludes conflicting paths from the merged result and applies only safe ops", () => {
    const base = { a: 1, b: 2 };
    const localOps = [
      [
        { op: "replace" as const, path: "/a", value: 99 },
        { op: "replace" as const, path: "/b", value: 5 },
      ],
    ];
    const remoteOps = [[{ op: "replace" as const, path: "/a", value: 77 }]];

    const { merged, conflicts } = mergeDocs(base, localOps, remoteOps);

    // /a is conflicted — neither value should overwrite in a deterministic way,
    // but /b (local-only) should be applied.
    expect(conflicts[0].path).toBe("/a");
    // Safe local op on /b should be applied.
    expect((merged as Record<string, unknown>).b).toBe(5);
  });

  it("returns base unchanged when both op arrays are empty", () => {
    const base = { x: 42 };
    const { merged, conflicts } = mergeDocs(base, [], []);
    expect(merged).toEqual(base);
    expect(conflicts).toHaveLength(0);
  });

  it("handles an add op that does not conflict with a remote replace op", () => {
    const base = { items: [] as number[] };
    const localOps = [[{ op: "add" as const, path: "/items/-", value: 1 }]];
    const remoteOps = [[{ op: "add" as const, path: "/count", value: 1 }]];

    const { conflicts } = mergeDocs(base, localOps, remoteOps);
    expect(conflicts).toHaveLength(0);
  });
});
