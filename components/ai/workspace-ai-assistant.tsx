"use client";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Send, Loader2, FileText, X } from "lucide-react";
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

// Render message content and turn @[Title](docId) tokens into clickable links
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
        className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
      >
        @{title}
      </Link>
    );
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push(content.slice(last));
  return <>{parts}</>;
}

export function WorkspaceAiAssistant({
  workspaceId,
  workspaceSlug,
  workspaceName,
}: WorkspaceAiAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // @mention state
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

    // Collect doc IDs referenced in this message via @[Title](docId) tokens
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

  // Detect @mention in the textarea and fetch suggestions inline
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

      // Cancel any in-flight fetch
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
        .catch(() => {
          // aborted or network error — ignore
        })
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
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-5 border-b shrink-0">
        <Bot className="w-6 h-6 text-indigo-500" />
        <div>
          <h1 className="text-xl font-bold">AI Assistant</h1>
          <p className="text-slate-500 text-xs">
            {workspaceName} &mdash; type @ to reference a document
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-8 py-6" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium mb-1">How can I help you today?</p>
            <p className="text-xs mb-6 text-slate-400">
              Type @ to reference a document from{" "}
              <span className="font-medium text-slate-500">{workspaceName}</span>
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {[
                "Summarize this meeting",
                "Draft an announcement",
                "What are the action items?",
                "Explain this technical concept",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="text-xs px-4 py-2 rounded-full border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-5 max-w-3xl mx-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                      AI
                    </AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  }`}
                >
                  <MessageContent content={msg.content} workspaceSlug={workspaceSlug} />
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3">
                <Avatar className="w-7 h-7 mt-0.5">
                  <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">
                    AI
                  </AvatarFallback>
                </Avatar>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input area */}
      <div className="border-t px-8 py-4 shrink-0 bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto">
          {/* Mentioned doc chips */}
          {mentionedDocs.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {mentionedDocs.map((doc) => (
                <span
                  key={doc.id}
                  className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2.5 py-0.5"
                >
                  <FileText className="w-3 h-3" />
                  {doc.title}
                  <button
                    onClick={() => removeMentionedDoc(doc.id)}
                    className="ml-0.5 hover:text-indigo-900"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* @mention suggestion popover */}
          {(suggestions.length > 0 || suggestionLoading) && mentionQuery !== null && (
            <div className="mb-2 border rounded-lg shadow-md bg-white dark:bg-slate-900 overflow-hidden">
              {suggestionLoading ? (
                <div className="px-3 py-2 text-xs text-slate-400">Searching…</div>
              ) : (
                suggestions.map((doc, i) => (
                  <button
                    key={doc.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(doc);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                      i === activeSuggestion
                        ? "bg-indigo-50 text-indigo-700"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {doc.title}
                  </button>
                ))
              )}
            </div>
          )}

          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… type @ to reference a document"
              disabled={chatLoading}
              rows={1}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[38px] max-h-40 overflow-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <Button
              onClick={handleSubmit}
              disabled={chatLoading || !input.trim()}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 px-4 self-end"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
