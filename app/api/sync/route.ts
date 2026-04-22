import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Legacy sync endpoint — replaced by /api/boards/[id]/operations for canvas ops.
 * Kept to avoid 404s from old clients.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await req.json();
    // Canvas operations are now handled by /api/boards/[id]/operations
    return NextResponse.json({ results: [] });
  } catch {
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
