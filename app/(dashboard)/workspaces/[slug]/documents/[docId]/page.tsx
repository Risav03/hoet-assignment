import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getDocumentById, getDocumentVersions } from "@/lib/dal/document";
import { getWorkspaceMember, getWorkspaceById } from "@/lib/dal/workspace";
import { DocumentEditor } from "@/components/editor/document-editor";

interface PageProps {
  params: Promise<{ slug: string; docId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const session = await getSession();
  if (!session?.user?.id) return { title: "Document — CoWork" };

  const { docId: id } = await params;
  const doc = await getDocumentById(id, session.user.id);
  if (!doc) return { title: "Document not found — CoWork" };

  const workspace = await getWorkspaceById(doc.workspaceId, session.user.id);
  const workspaceName = workspace?.name ?? "CoWork";

  return {
    title: `${doc.title} — ${workspaceName}`,
    description: `Editing "${doc.title}" in the ${workspaceName} workspace on CoWork.`,
  };
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { docId: id } = await params;
  const doc = await getDocumentById(id, session.user.id);
  if (!doc) notFound();

  const [member, workspace, versions] = await Promise.all([
    getWorkspaceMember(doc.workspaceId, session.user.id),
    getWorkspaceById(doc.workspaceId, session.user.id),
    getDocumentVersions(id, session.user.id),
  ]);
  if (!member) redirect("/dashboard");
  if (!workspace) notFound();

  const serializedVersions = versions.map((v) => ({
    ...v,
    createdAt: v.createdAt.toISOString(),
  }));

  const serializedDoc = {
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  return (
    <DocumentEditor
      document={serializedDoc}
      versions={serializedVersions}
      userRole={member.role}
      userId={session.user.id}
      membersCount={workspace._count.members}
      workspaceSlug={workspace.slug}
    />
  );
}
