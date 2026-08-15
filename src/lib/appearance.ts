export const COLOR_THEMES = [
  "mocha",
  "macchiato",
  "frappe",
  "latte",
  "one-dark",
  "github-dark",
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

export const FONT_THEMES = [
  "jetbrains",
  "inter",
  "system",
  "serif",
  "custom",
] as const;

export type FontTheme = (typeof FONT_THEMES)[number];

export const CODE_THEMES = [
  "mocha",
  "one-dark",
  "github-dark",
  "dracula",
  "nord",
  "latte",
] as const;

export type CodeTheme = (typeof CODE_THEMES)[number];

export type MarkdownTweaks = {
  h1Color: string;
  h2Color: string;
  h3Color: string;
  h1Font: string;
  h2Font: string;
  h3Font: string;
  paragraphColor: string;
  paragraphFont: string;
  inlineCodeColor: string;
  inlineCodeBg: string;
  inlineCodeFont: string;
  codeBlockColor: string;
  codeBlockBg: string;
  codeBlockFont: string;
  blockquoteColor: string;
  linkColor: string;
  listColor: string;
};

export type AppearanceSettings = {
  colorTheme: ColorTheme;
  fontTheme: FontTheme;
  codeTheme: CodeTheme;
  uiFont: string;
  bodyFont: string;
  monoFont: string;
  markdown: MarkdownTweaks;
};

export const COLOR_THEME_LABELS: Record<ColorTheme, string> = {
  mocha: "Catppuccin Mocha",
  macchiato: "Catppuccin Macchiato",
  frappe: "Catppuccin Frappé",
  latte: "Catppuccin Latte",
  "one-dark": "One Dark",
  "github-dark": "GitHub Dark",
};

export const FONT_THEME_LABELS: Record<FontTheme, string> = {
  jetbrains: "JetBrains Mono",
  inter: "Inter",
  system: "System",
  serif: "Iowan / serif",
  custom: "Custom",
};

export const CODE_THEME_LABELS: Record<CodeTheme, string> = {
  mocha: "Catppuccin Mocha",
  "one-dark": "One Dark",
  "github-dark": "GitHub Dark",
  dracula: "Dracula",
  nord: "Nord",
  latte: "Catppuccin Latte",
};

const FONT_PRESETS: Record<
  Exclude<FontTheme, "custom">,
  Pick<AppearanceSettings, "uiFont" | "bodyFont" | "monoFont">
> = {
  jetbrains: {
    uiFont: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    bodyFont: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    monoFont: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  inter: {
    uiFont: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
    bodyFont: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
    monoFont: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  system: {
    uiFont: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    bodyFont: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    monoFont: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  serif: {
    uiFont: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    bodyFont: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    monoFont: 'var(--font-jetbrains-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
};

const EMPTY_MARKDOWN: MarkdownTweaks = {
  h1Color: "",
  h2Color: "",
  h3Color: "",
  h1Font: "",
  h2Font: "",
  h3Font: "",
  paragraphColor: "",
  paragraphFont: "",
  inlineCodeColor: "",
  inlineCodeBg: "",
  inlineCodeFont: "",
  codeBlockColor: "",
  codeBlockBg: "",
  codeBlockFont: "",
  blockquoteColor: "",
  linkColor: "",
  listColor: "",
};

export const DEFAULT_APP_NAME = "Daily Routine";

export function defaultAppearance(): AppearanceSettings {
  return {
    colorTheme: "mocha",
    fontTheme: "jetbrains",
    codeTheme: "mocha",
    ...FONT_PRESETS.jetbrains,
    markdown: { ...EMPTY_MARKDOWN },
  };
}

function isColorTheme(value: unknown): value is ColorTheme {
  return COLOR_THEMES.includes(value as ColorTheme);
}

function isFontTheme(value: unknown): value is FontTheme {
  return FONT_THEMES.includes(value as FontTheme);
}

export function isCodeTheme(value: unknown): value is CodeTheme {
  return CODE_THEMES.includes(value as CodeTheme);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseAppearance(raw: unknown): AppearanceSettings {
  const defaults = defaultAppearance();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return defaults;
  const input = raw as Record<string, unknown>;
  const fontTheme = isFontTheme(input.fontTheme) ? input.fontTheme : defaults.fontTheme;
  const preset = fontTheme === "custom" ? null : FONT_PRESETS[fontTheme];
  const markdownRaw =
    input.markdown && typeof input.markdown === "object" && !Array.isArray(input.markdown)
      ? (input.markdown as Record<string, unknown>)
      : {};
  const markdown = { ...EMPTY_MARKDOWN };
  for (const key of Object.keys(EMPTY_MARKDOWN) as (keyof MarkdownTweaks)[]) {
    markdown[key] = asString(markdownRaw[key]);
  }
  return {
    colorTheme: isColorTheme(input.colorTheme) ? input.colorTheme : defaults.colorTheme,
    fontTheme,
    codeTheme: isCodeTheme(input.codeTheme) ? input.codeTheme : defaults.codeTheme,
    uiFont: asString(input.uiFont) || preset?.uiFont || defaults.uiFont,
    bodyFont: asString(input.bodyFont) || preset?.bodyFont || defaults.bodyFont,
    monoFont: asString(input.monoFont) || preset?.monoFont || defaults.monoFont,
    markdown,
  };
}

export function appearanceForFontTheme(
  current: AppearanceSettings,
  fontTheme: FontTheme,
): AppearanceSettings {
  if (fontTheme === "custom") {
    return { ...current, fontTheme };
  }
  return { ...current, fontTheme, ...FONT_PRESETS[fontTheme] };
}

function cssValue(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function appearanceStyle(appearance: AppearanceSettings): Record<string, string> {
  const style: Record<string, string> = {
    "--font-ui": appearance.uiFont,
    "--font-body": appearance.bodyFont,
    "--font-mono-stack": appearance.monoFont,
  };
  const md = appearance.markdown;
  const mapping: [string, string][] = [
    ["--md-h1-color", md.h1Color],
    ["--md-h2-color", md.h2Color],
    ["--md-h3-color", md.h3Color],
    ["--md-h1-font", md.h1Font],
    ["--md-h2-font", md.h2Font],
    ["--md-h3-font", md.h3Font],
    ["--md-p-color", md.paragraphColor],
    ["--md-font", md.paragraphFont],
    ["--md-code-color", md.inlineCodeColor],
    ["--md-code-bg", md.inlineCodeBg],
    ["--md-code-font", md.inlineCodeFont],
    ["--md-codeblock-color", md.codeBlockColor],
    ["--md-codeblock-bg", md.codeBlockBg],
    ["--md-codeblock-font", md.codeBlockFont],
    ["--md-quote-color", md.blockquoteColor],
    ["--md-link-color", md.linkColor],
    ["--md-list-color", md.listColor],
  ];
  for (const [key, value] of mapping) {
    const next = cssValue(value);
    if (next) style[key] = next;
  }
  return style;
}
