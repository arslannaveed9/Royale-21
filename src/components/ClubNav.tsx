"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { money } from "@/lib/format";
import type { PublicUser } from "@/lib/types";

export function ClubNav({ user }: { user: PublicUser }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="club-nav">
      <Link href="/lobby" className="wordmark">
        Royale <em>21</em>
      </Link>
      <nav>
        <Link href="/lobby">Floor</Link>
        <Link href="/profile">Account</Link>
      </nav>
      <div className="nav-user">
        <span>{user.displayName}</span>
        <b>{money(user.chips)}</b>
        <button onClick={logout}>Sign out</button>
      </div>
    </header>
  );
}
