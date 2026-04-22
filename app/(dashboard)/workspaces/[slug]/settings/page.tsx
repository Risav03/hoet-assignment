import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug, getWorkspaceMember } from "@/lib/dal/workspace";
import { WorkspaceSettings } from "@/components/workspace/workspace-settings";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceSettingsPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const member = await getWorkspaceMember(workspace.id, session.user.id);
  if (!member || member.role !== "OWNER") redirect(`/workspaces/${slug}`);

  return <WorkspaceSettings workspace={workspace} />;
}
