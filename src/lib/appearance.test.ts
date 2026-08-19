import { describe, expect, it } from "vitest";
import {
  appearanceForColorTheme,
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
    expect(parseAppearance({ colorTheme: "kanagawa" }).colorTheme).toBe(
      "kanagawa",
    );
    expect(parseAppearance({ codeTheme: "kanagawa" }).codeTheme).toBe(
      "kanagawa",
    );
    expect(
      parseAppearance({
        colorTheme: "kanagawa-dragon",
        codeTheme: "kanagawa-dragon",
      }).colorTheme,
    ).toBe("kanagawa-dragon");
    expect(
      parseAppearance({ codeTheme: "kanagawa-dragon" }).codeTheme,
    ).toBe("kanagawa-dragon");
    expect(parseAppearance({ colorTheme: "struck" }).colorTheme).toBe("struck");
    expect(parseAppearance({ colorTheme: "tensegrity" }).colorTheme).toBe(
      "tensegrity",
    );
    expect(
      parseAppearance({ colorTheme: "tensegrity-light" }).colorTheme,
    ).toBe("tensegrity-light");
    expect(parseAppearance({ colorTheme: "inkdrop" }).colorTheme).toBe(
      "inkdrop",
    );
    expect(parseAppearance({ colorTheme: "inkdrop-light" }).colorTheme).toBe(
      "inkdrop-light",
    );
  });
});

describe("appearanceForColorTheme", () => {
  it("pairs studio palettes with their code themes", () => {
    expect(appearanceForColorTheme(defaultAppearance(), "struck").codeTheme).toBe(
      "struck",
    );
    expect(
      appearanceForColorTheme(defaultAppearance(), "tensegrity-light")
        .codeTheme,
    ).toBe("tensegrity");
    expect(appearanceForColorTheme(defaultAppearance(), "mocha").codeTheme).toBe(
      "mocha",
    );
    expect(appearanceForColorTheme(defaultAppearance(), "mocha").fontTheme).toBe(
      "jetbrains",
    );
  });

  it("pairs Inkdrop with Inter and the Inkdrop code theme", () => {
    const next = appearanceForColorTheme(defaultAppearance(), "inkdrop");
    expect(next.colorTheme).toBe("inkdrop");
    expect(next.fontTheme).toBe("inter");
    expect(next.codeTheme).toBe("inkdrop");
    expect(next.uiFont).toContain("--font-inter");
  });

  it("pairs Inkdrop Light with Inter and the light Inkdrop code theme", () => {
    const next = appearanceForColorTheme(defaultAppearance(), "inkdrop-light");
    expect(next.colorTheme).toBe("inkdrop-light");
    expect(next.fontTheme).toBe("inter");
    expect(next.codeTheme).toBe("inkdrop-light");
    expect(next.uiFont).toContain("--font-inter");
  });

  it("does not revert font when switching to mocha", () => {
    const inkdrop = appearanceForColorTheme(defaultAppearance(), "inkdrop");
    const mocha = appearanceForColorTheme(inkdrop, "mocha");
    expect(mocha.colorTheme).toBe("mocha");
    expect(mocha.fontTheme).toBe("inter");
    expect(mocha.uiFont).toContain("--font-inter");
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
