import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DASHBOARD_PREFIXES = [
  "/dashboard",
  "/workspaces",
  "/documents",
  "/proposals",
  "/ai-assistant",
  "/settings",
];
const AUTH_ROUTES = ["/login", "/signup"];

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;
  const path = request.nextUrl.pathname;

  const isAuthRoute = AUTH_ROUTES.includes(path);
  const isDashboardRoute = DASHBOARD_PREFIXES.some((p) => path.startsWith(p));

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (isDashboardRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
