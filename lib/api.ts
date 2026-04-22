import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export type ApiHandler<T = unknown> = (
  req: Request,
  ctx: { params: Promise<Record<string, string>>; session: { user: { id: string; email: string; name: string } } }
) => Promise<NextResponse<T>>;

export function withAuth<T>(
  handler: ApiHandler<T>
): (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return handler(req, { ...ctx, session: session as { user: { id: string; email: string; name: string } } });
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation error", details: err.flatten() },
          { status: 422 }
        );
      }
      const message = err instanceof Error ? err.message : "Internal server error";
      const status =
        message.includes("Not a workspace member") || message.includes("Insufficient permissions")
          ? 403
          : message.includes("not found")
          ? 404
          : 500;
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Expected JSON body");
  }
  const body = await req.json();
  return schema.parse(body);
}
