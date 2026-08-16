import { describe, expect, it } from "vitest";
import {
  insertMention,
  mentionQueryAt,
  mentionsStillInText,
} from "./chat-mentions";

describe("mentionQueryAt", () => {
  it("picks up @file queries", () => {
    expect(mentionQueryAt("see @two", 8)).toEqual({
      trigger: "@",
      query: "two",
      start: 4,
      end: 8,
    });
  });

  it("picks up /folder queries", () => {
    expect(mentionQueryAt("open /DSA", 9)).toEqual({
      trigger: "/",
      query: "DSA",
      start: 5,
      end: 9,
    });
  });

  it("ignores http:// slashes", () => {
    expect(mentionQueryAt("http://example.com", 18)).toBeNull();
  });
});

describe("insertMention", () => {
  it("replaces the draft token", () => {
    const next = insertMention("see @two", {
      trigger: "@",
      query: "two",
      start: 4,
      end: 8,
    }, "Two Sum");
    expect(next.text).toBe("see @Two Sum ");
    expect(next.cursor).toBe(13);
  });
});

describe("mentionsStillInText", () => {
  it("drops deleted tokens", () => {
    expect(
      mentionsStillInText("see @Two Sum", [
        { kind: "file", id: "1", label: "Two Sum" },
        { kind: "folder", id: "2", label: "DSA" },
      ]),
    ).toEqual([{ kind: "file", id: "1", label: "Two Sum" }]);
  });
});
