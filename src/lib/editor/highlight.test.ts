import { describe, expect, it } from "vitest";
import { highlightCode } from "./highlight";

describe("highlightCode", () => {
  it("wraps javascript keywords without using the filesystem", () => {
    const html = highlightCode("const x = 1;", "javascript");
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("const");
  });

  it("highlights c++ fences used in vault notes", () => {
    const html = highlightCode("int mid = 0;", "c++");
    expect(html).toContain("int");
    expect(html).toContain("hljs-");
  });
});
