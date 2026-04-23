import "server-only";
import {
  applyPatch,
  deepClone,
  type Operation as JSONPatchOp,
} from "fast-json-patch";

export interface MergeResult {
  merged: unknown;
  conflicts: ConflictPair[];
}

export interface ConflictPair {
  path: string;
  localOp: JSONPatchOp;
  remoteOp: JSONPatchOp;
}

/**
 * Reconstruct document content at a given rev by applying ops to a snapshot.
 * Pure — no I/O.
 */
export function replayOps(
  snapshot: unknown,
  ops: { diff: unknown }[]
): unknown {
  let doc = deepClone(snapshot);
  for (const op of ops) {
    const patch = op.diff as JSONPatchOp[];
    if (!Array.isArray(patch) || patch.length === 0) continue;
    try {
      const result = applyPatch(doc, patch, false, false);
      doc = result.newDocument;
    } catch {
      // Skip malformed patches — don't crash reconstruction
    }
  }
  return doc;
}

/**
 * 3-way merge of diverged document revisions.
 *
 * base      — document state at the common ancestor rev
 * localOps  — client patches applied on top of base
 * remoteOps — server patches applied on top of base since the ancestor
 *
 * Strategy:
 *   1. Collect the set of JSON-Pointer paths touched by local ops.
 *   2. Collect the set of JSON-Pointer paths touched by remote ops.
 *   3. Any path touched by BOTH sides is a conflict.
 *   4. Non-conflicting ops from both sides are merged into the result.
 */
export function mergeDocs(
  base: unknown,
  localOps: JSONPatchOp[][],
  remoteOps: JSONPatchOp[][]
): MergeResult {
  const localPatches = localOps.flat();
  const remotePatches = remoteOps.flat();

  const localPaths = new Map<string, JSONPatchOp>();
  for (const op of localPatches) {
    localPaths.set(op.path, op);
  }

  const remotePaths = new Map<string, JSONPatchOp>();
  for (const op of remotePatches) {
    remotePaths.set(op.path, op);
  }

  const conflictPairs: ConflictPair[] = [];
  const conflictPathSet = new Set<string>();

  for (const [path, localOp] of localPaths) {
    if (remotePaths.has(path)) {
      conflictPairs.push({ path, localOp, remoteOp: remotePaths.get(path)! });
      conflictPathSet.add(path);
    }
  }

  // Apply remote non-conflicting ops first, then local non-conflicting ops
  let doc = deepClone(base);

  const safeRemote = remotePatches.filter((op) => !conflictPathSet.has(op.path));
  const safeLocal = localPatches.filter((op) => !conflictPathSet.has(op.path));

  for (const patch of [...safeRemote, ...safeLocal]) {
    try {
      doc = applyPatch(doc, [patch], false, false).newDocument;
    } catch {
      // Skip unapplicable op
    }
  }

  return { merged: doc, conflicts: conflictPairs };
}

/**
 * Apply a single remote resolution to a document.
 * Used when the client accepts remote ops for conflicting paths.
 */
export function applyResolution(
  doc: unknown,
  ops: JSONPatchOp[]
): unknown {
  let result = deepClone(doc);
  for (const op of ops) {
    try {
      result = applyPatch(result, [op], false, false).newDocument;
    } catch {
      // Skip
    }
  }
  return result;
}
