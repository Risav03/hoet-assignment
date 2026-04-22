import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function DocumentsPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/workspaces/${slug}/canvas`);
}
