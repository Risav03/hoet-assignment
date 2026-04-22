import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { getWorkspaceDocuments } from "@/lib/dal/document";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { FileText, Clock, Tag } from "lucide-react";
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-slate-500 text-sm">{workspace.name}</p>
        </div>
        {canCreate && <CreateDocumentDialog workspaceId={workspace.id} />}
      </div>

      <div className="flex items-center gap-3 mb-6">
        <form className="flex-1 max-w-sm">
          <Input
            name="query"
            placeholder="Search documents..."
            defaultValue={query}
            className="h-9"
          />
        </form>
        <div className="flex items-center gap-2">
          <Link href={`?`}>
            <Badge className={`cursor-pointer ${!archived ? "bg-slate-900 text-white" : "bg-transparent text-slate-500 border-slate-200"}`}>
              Active
            </Badge>
          </Link>
          <Link href={`?archived=true`}>
            <Badge className={`cursor-pointer ${archived === "true" ? "bg-slate-900 text-white" : "bg-transparent text-slate-500 border-slate-200"}`}>
              Archived
            </Badge>
          </Link>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <h3 className="font-medium text-slate-600 mb-1">No documents yet</h3>
          <p className="text-sm text-slate-400 mb-4">
            {canCreate
              ? "Create your first document to start collaborating."
              : "No documents in this workspace yet."}
          </p>
          {canCreate && <CreateDocumentDialog workspaceId={workspace.id} />}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc: typeof documents[0]) => (
            <Link key={doc.id} href={`/workspaces/${slug}/documents/${doc.id}`}>
              <Card className="hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {doc.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {doc.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {doc.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs px-1.5">
                          <Tag className="w-2.5 h-2.5 mr-0.5" />
                          {tag}
                        </Badge>
                      ))}
                      {doc.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs px-1.5">
                          +{doc.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                    <span className="ml-auto">{doc._count.versions} versions</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
