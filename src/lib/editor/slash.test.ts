import { describe, expect, it } from "vitest";
import { applySlashCommand, filterSlashCommands, SLASH_COMMANDS } from "./slash";

describe("filterSlashCommands", () => {
  it("returns every command for an empty query", () => {
    expect(filterSlashCommands("").map((item) => item.label)).toEqual([
      "To-do List",
      "Bullet List",
      "Numbered List",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Quote",
      "Divider",
      "Code Block",
    ]);
  });

  it("filters by label and aliases as the user types after /", () => {
    expect(filterSlashCommands("head").map((item) => item.label)).toEqual([
      "Heading 1",
      "Heading 2",
      "Heading 3",
    ]);
    expect(filterSlashCommands("to").map((item) => item.id)).toEqual(["todo"]);
    expect(filterSlashCommands("code").map((item) => item.id)).toEqual(["code"]);
  });
});

describe("applySlashCommand", () => {
  it("strips the slash query and converts the block", () => {
    const command = SLASH_COMMANDS.find((item) => item.id === "heading1");
    if (!command) throw new Error("missing heading1");
    const result = applySlashCommand(
      { id: "a", type: "paragraph", text: "/h1 leftover" },
      command,
    );
    expect(result.block).toMatchObject({
      type: "heading1",
      text: "leftover",
    });
    expect(result.extra).toBeUndefined();
  });

  it("inserts an empty paragraph after a divider", () => {
    const command = SLASH_COMMANDS.find((item) => item.id === "divider");
    if (!command) throw new Error("missing divider");
    const result = applySlashCommand(
      { id: "a", type: "paragraph", text: "/" },
      command,
      () => "extra",
    );
    expect(result.block.type).toBe("divider");
    expect(result.extra).toEqual({ id: "extra", type: "paragraph", text: "" });
  });

  it("creates a fenced code block", () => {
    const command = SLASH_COMMANDS.find((item) => item.id === "code");
    if (!command) throw new Error("missing code");
    const result = applySlashCommand(
      { id: "a", type: "paragraph", text: "/code" },
      command,
    );
    expect(result.block).toMatchObject({
      type: "code",
      text: "",
      language: "",
    });
  });
});
