"use server";

import { revalidatePath } from "next/cache";
import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/lib/chat";
import { emptyProvider, parseLlmConfig } from "@/lib/llm/config";
import { listRemoteModels } from "@/lib/llm/client";
import { resolveListedModel, type RemoteModel } from "@/lib/llm/models";
import { searchChatFiles, searchChatFolders } from "@/lib/chat-context";
import {
  getProvider,
  loadLlmConfig,
  saveLlmConfig,
  toPublicProvider,
} from "@/lib/llm/store";
import type { LlmProvider, LlmProviderPublic } from "@/lib/llm/types";

function revalidateChat() {
  revalidatePath("/chat");
  revalidatePath("/settings");
}

export async function getLlmSettingsView(): Promise<{
  activeProviderId: string;
  providers: LlmProviderPublic[];
}> {
  const config = loadLlmConfig();
  return {
    activeProviderId: config.activeProviderId,
    providers: config.providers.map(toPublicProvider),
  };
}

export async function saveLlmProviderAction(
  input: Omit<LlmProvider, "apiKey"> & { apiKey?: string },
): Promise<{ ok: true; providers: LlmProviderPublic[]; activeProviderId: string }> {
  const config = loadLlmConfig();
  const existing = config.providers.find((provider) => provider.id === input.id);
  const next: LlmProvider = {
    id: input.id || crypto.randomUUID(),
    name: input.name,
    kind: input.kind,
    baseUrl: input.baseUrl,
    model: input.model,
    apiKey:
      input.apiKey && input.apiKey.trim()
        ? input.apiKey
        : existing?.apiKey || "",
  };
  const providers = existing
    ? config.providers.map((provider) =>
        provider.id === next.id ? next : provider,
      )
    : [...config.providers, next];
  const saved = saveLlmConfig({
    activeProviderId: config.activeProviderId || next.id,
    providers,
  });
  revalidateChat();
  return {
    ok: true,
    activeProviderId: saved.activeProviderId,
    providers: saved.providers.map(toPublicProvider),
  };
}

export async function deleteLlmProviderAction(id: string) {
  const config = loadLlmConfig();
  const providers = config.providers.filter((provider) => provider.id !== id);
  if (providers.length === 0) {
    const saved = saveLlmConfig(parseLlmConfig({ providers: [emptyProvider("local")] }));
    revalidateChat();
    return {
      activeProviderId: saved.activeProviderId,
      providers: saved.providers.map(toPublicProvider),
    };
  }
  const activeProviderId =
    config.activeProviderId === id ? providers[0].id : config.activeProviderId;
  const saved = saveLlmConfig({ activeProviderId, providers });
  revalidateChat();
  return {
    activeProviderId: saved.activeProviderId,
    providers: saved.providers.map(toPublicProvider),
  };
}

export async function setActiveLlmProviderAction(id: string) {
  const config = loadLlmConfig();
  if (!config.providers.some((provider) => provider.id === id)) {
    throw new Error("Unknown model provider.");
  }
  const saved = saveLlmConfig({ ...config, activeProviderId: id });
  revalidateChat();
  return {
    activeProviderId: saved.activeProviderId,
    providers: saved.providers.map(toPublicProvider),
  };
}

export async function connectLlmProviderAction(input: {
  id?: string;
  name: string;
  kind: LlmProvider["kind"];
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<{
  ok: true;
  providers: LlmProviderPublic[];
  activeProviderId: string;
  models: RemoteModel[];
  model: string;
  listError: string | null;
  modelNote: string | null;
}> {
  const id = input.id?.trim() || crypto.randomUUID();
  await saveLlmProviderAction({
    id,
    name: input.name.trim() || "Model",
    kind: input.kind,
    baseUrl: input.baseUrl,
    model: input.model,
    apiKey: input.apiKey,
  });
  await setActiveLlmProviderAction(id);
  let models: RemoteModel[] = [];
  let listError: string | null = null;
  let model = input.model.trim();
  let modelNote: string | null = null;
  try {
    models = await listProviderModelsAction(id);
    const resolved = resolveListedModel(model, models);
    modelNote = resolved.note ?? null;
    if (resolved.id && resolved.id !== model) {
      model = resolved.id;
    } else if (!model && models[0]) {
      model = models[0].id;
    }
    if (model) {
      const provider = getProvider(id);
      if (provider && provider.model !== model) {
        await saveLlmProviderAction({
          id,
          name: provider.name,
          kind: provider.kind,
          baseUrl: provider.baseUrl,
          model,
        });
      }
    }
  } catch (caught) {
    listError = caught instanceof Error ? caught.message : "Could not list models.";
  }
  const config = loadLlmConfig();
  return {
    ok: true,
    activeProviderId: id,
    providers: config.providers.map(toPublicProvider),
    models,
    model,
    listError,
    modelNote,
  };
}

export async function listProviderModelsAction(id: string): Promise<RemoteModel[]> {
  const provider = getProvider(id);
  if (!provider) throw new Error("Unknown model provider.");
  return listRemoteModels(provider);
}

export async function probeRemoteModelsAction(input: {
  providerId?: string;
  kind: LlmProvider["kind"];
  baseUrl: string;
  apiKey?: string;
}): Promise<RemoteModel[]> {
  const existing = input.providerId ? getProvider(input.providerId) : null;
  return listRemoteModels({
    kind: input.kind,
    baseUrl: input.baseUrl,
    apiKey: input.apiKey?.trim() || existing?.apiKey || "",
  });
}

export async function createChatAction(providerId?: string) {
  const conversation = await createConversation(providerId);
  revalidatePath("/chat");
  return conversation;
}

export async function deleteChatAction(id: string) {
  await deleteConversation(id);
  revalidatePath("/chat");
}

export async function searchChatMentionsAction(
  kind: "file" | "folder",
  query: string,
) {
  return kind === "folder" ? searchChatFolders(query) : searchChatFiles(query);
}
