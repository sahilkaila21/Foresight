import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import LogoutButton from "./LogoutButton";
import CategoryTabs from "./CategoryTabs";
import HowToUse from "./HowToUse";
import SearchBox from "./SearchBox";
import ThemeToggle from "./ThemeToggle";

export default async function NavBar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap sm:gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="text-3xl">🔮</span>
          <span className="hidden text-xl sm:inline">Foresight</span>
        </Link>

        <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1">
          <SearchBox />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2.5 text-sm sm:ml-0 sm:gap-3">
          <ThemeToggle />
          <HowToUse />
          {user ? (
            <>
              <Link
                href="/markets/new"
                className="hidden rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:border-zinc-400 sm:inline dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500"
              >
                Create
              </Link>
              <Link
                href="/leaderboard"
                className="hidden text-zinc-600 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Leaderboard
              </Link>
              <Link
                href="/portfolio"
                className="font-mono font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                title="Portfolio"
              >
                {formatMoney(user.balance)}
              </Link>
              <Link
                href={`/users/${user.username}`}
                className="text-zinc-600 hover:underline dark:text-zinc-400"
              >
                @{user.username}
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/leaderboard"
                className="hidden text-zinc-600 hover:text-zinc-900 sm:inline dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Leaderboard
              </Link>
              <Link
                href="/login"
                className="rounded-md px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-zinc-900 px-3 py-1.5 font-semibold text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
      <CategoryTabs />
    </header>
  );
}
