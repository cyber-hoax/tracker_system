"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ChatMarkdown } from "@/app/components/chat-markdown";
import {
  createChatAction,
  deleteChatAction,
  searchChatMentionsAction,
  setActiveLlmProviderAction,
} from "@/app/actions/llm";
import {
  insertMention,
  mentionQueryAt,
  mentionsStillInText,
  type ChatMentionHit,
  type ChatMentionRef,
  type MentionDraft,
} from "@/lib/chat-mentions";
import type { ChatConversation, ChatMessage, LlmProviderPublic } from "@/lib/llm/types";

const THINKING_VERBS = [
  "Thinking",
  "Pondering",
  "Reasoning",
  "Considering",
  "Working it out",
];

function ChatThinking({
  reasoning,
  answer,
}: {
  reasoning: string;
  answer: string;
}) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % THINKING_VERBS.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, []);
  const answering = Boolean(answer);
  return (
    <li className="max-w-3xl rounded-2xl border border-ctp-surface0 bg-ctp-mantle px-4 py-3">
      <p
        className={`mb-2 font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0 ${
          answering ? "" : "chat-think"
        }`}
      >
        {answering ? "Assistant" : `${THINKING_VERBS[index]}…`}
      </p>
      {reasoning ? (
        <details
          open={!answering}
          className="mb-3 rounded-xl bg-ctp-crust/70 px-3 py-2"
        >
          <summary className="cursor-pointer text-xs text-ctp-subtext0">
            Thoughts
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ctp-overlay0">
            {reasoning}
          </p>
        </details>
      ) : null}
      {answer ? <ChatMarkdown markdown={answer} /> : null}
    </li>
  );
}

