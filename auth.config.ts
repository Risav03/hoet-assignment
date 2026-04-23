import type { NextAuthConfig } from "next-auth";

/**
 * Auth config that is safe to use in the Edge Runtime (middleware).
 * Does NOT import Prisma or any Node.js-only modules.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      const DASHBOARD_PREFIXES = [
        "/dashboard",
        "/workspaces",
        "/documents",
        "/ai-assistant",
        "/settings",
      ];
      const AUTH_ROUTES = ["/login", "/signup"];

      const isAuthRoute = AUTH_ROUTES.includes(path);
      const isDashboardRoute = DASHBOARD_PREFIXES.some((p) => path.startsWith(p));

      if (isAuthRoute && isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
      if (isDashboardRoute && !isLoggedIn) {
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", path);
        return Response.redirect(loginUrl);
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
  providers: [],
};
