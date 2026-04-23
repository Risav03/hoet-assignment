import "server-only";
import {
  applyPatch,
  deepClone,
  type Operation as JSONPatchOp,
} from "fast-json-patch";
import { applyOperation } from "@/lib/ot/apply";

/**
 * Extract the plain text content from a Tiptap JSON document.
 * Used by the OT layer to compute character-level positions.
 */
export function tiptapToText(doc: unknown): string {
  if (typeof doc === "string") return doc;
  if (!doc || typeof doc !== "object") return "";

  const node = doc as Record<string, unknown>;

  if (typeof node.text === "string") return node.text;

  if (Array.isArray(node.content)) {
    return (node.content as unknown[])
      .map((child) => tiptapToText(child))
      .join("");
  }

  return "";
}

/**
 * Reconstruct document content at a given rev by applying ops to a snapshot.
 * Pure — no I/O.
 *
 * Handles two op formats:
 *  - Legacy: `{ diff: JSONPatchOp[] }` — pre-OT migration ops still stored in DB
 *  - OT:     `{ type, position, text?, length? }` — ops written after migration
 *
 * For OT ops the snapshot content is treated as a plain-text string extracted
 * from the Tiptap JSON. The resulting plain text is then stored as-is inside a
 * minimal Tiptap doc wrapper so the rest of the pipeline can handle it uniformly.
 */
export function replayOps(
  snapshot: unknown,
  ops: Array<{
    diff?: unknown;
    type?: string | null;
    position?: number | null;
    text?: string | null;
    length?: number | null;
  }>
): unknown {
  if (ops.length === 0) return snapshot;

  // Determine format by inspecting the first op.
  const firstOp = ops[0];
  const isLegacy = firstOp.diff !== null && firstOp.diff !== undefined;

  if (isLegacy) {
    // Legacy JSON-Patch path
    let doc = deepClone(snapshot);
    for (const op of ops) {
      if (!op.diff) continue;
      const patch = op.diff as JSONPatchOp[];
      if (!Array.isArray(patch) || patch.length === 0) continue;
      try {
        const result = applyPatch(doc, patch, false, false);
        doc = result.newDocument;
      } catch {
        // Skip malformed patches
      }
    }
    return doc;
  }

  // OT path — work on plain text extracted from the snapshot
  let text = tiptapToText(snapshot);

  for (const op of ops) {
    if (!op.type || op.position === null || op.position === undefined) continue;

    if (op.type === "insert" && op.text !== null && op.text !== undefined) {
      text = applyOperation(text, {
        type: "insert",
        position: op.position,
        text: op.text,
        clientId: "",
        opId: "",
        baseRev: 0,
      });
    } else if (op.type === "delete" && op.length !== null && op.length !== undefined) {
      text = applyOperation(text, {
        type: "delete",
        position: op.position,
        length: op.length,
        clientId: "",
        opId: "",
        baseRev: 0,
      });
    }
  }

  // Wrap back into a minimal Tiptap doc
  return wrapTextInTiptap(text);
}

/**
 * Wrap a plain-text string inside a Tiptap paragraph structure.
 * Newlines become paragraph breaks.
 */
export function wrapTextInTiptap(text: string): unknown {
  const paragraphs = text.split("\n").map((line) => ({
    type: "paragraph",
    content: line.length > 0 ? [{ type: "text", text: line }] : [],
  }));

  return {
    type: "doc",
    content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph", content: [] }],
  };
}
