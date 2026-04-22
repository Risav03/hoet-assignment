import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AiAssistant } from "@/components/ai/ai-assistant";

export default async function AiAssistantPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <AiAssistant />;
}
