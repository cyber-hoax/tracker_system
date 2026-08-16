import { LLM_KINDS, type LlmConfig, type LlmKind, type LlmProvider } from "./types";

export type LlmPreset = {
  id: string;
  name: string;
  kind: LlmKind;
  baseUrl: string;
  model: string;
  needsKey: boolean;
};

export const LLM_PRESETS: LlmPreset[] = [
  {
    id: "omniroute",
    name: "OmniRoute",
    kind: "openai",
    baseUrl: "http://127.0.0.1:20128/v1",
    model: "",
    needsKey: true,
  },
  {
    id: "unsloth",
    name: "Unsloth (local)",
    kind: "openai",
    baseUrl: "http://127.0.0.1:8888/v1",
    model: "",
    needsKey: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "openai",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "",
    needsKey: true,
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    kind: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "llama3.2",
    needsKey: false,
  },
  {
    id: "lmstudio",
    name: "LM Studio (local)",
    kind: "local",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "",
    needsKey: false,
  },
  {
    id: "llamacpp",
    name: "llama.cpp server (local)",
    kind: "local",
    baseUrl: "http://127.0.0.1:8080/v1",
    model: "",
    needsKey: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    kind: "openai",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    needsKey: true,
  },
  {
    id: "groq",
    name: "Groq",
    kind: "openai",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "",
    needsKey: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5-20250929",
    needsKey: true,
  },
];

const SEEDED_PRESET_IDS = new Set([
  "ollama",
  "lmstudio",
  "llamacpp",
  "openai",
  "anthropic",
]);

export type ParsedConnection = {
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  kind?: LlmKind;
};

const KEY_VALUE =
  /^(api[_-]?key|openai_api_key|anthropic_api_key|authorization|auth[_-]?token|token|secret|key)\s*[:=]\s*(?:bearer\s+)?(.+)$/i;
const URL_VALUE =
  /^(?:openai[_-]?)?(?:base[_-]?url|api[_-]?base|endpoint|host|url)\s*[:=]\s*(.+)$/i;
const MODEL_VALUE =
  /^(?:openai[_-]?|anthropic[_-]?)?model(?:[_-]?id|_name)?\s*[:=]\s*(.+)$/i;
const NAME_VALUE = /^(name|provider|label)\s*[:=]\s*(.+)$/i;
const BARE_KEY =
  /\b(sk-unsloth-[A-Za-z0-9_-]+|sk-or-v1-[A-Za-z0-9_-]+|sk-ant-[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|gsk_[A-Za-z0-9_-]+|omr_[A-Za-z0-9_-]+)\b/;
const BARE_URL = /https?:\/\/[^\s"'<>]+/i;

function stripQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, "").trim();
}

