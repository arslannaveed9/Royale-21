"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClubNav } from "./ClubNav";
import { money } from "@/lib/format";
import type { PublicUser } from "@/lib/types";

export function LobbyClient({
  user,
  board,
}: {
  user: PublicUser;
  board: PublicUser[];
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createTable(mode: "solo" | "multi", aiCount = 0) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          aiCount,
          name: name || (mode === "solo" ? "Private table" : `${user.displayName}'s table`),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open table");
      router.push(`/play/${data.table.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open table");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/tables/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not join");
      router.push(`/play/${data.table.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <ClubNav user={user} />
      <section className="lobby-grid">
        <div>
          <p className="eyebrow">The floor</p>
          <h1>Good evening, {user.displayName}.</h1>
          <p className="lede">
            Bankroll {money(user.chips)}. Six-deck shoe, dealer hits soft 17, blackjack pays 3:2.
          </p>
          <label>
            Table name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional night title"
            />
          </label>
          {error ? <p className="error-line">{error}</p> : null}
          <div className="mode-grid">
            <article className="mode-card">
              <h3>Heads-up</h3>
              <p>Just you and the house. Hit, stand, double, split, and surrender.</p>
              <button className="btn-gold" disabled={busy} onClick={() => createTable("solo", 0)}>
                Play the dealer
              </button>
            </article>
            <article className="mode-card">
              <h3>Computer table</h3>
              <p>Sit with two computer players. They are not members and never appear on the board.</p>
              <button className="btn-gold" disabled={busy} onClick={() => createTable("solo", 2)}>
                Seat computers
              </button>
            </article>
            <article className="mode-card">
              <h3>Friends table</h3>
              <p>Private table with a share code. Only people you invite can sit down.</p>
              <button className="btn-gold" disabled={busy} onClick={() => createTable("multi", 0)}>
                Host friends
              </button>
            </article>
          </div>
          <div className="panel" style={{ width: "100%" }}>
            <h2>Join a friend</h2>
            <ol className="howto">
              <li>They tap <b>Host friends</b> and copy the 6-letter table code.</li>
              <li>You sign in, paste that code here, and tap Sit down.</li>
              <li>Or open the invite link they send after you are signed in.</li>
            </ol>
            <div className="join-row">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="TABLE CODE"
                maxLength={6}
              />
              <button className="btn-gold" disabled={busy || code.length < 4} onClick={join}>
                Sit down
              </button>
            </div>
          </div>
        </div>
        <aside className="panel" style={{ width: "100%" }}>
          <h2>High rollers</h2>
          <p className="muted">Live members only. Computers and unused test seats stay off this list.</p>
          {board.length === 0 ? (
            <p className="muted">No hands on the book yet.</p>
          ) : (
            <ol className="leader">
              {board.map((row, i) => (
                <li key={row.id}>
                  <span>
                    {i + 1}. {row.displayName}
                    {row.id === user.id ? " (you)" : ""}
                  </span>
                  <b>{money(row.chips)}</b>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </section>
    </main>
  );
}
