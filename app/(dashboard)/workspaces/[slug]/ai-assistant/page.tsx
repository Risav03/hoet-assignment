import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/dal/workspace";
import { WorkspaceAiAssistant } from "@/components/ai/workspace-ai-assistant";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function WorkspaceAiAssistantPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { slug } = await params;
  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  return (
    <WorkspaceAiAssistant
      workspaceId={workspace.id}
      workspaceSlug={slug}
      workspaceName={workspace.name}
    />
  );
}
