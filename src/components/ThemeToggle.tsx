"use client";

// Theme toggle. The visible icon is driven entirely by the `data-theme`
// attribute via Tailwind's `dark:` variant, so server and client render the
// same markup (no hydration mismatch) and the correct icon shows on first
// paint because the inline script in the layout sets the attribute early.
export default function ThemeToggle() {
  function toggle() {
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage unavailable (e.g. private mode) — theme still applies for
      // this session, it just won't persist.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle theme"
      className="flex h-8 w-8 items-center justify-center rounded-md text-lg text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
    >
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}
