import Link from "next/link";

export default function NotFound() {
  return (
    <main className="space-y-3 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-ctp-overlay0">
        404
      </p>
      <h1 className="text-2xl text-ctp-text">Note not found</h1>
      <Link href="/dsa" className="text-sm text-ctp-blue hover:text-ctp-sky">
        Back to DSA
      </Link>
    </main>
  );
}
