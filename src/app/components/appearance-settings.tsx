"use client";

import { useState, useTransition } from "react";
import {
  updateAppNameAction,
  updateAppearanceAction,
} from "@/app/actions/appearance";
import {
  appearanceForColorTheme,
  appearanceForFontTheme,
  CODE_THEME_LABELS,
  CODE_THEMES,
  COLOR_THEME_LABELS,
  COLOR_THEMES,
  FONT_THEME_LABELS,
  FONT_THEMES,
  STUDIO_COLOR_THEMES,
  type AppearanceSettings,
  type MarkdownTweaks,
} from "@/lib/appearance";

const STUDIO_COLOR = new Set<string>(STUDIO_COLOR_THEMES);
const CLASSIC_COLOR_THEMES = COLOR_THEMES.filter(
  (theme) => !STUDIO_COLOR.has(theme),
);
const STUDIO_CODE_THEMES = ["struck", "tensegrity", "inkdrop", "inkdrop-light"] as const;
const STUDIO_CODE = new Set<string>(STUDIO_CODE_THEMES);
const CLASSIC_CODE_THEMES = CODE_THEMES.filter((theme) => !STUDIO_CODE.has(theme));

const MD_FIELDS: { key: keyof MarkdownTweaks; label: string; hint: string }[] = [
  { key: "h1Color", label: "H1 color", hint: "#cdd6f4" },
  { key: "h1Font", label: "H1 font", hint: "Georgia, serif" },
  { key: "h2Color", label: "H2 color", hint: "" },
  { key: "h2Font", label: "H2 font", hint: "" },
  { key: "h3Color", label: "H3 color", hint: "" },
  { key: "h3Font", label: "H3 font", hint: "" },
  { key: "paragraphColor", label: "Paragraph color", hint: "" },
  { key: "paragraphFont", label: "Body font", hint: "" },
  { key: "inlineCodeColor", label: "Inline code color", hint: "" },
  { key: "inlineCodeBg", label: "Inline code background", hint: "" },
  { key: "inlineCodeFont", label: "Inline code font", hint: "" },
  { key: "codeBlockColor", label: "Code block color", hint: "" },
  { key: "codeBlockBg", label: "Code block background", hint: "" },
  { key: "codeBlockFont", label: "Code block font", hint: "" },
  { key: "blockquoteColor", label: "Blockquote color", hint: "" },
  { key: "linkColor", label: "Link color", hint: "" },
  { key: "listColor", label: "List color", hint: "" },
];

export function AppearanceSettings({
  appName,
  initial,
}: {
  appName: string;
  initial: AppearanceSettings;
}) {
  const [name, setName] = useState(appName);
  const [appearance, setAppearance] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  function persist(next: AppearanceSettings) {
    setAppearance(next);
    startTransition(async () => {
      await updateAppearanceAction(next);
      setSaved("Saved");
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          App name
        </h2>
        <p className="text-sm text-ctp-subtext0">
          Shown at the top of the sidebar. Click the title there to rename, or
          save it here.
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await updateAppNameAction(name);
              setSaved("Saved");
            });
          }}
        >
          <label className="min-w-0 flex-1 space-y-1">
            <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
              Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="bg-ctp-mauve px-3 py-2 font-mono text-xs text-ctp-crust disabled:opacity-50"
          >
            Save name
          </button>
        </form>
      </section>

      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Color theme
        </h2>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
            Preset
          </span>
          <select
            value={appearance.colorTheme}
            onChange={(event) =>
              persist(
                appearanceForColorTheme(
                  appearance,
                  event.target.value as AppearanceSettings["colorTheme"],
                ),
              )
            }
            className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
          >
            <optgroup label="Studio">
              {STUDIO_COLOR_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {COLOR_THEME_LABELS[theme]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Classic">
              {CLASSIC_COLOR_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {COLOR_THEME_LABELS[theme]}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </section>

      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Code block theme
        </h2>
        <p className="text-sm text-ctp-subtext0">
          Syntax colors for fenced code. Independent of the app color theme;
          you can also change this from a code block on a note.
        </p>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
            Preset
          </span>
          <select
            value={appearance.codeTheme}
            onChange={(event) =>
              persist({
                ...appearance,
                codeTheme: event.target.value as AppearanceSettings["codeTheme"],
              })
            }
            className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
          >
            <optgroup label="Studio">
              {STUDIO_CODE_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {CODE_THEME_LABELS[theme]}
                </option>
              ))}
            </optgroup>
            <optgroup label="Classic">
              {CLASSIC_CODE_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {CODE_THEME_LABELS[theme]}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </section>

      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Font theme
        </h2>
        <label className="block space-y-1">
          <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
            Preset
          </span>
          <select
            value={appearance.fontTheme}
            onChange={(event) =>
              persist(
                appearanceForFontTheme(
                  appearance,
                  event.target.value as AppearanceSettings["fontTheme"],
                ),
              )
            }
            className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
          >
            {FONT_THEMES.map((theme) => (
              <option key={theme} value={theme}>
                {FONT_THEME_LABELS[theme]}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["uiFont", "UI font"],
            ["bodyFont", "Markdown / body font"],
            ["monoFont", "Mono font"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1">
            <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
              {label}
            </span>
            <input
              value={appearance[key]}
              onChange={(event) =>
                setAppearance({ ...appearance, [key]: event.target.value })
              }
              onBlur={() => persist({ ...appearance, fontTheme: "custom" })}
              className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 font-mono text-xs"
            />
          </label>
        ))}
      </section>

      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Markdown tweaks
        </h2>
        <p className="text-sm text-ctp-subtext0">
          CSS colors or font-family values applied to{" "}
          <span className="font-mono text-ctp-text">.markdown</span> note bodies.
          Leave blank to inherit the theme.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MD_FIELDS.map((field) => (
            <label key={field.key} className="block space-y-1">
              <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
                {field.label}
              </span>
              <input
                value={appearance.markdown[field.key]}
                placeholder={field.hint}
                onChange={(event) =>
                  setAppearance({
                    ...appearance,
                    markdown: {
                      ...appearance.markdown,
                      [field.key]: event.target.value,
                    },
                  })
                }
                onBlur={() => persist(appearance)}
                className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 font-mono text-xs"
              />
            </label>
          ))}
        </div>
      </section>
      {saved ? (
        <p className="font-mono text-xs text-ctp-green">{pending ? "Saving…" : saved}</p>
      ) : null}
    </div>
  );
}
