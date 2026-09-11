import Link from "next/link";
import { PlayingCard } from "@/components/PlayingCard";

export default function Home() {
  return (
    <main className="hero">
      <div className="hero-inner">
        <p className="eyebrow">Est. tonight · House rules</p>
        <h1>
          Royale <em>21</em>
        </h1>
        <p className="lede">
          A private blackjack club with 6-deck shoes, 3:2 blackjack, insurance,
          splits, doubles, late surrender, computer opponents, and live
          multiplayer tables.
        </p>
        <div className="hero-actions">
          <Link href="/signup" className="btn-gold">
            Become a member
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
        </div>
        <div className="fan" aria-hidden>
          <PlayingCard card={{ id: "1", rank: "A", suit: "spades" }} />
          <PlayingCard card={{ id: "2", rank: "K", suit: "hearts" }} />
          <PlayingCard hidden />
          <PlayingCard card={{ id: "4", rank: "Q", suit: "diamonds" }} />
          <PlayingCard card={{ id: "5", rank: "J", suit: "clubs" }} />
        </div>
      </div>
    </main>
  );
}
