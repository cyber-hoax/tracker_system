import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatConversations, chatMessages } from "@/db/schema";
import type { ChatConversation, ChatMessage, ChatRole } from "@/lib/llm/types";

function serializeConversation(
  row: typeof chatConversations.$inferSelect,
): ChatConversation {
  return {
    id: row.id,
    title: row.title,
    providerId: row.providerId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeMessage(row: typeof chatMessages.$inferSelect): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatRole,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listConversations(): Promise<ChatConversation[]> {
  const rows = await db
    .select()
    .from(chatConversations)
    .orderBy(desc(chatConversations.updatedAt));
  return rows.map(serializeConversation);
}

export async function getConversation(id: string): Promise<{
  conversation: ChatConversation;
  messages: ChatMessage[];
} | null> {
  const [conversation] = await db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.id, id))
    .limit(1);
  if (!conversation) return null;
  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, id))
    .orderBy(chatMessages.createdAt);
  return {
    conversation: serializeConversation(conversation),
    messages: messages.map(serializeMessage),
  };
}

export async function createConversation(
  providerId?: string | null,
): Promise<ChatConversation> {
  const [row] = await db
    .insert(chatConversations)
    .values({
      title: "New chat",
      providerId: providerId || null,
    })
    .returning();
  return serializeConversation(row);
}

export async function deleteConversation(id: string): Promise<void> {
  await db.delete(chatConversations).where(eq(chatConversations.id, id));
}

export async function addChatMessage(input: {
  conversationId: string;
  role: ChatRole;
  content: string;
}): Promise<ChatMessage> {
  const [row] = await db
    .insert(chatMessages)
    .values({
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
    })
    .returning();
  const title =
    input.role === "user" ? titleFromContent(input.content) : null;
  await db
    .update(chatConversations)
    .set({
      updatedAt: new Date(),
      ...(title ? { title } : {}),
    })
    .where(eq(chatConversations.id, input.conversationId));
  return serializeMessage(row);
}

export async function updateConversationProvider(
  id: string,
  providerId: string,
): Promise<void> {
  await db
    .update(chatConversations)
    .set({ providerId, updatedAt: new Date() })
    .where(eq(chatConversations.id, id));
}

function titleFromContent(content: string): string {
  const compact = content.replace(/\s+/g, " ").trim();
  if (!compact) return "New chat";
  return compact.length > 48 ? `${compact.slice(0, 45)}…` : compact;
}
