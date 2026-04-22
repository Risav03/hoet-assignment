import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserWorkspaces } from "@/lib/dal/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users, FileText, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await getUserWorkspaces(session.user.id);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Welcome back, {session.user.name?.split(" ")[0]}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {memberships.length} workspace{memberships.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {memberships.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-4">🏢</div>
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
            No workspaces yet
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Create your first workspace to start collaborating with your team.
          </p>
          <CreateWorkspaceDialog trigger={<Button className="bg-indigo-600 hover:bg-indigo-500">Create workspace</Button>} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberships.map((m: typeof memberships[0]) => (
            <Link key={m.workspace.id} href={`/workspaces/${m.workspace.slug}`}>
              <Card className="hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base group-hover:text-indigo-600 transition-colors">
                        {m.workspace.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">/{m.workspace.slug}</CardDescription>
                    </div>
                    <Badge
                      variant={m.role === "OWNER" ? "default" : "secondary"}
                      className={
                        m.role === "OWNER"
                          ? "bg-indigo-100 text-indigo-700 border-indigo-200"
                          : ""
                      }
                    >
                      {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {m.workspace._count.members}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {m.workspace._count.documents}
                    </span>
                    <span className="flex items-center gap-1 ml-auto">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(m.workspace.updatedAt, { addSuffix: true })}
                    </span>
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
