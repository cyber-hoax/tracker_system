import { describe, expect, it } from "vitest";
import {
  normalizeBaseUrl,
  parseConnectionPaste,
  parseLlmConfig,
} from "./config";
import { parseAnthropicSseData, parseOpenAiSseData } from "./sse";

describe("normalizeBaseUrl", () => {
  it("adds /v1 for local and OpenAI endpoints", () => {
    expect(normalizeBaseUrl("http://127.0.0.1:11434", "local")).toBe(
      "http://127.0.0.1:11434/v1",
    );
    expect(normalizeBaseUrl("https://api.openai.com/v1/", "openai")).toBe(
      "https://api.openai.com/v1",
    );
  });

  it("keeps Anthropic without a trailing /v1", () => {
    expect(normalizeBaseUrl("https://api.anthropic.com/v1", "anthropic")).toBe(
      "https://api.anthropic.com",
    );
  });
});

describe("parseLlmConfig", () => {
  it("seeds Ollama when empty", () => {
    const config = parseLlmConfig(null);
    expect(config.providers.some((provider) => provider.id === "ollama")).toBe(
      true,
    );
    expect(config.activeProviderId).toBe("ollama");
  });

  it("keeps a custom local provider", () => {
    const config = parseLlmConfig({
      activeProviderId: "home",
      providers: [
        {
          id: "home",
          name: "Homebox",
          kind: "local",
          baseUrl: "http://192.168.1.20:11434",
          apiKey: "",
          model: "qwen2.5",
        },
      ],
    });
    expect(config.providers[0].baseUrl).toBe("http://192.168.1.20:11434/v1");
    expect(config.providers[0].model).toBe("qwen2.5");
  });
});

describe("parseConnectionPaste", () => {
  it("reads an OmniRoute URL + key block", () => {
    const parsed = parseConnectionPaste(
      "Base URL: http://127.0.0.1:20128/v1\nAPI Key: omr_live_abc123",
    );
    expect(parsed.baseUrl).toBe("http://127.0.0.1:20128/v1");
    expect(parsed.apiKey).toBe("omr_live_abc123");
    expect(parsed.name).toBe("OmniRoute");
    expect(parsed.kind).toBe("openai");
  });

  it("guesses Unsloth from a sk-unsloth key", () => {
    const parsed = parseConnectionPaste("sk-unsloth-local-test-key-123456");
    expect(parsed.apiKey).toBe("sk-unsloth-local-test-key-123456");
    expect(parsed.baseUrl).toBe("http://127.0.0.1:8888/v1");
    expect(parsed.name).toBe("Unsloth (local)");
  });

  it("treats a pasted token as the API key", () => {
    const parsed = parseConnectionPaste("just-a-long-enough-token");
    expect(parsed.apiKey).toBe("just-a-long-enough-token");
  });

  it("does not assume a sk- OmniRoute key is OpenAI", () => {
    const parsed = parseConnectionPaste("sk-abcdef1234567890-zzzzzz-yyyyyyyy");
    expect(parsed.apiKey).toBe("sk-abcdef1234567890-zzzzzz-yyyyyyyy");
    expect(parsed.baseUrl).toBeUndefined();
    expect(parsed.name).toBeUndefined();
  });
});

describe("SSE parsers", () => {
  it("reads OpenAI-compatible deltas", () => {
    expect(
      parseOpenAiSseData(
        JSON.stringify({ choices: [{ delta: { content: "Hi" } }] }),
      ),
    ).toEqual({ text: "Hi", reasoning: "" });
    expect(parseOpenAiSseData("[DONE]")).toEqual({ text: "", reasoning: "" });
  });

  it("reads reasoning_content from OpenAI-compatible streams", () => {
    expect(
      parseOpenAiSseData(
        JSON.stringify({
          choices: [{ delta: { reasoning_content: "hmm" } }],
        }),
      ),
    ).toEqual({ text: "", reasoning: "hmm" });
  });

  it("reads Anthropic text deltas", () => {
    expect(
      parseAnthropicSseData(
        JSON.stringify({
          type: "content_block_delta",
          delta: { type: "text_delta", text: "Yo" },
        }),
      ),
    ).toEqual({ text: "Yo", reasoning: "" });
  });
});
