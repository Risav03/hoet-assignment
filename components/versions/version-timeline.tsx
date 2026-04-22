"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { clearDraft } from "@/components/editor/draft-auto-save";

interface Version {
  id: string;
  versionNumber: number;
  contentSnapshot: string;
  createdAt: string;
  createdBy: { id: string; name: string; email: string };
}

interface VersionTimelineProps {
  versions: Version[];
  documentId: string;
  currentVersionId?: string | null;
  canRestore: boolean;
  onPreview?: (version: Version) => void;
  onRestored?: () => void;
}

export function VersionTimeline({
  versions,
  documentId,
  currentVersionId,
  canRestore,
  onPreview,
  onRestored,
}: VersionTimelineProps) {
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to restore version");
        return;
      }
      // Drop the stale local draft so the restored content isn't
      // immediately overwritten by an older unsaved draft.
      await clearDraft(documentId);
      onRestored?.();
      toast.success("Version restored! A new version was created.");
      router.refresh();
    } finally {
      setRestoringId(null);
    }
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Clock style={{ width: 32, height: 32, color: "#d4d4d8", marginBottom: 8 }} />
        <p style={{ fontSize: 13, color: "#a1a1aa" }}>No versions yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[560px]">
      <div style={{ paddingRight: 4 }}>
        {versions.map((version, idx) => {
          const isCurrent = version.id === currentVersionId;
          const isLast = idx === versions.length - 1;

          return (
            <div
              key={version.id}
              className="flex gap-3 cursor-pointer"
              onClick={() => onPreview?.(version)}
              onMouseEnter={(e) => {
                const row = (e.currentTarget as HTMLDivElement).querySelector<HTMLDivElement>(".vt-row-content");
                if (row && !isCurrent) row.style.background = "#f4f4f5";
              }}
              onMouseLeave={(e) => {
                const row = (e.currentTarget as HTMLDivElement).querySelector<HTMLDivElement>(".vt-row-content");
                if (row && !isCurrent) row.style.background = "transparent";
              }}
            >
              {/* Left column: dot + connector line */}
              <div className="flex flex-col items-center" style={{ width: 20, flexShrink: 0 }}>
                {/* Dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    marginTop: 14,
                    flexShrink: 0,
                    background: isCurrent ? "#4f46e5" : "#d4d4d8",
                    border: `2px solid ${isCurrent ? "#c7d2fe" : "#e4e4e7"}`,
                    boxShadow: isCurrent ? "0 0 0 3px rgba(79,70,229,.12)" : "none",
                  }}
                />
                {/* Connector line */}
                {!isLast && (
                  <div
                    style={{
                      width: 1,
                      flex: 1,
                      background: "#e4e4e7",
                      marginTop: 4,
                      marginBottom: 0,
                      minHeight: 16,
                    }}
                  />
                )}
              </div>

              {/* Right column: content */}
              <div
                className="vt-row-content flex-1 flex items-start justify-between gap-2 rounded-lg transition-colors"
                style={{
                  padding: "8px 10px",
                  marginBottom: isLast ? 0 : 2,
                  background: isCurrent ? "#eef2ff" : "transparent",
                  border: isCurrent ? "1px solid #c7d2fe" : "1px solid transparent",
                  borderRadius: 8,
                }}
              >
                <div className="flex-1 min-w-0">
                  {/* Version number + badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#18181b" }}>
                      v{version.versionNumber}
                    </span>
                    {isCurrent && (
                      <span
                        className="rounded-full px-2 py-0.5 font-semibold"
                        style={{ fontSize: 10, background: "#4f46e5", color: "#ffffff" }}
                      >
                        Current
                      </span>
                    )}
                  </div>

                  {/* Author + time */}
                  <div
                    className="flex items-center gap-1.5"
                    style={{ fontSize: 11, color: "#71717a" }}
                  >
                    <Avatar style={{ width: 14, height: 14 }}>
                      <AvatarFallback
                        className="text-[8px] font-bold"
                        style={{ background: "#eef2ff", color: "#4338ca" }}
                      >
                        {version.createdBy.name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{version.createdBy.name}</span>
                    <span>·</span>
                    <span>
                      {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Restore button */}
                {canRestore && !isCurrent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    style={{ height: 26, padding: "0 8px", fontSize: 11, color: "#71717a", flexShrink: 0 }}
                    disabled={restoringId === version.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(version.id);
                    }}
                  >
                    {restoringId === version.id ? (
                      <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
                    ) : (
                      <RotateCcw style={{ width: 12, height: 12 }} />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
