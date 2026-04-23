import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Use /api/docs/[docId]/versions instead" },
    { status: 410 }
  );
}
