import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getWorkspaceBySlug } from "@/lib/dal/workspace";
import { getBoardsByWorkspace } from "@/lib/dal/board";
import { CanvasPageClient } from "./page-client";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ boardId?: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Canvas — ${slug} — CoWork`,
  };
}

export default async function CanvasPage({ params, searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const [{ slug }, { boardId: qBoardId }] = await Promise.all([params, searchParams]);

  const workspace = await getWorkspaceBySlug(slug, session.user.id);
  if (!workspace) notFound();

  const boards = await getBoardsByWorkspace(workspace.id, session.user.id);

  const activeBoardId = qBoardId ?? boards[0]?.id ?? null;

  return (
    <CanvasPageClient
      workspace={{ id: workspace.id, name: workspace.name, slug: workspace.slug }}
      boards={boards.map((b) => ({
        id: b.id,
        title: b.title,
        workspaceId: b.workspaceId,
        isArchived: b.isArchived,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      }))}
      activeBoardId={activeBoardId}
      userId={session.user.id}
    />
  );
}
