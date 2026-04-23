"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { X, Eye, RotateCcw, Save, ChevronDown, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VersionSummary {
  id: string;
  boardId: string;
  label: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
}

interface VersionHistoryPanelProps {
  boardId: string;
  onClose: () => void;
  onPreview: (version: VersionSummary) => void;
  onRestore: (version: VersionSummary) => void;
}

const USER_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function VersionHistoryPanel({
  boardId,
  onClose,
  onPreview,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [showLabelInput, setShowLabelInput] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  const fetchVersions = useCallback(
    async (cursor?: string) => {
      const isInitial = !cursor;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      try {
        const url = new URL(`/api/boards/${boardId}/versions`, window.location.origin);
        url.searchParams.set("limit", "20");
        if (cursor) url.searchParams.set("cursor", cursor);

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          versions: VersionSummary[];
          nextCursor: string | null;
        };

        setVersions((prev) => (isInitial ? data.versions : [...prev, ...data.versions]));
        setNextCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load versions");
      } finally {
        if (isInitial) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [boardId]
  );

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  async function handleSaveCheckpoint() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/boards/${boardId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: labelInput.trim() || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLabelInput("");
      setShowLabelInput(false);
      await fetchVersions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save checkpoint");
    } finally {
      setSaving(false);
    }
  }

  function handleRestoreClick(version: VersionSummary) {
    setConfirmRestoreId(version.id);
  }

  function handleRestoreConfirm(version: VersionSummary) {
    setConfirmRestoreId(null);
    onRestore(version);
  }

  return (
    <div className="absolute right-0 top-0 h-full w-72 z-20 flex flex-col bg-background border-l border-border shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Version History</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close version history"
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Save checkpoint */}
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        {showLabelInput ? (
          <div className="flex flex-col gap-1.5">
            <input
              ref={labelRef}
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveCheckpoint();
                if (e.key === "Escape") setShowLabelInput(false);
              }}
              placeholder="Label (optional)"
              className="w-full text-xs px-2.5 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={handleSaveCheckpoint}
                disabled={saving}
                className="flex-1 text-xs font-medium py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setShowLabelInput(false)}
                className="text-xs px-3 py-1.5 rounded-md hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLabelInput(true)}
            className="flex items-center gap-2 w-full text-xs font-medium px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-muted-foreground" />
            Save checkpoint
          </button>
        )}
      </div>

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-3 text-xs text-red-500">{error}</div>
        )}

        {!loading && !error && versions.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-muted-foreground">No versions yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Versions are saved automatically as collaborators make changes.
            </p>
          </div>
        )}

        {!loading && versions.length > 0 && (
          <ul className="divide-y divide-border">
            {versions.map((v) => (
              <li key={v.id} className="px-3 py-3 hover:bg-accent/40 transition-colors">
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                    style={{ backgroundColor: colorForUser(v.createdById) }}
                    title={v.createdByName}
                  >
                    {initials(v.createdByName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{v.createdByName}</p>
                    {v.label && (
                      <p className="text-[11px] text-muted-foreground italic truncate mt-0.5">
                        {v.label}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {relativeTime(v.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                {confirmRestoreId === v.id ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Replace the current canvas for all collaborators?
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleRestoreConfirm(v)}
                        className="flex-1 text-[11px] font-medium py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                      >
                        Replace canvas
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRestoreId(null)}
                        className="text-[11px] px-2.5 py-1 rounded hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => onPreview(v)}
                      title="Read-only preview"
                      className={cn(
                        "flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border",
                        "hover:bg-accent transition-colors"
                      )}
                    >
                      <Eye className="w-3 h-3" />
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreClick(v)}
                      title="Restore this version"
                      className={cn(
                        "flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border",
                        "hover:bg-accent transition-colors"
                      )}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Load more */}
        {nextCursor && !loading && (
          <div className="px-3 py-2">
            <button
              type="button"
              onClick={() => fetchVersions(nextCursor)}
              disabled={loadingMore}
              className="flex items-center justify-center gap-1 w-full text-xs py-1.5 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <div className="w-3.5 h-3.5 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Load more
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
