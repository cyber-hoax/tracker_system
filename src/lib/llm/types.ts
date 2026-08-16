export const LLM_KINDS = ["openai", "anthropic", "local"] as const;

export type LlmKind = (typeof LLM_KINDS)[number];

export type LlmProvider = {
  id: string;
  name: string;
  kind: LlmKind;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type LlmConfig = {
  activeProviderId: string;
  providers: LlmProvider[];
};

export type LlmProviderPublic = {
  id: string;
  name: string;
  kind: LlmKind;
  baseUrl: string;
  model: string;
  hasKey: boolean;
};

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatConversation = {
  id: string;
  title: string;
  providerId: string | null;
  createdAt: string;
  updatedAt: string;
};
