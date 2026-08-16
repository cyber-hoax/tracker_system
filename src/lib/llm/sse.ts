export type SseDelta = {
  text: string;
  reasoning: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseOpenAiSseData(data: string): SseDelta {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") return { text: "", reasoning: "" };
  try {
    const json = JSON.parse(trimmed) as {
      choices?: {
        delta?: {
          content?: string;
          reasoning_content?: string;
          reasoning?: string;
          thinking?: string;
        };
        message?: {
          content?: string;
          reasoning_content?: string;
        };
      }[];
    };
    const delta = json.choices?.[0]?.delta;
    const message = json.choices?.[0]?.message;
    return {
      text: delta?.content || message?.content || "",
      reasoning:
        delta?.reasoning_content ||
        delta?.reasoning ||
        delta?.thinking ||
        message?.reasoning_content ||
        "",
    };
  } catch {
    return { text: "", reasoning: "" };
  }
}

export function parseAnthropicSseData(data: string): SseDelta {
  const trimmed = data.trim();
  if (!trimmed) return { text: "", reasoning: "" };
  try {
    const json = asRecord(JSON.parse(trimmed));
    if (!json) return { text: "", reasoning: "" };
    const delta = asRecord(json.delta);
    if (json.type === "content_block_delta" && delta) {
      if (delta.type === "text_delta" || asString(delta.text)) {
        return { text: asString(delta.text), reasoning: "" };
      }
      if (delta.type === "thinking_delta" || asString(delta.thinking)) {
        return { text: "", reasoning: asString(delta.thinking) };
      }
    }
    return { text: "", reasoning: "" };
  } catch {
    return { text: "", reasoning: "" };
  }
}
