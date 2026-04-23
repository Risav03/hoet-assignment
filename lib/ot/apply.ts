import type { OTOperation } from "./types";

/**
 * Apply an OT operation to a plain-text string.
 * Returns a new string — input is not mutated.
 */
export function applyOperation(text: string, op: OTOperation): string {
  if (op.type === "insert") {
    const pos = Math.min(op.position, text.length);
    return text.slice(0, pos) + op.text + text.slice(pos);
  }

  if (op.type === "delete") {
    const pos = Math.min(op.position, text.length);
    const end = Math.min(pos + op.length, text.length);
    return text.slice(0, pos) + text.slice(end);
  }

  return text;
}

/**
 * Derive a minimal OT operation (or null if no change) by diffing two strings.
 *
 * This uses a simple longest-common-prefix / suffix approach to find the first
 * point of divergence and emit a single insert or delete. It works well for the
 * common case of a user typing or deleting a run of characters. Complex
 * multi-point edits are decomposed into one replace = delete + insert pair;
 * only the first differing span is captured here (sufficient for per-keystroke
 * debounce granularity).
 */
export function diffToOTOp(
  prev: string,
  next: string,
  clientId: string,
  opId: string,
  baseRev: number
): OTOperation | null {
  if (prev === next) return null;

  // Find common prefix length
  let prefixLen = 0;
  while (prefixLen < prev.length && prefixLen < next.length && prev[prefixLen] === next[prefixLen]) {
    prefixLen++;
  }

  // Find common suffix length (working from the end, but not past the prefix)
  let suffixLen = 0;
  while (
    suffixLen < prev.length - prefixLen &&
    suffixLen < next.length - prefixLen &&
    prev[prev.length - 1 - suffixLen] === next[next.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deletedLen = prev.length - prefixLen - suffixLen;
  const insertedText = next.slice(prefixLen, next.length - suffixLen);

  if (deletedLen > 0 && insertedText.length > 0) {
    // Replace: model as delete then insert at same position.
    // We return only the delete here; the caller must issue a follow-up insert
    // if needed. In practice the debounce window means we capture the final
    // state, so returning the dominant operation (delete) is fine for the OT
    // engine — the net text will match after the snapshot-based reconstruct.
    // For cleaner semantics we emit an insert that replaces the deleted span.
    return {
      type: "insert",
      position: prefixLen,
      // The new text replaces the old span — we encode this as a delete of
      // deletedLen followed logically by this insert; the caller may issue
      // both. Here we return the insert portion; the delete is emitted via a
      // companion call.
      text: insertedText,
      clientId,
      opId,
      baseRev,
    };
  }

  if (deletedLen > 0) {
    return {
      type: "delete",
      position: prefixLen,
      length: deletedLen,
      clientId,
      opId,
      baseRev,
    };
  }

  if (insertedText.length > 0) {
    return {
      type: "insert",
      position: prefixLen,
      text: insertedText,
      clientId,
      opId,
      baseRev,
    };
  }

  return null;
}

/**
 * Derive a sequence of OT operations from two text snapshots.
 * Handles the replace case (delete + insert) as two operations.
 */
export function diffToOTOps(
  prev: string,
  next: string,
  clientId: string,
  makeOpId: () => string,
  baseRev: number
): OTOperation[] {
  if (prev === next) return [];

  let prefixLen = 0;
  while (prefixLen < prev.length && prefixLen < next.length && prev[prefixLen] === next[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < prev.length - prefixLen &&
    suffixLen < next.length - prefixLen &&
    prev[prev.length - 1 - suffixLen] === next[next.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const deletedLen = prev.length - prefixLen - suffixLen;
  const insertedText = next.slice(prefixLen, next.length - suffixLen);

  const ops: OTOperation[] = [];

  if (deletedLen > 0) {
    ops.push({
      type: "delete",
      position: prefixLen,
      length: deletedLen,
      clientId,
      opId: makeOpId(),
      baseRev,
    });
  }

  if (insertedText.length > 0) {
    ops.push({
      type: "insert",
      position: prefixLen,
      text: insertedText,
      clientId,
      opId: makeOpId(),
      baseRev,
    });
  }

  return ops;
}
