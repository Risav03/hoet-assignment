import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/dal/workspace";
import {
  getDocumentById,
  getDocumentMembership,
  getClosestSnapshot,
  getOpsBetweenRevs,
  listSnapshots,
} from "@/lib/dal/document";
import { replayOps } from "@/lib/sync/doc-merge";
import { DocumentEditorClient } from "./page-client";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string; docId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, docId } = await params;
  const session = await getSession();
  if (!session?.user?.id) return { title: "Document" };
  const doc = await getDocumentById(docId, session.user.id).catch(() => null);
  return { title: `${doc?.title ?? "Document"} — ${slug} — CoWork` };
}

export default async function DocumentPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { slug, docId } = await params;

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const [doc, membership] = await Promise.all([
    getDocumentById(docId, session.user.id),
    getDocumentMembership(docId, session.user.id),
  ]);

  if (!doc || !membership) notFound();

  // Load the latest snapshot content + version list
  const [snapshot, snapshots] = await Promise.all([
    getClosestSnapshot(docId, doc.currentRev),
    listSnapshots(docId),
  ]);

  // Reconstruct current content by replaying any ops that landed after the
  // closest snapshot. Snapshots are only created every 50 ops, so without this
  // all edits between snapshots are invisible on page load.
  let initialContent: unknown = snapshot?.content ?? { type: "doc", content: [{ type: "paragraph" }] };
  if (snapshot && snapshot.rev < doc.currentRev) {
    const pendingOps = await getOpsBetweenRevs(docId, snapshot.rev, doc.currentRev);
    if (pendingOps.length > 0) {
      initialContent = replayOps(snapshot.content, pendingOps);
    }
  }

  return (
    <DocumentEditorClient
      document={doc}
      initialContent={initialContent}
      versions={snapshots.map((s) => ({
        id: s.id,
        rev: s.rev,
        createdAt: s.createdAt.toISOString(),
      }))}
      userRole={membership.role as "OWNER" | "EDITOR" | "VIEWER"}
      workspaceSlug={slug}
      currentUser={{ id: session.user.id, name: session.user.name ?? "Anonymous" }}
    />
  );
}
