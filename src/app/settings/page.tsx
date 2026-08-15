import { connection } from "next/server";
import { ObsidianSyncButton } from "@/app/components/obsidian-sync-button";
import { LeetCodeSettings } from "@/app/components/leetcode-settings";
import {
  createPropertyDefAction,
  updatePropertyOptionsAction,
} from "@/app/actions/zettel";
import { DeleteDefButton } from "@/app/components/delete-def-button";
import { propertyValueTypes } from "@/db/schema";
import { getLeetCodeSettingsView } from "@/lib/leetcode";
import { trackerDirRel, vaultRoot } from "@/lib/obsidian";
import { listPropertyDefs } from "@/lib/zettel";
import { asStringArray } from "@/lib/zettel/values";
import { AppearanceSettings } from "@/app/components/appearance-settings";
import { getAppName, loadAppearance } from "@/lib/appearance-store";
import { TrashSnapshots } from "@/app/components/trash-snapshots";
import { listTrashSnapshots } from "@/lib/workspace/snapshots";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  await connection();
  const defs = await listPropertyDefs();
  const vault = vaultRoot();
  const trackerDir = trackerDirRel();
  const leetcode = getLeetCodeSettingsView();
  const appearance = loadAppearance();
  const appName = getAppName();
  const snapshots = await listTrashSnapshots();

  return (
    <main className="space-y-8">
      <section className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
          Appearance
        </p>
        <h1 className="mt-1 text-2xl text-ctp-text">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-ctp-subtext0">
          Color and font presets apply across the app. Code block themes are
          independent. Markdown tweaks target note bodies.
        </p>
        <AppearanceSettings appName={appName} initial={appearance} />
      </section>

      <TrashSnapshots snapshots={snapshots} />

      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Obsidian vault
        </h2>
        <p className="text-sm text-ctp-subtext0">
          Problems live in{" "}
          <span className="font-mono text-ctp-text">
            {trackerDir}/&lt;Title&gt;.md
          </span>
          ; pattern hubs in{" "}
          <span className="font-mono text-ctp-text">Patterns/&lt;name&gt;.md</span>.
          App saves rewrite those files. Use the button to pull edits from
          Obsidian.
        </p>
        <p className="font-mono text-xs text-ctp-overlay0">
          {vault ?? "OBSIDIAN_VAULT is not set"}
        </p>
        <ObsidianSyncButton />
      </section>

      <section className="space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          LeetCode
        </h2>
        <p className="text-sm text-ctp-subtext0">
          On first run the app pulls recent submissions, then polls hourly.
          Accepted submissions become Solved notes under{" "}
          <span className="font-mono text-ctp-text">
            {trackerDir}/&lt;Title&gt;.md
          </span>
          . Session cookie stays in{" "}
          <span className="font-mono text-ctp-text">.env.local</span>.
        </p>
        <LeetCodeSettings initial={leetcode} />
      </section>

      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
          Schema
        </p>
        <h2 className="mt-1 text-2xl text-ctp-text">Note properties</h2>
        <p className="mt-2 max-w-2xl text-sm text-ctp-subtext0">
          Add or remove property definitions. Removing a definition deletes every
          stored value (cascade). System fields stay hidden on the note editor
          but remain in the database for Obsidian sync.
        </p>
      </div>

      <section className="border border-ctp-surface0 bg-ctp-base">
        <ul className="divide-y divide-ctp-surface0">
          {defs.map((def) => {
            const options = asStringArray(def.options);
            const selectable =
              def.valueType === "select" || def.valueType === "multi_select";
            return (
              <li key={def.id} className="space-y-3 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-ctp-text">{def.key}</p>
                    <p className="font-mono text-xs text-ctp-overlay0">
                      {def.valueType}
                      {def.isSystem ? " · system" : ""}
                    </p>
                  </div>
                  {def.isSystem ? (
                    <span className="font-mono text-xs text-ctp-overlay0">
                      locked
                    </span>
                  ) : (
                    <DeleteDefButton id={def.id} label={def.key} />
                  )}
                </div>
                {selectable && !def.isSystem ? (
                  <form
                    action={updatePropertyOptionsAction}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <input type="hidden" name="id" value={def.id} />
                    <label className="min-w-0 flex-1 space-y-1">
                      <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
                        Options
                      </span>
                      <input
                        name="options"
                        defaultValue={options.join(", ")}
                        className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="font-mono text-xs text-ctp-blue"
                    >
                      Save options
                    </button>
                  </form>
                ) : selectable ? (
                  <p className="font-mono text-xs text-ctp-overlay0">
                    {options.join(", ")}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="max-w-xl space-y-3 border border-ctp-surface0 bg-ctp-base p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ctp-mauve">
          Add property
        </h2>
        <form action={createPropertyDefAction} className="space-y-3">
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
              Key
            </span>
            <input
              required
              name="key"
              placeholder="Next Review Owner"
              className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
              Type
            </span>
            <select
              name="valueType"
              defaultValue="text"
              className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
            >
              {propertyValueTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase text-ctp-overlay0">
              Options (select / multi_select, comma or newline)
            </span>
            <textarea
              name="options"
              rows={2}
              className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="bg-ctp-mauve px-3 py-2 font-mono text-xs text-ctp-crust"
          >
            Add definition
          </button>
        </form>
      </section>
    </main>
  );
}
