import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function NoteBreadcrumb({
  parentHref,
  parentLabel,
  current,
}: {
  parentHref: string;
  parentLabel: string;
  current: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex flex-wrap items-center gap-2 font-mono text-xs shrink-0"
    >
      <Link
        href={parentHref}
        className="inline-flex items-center gap-1.5 uppercase tracking-[0.18em] text-ctp-overlay0 hover:text-ctp-mauve"
      >
        <ArrowLeft size={18} weight="bold" />
        {parentLabel}
      </Link>
      <span className="text-ctp-surface2" aria-hidden="true">
        /
      </span>
      <span className="text-ctp-subtext0">{current}</span>
    </nav>
  );
}
