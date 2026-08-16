import { addChatMessage, getConversation, updateConversationProvider } from "@/lib/chat";
import { expandChatMentions } from "@/lib/chat-context";
import type { ChatMentionRef } from "@/lib/chat-mentions";
import { streamChat } from "@/lib/llm/client";
import { getProvider } from "@/lib/llm/store";
import type { ChatRole } from "@/lib/llm/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SYSTEM = [
  "You are a local study coach inside a personal DSA / SDE tracker.",
  "Be concise. Prefer depth over extra problems. Do not dump full solutions unless asked.",
  "If the user attached notes with @ or folders with /, use that workspace context.",
].join(" ");

type ChatBody = {
  conversationId?: string;
  providerId?: string;
  content?: string;
  mentions?: ChatMentionRef[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatBody;
    const content = String(body.content || "").trim();
    const conversationId = String(body.conversationId || "");
    if (!content) {
      return Response.json({ error: "Message is empty." }, { status: 400 });
    }
    if (!conversationId) {
      return Response.json({ error: "Missing conversation." }, { status: 400 });
    }

    const loaded = await getConversation(conversationId);
    if (!loaded) {
      return Response.json({ error: "Conversation not found." }, { status: 404 });
    }

    const provider = getProvider(body.providerId || loaded.conversation.providerId);
    if (!provider) {
      return Response.json(
        { error: "Add a model in Settings first." },
        { status: 400 },
      );
    }

    const mentions = Array.isArray(body.mentions) ? body.mentions : [];
    const attached = await expandChatMentions(
      mentions.filter(
        (item) =>
          item &&
          (item.kind === "file" || item.kind === "folder") &&
          typeof item.id === "string" &&
          typeof item.label === "string",
      ),
    );
    const modelContent = attached
      ? `${content}\n\n${attached}`
      : content;

    await addChatMessage({ conversationId, role: "user", content });
    if (body.providerId) {
      await updateConversationProvider(conversationId, provider.id);
    }

    const history = [
      ...loaded.messages.map((message) => ({
        role: message.role as ChatRole,
        content: message.content,
      })),
      { role: "user" as const, content: modelContent },
    ];

    const encoder = new TextEncoder();
    let assistant = "";
    const generator = await streamChat(provider, [
      { role: "system", content: SYSTEM },
      ...history,
    ]);

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generator) {
            if (chunk.reasoning) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ reasoning: chunk.reasoning })}\n\n`,
                ),
              );
            }
            if (chunk.text) {
              assistant += chunk.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: chunk.text })}\n\n`),
              );
            }
          }
          if (assistant.trim()) {
            await addChatMessage({
              conversationId,
              role: "assistant",
              content: assistant,
            });
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Model request failed.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Request failed";
    return Response.json({ error: detail }, { status: 500 });
  }
}
