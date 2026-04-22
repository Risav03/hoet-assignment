"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getLocalDB } from "@/lib/db/local";
import { CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DraftAutoSaveProps {
  documentId: string;
  workspaceId: string;
  content: string;
  debounceMs?: number;
}

export function DraftAutoSave({
  documentId,
  workspaceId,
  content,
  debounceMs = 1500,
}: DraftAutoSaveProps) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef(content);
  useLayoutEffect(() => {
    contentRef.current = content;
  });

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        const db = getLocalDB();
        await db.drafts.put({
          id: documentId,
          documentId,
          workspaceId,
          content: contentRef.current,
          savedAt: new Date().toISOString(),
        });
        setLastSaved(new Date());
      } catch {
        // IndexedDB not available
      } finally {
        setSaving(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, documentId, workspaceId, debounceMs]);

  return (
    <span className="flex items-center gap-1 text-xs text-slate-400">
      {saving ? (
        <>
          <Clock className="w-3 h-3 animate-pulse" />
          Saving draft...
        </>
      ) : lastSaved ? (
        <>
          <CheckCircle className="w-3 h-3 text-emerald-400" />
          Draft saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
        </>
      ) : null}
    </span>
  );
}

export async function loadDraft(documentId: string): Promise<string | null> {
  try {
    const db = getLocalDB();
    const draft = await db.drafts.get(documentId);
    return draft?.content ?? null;
  } catch {
    return null;
  }
}

export async function clearDraft(documentId: string): Promise<void> {
  try {
    const db = getLocalDB();
    await db.drafts.delete(documentId);
  } catch {
    // ignore
  }
}
