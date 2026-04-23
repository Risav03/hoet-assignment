"use client";
import { DocumentEditor } from "@/components/editor/document-editor";
import type { DocMeta } from "@/lib/types/document";

interface VersionEntry {
  id: string;
  rev: number;
  createdAt: string;
}

interface DocumentEditorClientProps {
  document: DocMeta;
  initialContent: unknown;
  versions: VersionEntry[];
  userRole: "OWNER" | "EDITOR" | "VIEWER";
  workspaceSlug: string;
  currentUser: { id: string; name: string };
}

export function DocumentEditorClient({
  document,
  initialContent,
  versions,
  userRole,
  workspaceSlug,
  currentUser,
}: DocumentEditorClientProps) {
  return (
    <DocumentEditor
      document={document}
      initialContent={initialContent}
      versions={versions}
      userRole={userRole}
      workspaceSlug={workspaceSlug}
      currentUser={currentUser}
    />
  );
}
