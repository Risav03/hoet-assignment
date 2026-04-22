"use client";
import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || chatLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
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
  }, [input, chatLoading, messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-8 py-5 border-b shrink-0">
        <Bot className="w-6 h-6 text-indigo-500" />
        <div>
          <h1 className="text-xl font-bold">AI Assistant</h1>
          <p className="text-slate-500 text-xs">Ask me anything about your documents or workspace</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-8 py-6" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="text-center py-24 text-slate-400">
            <Bot className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium mb-1">How can I help you today?</p>
            <p className="text-xs mb-6 text-slate-400">Try one of the suggestions below to get started</p>
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
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <Avatar className="w-7 h-7 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">AI</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3">
                <Avatar className="w-7 h-7 mt-0.5">
                  <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs">AI</AvatarFallback>
                </Avatar>
                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input — always visible at the bottom */}
      <div className="border-t px-8 py-4 shrink-0 bg-white dark:bg-slate-950">
        <form onSubmit={handleSubmit} className="flex gap-3 max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything..."
            disabled={chatLoading}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit();
            }}
          />
          <Button
            type="submit"
            disabled={chatLoading || !input.trim()}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 px-4"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
