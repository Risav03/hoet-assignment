"use client";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
}

export function VersionTimeline({
  versions,
  documentId,
  currentVersionId,
  canRestore,
  onPreview,
}: VersionTimelineProps) {
  const router = useRouter();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  async function handleRestore(versionId: string) {
    setRestoringId(versionId);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to restore version");
        return;
      }
      toast.success("Version restored! A new version was created.");
      router.refresh();
    } finally {
      setRestoringId(null);
    }
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No versions yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-1 p-1">
        {versions.map((version, idx) => {
          const isCurrent = version.id === currentVersionId;
          return (
            <div
              key={version.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 ${
                isCurrent ? "border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20" : "border-transparent"
              }`}
              onClick={() => onPreview?.(version)}
            >
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={`w-2 h-2 rounded-full mt-1 ${
                    isCurrent ? "bg-indigo-500" : "bg-slate-300"
                  }`}
                />
                {idx < versions.length - 1 && (
                  <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">v{version.versionNumber}</span>
                  {isCurrent && (
                    <Badge className="text-xs bg-indigo-100 text-indigo-700 border-indigo-200">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Avatar className="w-4 h-4">
                    <AvatarFallback className="text-[8px] bg-slate-200">
                      {version.createdBy.name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{version.createdBy.name}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}</span>
                </div>
              </div>
              {canRestore && !isCurrent && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-7 px-2"
                  disabled={restoringId === version.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestore(version.id);
                  }}
                >
                  {restoringId === version.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
