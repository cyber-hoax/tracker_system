import { describe, expect, it } from "vitest";
import { parseChatMarkdown } from "./chat-markdown";

describe("parseChatMarkdown", () => {
  it("parses headings, lists, fences, and tables", () => {
    const md = [
      "### Idea",
      "",
      "Use **counting**.",
      "",
      "| position | choices |",
      "|---|---|",
      "| 1st digit | 9 |",
      "",
      "```cpp",
      "int n = 0;",
      "```",
    ].join("\n");

    expect(parseChatMarkdown(md)).toEqual([
      { type: "heading", level: 3, text: "Idea" },
      { type: "paragraph", text: "Use **counting**." },
      {
        type: "table",
        headers: ["position", "choices"],
        rows: [["1st digit", "9"]],
      },
      { type: "code", language: "cpp", text: "int n = 0;" },
    ]);
  });
});
