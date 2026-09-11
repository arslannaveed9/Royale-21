"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CHIP_VALUES } from "@/lib/constants";
import { money, signedMoney } from "@/lib/format";
import { armSound, primeSounds, sound } from "@/lib/sound";
import { handValue, knownValue } from "@/lib/cards";
import type { ClientAction, PublicPlayer, PublicTable } from "@/lib/types";
import { Chip } from "./Chip";
import { PlayingCard } from "./PlayingCard";

export function GameTable({ tableId }: { tableId: string }) {
  const router = useRouter();
  const [table, setTable] = useState<PublicTable | null>(null);
  const [error, setError] = useState("");
  const [chat, setChat] = useState("");
  const [hintOn, setHintOn] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [cueFlash, setCueFlash] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"code" | "link" | "">("");
  const prevCards = useRef(0);
  const prevPhase = useRef<string>("");

  const bang = useCallback(
    (label: string, fn: () => void) => {
      if (!soundOn) return;
      fn();
      setCueFlash(label);
    },
    [soundOn],
  );

  const enableSound = useCallback(() => {
    setSoundOn(true);
    void armSound().finally(() => {
      setAudioReady(true);
      setCueFlash("ready");
    });
  }, []);

  const play = useCallback(
    (label: string, fn: () => void) => {
      if (!soundOn || !audioReady) return;
      bang(label, fn);
    },
    [audioReady, bang, soundOn],
  );

  const act = useCallback(
    async (action: ClientAction) => {
      if (soundOn && !audioReady) enableSound();
      if (soundOn) {
        if (action.type === "addChip") bang("chip", () => sound.chip());
        if (action.type === "deal") bang("deal", () => sound.shuffle());
        if (action.type === "hit") bang("hit", () => sound.deal());
        if (action.type === "stand") bang("stand", () => sound.stand());
        if (action.type === "double") bang("double", () => sound.double());
        if (action.type === "split") bang("split", () => sound.split());
        if (action.type === "surrender") bang("fold", () => sound.lose());
        if (action.type === "clearBet" || action.type === "insurance") bang("click", () => sound.click());
      }
      setBusy(true);
      setError("");
      try {
        const res = await fetch(`/api/tables/${tableId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Action failed");
        setTable(data.table);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [audioReady, bang, enableSound, soundOn, tableId],
  );

  useEffect(() => {
    primeSounds();
    const saved = window.localStorage.getItem("royale-sound-v3");
    if (saved === "off") setSoundOn(false);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("royale-sound-v3", soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    if (!cueFlash) return;
    const timer = window.setTimeout(() => setCueFlash(""), 700);
    return () => window.clearTimeout(timer);
  }, [cueFlash]);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    async function boot() {
      const join = await fetch(`/api/tables/${tableId}`, { method: "POST" });
      const data = await join.json();
      if (!join.ok) {
        setError(data.error || "Could not join table");
        return;
      }
      if (!cancelled) setTable(data.table);
      source = new EventSource(`/api/tables/${tableId}/stream`);
      source.onmessage = (event) => {
        try {
          setTable(JSON.parse(event.data) as PublicTable);
        } catch {
          // ignore keep-alives
        }
      };
    }

    boot();
    return () => {
      cancelled = true;
      source?.close();
    };
  }, [tableId]);

  useEffect(() => {
    if (!table) return;
    const count =
      table.dealerCards.length +
      table.players.reduce(
        (sum, p) => sum + p.hands.reduce((h, hand) => h + hand.cards.length, 0),
        0,
      );
    if (count > prevCards.current) {
      const n = Math.min(count - prevCards.current, 8);
      for (let i = 0; i < n; i += 1) {
        setTimeout(() => play("card", () => sound.deal()), i * 85);
      }
    }
    prevCards.current = count;
    if (prevPhase.current !== "dealer" && table.phase === "dealer") {
      play("reveal", () => sound.reveal());
    }
    if (table.phase === "payout" && prevPhase.current !== "payout") {
      const you = table.lastResults.find((r) => r.playerId === table.you?.id);
      const bj = table.you?.hands.some((h) => h.result === "blackjack");
      const busted = table.you?.hands.every((h) => h.result === "bust");
      if (bj) play("blackjack", () => sound.blackjack());
      else if (you && you.net > 0) play("win", () => sound.win());
      else if (busted) play("bust", () => sound.bust());
      else if (you && you.net < 0) play("lose", () => sound.lose());
      else play("push", () => sound.push());
    }
    prevPhase.current = table.phase;
  }, [table, play]);

  useEffect(() => {
    if (table?.phase !== "payout" || table.mode !== "solo") return;
    const timer = setTimeout(() => {
      act({ type: "nextRound" });
    }, 6500);
    return () => clearTimeout(timer);
  }, [table?.phase, table?.mode, act]);

  const ordered = useMemo(
    () => (table ? [...table.players].sort((a, b) => a.seat - b.seat) : []),
    [table],
  );
  const you = table?.you;

  if (!table || !you) {
    return (
      <div className="table-boot">
        <div className="gold-spinner" />
        <p>{error || "Preparing the felt..."}</p>
      </div>
    );
  }

  const actions = table.actions;
  const dealerTotal = knownValue(table.dealerCards);
  const tableCode = table.code;
  const humans = table.players.filter((p) => !p.isAI).length;
  const inviteLink =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/join/${tableCode}`;

  async function copyCode() {
    await navigator.clipboard.writeText(tableCode);
    setCopied("code");
    setTimeout(() => setCopied(""), 1400);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink);
    setCopied("link");
    setTimeout(() => setCopied(""), 1400);
  }

  return (
    <div
      className="table-shell"
      onPointerDown={() => {
        if (soundOn && !audioReady) enableSound();
      }}
    >
      <div className="table-chrome">
        <header className="table-top">
          <div className="table-top-side left">
            <button
              className="ghost-link"
              type="button"
              onClick={() => act({ type: "leave" }).then(() => router.push("/lobby"))}
            >
              ← Floor
            </button>
          </div>
          <div className="table-brand">
            <span>Royale 21</span>
            <strong>{table.name}</strong>
          </div>
          <div className="table-top-side right">
            <button className={`icon-toggle ${hintOn ? "on" : ""}`} onClick={() => setHintOn((v) => !v)} type="button">
              Coach
            </button>
            <button
              className={`icon-toggle sound-toggle ${soundOn ? "on" : ""} ${audioReady ? "live" : ""}`}
              onClick={() => {
                if (!soundOn || !audioReady) {
                  enableSound();
                  return;
                }
                setSoundOn(false);
                setAudioReady(false);
              }}
              type="button"
            >
              <span className="wide-only">
                {soundOn && audioReady ? "Sound on" : soundOn ? "Tap for sound" : "Sound off"}
              </span>
              <span className="narrow-only">{soundOn ? "Sound" : "Muted"}</span>
            </button>
            <button className={`icon-toggle ${chatOpen ? "on" : ""}`} onClick={() => setChatOpen((v) => !v)} type="button">
              Chat
            </button>
            <span className="stack-pill">{money(you.chips)}</span>
          </div>
        </header>
        <div className="invite-bar">
          {table.mode === "multi" ? (
            <>
              <span className="invite-tag">Friends only</span>
              <strong>{tableCode}</strong>
              <button type="button" className="btn-ghost slim" onClick={copyCode}>
                {copied === "code" ? "Copied" : "Copy code"}
              </button>
              <button type="button" className="btn-ghost slim" onClick={copyLink}>
                {copied === "link" ? "Copied" : <><span className="wide-only">Copy invite link</span><span className="narrow-only">Link</span></>}
              </button>
              <em className="invite-help">
                {humans < 2
                  ? "Friends sign in, open the Floor, and enter this code."
                  : `${humans} members at the table`}
              </em>
            </>
          ) : (
            <>
              <span className="invite-tag">Private</span>
              <em>{table.shoeCount} cards in the shoe · you and the house</em>
            </>
          )}
          {cueFlash ? <em className="sound-cue">♪ {cueFlash}</em> : null}
        </div>
      </div>

      <div className="felt-stage">
        {soundOn && !audioReady ? (
          <button
            className="sound-arm"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              enableSound();
            }}
          >
            <strong>Enable table sound</strong>
            <span>Tap once — you should hear a beep</span>
          </button>
        ) : null}
        {cueFlash ? <div className="sound-pulse">♪ {cueFlash}</div> : null}
        <div className="felt">
          <div className="felt-wood" />
          <div className="felt-inlay" />
          <div className="felt-glow" />
          <p className="felt-inscribe">Blackjack pays 3 to 2 · Insurance 2 to 1 · Dealer hits soft 17</p>

          <section className="dealer-well">
            <div className="dealer-plaque">Dealer</div>
            <div className="card-row">
              {table.dealerCards.length === 0 ? (
                <div className="empty-spot">Waiting for the shoe</div>
              ) : (
                table.dealerCards.map((card, i) => (
                  <PlayingCard key={card.id} card={card} delay={i * 90} size="md" />
                ))
              )}
            </div>
            {dealerTotal && table.dealerCards.length > 0 ? (
              <div className="hand-total">{dealerTotal.total}</div>
            ) : null}
          </section>

          <div className="felt-center">
            <p className="table-message">{table.message}</p>
            {table.phase === "payout" && table.lastResults.length > 0 ? (
              <div className="results-banner">
                {table.lastResults.map((result) => (
                  <div key={result.playerId} className={result.net >= 0 ? "up" : "down"}>
                    <b>{result.name}</b>
                    <span>{signedMoney(result.net)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {hintOn && table.hint ? <div className="hint-inline">{table.hint}</div> : null}
          </div>

          <section className="seats">
            {ordered.map((player) => (
              <Seat
                key={player.id}
                player={player}
                you={player.id === you.id}
                active={table.currentPlayerId === player.id && table.phase === "acting"}
              />
            ))}
          </section>
        </div>

        {chatOpen ? (
          <div className="chat-pop">
            <h3>Table talk</h3>
            <div className="chat-log">
              {table.chat.length === 0 ? <p className="muted">No chatter yet.</p> : null}
              {table.chat.map((msg) => (
                <p key={msg.id}>
                  <b>{msg.name}</b> {msg.text}
                </p>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chat.trim()) return;
                act({ type: "chat", text: chat });
                setChat("");
              }}
            >
              <input
                value={chat}
                onChange={(e) => setChat(e.target.value)}
                placeholder="Say something"
                maxLength={180}
              />
            </form>
          </div>
        ) : null}
      </div>

      <footer className="action-dock">
        {error ? <p className="error-line">{error}</p> : null}

        {table.phase === "betting" ? (
          <div className="dock-inner">
            <div className="bet-readout">
              <span>Bet</span>
              <b>{money(you.pendingBet)}</b>
            </div>
            <div className="chip-row">
              {CHIP_VALUES.map((value) => (
                <Chip
                  key={value}
                  value={value}
                  disabled={busy || you.chips - you.pendingBet < value || you.pendingBet + value > table.maxBet}
                  onClick={() => {
                    act({ type: "addChip", value });
                  }}
                />
              ))}
            </div>
            <div className="dock-actions">
              {actions.canAddAI ? (
                <button className="btn-ghost slim" onClick={() => act({ type: "addAI" })}>
                  + CPU
                </button>
              ) : null}
              {actions.canRebuy ? (
                <button className="btn-ghost slim" onClick={() => act({ type: "rebuy" })}>
                  Rebuy
                </button>
              ) : null}
              <button className="btn-ghost slim" disabled={!actions.canClearBet || busy} onClick={() => act({ type: "clearBet" })}>
                Clear
              </button>
              <button className="btn-gold slim" disabled={!actions.canDeal || busy} onClick={() => act({ type: "deal" })}>
                Deal
              </button>
            </div>
          </div>
        ) : null}

        {table.phase === "insurance" && actions.canInsurance ? (
          <div className="dock-inner">
            <p className="dock-label">
              {actions.evenMoney ? "Even money on your blackjack?" : "Insurance against dealer blackjack?"}
            </p>
            <div className="dock-actions">
              <button className="btn-ghost slim" disabled={busy} onClick={() => act({ type: "insurance", take: false })}>
                No
              </button>
              <button className="btn-gold slim" disabled={busy} onClick={() => act({ type: "insurance", take: true })}>
                {actions.evenMoney ? "Even money" : "Insure"}
              </button>
            </div>
          </div>
        ) : null}

        {table.phase === "acting" && table.currentPlayerId === you.id ? (
          <div className="dock-inner">
            <p className="dock-label">Your action</p>
            <div className="dock-actions wrap">
              <button className="btn-gold slim" disabled={!actions.canHit || busy} onClick={() => act({ type: "hit" })}>
                Hit
              </button>
              <button className="btn-gold slim" disabled={!actions.canStand || busy} onClick={() => act({ type: "stand" })}>
                Stand
              </button>
              <button className="btn-ghost slim" disabled={!actions.canDouble || busy} onClick={() => act({ type: "double" })}>
                Double
              </button>
              <button className="btn-ghost slim" disabled={!actions.canSplit || busy} onClick={() => act({ type: "split" })}>
                Split
              </button>
              <button className="btn-ghost slim" disabled={!actions.canSurrender || busy} onClick={() => act({ type: "surrender" })}>
                Surrender
              </button>
            </div>
          </div>
        ) : null}

        {table.phase === "payout" ? (
          <div className="dock-inner">
            <p className="dock-label">Round settled</p>
            <button className="btn-gold slim" disabled={!actions.canNextRound || busy} onClick={() => act({ type: "nextRound" })}>
              Next hand
            </button>
          </div>
        ) : null}

        {table.phase === "acting" && table.currentPlayerId !== you.id ? (
          <div className="dock-inner">
            <p className="dock-label">Waiting on the other seat...</p>
          </div>
        ) : null}

        {table.phase === "insurance" && !actions.canInsurance ? (
          <div className="dock-inner">
            <p className="dock-label">Waiting on insurance...</p>
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function Seat({
  player,
  you,
  active,
}: {
  player: PublicPlayer;
  you: boolean;
  active: boolean;
}) {
  return (
    <article className={`seat ${you ? "is-you" : ""} ${active ? "is-active" : ""}`}>
      <div className="bet-circle">
        {player.pendingBet > 0 || player.hands[0]?.bet ? (
          <span>{money(player.pendingBet || player.hands[0]?.bet || 0)}</span>
        ) : (
          <span className="muted">Bet</span>
        )}
      </div>
      <div className="hands">
        {player.hands.map((hand, index) => {
          const total = hand.cards.length ? handValue(hand.cards) : null;
          return (
            <div
              key={`${player.id}-${index}`}
              className={`mini-hand ${player.activeHand === index && active ? "live" : ""}`}
            >
              <div className="card-row tight">
                {hand.cards.map((card, i) => (
                  <PlayingCard key={card.id} card={card} size="xs" delay={i * 70} />
                ))}
              </div>
              {total ? (
                <div className="hand-total sm">
                  {hand.result ?? total.total}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <header>
        <strong>{player.displayName}</strong>
        <span>{player.isAI ? "CPU" : money(player.chips)}</span>
      </header>
    </article>
  );
}
