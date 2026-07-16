import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import LogoutButton from "./LogoutButton";

export default async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold tracking-tight">
            🔮 Foresight
          </Link>
          <Link
            href="/markets/new"
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Create market
          </Link>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                {formatMoney(user.balance)}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">@{user.username}</span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