export function extractCompatBaseUrl(value: string): string {
  const trimmed = stripQuotes(value);
  try {
    const parsed = new URL(trimmed);
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname
      .replace(/\/+$/, "")
      .replace(/\/(chat\/completions|messages|models|completions)$/i, "");
    if (!parsed.pathname) parsed.pathname = "/";
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function guessFromKey(key: string): ParsedConnection {
  if (key.startsWith("sk-unsloth-")) {
    return {
      kind: "openai",
      baseUrl: "http://127.0.0.1:8888/v1",
      name: "Unsloth (local)",
    };
  }
  if (key.startsWith("sk-or-")) {
    return {
      kind: "openai",
      baseUrl: "https://openrouter.ai/api/v1",
      name: "OpenRouter",
    };
  }
  if (key.startsWith("sk-ant-")) {
    return {
      kind: "anthropic",
      baseUrl: "https://api.anthropic.com",
      name: "Anthropic",
    };
  }
  if (key.startsWith("gsk_")) {
    return {
      kind: "openai",
      baseUrl: "https://api.groq.com/openai/v1",
      name: "Groq",
    };
  }
  if (key.startsWith("omr_")) {
    return {
      kind: "openai",
      baseUrl: "http://127.0.0.1:20128/v1",
      name: "OmniRoute",
    };
  }
  return {};
}

function guessFromUrl(url: string): ParsedConnection {
  const lower = url.toLowerCase();
  if (lower.includes(":20128") || lower.includes("omniroute")) {
    return { kind: "openai", name: "OmniRoute" };
  }
  if (lower.includes(":8888") || lower.includes("unsloth")) {
    return { kind: "openai", name: "Unsloth (local)" };
  }
  if (lower.includes("openrouter.ai")) {
    return { kind: "openai", name: "OpenRouter" };
  }
  if (lower.includes("anthropic.com")) {
    return { kind: "anthropic", name: "Anthropic" };
  }
  if (lower.includes("groq.com")) {
    return { kind: "openai", name: "Groq" };
  }
  if (lower.includes(":11434")) {
    return { kind: "local", name: "Ollama (local)" };
  }
  if (lower.includes(":1234")) {
    return { kind: "local", name: "LM Studio (local)" };
  }
  if (lower.includes(":8080")) {
    return { kind: "local", name: "llama.cpp server (local)" };
  }
  if (lower.includes("openai.com")) {
    return { kind: "openai", name: "OpenAI" };
  }
  if (lower.includes("127.0.0.1") || lower.includes("localhost")) {
    return { kind: "openai" };
  }
  return { kind: "openai" };
}

export function parseConnectionPaste(raw: string): ParsedConnection {
  const text = raw.trim();
  if (!text) return {};

  const parsed: ParsedConnection = {};
  if (text.startsWith("{")) {
    try {
      const record = asRecord(JSON.parse(text));
      if (record) {
        const apiKey = asString(record.apiKey || record.api_key || record.key);
        const baseUrl = asString(
          record.baseUrl || record.base_url || record.url || record.endpoint,
        );
        const model = asString(record.model);
        const name = asString(record.name);
        if (apiKey) parsed.apiKey = stripQuotes(apiKey);
        if (baseUrl) parsed.baseUrl = extractCompatBaseUrl(baseUrl);
        if (model) parsed.model = stripQuotes(model);
        if (name) parsed.name = stripQuotes(name);
      }
    } catch {
      // fall through to line parsing
    }
  }

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const keyMatch = trimmed.match(KEY_VALUE);
    if (keyMatch) {
      parsed.apiKey = stripQuotes(keyMatch[2]);
      continue;
    }
    const urlMatch = trimmed.match(URL_VALUE);
    if (urlMatch) {
      parsed.baseUrl = extractCompatBaseUrl(urlMatch[1]);
      continue;
    }
    const modelMatch = trimmed.match(MODEL_VALUE);
    if (modelMatch) {
      parsed.model = stripQuotes(modelMatch[1]);
      continue;
    }
    const nameMatch = trimmed.match(NAME_VALUE);
    if (nameMatch) {
      parsed.name = stripQuotes(nameMatch[2]);
    }
  }

  if (!parsed.apiKey) {
    const keyMatch = text.match(BARE_KEY);
    if (keyMatch) parsed.apiKey = keyMatch[1];
    else if (!text.includes("\n") && !BARE_URL.test(text)) {
      const token = stripQuotes(text);
      if (token.length >= 16 && !/\s/.test(token)) parsed.apiKey = token;
    }
  }
  if (!parsed.baseUrl) {
    const urlMatch = text.match(BARE_URL);
    if (urlMatch) parsed.baseUrl = extractCompatBaseUrl(urlMatch[0]);
  }

  const guessed = {
    ...(parsed.apiKey ? guessFromKey(parsed.apiKey) : {}),
    ...(parsed.baseUrl ? guessFromUrl(parsed.baseUrl) : {}),
  };
  return {
    ...guessed,
    ...parsed,
    kind: parsed.kind ?? guessed.kind,
    name: parsed.name || guessed.name,
    baseUrl: parsed.baseUrl || guessed.baseUrl,
  };
}

export function emptyProvider(kind: LlmKind = "local"): LlmProvider {
  const preset =
    LLM_PRESETS.find((item) => item.id === kind) ??
    LLM_PRESETS.find((item) => item.kind === kind) ??
    LLM_PRESETS[0];
  return {
    id: crypto.randomUUID(),
    name: kind === "local" ? "Local LLM" : preset.name,
    kind,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.model,
  };
}

export function defaultLlmConfig(): LlmConfig {
  return {
    activeProviderId: "ollama",
    providers: LLM_PRESETS.filter((preset) => SEEDED_PRESET_IDS.has(preset.id)).map(
      (preset) => ({
        id: preset.id,
        name: preset.name,
        kind: preset.kind,
        baseUrl: preset.baseUrl,
        model: preset.model,
        apiKey: "",
      }),
    ),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function isLlmKind(value: unknown): value is LlmKind {
  return LLM_KINDS.includes(value as LlmKind);
}

export function normalizeBaseUrl(value: string, kind: LlmKind): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return kind === "anthropic"
      ? "https://api.anthropic.com"
      : kind === "openai"
        ? "https://api.openai.com/v1"
        : "http://127.0.0.1:11434/v1";
  }
  if (kind === "anthropic") return trimmed.replace(/\/v1$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

export function openaiCompatRoot(baseUrl: string): string {
  return baseUrl.replace(/\/v1$/, "");
}

function normalizeProvider(value: unknown, fallbackId: string): LlmProvider | null {
  const record = asRecord(value);
  if (!record) return null;
  const kind = isLlmKind(record.kind) ? record.kind : "local";
  const name = asString(record.name).trim();
  return {
    id: asString(record.id, fallbackId).trim() || fallbackId,
    name: name || (kind === "local" ? "Local LLM" : kind),
    kind,
    baseUrl: normalizeBaseUrl(asString(record.baseUrl), kind),
    apiKey: asString(record.apiKey),
    model: asString(record.model).trim(),
  };
}

export function parseLlmConfig(raw: unknown): LlmConfig {
  const defaults = defaultLlmConfig();
  const record = asRecord(raw);
  if (!record) return defaults;
  const incoming = Array.isArray(record.providers) ? record.providers : [];
  const providers = incoming
    .map((item, index) => normalizeProvider(item, `provider-${index + 1}`))
    .filter((item): item is LlmProvider => Boolean(item));
  if (providers.length === 0) return defaults;
  const active =
    asString(record.activeProviderId) ||
    providers[0].id;
  const exists = providers.some((provider) => provider.id === active);
  return {
    activeProviderId: exists ? active : providers[0].id,
    providers,
  };
}
