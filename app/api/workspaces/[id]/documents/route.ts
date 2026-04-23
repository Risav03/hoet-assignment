import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Use /api/docs?workspaceId=... instead" },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/docs instead" },
    { status: 410 }
  );
}
