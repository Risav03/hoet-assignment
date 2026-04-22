"use client";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, RotateCcw, Loader2 } from "lucide-react";
import { clearDraft } from "@/components/editor/draft-auto-save";
import { cn } from "@/lib/utils";
import { useRestoreVersion } from "@/lib/hooks/use-document-mutations";

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
  const { mutate: restoreVersion, isPending: restoring, variables: restoringId } =
    useRestoreVersion(documentId);

  function handleRestore(versionId: string) {
    restoreVersion(versionId, {
      onSuccess: async () => {
        await clearDraft(documentId);
        onRestored?.();
      },
    });
  }

  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Clock className="w-8 h-8 text-muted mb-2" />
        <p className="text-[13px] text-muted-foreground">No versions yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[560px]">
      <div className="pr-1">
        {versions.map((version, idx) => {
          const isCurrent = version.id === currentVersionId;
          const isLast = idx === versions.length - 1;

          return (
            <div
              key={version.id}
              className="group flex gap-3 cursor-pointer"
              onClick={() => onPreview?.(version)}
            >
              {/* Left column: dot + connector line */}
              <div className="flex flex-col items-center w-5 shrink-0">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full mt-[14px] shrink-0",
                    isCurrent
                      ? "bg-primary border-2 border-accent-border ring-[3px] ring-primary/10"
                      : "bg-muted-foreground/40 border-2 border-border"
                  )}
                />
                {!isLast && (
                  <div className="w-px flex-1 bg-border mt-1 mb-0 min-h-4" />
                )}
              </div>

              {/* Right column: content */}
              <div
                className={cn(
                  "flex-1 flex items-start justify-between gap-2 rounded-lg transition-colors px-2.5 py-2",
                  isCurrent
                    ? "bg-accent border border-accent-border"
                    : "border border-transparent group-hover:bg-muted",
                  isLast ? "mb-0" : "mb-0.5"
                )}
              >
                <div className="flex-1 min-w-0">
                  {/* Version number + badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-foreground">
                      v{version.versionNumber}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full px-2 py-0.5 font-semibold text-[10px] bg-primary text-primary-foreground">
                        Current
                      </span>
                    )}
                  </div>

                  {/* Author + time */}
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Avatar className="w-3.5 h-3.5">
                      <AvatarFallback className="text-[8px] font-bold bg-accent text-accent-foreground">
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
                    className="h-[26px] px-2 text-[11px] text-muted-foreground shrink-0"
                    disabled={restoring && restoringId === version.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(version.id);
                    }}
                  >
                    {restoring && restoringId === version.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
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
