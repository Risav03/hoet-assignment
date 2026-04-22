"use client";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sparkles, Send, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
        className="underline underline-offset-2 hover:opacity-80 font-bold"
        style={{ color: "#ffffff" }}
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
  const [suggestions, setSuggestions] = useState<DocSuggestion[]>([]);
  const [mentionedDocs, setMentionedDocs] = useState<MentionedDoc[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fetchControllerRef = useRef<AbortController | null>(null);

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
        setSuggestions([]);
        return;
      }

      const query = atMatch[1];
      setMentionQuery(query);

      fetchControllerRef.current?.abort();
      const controller = new AbortController();
      fetchControllerRef.current = controller;

      setSuggestionLoading(true);
      fetch(
        `/api/workspaces/${workspaceId}/documents?query=${encodeURIComponent(query)}&limit=8`,
        { signal: controller.signal }
      )
        .then((r) => r.json())
        .then((data) => {
          setSuggestions(
            (data.documents ?? []).map((d: { id: string; title: string }) => ({
              id: d.id,
              title: d.title,
            }))
          );
          setActiveSuggestion(0);
        })
        .catch(() => {})
        .finally(() => setSuggestionLoading(false));
    },
    [workspaceId]
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
    <div className="flex flex-col" style={{ height: "100%", background: "#fafafa" }}>
      {/* Top bar — 52px */}
      <div
        className="flex items-center gap-3 px-6 shrink-0"
        style={{
          height: 52,
          background: "#ffffff",
          borderBottom: "1px solid #e4e4e7",
        }}
      >
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 32, height: 32, borderRadius: 8, background: "#eef2ff" }}
        >
          <Sparkles style={{ width: 15, height: 15, color: "#818cf8" }} />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#18181b" }}>AI Assistant</p>
        </div>
        <span
          className="ml-2 rounded-full px-2.5 py-0.5 font-semibold text-xs"
          style={{ background: "#f4f4f5", color: "#52525b", border: "1px solid #e4e4e7" }}
        >
          {workspaceName}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div style={{ padding: "28px 40px" }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center text-center py-20">
              <div
                className="flex items-center justify-center mb-5"
                style={{ width: 52, height: 52, borderRadius: 16, background: "#eef2ff" }}
              >
                <Sparkles style={{ width: 22, height: 22, color: "#818cf8" }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#18181b", marginBottom: 6 }}>
                How can I help you today?
              </p>
              <p style={{ fontSize: 13, color: "#71717a", marginBottom: 24 }}>
                Type @ to reference a document from{" "}
                <span style={{ fontWeight: 600, color: "#3f3f46" }}>{workspaceName}</span>
              </p>
              <div className="flex flex-wrap gap-2 justify-center" style={{ maxWidth: 480 }}>
                {SUGGESTION_CHIPS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "6px 16px",
                      borderRadius: 20,
                      border: "1px solid #e4e4e7",
                      background: "#ffffff",
                      color: "#3f3f46",
                      cursor: "pointer",
                      transition: "all 150ms",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#c7d2fe";
                      (e.currentTarget as HTMLButtonElement).style.background = "#eef2ff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#e4e4e7";
                      (e.currentTarget as HTMLButtonElement).style.background = "#ffffff";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5" style={{ maxWidth: 680, margin: "0 auto" }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar style={{ width: 28, height: 28, flexShrink: 0, marginTop: 2 }}>
                      <AvatarFallback
                        className="text-xs font-bold"
                        style={{ background: "#eef2ff", color: "#4338ca" }}
                      >
                        AI
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    style={{
                      maxWidth: "75%",
                      padding: "10px 14px",
                      fontSize: 13,
                      lineHeight: 1.65,
                      whiteSpace: "pre-wrap",
                      ...(msg.role === "user"
                        ? {
                            background: "#4f46e5",
                            color: "#ffffff",
                            borderRadius: "12px 4px 12px 12px",
                          }
                        : {
                            background: "#ffffff",
                            color: "#18181b",
                            border: "1px solid #e4e4e7",
                            borderRadius: "4px 12px 12px 12px",
                            boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                          }),
                    }}
                  >
                    <MessageContent content={msg.content} workspaceSlug={workspaceSlug} />
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-3">
                  <Avatar style={{ width: 28, height: 28, marginTop: 2 }}>
                    <AvatarFallback
                      className="text-xs font-bold"
                      style={{ background: "#eef2ff", color: "#4338ca" }}
                    >
                      AI
                    </AvatarFallback>
                  </Avatar>
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e4e4e7",
                      borderRadius: "4px 12px 12px 12px",
                      padding: "10px 14px",
                      boxShadow: "0 1px 3px rgba(0,0,0,.06)",
                    }}
                  >
                    <Loader2 style={{ width: 16, height: 16, color: "#a1a1aa" }} className="animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input bar */}
      <div
        className="shrink-0"
        style={{
          borderTop: "1px solid #e4e4e7",
          background: "#ffffff",
          padding: "16px 40px",
        }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* Mentioned doc chips */}
          {mentionedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {mentionedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold"
                  style={{
                    fontSize: 11,
                    background: "#eef2ff",
                    color: "#4338ca",
                    border: "1px solid #c7d2fe",
                  }}
                >
                  <FileText style={{ width: 11, height: 11 }} />
                  {doc.title}
                  <button
                    onClick={() => removeMentionedDoc(doc.id)}
                    className="ml-0.5 hover:opacity-70"
                  >
                    <X style={{ width: 11, height: 11 }} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Mention suggestion popover */}
          {(suggestions.length > 0 || suggestionLoading) && mentionQuery !== null && (
            <div
              className="mb-2 overflow-hidden"
              style={{
                border: "1px solid #e4e4e7",
                borderRadius: 8,
                boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                background: "#ffffff",
              }}
            >
              {suggestionLoading ? (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "#a1a1aa" }}>
                  Searching…
                </div>
              ) : (
                suggestions.map((doc, i) => (
                  <button
                    key={doc.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(doc);
                    }}
                    className="w-full flex items-center gap-2 text-left transition-colors"
                    style={{
                      padding: "8px 12px",
                      fontSize: 13,
                      background: i === activeSuggestion ? "#eef2ff" : "transparent",
                      color: i === activeSuggestion ? "#4338ca" : "#3f3f46",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <FileText style={{ width: 13, height: 13, flexShrink: 0 }} />
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
              style={{
                flex: 1,
                resize: "none",
                border: "1.5px solid #e4e4e7",
                borderRadius: 10,
                padding: "9px 12px",
                fontSize: 13,
                background: "#fafafa",
                color: "#18181b",
                outline: "none",
                minHeight: 38,
                maxHeight: 160,
                overflow: "auto",
                fontFamily: "inherit",
                transition: "border-color 150ms",
                fieldSizing: "content",
              } as React.CSSProperties}
              onFocus={(e) => {
                (e.target as HTMLTextAreaElement).style.borderColor = "#4f46e5";
              }}
              onBlur={(e) => {
                (e.target as HTMLTextAreaElement).style.borderColor = "#e4e4e7";
              }}
            />
            <Button
              onClick={handleSubmit}
              disabled={chatLoading || !input.trim()}
              className="text-white shrink-0"
              style={{
                background: "#4f46e5",
                borderRadius: 8,
                width: 38,
                height: 38,
                padding: 0,
                boxShadow: "0 1px 2px rgba(79,70,229,.25)",
              }}
            >
              <Send style={{ width: 15, height: 15 }} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
