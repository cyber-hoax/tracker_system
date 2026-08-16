import { connection } from "next/server";
import { ChatWindow } from "@/app/components/chat-window";
import { getConversation, listConversations } from "@/lib/chat";
import { loadLlmConfig, toPublicProvider } from "@/lib/llm/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chat",
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const requested = typeof params.id === "string" ? params.id : "";
  const [conversations, config] = await Promise.all([
    listConversations(),
    Promise.resolve(loadLlmConfig()),
  ]);
  const activeId = requested || conversations[0]?.id || "";
  const active = activeId ? await getConversation(activeId) : null;

  return (
    <ChatWindow
      conversations={conversations}
      active={active}
      providers={config.providers.map(toPublicProvider)}
      activeProviderId={config.activeProviderId}
    />
  );
}
