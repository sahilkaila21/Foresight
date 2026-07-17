"use client";

import { Suspense, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function Box() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (search === current) return;
    const id = setTimeout(() => {
      const sp = new URLSearchParams(params.toString());
      if (search) sp.set("q", search);
      else sp.delete("q");
      startTransition(() => {
        router.push(`/${sp.toString() ? `?${sp.toString()}` : ""}`, { scroll: false });
      });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="relative mx-auto max-w-md">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">🔍</span>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          if (pathname !== "/") router.push("/");
        }}
        placeholder="Search markets…"
        className="w-full rounded-full border border-zinc-300 bg-zinc-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}

export default function SearchBox() {
  return (
    <Suspense>
      <Box />
    </Suspense>
  );
}
