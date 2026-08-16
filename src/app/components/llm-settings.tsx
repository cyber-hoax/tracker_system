"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  connectLlmProviderAction,
  deleteLlmProviderAction,
  listProviderModelsAction,
  probeRemoteModelsAction,
  saveLlmProviderAction,
  setActiveLlmProviderAction,
} from "@/app/actions/llm";
import { LLM_PRESETS, parseConnectionPaste } from "@/lib/llm/config";
import { resolveListedModel, type RemoteModel } from "@/lib/llm/models";
import type { LlmKind, LlmProviderPublic } from "@/lib/llm/types";

const inputClass =
  "w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm";
const labelClass = "block space-y-1";
const hintClass = "font-mono text-[10px] uppercase text-ctp-overlay0";

export function LlmSettings({
  initial,
}: {
  initial: { activeProviderId: string; providers: LlmProviderPublic[] };
}) {
  const [activeProviderId, setActiveProviderId] = useState(initial.activeProviderId);
  const [providers, setProviders] = useState(initial.providers);
  const first =
    initial.providers.find((item) => item.id === initial.activeProviderId) ??
    initial.providers[0];
  const [selectedId, setSelectedId] = useState(first?.id ?? "");
  const [name, setName] = useState(first?.name ?? "");
  const [kind, setKind] = useState<LlmKind>(first?.kind ?? "local");
  const [baseUrl, setBaseUrl] = useState(first?.baseUrl ?? "http://127.0.0.1:11434/v1");
  const [model, setModel] = useState(first?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [paste, setPaste] = useState("");
  const [models, setModels] = useState<RemoteModel[]>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  const selected = providers.find((item) => item.id === selectedId);
  const needsKey = kind !== "local";
  const visibleModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) return models;
    return models.filter(
      (item) =>
        item.id.toLowerCase().includes(query) ||
        item.label.toLowerCase().includes(query) ||
        item.ownedBy.toLowerCase().includes(query),
    );
  }, [models, modelQuery]);
  const modelGroups = useMemo(() => {
    const groups = new Map<string, RemoteModel[]>();
    for (const item of visibleModels) {
      const list = groups.get(item.ownedBy) ?? [];
      list.push(item);
      groups.set(item.ownedBy, list);
    }
    return [...groups.entries()];
  }, [visibleModels]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (needsKey && !apiKey.trim() && !selected?.hasKey) {
        setModels([]);
        return;
      }
      startTransition(async () => {
        try {
          const next =
            selectedId && !apiKey.trim()
              ? await listProviderModelsAction(selectedId)
              : await probeRemoteModelsAction({
                  providerId: selectedId || undefined,
                  kind,
                  baseUrl,
                  apiKey,
                });
          setModels(next);
          if (model.trim() && next.length > 0) {
            const resolved = resolveListedModel(model, next);
            if (resolved.id !== model) setModel(resolved.id);
          }
        } catch {
          setModels([]);
        }
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [selectedId, apiKey, baseUrl, kind, needsKey, selected?.hasKey]);

  function loadIntoForm(provider: LlmProviderPublic) {
    setSelectedId(provider.id);
    setName(provider.name);
    setKind(provider.kind);
    setBaseUrl(provider.baseUrl);
    setModel(provider.model);
    setApiKey("");
    setPaste("");
    setModels([]);
    setModelQuery("");
  }

  function applyPreset(id: string) {
    const preset = LLM_PRESETS.find((item) => item.id === id);
    if (!preset) return;
    setName(preset.name);
    setKind(preset.kind);
    setBaseUrl(preset.baseUrl);
    setModel(preset.model);
    setApiKey("");
    setPaste("");
    setSelectedId("");
    setModels([]);
    setModelQuery("");
    setStatus(`Paste the ${preset.name} API key, then Connect.`);
    setError(false);
  }

  function applyPaste(raw: string) {
    setPaste(raw);
    const parsed = parseConnectionPaste(raw);
    if (parsed.name) setName(parsed.name);
    if (parsed.kind) setKind(parsed.kind);
    if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
    if (parsed.model) setModel(parsed.model);
    if (parsed.apiKey) setApiKey(parsed.apiKey);
  }

  function persist(asNew: boolean) {
    setError(false);
    startTransition(async () => {
      try {
        const result = await saveLlmProviderAction({
          id: asNew || !selectedId ? crypto.randomUUID() : selectedId,
          name,
          kind,
          baseUrl,
          model,
          apiKey,
        });
        setProviders(result.providers);
        setActiveProviderId(result.activeProviderId);
        const next =
          result.providers.find((item) => item.name === name) ??
          result.providers.at(-1);
        if (next) loadIntoForm(next);
        setStatus("Saved. Keys stay on this machine.");
      } catch (caught) {
        setError(true);
        setStatus(caught instanceof Error ? caught.message : "Could not save");
      }
    });
  }

  function connect() {
    if (!name.trim()) {
      setError(true);
      setStatus("Give this connection a name.");
      return;
    }
    if (needsKey && !apiKey.trim() && !selected?.hasKey) {
      setError(true);
      setStatus("Paste an API key to connect.");
      return;
    }
    setError(false);
    startTransition(async () => {
      try {
        const result = await connectLlmProviderAction({
          id: selectedId || crypto.randomUUID(),
          name,
          kind,
          baseUrl,
          model,
          apiKey,
        });
        setProviders(result.providers);
        setActiveProviderId(result.activeProviderId);
        setSelectedId(result.activeProviderId);
        setModel(result.model);
        setApiKey("");
        setPaste("");
        setModels(result.models);
        if (result.listError) {
          setError(true);
          setStatus(
            `Saved as default, but models did not load: ${result.listError}`,
          );
          return;
        }
        setStatus(
          result.modelNote ||
            (result.models.length
              ? `Connected. ${result.models.length} model${
                  result.models.length === 1 ? "" : "s"
                } available${result.model ? ` · using ${result.model}` : ""}.`
              : "Connected. Type a model name if the server does not list them."),
        );
      } catch (caught) {
        setError(true);
        setStatus(caught instanceof Error ? caught.message : "Could not connect");
      }
    });
  }

  return (
    <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
      <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
        Models &amp; API keys
      </h2>
      <p className="text-sm text-ctp-subtext0">
        Pick a provider, paste the API key (or the whole URL + key block), and
        Connect. OmniRoute, Unsloth, OpenRouter, and local servers all work.
        Keys stay on this Mac, not in git.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {LLM_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="rounded-full border border-ctp-surface1 px-3 py-1 text-xs text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text"
            onClick={() => applyPreset(preset.id)}
          >
            {preset.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <ul className="space-y-1">
          {providers.map((provider) => {
            const active = provider.id === activeProviderId;
            const open = provider.id === selectedId;
            return (
              <li key={provider.id}>
                <button
                  type="button"
                  onClick={() => loadIntoForm(provider)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm ${
                    open ? "bg-ctp-surface0 text-ctp-text" : "text-ctp-subtext0 hover:bg-ctp-surface0/70"
                  }`}
                >
                  <span className="block truncate">{provider.name}</span>
                  <span className="font-mono text-[10px] text-ctp-overlay0">
                    {provider.kind}
                    {active ? " · default" : ""}
                    {provider.hasKey ? "" : " · no key"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            connect();
          }}
        >
          <label className={labelClass}>
            <span className={hintClass}>Paste key or connection</span>
            <textarea
              className={`${inputClass} min-h-20 font-mono text-xs`}
              value={paste}
              onChange={(event) => applyPaste(event.target.value)}
              placeholder="sk-… or&#10;Base URL: http://127.0.0.1:20128/v1&#10;API Key: …"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className={labelClass}>
            <span className={hintClass}>Name</span>
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="OmniRoute"
            />
          </label>
          <label className={labelClass}>
            <span className={hintClass}>
              API key {needsKey ? "" : "(optional)"}
            </span>
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={selected?.hasKey ? "unchanged" : "sk-…"}
            />
          </label>
          <label className={labelClass}>
            <span className={hintClass}>Model</span>
            <input
              className={inputClass}
              value={modelQuery}
              onChange={(event) => setModelQuery(event.target.value)}
              placeholder={
                models.length
                  ? `Filter ${models.length} models`
                  : "Prefetching models…"
              }
            />
            <select
              className={inputClass}
              value={models.some((item) => item.id === model) ? model : ""}
              onChange={(event) => setModel(event.target.value)}
              size={Math.min(12, Math.max(6, modelGroups.length ? 10 : 6))}
            >
              <option value="">
                {models.length
                  ? "Select a catalog id (provider/model)"
                  : "No models yet — paste a key or Connect"}
              </option>
              {modelGroups.map(([owner, items]) => (
                <optgroup key={owner} label={owner}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.id === item.label ? item.id : `${item.id} — ${item.label}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <input
              className={inputClass}
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="cursor/grok-4.5-high"
            />
          </label>
          <details className="rounded-xl border border-ctp-surface0 px-3 py-2">
            <summary className="cursor-pointer font-mono text-[10px] uppercase text-ctp-overlay0">
              Advanced — kind &amp; base URL
            </summary>
            <div className="mt-3 space-y-3">
              <label className={labelClass}>
                <span className={hintClass}>Kind</span>
                <select
                  className={inputClass}
                  value={kind}
                  onChange={(event) => setKind(event.target.value as LlmKind)}
                >
                  <option value="local">Local (Ollama / LM Studio / llama.cpp)</option>
                  <option value="openai">
                    OpenAI-compatible (OmniRoute, Unsloth, OpenRouter, Groq)
                  </option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </label>
              <label className={labelClass}>
                <span className={hintClass}>Base URL</span>
                <input
                  className={inputClass}
                  value={baseUrl}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="http://127.0.0.1:20128/v1"
                />
              </label>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-ctp-mauve px-3 py-2 font-mono text-xs text-ctp-crust disabled:opacity-50"
            >
              Connect
            </button>
            <button
              type="button"
              disabled={pending}
              className="px-3 py-2 font-mono text-xs text-ctp-blue"
              onClick={() => persist(true)}
            >
              Save as new
            </button>
            {selectedId ? (
              <>
                <button
                  type="button"
                  className="px-3 py-2 font-mono text-xs text-ctp-green"
                  onClick={() => {
                    startTransition(async () => {
                      await setActiveLlmProviderAction(selectedId);
                      setActiveProviderId(selectedId);
                      setStatus("Default model updated.");
                      setError(false);
                    });
                  }}
                >
                  Use as default
                </button>
                <button
                  type="button"
                  className="px-3 py-2 font-mono text-xs text-ctp-subtext0"
                  onClick={() => {
                    startTransition(async () => {
                      try {
                        const next = await listProviderModelsAction(selectedId);
                        setModels(next);
                        if (model.trim() && next.length > 0) {
                          const resolved = resolveListedModel(model, next);
                          if (resolved.id !== model) setModel(resolved.id);
                        }
                        setStatus(
                          next.length
                            ? `Found ${next.length} model${next.length === 1 ? "" : "s"}.`
                            : "No models listed. Is the local server running?",
                        );
                        setError(next.length === 0);
                      } catch (caught) {
                        setError(true);
                        setStatus(
                          caught instanceof Error
                            ? caught.message
                            : "Could not list models",
                        );
                      }
                    });
                  }}
                >
                  List models
                </button>
                <button
                  type="button"
                  className="px-3 py-2 font-mono text-xs text-ctp-red"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await deleteLlmProviderAction(selectedId);
                      setProviders(result.providers);
                      setActiveProviderId(result.activeProviderId);
                      const next = result.providers[0];
                      if (next) loadIntoForm(next);
                      setStatus("Removed.");
                    });
                  }}
                >
                  Remove
                </button>
              </>
            ) : null}
          </div>
          {status ? (
            <p className={`text-[13px] ${error ? "text-ctp-red" : "text-ctp-green"}`}>
              {status}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
