import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/dal/workspace";
import { listDocuments } from "@/lib/dal/document";
import { DocumentsPageClient } from "./page-client";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Documents — ${slug} — CoWork` };
}

export default async function DocumentsPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const documents = await listDocuments(workspace.id, session.user.id).catch(() => []);

  return (
    <DocumentsPageClient
      workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
      documents={documents.map((d) => ({
        id: d.id,
        title: d.title,
        currentRev: d.currentRev,
        updatedAt: d.updatedAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      }))}
      userId={session.user.id}
    />
  );
}
