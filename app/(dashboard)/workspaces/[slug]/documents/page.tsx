import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { getWorkspaceDocuments } from "@/lib/dal/document";
import Link from "next/link";
import { FileText, Clock, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateDocumentDialog } from "@/components/document/create-document-dialog";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ query?: string; archived?: string }>;
}

export default async function DocumentsPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [{ slug }, { query, archived }] = await Promise.all([params, searchParams]);

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const [member, { documents }] = await Promise.all([
    getWorkspaceMember(workspace.id, session.user.id),
    getWorkspaceDocuments(workspace.id, session.user.id, {
      query,
      isArchived: archived === "true",
    }),
  ]);
  if (!member) redirect("/dashboard");

  const canCreate = member.role === "OWNER" || member.role === "EDITOR";

  return (
    <div className="page-animate p-5 md:p-9 md:px-10">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-extrabold text-foreground mb-1">Documents</h1>
          <p className="text-[13px] text-muted-foreground">{workspace.name}</p>
        </div>
        {canCreate && <CreateDocumentDialog workspaceId={workspace.id} />}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        {/* Search */}
        <form className="relative flex-1 sm:flex-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none w-3.5 h-3.5 text-muted-foreground" />
          <input
            name="query"
            placeholder="Search documents…"
            defaultValue={query}
            className="w-full sm:w-[260px] pl-[34px] pr-3 py-[7px] border border-border rounded-lg text-[13px] bg-card text-foreground outline-none focus:border-primary transition-colors"
          />
        </form>

        {/* Segmented control */}
        <div className="flex items-center p-1 gap-1 bg-muted rounded-lg self-start sm:self-auto">
          <Link href="?">
            <span
              className={cn(
                "block cursor-pointer transition-all font-semibold text-xs px-3 py-1 rounded-md",
                !archived || archived !== "true"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              Active
            </span>
          </Link>
          <Link href="?archived=true">
            <span
              className={cn(
                "block cursor-pointer transition-all font-semibold text-xs px-3 py-1 rounded-md",
                archived === "true"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
            >
              Archived
            </span>
          </Link>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FileText className="w-10 h-10 text-muted mb-3" />
          <h3 className="text-sm font-semibold text-secondary-foreground mb-1.5">No documents yet</h3>
          <p className="text-[13px] text-muted-foreground mb-4">
            {canCreate
              ? "Create your first document to start collaborating."
              : "No documents in this workspace yet."}
          </p>
          {canCreate && <CreateDocumentDialog workspaceId={workspace.id} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger gap-3.5">
          {documents.map((doc: typeof documents[0]) => (
            <Link key={doc.id} href={`/workspaces/${slug}/documents/${doc.id}`}>
              <div className="hover-card cursor-pointer h-full bg-card border border-border rounded-xl p-[18px] pb-3.5 shadow-sm">
                {/* Icon + title */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-accent">
                    <FileText className="w-[15px] h-[15px] text-primary" />
                  </div>
                  <p className="line-clamp-2 text-[13px] font-bold text-foreground leading-[1.4]">
                    {doc.title}
                  </p>
                </div>

                {/* Tags */}
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {doc.tags.slice(0, 3).map((tag: string) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 font-semibold text-[11px] bg-muted text-secondary-foreground border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                    {doc.tags.length > 3 && (
                      <span className="rounded-full px-2 py-0.5 font-semibold text-[11px] bg-muted text-secondary-foreground border border-border">
                        +{doc.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="w-[11px] h-[11px]" />
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
