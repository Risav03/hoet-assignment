import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { ZodError } from "zod";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const rlKey = getRateLimitKey(req, "signup");
  const rl = rateLimit(rlKey, { windowMs: 15 * 60 * 1000, max: 15 });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();

    const data = signupSchema.parse(body);

    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }


    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.user.create({
      data: { name: data.name, email: data.email, passwordHash },
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.flatten() }, { status: 422 });
    }
    console.error("[signup]", err);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
