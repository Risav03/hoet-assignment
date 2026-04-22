import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Documents are not available in this version" }, { status: 410 });
}
