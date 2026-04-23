import "server-only";
import * as Y from "yjs";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { yXmlFragmentToProsemirrorJSON } = require("@tiptap/y-tiptap") as {
  yXmlFragmentToProsemirrorJSON: (fragment: Y.XmlFragment) => Record<string, unknown>;
};
import { db } from "@/lib/db";
import type { Prisma } from "@/app/generated/prisma/client";

/** Number of new YjsUpdate rows since the last DocumentSnapshot that triggers a new version. */
const DOC_SNAPSHOT_THRESHOLD = 25;

/**
 * Minimum gap between two consecutive DocumentSnapshots for the same document.
 * Prevents duplicate snapshots when multiple requests race to create one.
 */
const MIN_SNAPSHOT_GAP_MS = 10_000;

/**
 * Reconstruct a Y.Doc from the stored YjsSnapshot (CRDT compaction) plus any
 * incremental YjsUpdate rows that came after it.
 */
export async function buildYDocFromDb(docId: string): Promise<Y.Doc> {
  const snapshot = await db.yjsSnapshot.findUnique({ where: { documentId: docId } });

  const updates = await db.yjsUpdate.findMany({
    where: {
      documentId: docId,
      ...(snapshot ? { createdAt: { gt: snapshot.createdAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { update: true },
  });

  const ydoc = new Y.Doc();

  if (snapshot) {
    Y.applyUpdate(ydoc, new Uint8Array(snapshot.state));
  }

  for (const row of updates) {
    Y.applyUpdate(ydoc, new Uint8Array(row.update));
  }

  return ydoc;
}

/**
 * Extract Tiptap-compatible JSON from a reconstructed Y.Doc.
 * The Collaboration extension stores content in the XMLFragment named "document"
 * (configured via `Collaboration.configure({ field: "document" })`).
 */
export function extractTiptapJSON(ydoc: Y.Doc): Record<string, unknown> {
  const xmlFragment = ydoc.get("document", Y.XmlFragment);
  return yXmlFragmentToProsemirrorJSON(xmlFragment);
}

/**
 * Conditionally create a new DocumentSnapshot (version history entry) for a
 * document.
 *
 * Count-based (default): creates a snapshot when `>= DOC_SNAPSHOT_THRESHOLD`
 * new YjsUpdate rows exist since the last DocumentSnapshot.
 *
 * Force mode: skips the count check and creates a snapshot whenever there is
 * at least one new YjsUpdate since the last DocumentSnapshot (used by the
 * cron job for the time-based trigger).
 *
 * A concurrency guard prevents duplicate snapshots if multiple requests race:
 * if the latest DocumentSnapshot is younger than MIN_SNAPSHOT_GAP_MS, we skip.
 *
 * @returns true if a new DocumentSnapshot was created.
 */
export async function maybeCreateDocSnapshot(
  docId: string,
  { force = false }: { force?: boolean } = {}
): Promise<boolean> {
  try {
    const lastSnapshot = await db.documentSnapshot.findFirst({
      where: { documentId: docId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    // Concurrency guard: skip if a snapshot was created very recently
    if (lastSnapshot) {
      const ageMs = Date.now() - lastSnapshot.createdAt.getTime();
      if (ageMs < MIN_SNAPSHOT_GAP_MS) return false;
    }

    // Count YjsUpdate rows that arrived after the last DocumentSnapshot
    const updateCount = await db.yjsUpdate.count({
      where: {
        documentId: docId,
        ...(lastSnapshot ? { createdAt: { gt: lastSnapshot.createdAt } } : {}),
      },
    });

    // Nothing to snapshot
    if (updateCount === 0) return false;

    // Count-based gate (bypassed when force=true)
    if (!force && updateCount < DOC_SNAPSHOT_THRESHOLD) return false;

    const ydoc = await buildYDocFromDb(docId);
    const content = extractTiptapJSON(ydoc);
    ydoc.destroy();

    const doc = await db.document.update({
      where: { id: docId },
      data: { currentRev: { increment: 1 } },
      select: { currentRev: true },
    });

    await db.documentSnapshot.create({
      data: {
        documentId: docId,
        rev: doc.currentRev,
        content: content as Prisma.InputJsonValue,
      },
    });

    return true;
  } catch (err) {
    console.error("[server-snapshot] maybeCreateDocSnapshot failed", docId, err);
    return false;
  }
}
