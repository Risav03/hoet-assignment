"use client";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

interface DocSuggestion {
  id: string;
  title: string;
}

interface MentionedDoc {
  id: string;
  title: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface WorkspaceAiAssistantProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

function MessageContent({
  content,
  workspaceSlug,
}: {
  content: string;
  workspaceSlug: string;
}) {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > last) parts.push(content.slice(last, match.index));
    const [, title, docId] = match;
    parts.push(
      <Link
        key={match.index}
        href={`/workspaces/${workspaceSlug}/documents/${docId}`}
        className="underline underline-offset-2 hover:opacity-80 font-bold text-primary-foreground"
      >
        @{title}
      </Link>
    );
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return <>{parts}</>;
}

const SUGGESTION_CHIPS = [
  "Summarize this meeting",
  "Draft an announcement",
  "What are the action items?",
  "Explain this technical concept",
];

export function WorkspaceAiAssistant({
  workspaceId,
  workspaceSlug,
  workspaceName,
}: WorkspaceAiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionedDocs, setMentionedDocs] = useState<MentionedDoc[]>([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: suggestionData, isFetching: suggestionLoading } = useQuery({
    queryKey: ["documents", "search", workspaceId, mentionQuery],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/documents?query=${encodeURIComponent(mentionQuery ?? "")}&limit=8`,
        { signal }
      );
      if (!res.ok) return { documents: [] };
      return res.json() as Promise<{ documents: { id: string; title: string }[] }>;
    },
    enabled: mentionQuery !== null,
    staleTime: 30_000,
  });

  const suggestions: DocSuggestion[] = (suggestionData?.documents ?? []).map((d) => ({
    id: d.id,
    title: d.title,
  }));

  const insertMention = useCallback(
    (doc: DocSuggestion) => {
      const cursor = inputRef.current?.selectionStart ?? input.length;
      const textBeforeCursor = input.slice(0, cursor);
      const atIndex = textBeforeCursor.lastIndexOf("@");
      const before = input.slice(0, atIndex);
      const after = input.slice(cursor);
      const token = `@[${doc.title}](${doc.id})`;
      const newInput = before + token + " " + after;
      setInput(newInput);
      setMentionQuery(null);
      setMentionedDocs((prev) =>
        prev.find((d) => d.id === doc.id) ? prev : [...prev, doc]
      );
      setTimeout(() => {
        if (inputRef.current) {
          const pos = (before + token + " ").length;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
    },
    [input]
  );

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || chatLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setMentionQuery(null);
    setChatLoading(true);

    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const referencedIds = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = mentionRegex.exec(userMessage.content)) !== null) {
      referencedIds.add(m[2]);
    }

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          messages: newMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          referencedDocumentIds: Array.from(referencedIds),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "AI request failed");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: data.content },
      ]);
    } finally {
      setChatLoading(false);
    }
  }, [input, chatLoading, messages, workspaceId]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInput(val);
      const cursor = e.target.selectionStart ?? val.length;
      const textBeforeCursor = val.slice(0, cursor);
      const atMatch = textBeforeCursor.match(/@(\w*)$/);

      if (!atMatch) {
        setMentionQuery(null);
        setActiveSuggestion(0);
        return;
      }

      setMentionQuery(atMatch[1]);
      setActiveSuggestion(0);
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length > 0 && mentionQuery !== null) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveSuggestion((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          insertMention(suggestions[activeSuggestion]);
          return;
        }
        if (e.key === "Escape") {
          setMentionQuery(null);
          return;
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [suggestions, mentionQuery, activeSuggestion, insertMention, handleSubmit]
  );

  const removeMentionedDoc = useCallback((docId: string) => {
    setMentionedDocs((prev) => prev.filter((d) => d.id !== docId));
    setInput((prev) =>
      prev.replace(new RegExp(`@\\[[^\\]]*\\]\\(${docId}\\)\\s?`, "g"), "")
    );
  }, []);

  return (
    <div className="flex flex-col h-full bg-secondary">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 sm:px-6 shrink-0 h-[52px] bg-card border-b border-border">
        <div className="flex items-center justify-center shrink-0 w-8 h-8 rounded-lg bg-accent">
          <Sparkles className="w-[15px] h-[15px] text-[#818cf8]" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">AI Assistant</p>
        </div>
        <span className="ml-2 rounded-full px-2.5 py-0.5 font-semibold text-xs bg-muted text-secondary-foreground border border-border">
          {workspaceName}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-4 sm:px-10 py-6 sm:py-7">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center text-center py-16 sm:py-20">
              <div className="flex items-center justify-center mb-5 w-[52px] h-[52px] rounded-2xl bg-accent">
                <Sparkles className="w-[22px] h-[22px] text-[#818cf8]" />
              </div>
              <p className="text-[15px] font-semibold text-foreground mb-1.5">
                How can I help you today?
              </p>
              <p className="text-[13px] text-muted-foreground mb-6">
                Type @ to reference a document from{" "}
                <span className="font-semibold text-secondary-foreground">{workspaceName}</span>
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-[480px]">
                {SUGGESTION_CHIPS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs font-semibold px-4 py-1.5 rounded-full border border-border bg-card text-secondary-foreground hover:border-accent-border hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5 max-w-[680px] mx-auto">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                      <AvatarFallback className="text-xs font-bold bg-accent text-accent-foreground">
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] sm:max-w-[75%] px-3.5 py-2.5 text-[13px] leading-[1.65] whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-xl rounded-br-sm"
                        : "bg-card text-foreground border border-border rounded-xl rounded-bl-sm shadow-sm"
                    )}
                  >
                    <MessageContent content={msg.content} workspaceSlug={workspaceSlug} />
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <Avatar className="w-7 h-7 mt-0.5">
                    <AvatarFallback className="text-xs font-bold bg-accent text-accent-foreground">
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-card border border-border rounded-xl rounded-bl-sm px-3.5 py-2.5 shadow-sm">
                    <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-card px-4 sm:px-10 py-4">
        <div className="max-w-[680px] mx-auto">
          {/* Mentioned doc chips */}
          {mentionedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {mentionedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold text-[11px] bg-accent text-accent-foreground border border-accent-border"
                >
                  <FileText className="w-[11px] h-[11px]" />
                  {doc.title}
                  <button
                    onClick={() => removeMentionedDoc(doc.id)}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X className="w-[11px] h-[11px]" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Mention suggestion popover */}
          {(suggestions.length > 0 || suggestionLoading) && mentionQuery !== null && (
            <div className="mb-2 overflow-hidden border border-border rounded-lg shadow-md bg-card">
              {suggestionLoading ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
              ) : (
                suggestions.map((doc, i) => (
                  <button
                    key={doc.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(doc);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 text-left transition-colors px-3 py-2 text-[13px] border-none cursor-pointer",
                      i === activeSuggestion
                        ? "bg-accent text-accent-foreground"
                        : "text-secondary-foreground hover:bg-muted"
                    )}
                  >
                    <FileText className="w-[13px] h-[13px] shrink-0" />
                    {doc.title}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… type @ to reference a document"
              disabled={chatLoading}
              rows={1}
              className="flex-1 resize-none border-[1.5px] border-border rounded-xl px-3 py-2 text-[13px] bg-muted text-foreground outline-none min-h-[38px] max-h-[160px] overflow-auto font-[inherit] transition-colors focus:border-primary"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <Button
              onClick={handleSubmit}
              disabled={chatLoading || !input.trim()}
              className="text-primary-foreground shrink-0 bg-primary w-[38px] h-[38px] p-0 rounded-lg shadow-[0_1px_2px_rgba(79,70,229,.25)]"
            >
              <Send className="w-[15px] h-[15px]" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
