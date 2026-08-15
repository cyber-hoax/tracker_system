"use client";

import { deletePropertyDefAction } from "@/app/actions/zettel";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteDefButton({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            `Remove property “${label}”? All values on notes will be deleted.`,
          )
        ) {
          return;
        }
        startTransition(async () => {
          await deletePropertyDefAction(id);
          router.refresh();
        });
      }}
      className="font-mono text-xs text-ctp-red hover:text-ctp-maroon disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
