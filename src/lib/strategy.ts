import { handValue, isBlackjack, rankValue } from "./cards";
import type { Card, Hand } from "./types";

export type Advice =
  | "hit"
  | "stand"
  | "double"
  | "split"
  | "surrender"
  | "insurance-no";

function upVal(card: Card) {
  return card.rank === "A" ? 11 : rankValue(card.rank);
}

export function advise(
  hand: Hand,
  dealerUp: Card,
  opts: { canDouble: boolean; canSplit: boolean; canSurrender: boolean },
): Advice {
  const cards = hand.cards;
  const dealer = upVal(dealerUp);
  const { total, soft } = handValue(cards);

  if (opts.canSurrender && cards.length === 2 && !hand.fromSplit) {
    if (total === 16 && (dealer === 9 || dealer === 10 || dealer === 11)) {
      return "surrender";
    }
    if (total === 15 && dealer === 10) return "surrender";
  }

  if (opts.canSplit && cards.length === 2 && cards[0].rank === cards[1].rank) {
    const r = cards[0].rank;
    if (r === "A" || r === "8") return "split";
    if (r === "10" || r === "J" || r === "Q" || r === "K") return "stand";
    if (r === "9") {
      if (dealer === 7 || dealer === 10 || dealer === 11) return "stand";
      return "split";
    }
    if (r === "7") return dealer <= 7 ? "split" : "hit";
    if (r === "6") return dealer <= 6 ? "split" : "hit";
    if (r === "5") {
      if (opts.canDouble && dealer <= 9) return "double";
      return "hit";
    }
    if (r === "4") return dealer === 5 || dealer === 6 ? "split" : "hit";
    if (r === "3" || r === "2") return dealer <= 7 ? "split" : "hit";
  }

  if (isBlackjack(cards)) return "stand";

  if (soft) {
    if (total >= 19) return "stand";
    if (total === 18) {
      if (opts.canDouble && dealer >= 3 && dealer <= 6) return "double";
      if (dealer >= 9) return "hit";
      return "stand";
    }
    if (total === 17) {
      if (opts.canDouble && dealer >= 3 && dealer <= 6) return "double";
      return "hit";
    }
    if (total === 15 || total === 16) {
      if (opts.canDouble && dealer >= 4 && dealer <= 6) return "double";
      return "hit";
    }
    if (total === 13 || total === 14) {
      if (opts.canDouble && dealer >= 5 && dealer <= 6) return "double";
      return "hit";
    }
    return "hit";
  }

  if (total >= 17) return "stand";
  if (total >= 13 && total <= 16) return dealer <= 6 ? "stand" : "hit";
  if (total === 12) return dealer >= 4 && dealer <= 6 ? "stand" : "hit";
  if (total === 11) {
    if (opts.canDouble) return "double";
    return "hit";
  }
  if (total === 10) {
    if (opts.canDouble && dealer <= 9) return "double";
    return "hit";
  }
  if (total === 9) {
    if (opts.canDouble && dealer >= 3 && dealer <= 6) return "double";
    return "hit";
  }
  return "hit";
}

export function adviceLabel(advice: Advice) {
  switch (advice) {
    case "hit":
      return "Hit";
    case "stand":
      return "Stand";
    case "double":
      return "Double";
    case "split":
      return "Split";
    case "surrender":
      return "Surrender";
    default:
      return "Skip insurance";
  }
}
