"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export function LiveSearchQuery({
  defaultValue,
  placeholder,
}: {
  defaultValue?: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsRef = useRef(searchParams);
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue ?? "");
  const [, startTransition] = useTransition();

  paramsRef.current = searchParams;

  useEffect(() => {
    if (inputRef.current === document.activeElement) return;
    setValue(defaultValue ?? "");
  }, [defaultValue]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current.toString());
      const current = params.get("q") ?? "";
      const next = value.trim();
      if (current === next) return;
      if (next) params.set("q", next);
      else params.delete("q");
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    }, 250);
    return () => window.clearTimeout(handle);
  }, [value, pathname, router]);

  return (
    <input
      ref={inputRef}
      type="search"
      name="q"
      value={value}
      autoComplete="off"
      placeholder={placeholder}
      onChange={(event) => setValue(event.target.value)}
      className="w-full border border-ctp-surface1 bg-ctp-mantle px-2 py-1.5 text-sm"
    />
  );
}
