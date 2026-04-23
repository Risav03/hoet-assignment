"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "./rich-text-editor";
import { AlertTriangle, CheckCheck, X } from "lucide-react";
import type { DocConflict } from "@/lib/types/document";
import { applyPatch, deepClone, type Operation as JSONPatchOp } from "fast-json-patch";
import { toast } from "sonner";

interface ConflictResolverProps {
  docId: string;
  conflicts: DocConflict[];
  baseContent: unknown;
  onResolved: (conflictId: string) => void;
  onAllResolved: () => void;
}

type Resolution = "local" | "remote" | null;

export function ConflictResolver({
  docId,
  conflicts,
  baseContent,
  onResolved,
  onAllResolved,
}: ConflictResolverProps) {
  const [current, setCurrent] = useState(0);
  const [resolving, setResolving] = useState(false);

  const conflict = conflicts[current];
  if (!conflict) return null;

  const localContent = safeApplyPatch(baseContent, conflict.localOp.diff);
  const remoteContent = safeApplyPatch(baseContent, conflict.remoteOp.diff);

  async function resolve(resolution: Resolution) {
    if (!resolution || resolving) return;
    setResolving(true);

    const chosenDiff =
      resolution === "local" ? conflict.localOp.diff : conflict.remoteOp.diff;

    try {
      const res = await fetch(`/api/docs/${docId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: `resolution-${Date.now()}`,
          baseRev: conflict.baseRev,
          ops: [
            {
              opId: `resolve-${conflict.id}`,
              clientId: `resolution-${Date.now()}`,
              baseRev: conflict.baseRev,
              diff: chosenDiff,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      onResolved(conflict.id);

      if (current >= conflicts.length - 1) {
        onAllResolved();
        toast.success("All conflicts resolved");
      } else {
        setCurrent((c) => Math.min(c + 1, conflicts.length - 1));
        toast.success(`Conflict ${current + 1} resolved`);
      }
    } catch (err) {
      toast.error(`Failed to resolve: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-destructive/10 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="text-sm font-semibold text-destructive">
            Conflict {current + 1} of {conflicts.length}
          </span>
          <span className="text-xs text-muted-foreground">
            — Edit path: <code className="font-mono">{conflict.localOp.diff[0]?.path ?? "(unknown)"}</code>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {conflicts.length > 1 && (
            <div className="flex gap-1">
              {conflicts.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === current ? "bg-destructive" : "bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden divide-x divide-border">
        {/* Local version */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
              Your version
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300"
              disabled={resolving}
              onClick={() => resolve("local")}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Accept local
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {localContent !== null ? (
              <RichTextEditor
                content={JSON.stringify(localContent)}
                onChange={() => {}}
                editable={false}
                className="min-h-[200px]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Cannot reconstruct local version</p>
            )}
          </div>
        </div>

        {/* Remote version */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 shrink-0">
            <span className="text-xs font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Server version
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300"
              disabled={resolving}
              onClick={() => resolve("remote")}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Accept remote
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {remoteContent !== null ? (
              <RichTextEditor
                content={JSON.stringify(remoteContent)}
                onChange={() => {}}
                editable={false}
                className="min-h-[200px]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">Cannot reconstruct remote version</p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
        <p className="text-xs text-muted-foreground">
          Both versions edited the same region. Choose one to accept as the canonical version.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1"
          onClick={() => onAllResolved()}
        >
          <X className="w-3.5 h-3.5" />
          Dismiss all
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeApplyPatch(base: unknown, diff: JSONPatchOp[]): unknown | null {
  if (!Array.isArray(diff) || diff.length === 0) return base;
  try {
    return applyPatch(deepClone(base as object), diff, false, false).newDocument;
  } catch {
    return null;
  }
}