export function ChatWindow({
  conversations: initialConversations,
  active,
  providers,
  activeProviderId,
}: {
  conversations: ChatConversation[];
  active: { conversation: ChatConversation; messages: ChatMessage[] } | null;
  providers: LlmProviderPublic[];
  activeProviderId: string;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversation, setConversation] = useState(active?.conversation ?? null);
  const [messages, setMessages] = useState(active?.messages ?? []);
  const [providerId, setProviderId] = useState(
    active?.conversation.providerId || activeProviderId,
  );
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [mention, setMention] = useState<MentionDraft | null>(null);
  const [hits, setHits] = useState<ChatMentionHit[]>([]);
  const [highlighted, setHighlighted] = useState(0);
  const [attached, setAttached] = useState<ChatMentionRef[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  const visibleHits = useMemo(() => hits.slice(0, 12), [hits]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, streaming, reasoning, busy]);

  useEffect(() => {
    if (!mention) {
      setHits([]);
      return;
    }
    const kind = mention.trigger === "/" ? "folder" : "file";
    const handle = window.setTimeout(() => {
      startTransition(async () => {
        const next = await searchChatMentionsAction(kind, mention.query);
        setHits(next);
        setHighlighted(0);
      });
    }, 120);
    return () => window.clearTimeout(handle);
  }, [mention?.trigger, mention?.query, mention]);

  function refreshMention(text: string, cursor: number) {
    setMention(mentionQueryAt(text, cursor));
    setAttached((current) => mentionsStillInText(text, current));
  }

  function applyHit(hit: ChatMentionHit) {
    const field = composer.current;
    const cursor = field?.selectionStart ?? draft.length;
    const current = mentionQueryAt(draft, cursor) ?? mention;
    if (!current) return;
    const next = insertMention(draft, current, hit.label);
    setDraft(next.text);
    setAttached((refs) =>
      mentionsStillInText(next.text, [
        ...refs.filter((ref) => ref.id !== hit.id),
        { kind: hit.kind, id: hit.id, label: hit.label },
      ]),
    );
    setMention(null);
    setHits([]);
    requestAnimationFrame(() => {
      const el = composer.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.cursor, next.cursor);
    });
  }

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    if (mention && visibleHits.length > 0) {
      applyHit(visibleHits[highlighted] ?? visibleHits[0]);
      return;
    }
    const payloadMentions = mentionsStillInText(content, attached);
    let conversationId = conversation?.id;
    if (!conversationId) {
      const created = await createChatAction(providerId);
      conversationId = created.id;
      setConversation(created);
      setConversations((current) => [created, ...current]);
    }
    setDraft("");
    setAttached([]);
    setMention(null);
    setError("");
    setBusy(true);
    setReasoning("");
    setMessages((current) => [
      ...current,
      {
        id: `local-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      },
    ]);
    setStreaming("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          providerId,
          content,
          mentions: payloadMentions,
        }),
      });
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Chat request failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistant = "";
      let thoughts = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") continue;
          const json = JSON.parse(payload) as {
            text?: string;
            reasoning?: string;
            error?: string;
          };
          if (json.error) throw new Error(json.error);
          if (json.reasoning) {
            thoughts += json.reasoning;
            setReasoning(thoughts);
          }
          if (json.text) {
            assistant += json.text;
            setStreaming(assistant);
          }
        }
      }
      if (assistant) {
        setMessages((current) => [
          ...current,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: assistant,
            createdAt: new Date().toISOString(),
          },
        ]);
        setConversations((current) =>
          current.map((item) =>
            item.id === conversationId
              ? {
                  ...item,
                  title:
                    item.title === "New chat"
                      ? content.slice(0, 48)
                      : item.title,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chat failed.");
    } finally {
      setStreaming("");
      setReasoning("");
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 bg-ctp-crust">
      <aside className="flex w-56 shrink-0 flex-col border-r border-ctp-surface0 bg-ctp-mantle">
        <div className="flex items-center justify-between gap-2 p-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
            Chats
          </p>
          <button
            type="button"
            disabled={pending}
            className="text-xs text-ctp-mauve"
            onClick={() => {
              startTransition(async () => {
                const created = await createChatAction(providerId);
                setConversation(created);
                setMessages([]);
                setConversations((current) => [created, ...current]);
              });
            }}
          >
            New
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {conversations.map((item) => {
            const open = item.id === conversation?.id;
            return (
              <li key={item.id}>
                <div
                  className={`group flex items-center rounded-xl ${
                    open ? "bg-ctp-surface0" : "hover:bg-ctp-surface0/70"
                  }`}
                >
                  <a
                    href={`/chat?id=${item.id}`}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-ctp-text"
                  >
                    {item.title}
                  </a>
                  <button
                    type="button"
                    className="hidden px-2 text-xs text-ctp-red group-hover:block"
                    onClick={() => {
                      startTransition(async () => {
                        await deleteChatAction(item.id);
                        const next = conversations.filter((row) => row.id !== item.id);
                        setConversations(next);
                        if (conversation?.id === item.id) {
                          setConversation(next[0] ?? null);
                          setMessages([]);
                        }
                      });
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-ctp-surface0 px-5 py-3">
          <h1 className="text-lg text-ctp-text">Chat</h1>
          <label className="ml-auto text-xs text-ctp-overlay0">
            Model
            <select
              className="ml-2 border border-ctp-surface1 bg-ctp-mantle px-2 py-1 text-sm text-ctp-text"
              value={providerId}
              onChange={(event) => {
                const next = event.target.value;
                setProviderId(next);
                startTransition(async () => {
                  await setActiveLlmProviderAction(next);
                });
              }}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                  {provider.model ? ` · ${provider.model}` : ""}
                </option>
              ))}
            </select>
          </label>
        </header>

        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 && !busy ? (
            <p className="max-w-xl text-sm text-ctp-subtext0">
              Talk to a local model or a cloud key from Settings. Type @ for a
              note or / for a folder. Replies stay on this machine.
            </p>
          ) : null}
          <ol className="space-y-4">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`max-w-3xl rounded-2xl border border-ctp-surface0 px-4 py-3.5 ${
                  message.role === "user"
                    ? "ml-auto bg-ctp-surface0"
                    : "bg-ctp-mantle"
                }`}
              >
                <p className="mb-2.5 font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
                  {message.role === "user" ? "You" : "Assistant"}
                </p>
                {message.role === "assistant" ? (
                  <ChatMarkdown markdown={message.content} />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </p>
                )}
              </li>
            ))}
            {busy ? (
              <ChatThinking reasoning={reasoning} answer={streaming} />
            ) : null}
          </ol>
        </div>

        <form
          className="relative border-t border-ctp-surface0 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          {mention ? (
            <div
              role="listbox"
              aria-label={mention.trigger === "/" ? "Folders" : "Notes"}
              className="absolute inset-x-4 bottom-full z-20 mb-2 max-h-64 overflow-y-auto rounded-xl border border-ctp-surface1 bg-ctp-base shadow-xl"
            >
              <p className="border-b border-ctp-surface0 px-3 py-2 font-mono text-[10px] uppercase tracking-wide text-ctp-overlay0">
                {mention.trigger === "/" ? "Folders" : "Notes"}
              </p>
              {visibleHits.length === 0 ? (
                <p className="px-3 py-2 text-xs text-ctp-overlay0">No matches.</p>
              ) : (
                visibleHits.map((hit, index) => (
                  <button
                    key={hit.id}
                    type="button"
                    role="option"
                    aria-selected={index === highlighted}
                    data-active={index === highlighted}
                    className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                      index === highlighted
                        ? "bg-ctp-surface0 text-ctp-text"
                        : "text-ctp-subtext0 hover:bg-ctp-surface0/70"
                    }`}
                    onMouseEnter={() => setHighlighted(index)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      applyHit(hit);
                    }}
                  >
                    <span className="font-medium text-ctp-text">
                      {mention.trigger}
                      {hit.label}
                    </span>
                    <span className="font-mono text-[10px] text-ctp-overlay0">
                      {hit.hint}
                    </span>
                  </button>
                ))
              )}
            </div>
          ) : null}
          <textarea
            ref={composer}
            value={draft}
            onChange={(event) => {
              const value = event.target.value;
              setDraft(value);
              refreshMention(value, event.target.selectionStart);
            }}
            onClick={(event) => {
              refreshMention(event.currentTarget.value, event.currentTarget.selectionStart);
            }}
            onKeyUp={(event) => {
              if (
                event.key === "ArrowLeft" ||
                event.key === "ArrowRight" ||
                event.key === "Home" ||
                event.key === "End"
              ) {
                refreshMention(
                  event.currentTarget.value,
                  event.currentTarget.selectionStart,
                );
              }
            }}
            onKeyDown={(event) => {
              if (mention && visibleHits.length > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setHighlighted((index) => (index + 1) % visibleHits.length);
                  return;
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setHighlighted(
                    (index) =>
                      (index - 1 + visibleHits.length) % visibleHits.length,
                  );
                  return;
                }
                if (event.key === "Enter" || event.key === "Tab") {
                  event.preventDefault();
                  applyHit(visibleHits[highlighted] ?? visibleHits[0]);
                  return;
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setMention(null);
                  return;
                }
              }
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={3}
            placeholder="Ask anything. @ note, / folder. Shift+Enter for a new line."
            className="w-full border border-ctp-surface1 bg-ctp-mantle px-3 py-2 text-sm text-ctp-text outline-none focus:border-ctp-mauve"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className={`text-[13px] ${error ? "text-ctp-red" : "text-ctp-overlay0"}`}>
              {error ||
                (providers.find((item) => item.id === providerId)?.kind === "local"
                  ? "Local model — start Ollama or LM Studio first."
                  : "Cloud key is read from Settings.")}
            </p>
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="rounded-full bg-ctp-peach px-4 py-2 text-sm font-medium text-ctp-crust disabled:opacity-50"
            >
              {busy ? `${THINKING_VERBS[0]}…` : "Send"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
