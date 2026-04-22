import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserWorkspaces } from "@/lib/dal/workspace";
import Link from "next/link";
import { Users, FileText, Clock, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CreateWorkspaceDialog } from "@/components/workspace/create-workspace-dialog";

function getRoleBadgeStyle(role: string) {
  if (role === "OWNER")
    return { background: "#eef2ff", color: "#4338ca", border: "1px solid #c7d2fe" };
  if (role === "EDITOR")
    return { background: "#ecfdf5", color: "#065f46", border: "1px solid #6ee7b7" };
  return { background: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const memberships = await getUserWorkspaces(session.user.id);
  const firstName = session.user.name?.split(" ")[0];

  return (
    <div className="page-animate" style={{ padding: "36px 40px" }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#18181b", marginBottom: 4 }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ fontSize: 13, color: "#71717a" }}>
            {memberships.length} workspace{memberships.length !== 1 ? "s" : ""}
          </p>
        </div>
        <CreateWorkspaceDialog />
      </div>

      {memberships.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div
            className="flex items-center justify-center mb-6"
            style={{ width: 56, height: 56, borderRadius: 16, background: "#eef2ff" }}
          >
            <Plus style={{ width: 24, height: 24, color: "#4f46e5" }} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#18181b", marginBottom: 8 }}>
            No workspaces yet
          </h2>
          <p style={{ fontSize: 13, color: "#71717a", marginBottom: 20 }}>
            Create your first workspace to start collaborating with your team.
          </p>
          <CreateWorkspaceDialog />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 stagger" style={{ gap: 14 }}>
          {memberships.map((m: typeof memberships[0]) => (
            <Link key={m.workspace.id} href={`/workspaces/${m.workspace.slug}`}>
              <div
                className="hover-card cursor-pointer"
                style={{
                  background: "#ffffff",
                  border: "1px solid #e4e4e7",
                  borderRadius: 12,
                  padding: "20px 20px 16px",
                  boxShadow: "0 1px 3px rgba(0,0,0,.04)",
                }}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="flex items-center justify-center font-extrabold"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: "#eef2ff",
                      color: "#4f46e5",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {m.workspace.name[0]?.toUpperCase()}
                  </div>
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={getRoleBadgeStyle(m.role)}
                  >
                    {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                  </span>
                </div>

                {/* Name + slug */}
                <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b", marginBottom: 2 }}>
                  {m.workspace.name}
                </p>
                <p style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 14 }}>
                  /{m.workspace.slug}
                </p>

                {/* Footer row */}
                <div className="flex items-center gap-4" style={{ fontSize: 12, color: "#71717a" }}>
                  <span className="flex items-center gap-1">
                    <Users style={{ width: 12, height: 12 }} />
                    {m.workspace._count.members}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText style={{ width: 12, height: 12 }} />
                    {m.workspace._count.documents}
                  </span>
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock style={{ width: 12, height: 12 }} />
                    {formatDistanceToNow(m.workspace.updatedAt, { addSuffix: true })}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* Dashed new workspace tile — uses a div trigger to avoid button-in-button */}
          <CreateWorkspaceDialog
            trigger={
              <div
                className="new-ws-tile flex flex-col items-center justify-center cursor-pointer"
                style={{
                  border: "1.5px dashed #e4e4e7",
                  borderRadius: 12,
                  minHeight: 140,
                  background: "#fafafa",
                }}
              >
                <div
                  className="flex items-center justify-center mb-2"
                  style={{ width: 36, height: 36, borderRadius: 10, background: "#eef2ff" }}
                >
                  <Plus style={{ width: 18, height: 18, color: "#4f46e5" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#71717a" }}>
                  New workspace
                </span>
              </div>
            }
          />
        </div>
      )}
    </div>
  );
}
