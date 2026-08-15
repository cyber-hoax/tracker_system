import { describe, expect, it } from "vitest";
import {
  appearanceForFontTheme,
  appearanceStyle,
  defaultAppearance,
  parseAppearance,
} from "./appearance";

describe("parseAppearance", () => {
  it("defaults to Catppuccin Mocha and JetBrains Mono", () => {
    const parsed = parseAppearance(null);
    expect(parsed.colorTheme).toBe("mocha");
    expect(parsed.fontTheme).toBe("jetbrains");
    expect(parsed.codeTheme).toBe("mocha");
  });

  it("keeps known code themes independent of the app color theme", () => {
    expect(
      parseAppearance({ colorTheme: "latte", codeTheme: "dracula" }).codeTheme,
    ).toBe("dracula");
    expect(parseAppearance({ codeTheme: "solarized" }).codeTheme).toBe("mocha");
  });

  it("keeps known themes and ignores unknown keys for color", () => {
    expect(
      parseAppearance({ colorTheme: "latte", fontTheme: "serif" }).colorTheme,
    ).toBe("latte");
    expect(parseAppearance({ colorTheme: "solarized" }).colorTheme).toBe("mocha");
  });
});

describe("appearanceStyle", () => {
  it("emits font CSS variables and only set markdown overrides", () => {
    const style = appearanceStyle({
      ...defaultAppearance(),
      markdown: {
        ...defaultAppearance().markdown,
        h1Color: "#f38ba8",
        inlineCodeBg: "#313244",
      },
    });
    expect(style["--font-ui"]).toContain("jetbrains");
    expect(style["--md-h1-color"]).toBe("#f38ba8");
    expect(style["--md-code-bg"]).toBe("#313244");
    expect(style["--md-h2-color"]).toBeUndefined();
  });
});

describe("appearanceForFontTheme", () => {
  it("fills Inter stacks when switching away from custom", () => {
    const next = appearanceForFontTheme(defaultAppearance(), "inter");
    expect(next.fontTheme).toBe("inter");
    expect(next.uiFont).toContain("--font-inter");
    expect(next.monoFont).toContain("--font-jetbrains-mono");
  });
});
