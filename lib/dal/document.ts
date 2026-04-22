import "server-only";
/**
 * Document DAL — stubbed out since the Document model has been removed from the database.
 * The application now uses Board/BoardNode/BoardEdge for collaborative content.
 */

export async function getWorkspaceDocuments(
  _workspaceId: string,
  _userId: string,
  _opts?: Record<string, unknown>
) {
  return { documents: [], nextCursor: undefined };
}

export async function getDocumentById(_documentId: string, _userId: string) {
  return null;
}

export async function createDocument(
  _workspaceId: string,
  _userId: string,
  _data: { title: string; content?: string; tags?: string[] }
) {
  throw new Error("Documents are not supported in this version");
}

export async function updateDocument(
  _documentId: string,
  _userId: string,
  _data: Record<string, unknown>
) {
  throw new Error("Documents are not supported in this version");
}

export async function archiveDocument(_documentId: string, _userId: string) {
  throw new Error("Documents are not supported in this version");
}

export async function getDocumentVersions(_documentId: string, _userId: string) {
  return [];
}
