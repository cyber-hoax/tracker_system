import { createNoteAction } from "@/app/actions/zettel";

export function CreateNoteForm({
  type,
  placeholder,
}: {
  type: "problem" | "pattern";
  placeholder: string;
}) {
  return (
    <form action={createNoteAction} className="flex gap-2">
      <input type="hidden" name="type" value={type} />
      <input
        required
        name="title"
        placeholder={placeholder}
        className="min-w-0 flex-1 border border-ctp-surface0 bg-ctp-base px-3 py-2 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-mauve focus:outline-none"
      />
      <button
        type="submit"
        className="bg-ctp-mauve px-3 py-2 font-mono text-xs text-ctp-crust hover:bg-ctp-lavender"
      >
        Add
      </button>
    </form>
  );
}
