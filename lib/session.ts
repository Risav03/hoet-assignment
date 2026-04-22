import { cache } from "react";
import { auth } from "@/auth";

/**
 * Cached version of auth() — deduplicates JWT verification within a single
 * request so layout + page components share one auth call instead of two.
 */
export const getSession = cache(auth);
