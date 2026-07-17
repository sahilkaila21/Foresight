export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8 border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-zinc-500 sm:flex-row">
        <p className="flex items-center gap-1.5">
          <span>🔮</span>
          <span>© {year} Sahil Kaila · Foresight</span>
        </p>
        <p className="text-xs text-zinc-400">
          Play-money prediction markets. Not real gambling — just bragging rights.
        </p>
      </div>
    </footer>
  );
}
