import "server-only";

import { getSetting, setSetting } from "@/lib/app-settings";
import { defaultLlmConfig, parseLlmConfig } from "./config";
import type { LlmConfig, LlmProvider, LlmProviderPublic } from "./types";

export function loadLlmConfig(): LlmConfig {
  const raw = getSetting("llm_config");
  if (!raw) return defaultLlmConfig();
  try {
    return parseLlmConfig(JSON.parse(raw) as unknown);
  } catch {
    return defaultLlmConfig();
  }
}

export function saveLlmConfig(config: LlmConfig): LlmConfig {
  const parsed = parseLlmConfig(config);
  setSetting("llm_config", JSON.stringify(parsed));
  return parsed;
}

export function resolvedApiKey(provider: Pick<LlmProvider, "kind" | "apiKey">): string {
  const stored = provider.apiKey.trim();
  if (stored) return stored;
  if (provider.kind === "openai") return process.env.OPENAI_API_KEY?.trim() || "";
  if (provider.kind === "anthropic") {
    return process.env.ANTHROPIC_API_KEY?.trim() || "";
  }
  return "";
}

export function providerHasKey(provider: LlmProvider): boolean {
  return provider.kind === "local" || Boolean(resolvedApiKey(provider));
}

export function toPublicProvider(provider: LlmProvider): LlmProviderPublic {
  return {
    id: provider.id,
    name: provider.name,
    kind: provider.kind,
    baseUrl: provider.baseUrl,
    model: provider.model,
    hasKey: providerHasKey(provider),
  };
}

export function getProvider(id?: string | null): LlmProvider | null {
  const config = loadLlmConfig();
  if (id) return config.providers.find((provider) => provider.id === id) ?? null;
  return (
    config.providers.find((provider) => provider.id === config.activeProviderId) ??
    config.providers[0] ??
    null
  );
}
