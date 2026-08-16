import { openaiCompatRoot } from "./config";
import { parseModelCatalog, resolveListedModel, type RemoteModel } from "./models";
import { parseAnthropicSseData, parseOpenAiSseData, type SseDelta } from "./sse";
import { resolvedApiKey } from "./store";
import type { ChatRole, LlmProvider } from "./types";

export type ChatTurn = {
  role: ChatRole;
  content: string;
};

async function* readSse(
  response: Response,
  parseData: (data: string) => SseDelta,
): AsyncGenerator<SseDelta> {
  if (!response.body) throw new Error("Model returned an empty stream.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const delta = parseData(trimmed.slice(5).trimStart());
      if (delta.text || delta.reasoning) yield delta;
    }
  }
}

function openaiHeaders(provider: Pick<LlmProvider, "kind" | "apiKey">): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = resolvedApiKey(provider);
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function streamOpenAiCompat(
  provider: LlmProvider,
  messages: ChatTurn[],
): Promise<AsyncGenerator<SseDelta>> {
  const model = await resolvedOpenAiModel(provider);
  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: openaiHeaders(provider),
    body: JSON.stringify({
      model,
      stream: true,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      detail.trim() || `Local/OpenAI-compatible request failed (${response.status}).`,
    );
  }
  return readSse(response, parseOpenAiSseData);
}

async function streamAnthropic(
  provider: LlmProvider,
  messages: ChatTurn[],
): Promise<AsyncGenerator<SseDelta>> {
  const key = resolvedApiKey(provider);
  if (!key) throw new Error("Add an Anthropic API key in Settings.");
  if (!provider.model.trim()) throw new Error("Set an Anthropic model in Settings.");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const turns = messages.filter((message) => message.role !== "system");
  const response = await fetch(
    `${openaiCompatRoot(provider.baseUrl)}/v1/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 4096,
        stream: true,
        system: system || undefined,
        messages: turns.map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: message.content,
        })),
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail.trim() || `Anthropic request failed (${response.status}).`);
  }
  return readSse(response, parseAnthropicSseData);
}

export async function streamChat(
  provider: LlmProvider,
  messages: ChatTurn[],
): Promise<AsyncGenerator<SseDelta>> {
  if (provider.kind === "anthropic") return streamAnthropic(provider, messages);
  if (provider.kind !== "local" && !resolvedApiKey(provider)) {
    throw new Error("Add an API key for this model in Settings.");
  }
  return streamOpenAiCompat(provider, messages);
}

export async function listRemoteModels(
  provider: Pick<LlmProvider, "kind" | "baseUrl" | "apiKey">,
): Promise<RemoteModel[]> {
  const names: RemoteModel[] = [];
  const headers = openaiHeaders(provider);
  const openaiUrl = `${provider.baseUrl}/models`;
  let listed = false;
  try {
    const response = await fetch(openaiUrl, { headers });
    if (response.ok) {
      names.push(...parseModelCatalog(await response.json()));
      listed = true;
    } else if (provider.kind !== "local") {
      const detail = await response.text().catch(() => "");
      throw new Error(
        detail.trim() || `Could not list models (${response.status}).`,
      );
    }
  } catch (caught) {
    if (provider.kind !== "local" || listed) throw caught;
  }
  if (provider.kind === "local") {
    try {
      const response = await fetch(`${openaiCompatRoot(provider.baseUrl)}/api/tags`);
      if (response.ok) {
        names.push(...parseModelCatalog(await response.json()));
      }
    } catch {
      // ignore — user may not have Ollama running
    }
  }
  const seen = new Set<string>();
  return names.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

const catalogCache = new Map<string, { at: number; models: RemoteModel[] }>();

async function resolvedOpenAiModel(provider: LlmProvider): Promise<string> {
  const requested = provider.model.trim();
  if (!requested) throw new Error("Set a model name in Settings first.");
  const cacheKey = `${provider.baseUrl}::${resolvedApiKey(provider).slice(-8)}`;
  const cached = catalogCache.get(cacheKey);
  const now = Date.now();
  let models = cached && now - cached.at < 60_000 ? cached.models : null;
  if (!models) {
    try {
      models = await listRemoteModels(provider);
      catalogCache.set(cacheKey, { at: now, models });
    } catch {
      return requested;
    }
  }
  if (models.some((model) => model.id === requested)) return requested;
  return resolveListedModel(requested, models).id;
}
