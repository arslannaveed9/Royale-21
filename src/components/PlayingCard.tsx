import { isRed } from "@/lib/cards";
import type { PublicDealerCard } from "@/lib/types";

const SUIT: Record<string, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const sizeMap = {
  xs: "card-xs",
  sm: "card-sm",
  md: "card-md",
  lg: "card-lg",
};

export function PlayingCard({
  card,
  hidden,
  delay = 0,
  size = "md",
}: {
  card?: PublicDealerCard | null;
  hidden?: boolean;
  delay?: number;
  size?: keyof typeof sizeMap;
}) {
  const faceDown = hidden || !card || card.hidden || !card.rank || !card.suit;
  const red = card?.suit ? isRed(card.suit) : false;

  if (faceDown) {
    return (
      <div
        className={`playing-card card-back ${sizeMap[size]}`}
        style={{ animationDelay: `${delay}ms` }}
        aria-label="Face-down card"
      >
        <div className="card-back-inner">
          <span>21</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`playing-card card-face ${sizeMap[size]} ${red ? "is-red" : "is-black"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="card-corner tl">
        <b>{card.rank}</b>
        <span>{SUIT[card.suit!]}</span>
      </div>
      <div className="card-pip">{SUIT[card.suit!]}</div>
      <div className="card-corner br">
        <b>{card.rank}</b>
        <span>{SUIT[card.suit!]}</span>
      </div>
    </div>
  );
}
