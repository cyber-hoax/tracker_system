import { describe, expect, it } from "vitest";
import { parsePropertyValue } from "./values";

describe("parsePropertyValue Pattern list", () => {
  it("stores hashmap and hash table as one pattern", () => {
    expect(
      parsePropertyValue(
        "wikilink_list",
        ["hashmap", "array", "hash table"],
        "Pattern",
      ),
    ).toEqual(["hash table", "array"]);
  });
});
