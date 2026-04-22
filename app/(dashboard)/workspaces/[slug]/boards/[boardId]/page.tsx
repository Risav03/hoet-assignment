import { redirect } from "next/navigation";

export default async function BoardPage({ params }: { params: Promise<{ slug: string; boardId: string }> }) {
  const { slug, boardId } = await params;
  redirect(`/workspaces/${slug}/canvas?boardId=${boardId}`);
}
