import { describe, expect, it } from "vitest";
import { parseModelCatalog, resolveListedModel } from "./models";

const catalog = parseModelCatalog({
  data: [
    { id: "cu/grok-4.3", name: "cu/Grok 4.3", owned_by: "cursor", root: "grok-4.3" },
    {
      id: "cursor/grok-4.3",
      name: "cursor/Grok 4.3",
      owned_by: "cursor",
      root: "grok-4.3",
      parent: "cu/grok-4.3",
    },
    {
      id: "cu/grok-4.5-high",
      name: "cu/Grok 4.5 High",
      owned_by: "cursor",
      root: "grok-4.5-high",
    },
    {
      id: "cursor/grok-4.5-high",
      name: "cursor/Grok 4.5 High",
      owned_by: "cursor",
      root: "grok-4.5-high",
      parent: "cu/grok-4.5-high",
    },
    {
      id: "cursor/grok-4.5-fast-high",
      name: "cursor/Grok 4.5 Fast High",
      owned_by: "cursor",
      root: "grok-4.5-fast-high",
    },
    { id: "auto/chat", owned_by: "combo", root: "auto/chat" },
  ],
});

describe("parseModelCatalog", () => {
  it("keeps the cursor/ id instead of the cu/ alias", () => {
    expect(catalog.some((model) => model.id === "cursor/grok-4.5-high")).toBe(true);
    expect(catalog.some((model) => model.id === "cu/grok-4.5-high")).toBe(false);
  });

  it("reads Ollama tag names as ids", () => {
    const models = parseModelCatalog({ models: [{ name: "llama3.2" }] });
    expect(models.map((model) => model.id)).toEqual(["llama3.2"]);
  });
});

describe("resolveListedModel", () => {
  it("maps a display name onto the prefixed catalog id", () => {
    expect(resolveListedModel("cursor Grok 4.5 High", catalog).id).toBe(
      "cursor/grok-4.5-high",
    );
  });

  it("falls back from missing Grok 4.6 to the closest Grok 4.5 id", () => {
    const resolved = resolveListedModel("cursor Grok 4.6", catalog);
    expect(resolved.id).toBe("cursor/grok-4.5-high");
    expect(resolved.note).toMatch(/not in the catalog/);
  });
});
