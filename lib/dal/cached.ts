import { cache } from "react";
import { getUserWorkspaces } from "./workspace";

/**
 * Cached version of getUserWorkspaces — deduplicates the DB query so the
 * dashboard layout and dashboard page share one result per request.
 */
export const getCachedUserWorkspaces = cache(getUserWorkspaces);
