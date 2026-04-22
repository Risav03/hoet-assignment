import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string; docId: string }>;
}

export default async function DocumentEditorPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/workspaces/${slug}/canvas`);
}
