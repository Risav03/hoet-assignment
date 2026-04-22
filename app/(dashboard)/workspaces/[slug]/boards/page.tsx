import { redirect } from "next/navigation";

export default async function BoardsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/workspaces/${slug}/canvas`);
}
