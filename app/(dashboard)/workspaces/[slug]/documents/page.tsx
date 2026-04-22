import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { getWorkspaceDocuments } from "@/lib/dal/document";
import Link from "next/link";
import { FileText, Clock, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateDocumentDialog } from "@/components/document/create-document-dialog";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ query?: string; archived?: string }>;
}

export default async function DocumentsPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const { query, archived } = await searchParams;

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const member = await getWorkspaceMember(workspace.id, session.user.id);
  if (!member) redirect("/dashboard");

  const { documents } = await getWorkspaceDocuments(workspace.id, session.user.id, {
    query,
    isArchived: archived === "true",
  });

  const canCreate = member.role === "OWNER" || member.role === "EDITOR";

  return (
    <div className="page-animate" style={{ padding: "36px 40px" }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", marginBottom: 4 }}>
            Documents
          </h1>
          <p style={{ fontSize: 13, color: "#71717a" }}>{workspace.name}</p>
        </div>
        {canCreate && <CreateDocumentDialog workspaceId={workspace.id} />}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-6">
        {/* Search */}
        <form className="relative" style={{ maxWidth: 260, flex: "0 0 260px" }}>
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 14, height: 14, color: "#a1a1aa" }}
          />
          <input
            name="query"
            placeholder="Search documents…"
            defaultValue={query}
            style={{
              width: "100%",
              paddingLeft: 34,
              paddingRight: 12,
              paddingTop: 7,
              paddingBottom: 7,
              border: "1px solid #e4e4e7",
              borderRadius: 8,
              fontSize: 13,
              background: "#ffffff",
              color: "#18181b",
              outline: "none",
            }}
          />
        </form>

        {/* Segmented control */}
        <div
          className="flex items-center p-1 gap-1"
          style={{ background: "#f4f4f5", borderRadius: 8 }}
        >
          <Link href="?">
            <span
              className="block cursor-pointer transition-all font-semibold"
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                background: !archived || archived !== "true" ? "#ffffff" : "transparent",
                color: !archived || archived !== "true" ? "#18181b" : "#71717a",
                boxShadow:
                  !archived || archived !== "true" ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
            >
              Active
            </span>
          </Link>
          <Link href="?archived=true">
            <span
              className="block cursor-pointer transition-all font-semibold"
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                background: archived === "true" ? "#ffffff" : "transparent",
                color: archived === "true" ? "#18181b" : "#71717a",
                boxShadow: archived === "true" ? "0 1px 3px rgba(0,0,0,.08)" : "none",
              }}
            >
              Archived
            </span>
          </Link>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FileText style={{ width: 40, height: 40, color: "#d4d4d8", marginBottom: 12 }} />
          <h3 style={{ fontSize: 14, fontWeight: 600, color: "#3f3f46", marginBottom: 6 }}>
            No documents yet
          </h3>
          <p style={{ fontSize: 13, color: "#a1a1aa", marginBottom: 16 }}>
            {canCreate
              ? "Create your first document to start collaborating."
              : "No documents in this workspace yet."}
          </p>
          {canCreate && <CreateDocumentDialog workspaceId={workspace.id} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger" style={{ gap: 14 }}>
          {documents.map((doc: typeof documents[0]) => (
            <Link key={doc.id} href={`/workspaces/${slug}/documents/${doc.id}`}>
              <div
                className="hover-card cursor-pointer h-full"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e4e4e7",
                  borderRadius: 12,
                  padding: "18px 20px 14px",
                  boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                }}
              >
                {/* Icon + title */}
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{ width: 32, height: 32, borderRadius: 8, background: "#eef2ff" }}
                  >
                    <FileText style={{ width: 15, height: 15, color: "#4f46e5" }} />
                  </div>
                  <p
                    className="line-clamp-2"
                    style={{ fontSize: 13, fontWeight: 700, color: "#18181b", lineHeight: 1.4 }}
                  >
                    {doc.title}
                  </p>
                </div>

                {/* Tags */}
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{
                          fontSize: 11,
                          background: "#f4f4f5",
                          color: "#52525b",
                          border: "1px solid #e4e4e7",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{
                          fontSize: 11,
                          background: "#f4f4f5",
                          color: "#52525b",
                          border: "1px solid #e4e4e7",
                        }}
                      >
                        +{doc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 11, color: "#a1a1aa" }}
                >
                  <Clock style={{ width: 11, height: 11 }} />
                  {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  <span className="ml-auto">{doc._count.versions} versions</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
