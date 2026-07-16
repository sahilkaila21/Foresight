"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      Log out
    </button>
  );
}
