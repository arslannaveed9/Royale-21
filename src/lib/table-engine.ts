import {
  AI_NAMES,
  BJ_PAYOUT,
  DECKS,
  MAX_CHAT,
  MAX_HANDS,
  MAX_HISTORY,
  MAX_SEATS,
  MIN_BET,
  MAX_BET,
  REBUY_AMOUNT,
  REBUY_THRESHOLD,
  SHUFFLE_AT,
} from "./constants";
import {
  createShoe,
  handValue,
  isBlackjack,
  isBust,
  shuffle,
} from "./cards";
import { advise, adviceLabel } from "./strategy";
import type {
  ActionFlags,
  Card,
  ClientAction,
  Hand,
  PlayerState,
  PublicTable,
  PublicUser,
  TableState,
  TableSummary,
} from "./types";
import { GameError } from "./types";
import { getUserById, patchUser } from "./store";
import { notifyListeners } from "./events";

const g = globalThis as unknown as {
  __royaleTables?: Map<string, TableState>;
  __royaleTableLocks?: Map<string, Promise<void>>;
};

function tables() {
  if (!g.__royaleTables) g.__royaleTables = new Map();
  return g.__royaleTables;
}

function locks() {
  if (!g.__royaleTableLocks) g.__royaleTableLocks = new Map();
  return g.__royaleTableLocks;
}

export async function withTableLock<T>(id: string, fn: () => Promise<T>) {
  const map = locks();
  const prior = map.get(id) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  map.set(
    id,
    prior.then(() => next),
  );
  await prior;
  try {
    return await fn();
  } finally {
    release();
  }
}

function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function emptyHand(bet: number, fromSplit = false, splitAces = false): Hand {
  return {
    cards: [],
    bet,
    status: "pending",
    doubled: false,
    fromSplit,
    splitAces,
  };
}

function draw(table: TableState): Card {
  if (table.shoe.length === 0) {
    table.shoe = shuffle(table.discard);
    table.discard = [];
  }
  return table.shoe.shift()!;
}

function maybeShuffle(table: TableState) {
  if (table.shoe.length < SHUFFLE_AT) {
    table.shoe = createShoe(DECKS);
    table.discard = [];
    table.message = "New shoe in play.";
  }
}

function inRound(table: TableState) {
  return table.phase !== "betting" && table.phase !== "payout";
}

function seated(table: TableState) {
  return [...table.players].sort((a, b) => a.seat - b.seat);
}

function livePlayers(table: TableState) {
  return seated(table).filter((p) => !p.sittingOut && p.hands.length > 0);
}

function currentPlayer(table: TableState) {
  return table.players.find((p) => p.id === table.currentPlayerId) ?? null;
}

function currentHand(player: PlayerState) {
  return player.hands[player.activeHand] ?? null;
}

function dealerUp(table: TableState) {
  return table.dealerCards[0] ?? null;
}

function canSplitHand(player: PlayerState, hand: Hand) {
  if (hand.cards.length !== 2) return false;
  if (player.hands.length >= MAX_HANDS) return false;
  if (hand.splitAces) return false;
  if (player.chips < hand.bet) return false;
  return hand.cards[0].rank === hand.cards[1].rank;
}

function canDoubleHand(player: PlayerState, hand: Hand) {
  return (
    hand.cards.length === 2 &&
    !hand.splitAces &&
    player.chips >= hand.bet &&
    (hand.status === "playing" || hand.status === "pending")
  );
}

function canSurrenderHand(hand: Hand) {
  return hand.cards.length === 2 && !hand.fromSplit && !hand.doubled;
}

function flagsFor(table: TableState, userId: string): ActionFlags {
  const player = table.players.find((p) => p.id === userId);
  const empty: ActionFlags = {
    canAddChip: false,
    canClearBet: false,
    canDeal: false,
    canHit: false,
    canStand: false,
    canDouble: false,
    canSplit: false,
    canSurrender: false,
    canInsurance: false,
    evenMoney: false,
    canNextRound: false,
    canRebuy: false,
    canAddAI: false,
  };
  if (!player) return empty;
  empty.canRebuy = player.chips < REBUY_THRESHOLD;
  empty.canAddAI =
    table.mode === "solo" &&
    table.phase === "betting" &&
    table.players.length < table.maxSeats;

  if (table.phase === "betting") {
    empty.canAddChip =
      player.pendingBet < table.maxBet && player.chips > player.pendingBet;
    empty.canClearBet = player.pendingBet > 0;
    const anyoneIn = table.players.some((p) => !p.isAI && p.pendingBet >= table.minBet);
    empty.canDeal = player.pendingBet >= table.minBet && anyoneIn;
    return empty;
  }

  if (table.phase === "insurance") {
    empty.canInsurance =
      !player.sittingOut &&
      !player.insuranceDecision &&
      player.hands.some((h) => h.bet > 0);
    empty.evenMoney = Boolean(
      empty.canInsurance && player.hands.some((h) => isBlackjack(h.cards) && !h.fromSplit),
    );
    return empty;
  }

  if (table.phase === "payout") {
    empty.canNextRound = true;
    return empty;
  }

  if (table.phase === "acting" && table.currentPlayerId === player.id) {
    const hand = currentHand(player);
    if (hand && (hand.status === "playing" || hand.status === "pending")) {
      empty.canHit = !hand.splitAces;
      empty.canStand = true;
      empty.canDouble = canDoubleHand(player, hand);
      empty.canSplit = canSplitHand(player, hand);
      empty.canSurrender = canSurrenderHand(hand);
    }
  }
  return empty;
}

function hintFor(table: TableState, userId: string) {
  const player = table.players.find((p) => p.id === userId);
  if (!player || table.phase !== "acting" || table.currentPlayerId !== userId) return null;
  const hand = currentHand(player);
  const up = dealerUp(table);
  if (!hand || !up || hand.cards.length < 2) return null;
  const flags = flagsFor(table, userId);
  const advice = advise(hand, up, {
    canDouble: flags.canDouble,
    canSplit: flags.canSplit,
    canSurrender: flags.canSurrender,
  });
  return `Basic strategy: ${adviceLabel(advice)}`;
}

export function toPublicTable(table: TableState, userId?: string): PublicTable {
  const reveal = table.dealerRevealed || table.phase === "payout" || table.phase === "dealer";
  return {
    id: table.id,
    code: table.code,
    name: table.name,
    hostId: table.hostId,
    mode: table.mode,
    maxSeats: table.maxSeats,
    minBet: table.minBet,
    maxBet: table.maxBet,
    phase: table.phase,
    message: table.message,
    players: table.players.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      chips: p.chips,
      isAI: p.isAI,
      seat: p.seat,
      hands: p.hands,
      activeHand: p.activeHand,
      pendingBet: p.pendingBet,
      insuranceBet: p.insuranceBet,
      insuranceDecision: p.insuranceDecision,
      sittingOut: p.sittingOut,
      connected: p.connected,
    })),
    dealerCards: table.dealerCards.map((card, index) => {
      if (index === 0 || reveal) return card;
      return { id: card.id, hidden: true };
    }),
    dealerRevealed: reveal,
    shoeCount: table.shoe.length,
    currentPlayerId: table.currentPlayerId,
    chat: table.chat,
    lastResults: table.lastResults,
    you: table.players.find((p) => p.id === userId),
    actions: userId
      ? flagsFor(table, userId)
      : flagsFor(table, ""),
    hint: userId ? hintFor(table, userId) : null,
  };
}

export function listPublicTables(): TableSummary[] {
  return [];
}

export function getTable(id: string) {
  return (
    tables().get(id) ??
    [...tables().values()].find((t) => t.code === id.toUpperCase()) ??
    null
  );
}

function nextSeat(table: TableState) {
  const taken = new Set(table.players.map((p) => p.seat));
  for (let i = 0; i < table.maxSeats; i += 1) {
    if (!taken.has(i)) return i;
  }
  return -1;
}

function makePlayer(
  user: { id: string; username: string; displayName: string; chips: number },
  seat: number,
  isAI = false,
): PlayerState {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    chips: user.chips,
    isAI,
    seat,
    hands: [],
    activeHand: 0,
    pendingBet: 0,
    insuranceBet: 0,
    sittingOut: false,
    leaving: false,
    connected: true,
  };
}

function addAIPlayer(table: TableState) {
  const seat = nextSeat(table);
  if (seat < 0) throw new GameError("This table is full.");
  const used = new Set(table.players.map((p) => p.displayName));
  const name = AI_NAMES.find((n) => !used.has(n)) ?? `Agent ${seat + 1}`;
  table.players.push(
    makePlayer(
      {
        id: `ai-${crypto.randomUUID()}`,
        username: name.toLowerCase().replace(/\s+/g, ""),
        displayName: name,
        chips: 10_000,
      },
      seat,
      true,
    ),
  );
}

export function createTable(input: {
  host: PublicUser;
  name: string;
  mode: "solo" | "multi";
  aiCount: number;
  maxSeats?: number;
}) {
  const maxSeats = Math.min(
    MAX_SEATS,
    Math.max(1, input.mode === "solo" ? 1 + input.aiCount : (input.maxSeats ?? 5)),
  );
  const table: TableState = {
    id: crypto.randomUUID(),
    code: code(),
    name: input.name.trim().slice(0, 32) || (input.mode === "solo" ? "Private Table" : "Open Table"),
    hostId: input.host.id,
    mode: input.mode,
    maxSeats,
    minBet: MIN_BET,
    maxBet: MAX_BET,
    phase: "betting",
    message: input.mode === "solo" ? "Place your bet to begin." : "Players may join. Place bets when ready.",
    players: [makePlayer(input.host, 0)],
    dealerCards: [],
    dealerRevealed: false,
    shoe: createShoe(DECKS),
    discard: [],
    currentPlayerId: null,
    chat: [],
    lastResults: [],
    statsRecorded: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const aiCount = Math.max(0, Math.min(input.aiCount, maxSeats - 1));
  for (let i = 0; i < aiCount; i += 1) addAIPlayer(table);
  tables().set(table.id, table);
  return table;
}

export function joinTable(table: TableState, user: PublicUser) {
  if (table.players.some((p) => p.id === user.id)) {
    const existing = table.players.find((p) => p.id === user.id)!;
    existing.connected = true;
    existing.chips = user.chips;
    return table;
  }
  if (inRound(table) && table.mode === "multi") {
    const seat = nextSeat(table);
    if (seat < 0) throw new GameError("This table is full.");
    const player = makePlayer(user, seat);
    player.sittingOut = true;
    table.players.push(player);
    table.message = `${user.displayName} will join on the next hand.`;
    return table;
  }
  const seat = nextSeat(table);
  if (seat < 0) throw new GameError("This table is full.");
  table.players.push(makePlayer(user, seat));
  table.message = `${user.displayName} took a seat.`;
  return table;
}

function placeAIBets(table: TableState) {
  for (const player of table.players) {
    if (!player.isAI || player.sittingOut) continue;
    const units = [1, 1, 2, 2, 4][Math.floor(Math.random() * 5)];
    let amount = Math.min(player.chips, table.minBet * units, table.maxBet);
    amount = Math.floor(amount / table.minBet) * table.minBet;
    player.pendingBet = Math.max(table.minBet, amount);
    if (player.pendingBet > player.chips) player.pendingBet = 0;
  }
}

function lockBets(table: TableState) {
  for (const player of table.players) {
    player.hands = [];
    player.activeHand = 0;
    player.insuranceBet = 0;
    player.insuranceDecision = undefined;
    if (player.pendingBet < table.minBet || player.pendingBet > player.chips) {
      player.sittingOut = true;
      player.pendingBet = 0;
      continue;
    }
    player.sittingOut = false;
    player.chips -= player.pendingBet;
    player.hands = [emptyHand(player.pendingBet)];
    player.pendingBet = 0;
  }
}

function dealRound(table: TableState) {
  maybeShuffle(table);
  table.dealerCards = [];
  table.dealerRevealed = false;
  const actives = seated(table).filter((p) => !p.sittingOut && p.hands.length > 0);
  if (actives.length === 0) {
    throw new GameError("At least one player must place a bet.");
  }
  for (const player of actives) player.hands[0].cards.push(draw(table));
  table.dealerCards.push(draw(table));
  for (const player of actives) player.hands[0].cards.push(draw(table));
  table.dealerCards.push(draw(table));

  for (const player of actives) {
    const hand = player.hands[0];
    if (isBlackjack(hand.cards)) {
      hand.status = "blackjack";
    } else {
      hand.status = "playing";
    }
  }
}

function dealerHasBJ(table: TableState) {
  return isBlackjack(table.dealerCards);
}

function dealerShowsAce(table: TableState) {
  return table.dealerCards[0]?.rank === "A";
}

function dealerShowsTen(table: TableState) {
  const rank = table.dealerCards[0]?.rank;
  return Boolean(rank && rank !== "A" && (rank === "10" || rank === "J" || rank === "Q" || rank === "K"));
}

function beginActing(table: TableState) {
  table.phase = "acting";
  const next = seated(table).find((p) =>
    p.hands.some((h) => h.status === "playing" || h.status === "pending"),
  );
  if (!next) {
    playDealerAndSettle(table);
    return;
  }
  table.currentPlayerId = next.id;
  next.activeHand = next.hands.findIndex((h) => h.status === "playing" || h.status === "pending");
  if (next.activeHand < 0) next.activeHand = 0;
  const hand = currentHand(next);
  if (hand && hand.status === "pending" && hand.cards.length === 1) {
    hand.cards.push(draw(table));
    finishIfNeeded(table, next, hand);
  }
  table.message = `${next.displayName}'s turn.`;
}

function finishIfNeeded(table: TableState, player: PlayerState, hand: Hand): void {
  if (hand.splitAces) {
    hand.status = isBust(hand.cards) ? "bust" : "stood";
    if (hand.status === "bust") hand.result = "bust";
    advanceHand(table, player);
    return;
  }
  const { total } = handValue(hand.cards);
  if (total > 21) {
    hand.status = "bust";
    hand.result = "bust";
    advanceHand(table, player);
    return;
  }
  if (total === 21) {
    hand.status = "stood";
    advanceHand(table, player);
  }
}

function advanceHand(table: TableState, player: PlayerState): void {
  const nextIndex = player.hands.findIndex(
    (h, i) => i > player.activeHand && (h.status === "playing" || h.status === "pending"),
  );
  if (nextIndex >= 0) {
    player.activeHand = nextIndex;
    const hand = player.hands[nextIndex];
    if (hand.cards.length === 1) {
      hand.cards.push(draw(table));
      hand.status = "playing";
      return finishIfNeeded(table, player, hand);
    }
    table.message = `${player.displayName} — hand ${nextIndex + 1}.`;
    return;
  }
  const nextPlayer = seated(table).find(
    (p) =>
      p.seat > player.seat &&
      p.hands.some((h) => h.status === "playing" || h.status === "pending"),
  );
  if (!nextPlayer) {
    playDealerAndSettle(table);
    return;
  }
  table.currentPlayerId = nextPlayer.id;
  nextPlayer.activeHand = nextPlayer.hands.findIndex(
    (h) => h.status === "playing" || h.status === "pending",
  );
  const hand = currentHand(nextPlayer);
  if (hand && hand.cards.length === 1) {
    hand.cards.push(draw(table));
    hand.status = "playing";
    finishIfNeeded(table, nextPlayer, hand);
  }
  table.message = `${nextPlayer.displayName}'s turn.`;
}

function playDealer(table: TableState) {
  table.phase = "dealer";
  table.dealerRevealed = true;
  table.currentPlayerId = null;
  const someoneAlive = livePlayers(table).some((p) =>
    p.hands.some((h) => h.status !== "bust" && h.status !== "surrender" && h.status !== "even-money"),
  );
  if (!someoneAlive) return;
  while (true) {
    const { total, soft } = handValue(table.dealerCards);
    if (total < 17 || (total === 17 && soft)) {
      table.dealerCards.push(draw(table));
      continue;
    }
    break;
  }
}

function settle(table: TableState) {
  table.phase = "payout";
  const dealerTotal = handValue(table.dealerCards).total;
  const dealerBJ = isBlackjack(table.dealerCards);
  const dealerBust = dealerTotal > 21;
  const results: TableState["lastResults"] = [];

  for (const player of livePlayers(table)) {
    let net = 0;
    const details: string[] = [];
    if (player.insuranceBet > 0) {
      if (dealerBJ) {
        const won = player.insuranceBet * 2;
        player.chips += player.insuranceBet + won;
        net += won;
        details.push("insurance +");
      } else {
        net -= player.insuranceBet;
        details.push("insurance -");
      }
    }
    for (const hand of player.hands) {
      if (hand.status === "even-money") {
        net += hand.bet;
        details.push("even money");
        continue;
      }
      if (hand.status === "surrender") {
        const back = Math.floor(hand.bet / 2);
        player.chips += back;
        net -= hand.bet - back;
        hand.result = "surrender";
        hand.payout = - (hand.bet - back);
        details.push("surrender");
        continue;
      }
      if (hand.status === "bust") {
        net -= hand.bet;
        hand.result = "bust";
        hand.payout = -hand.bet;
        details.push("bust");
        continue;
      }
      const playerBJ = isBlackjack(hand.cards) && !hand.fromSplit;
      const playerTotal = handValue(hand.cards).total;
      if (playerBJ && dealerBJ) {
        player.chips += hand.bet;
        net += 0;
        hand.result = "push";
        hand.payout = 0;
        details.push("BJ push");
      } else if (playerBJ) {
        const win = Math.round(hand.bet * BJ_PAYOUT);
        player.chips += hand.bet + win;
        net += win;
        hand.status = "blackjack";
        hand.result = "blackjack";
        hand.payout = win;
        details.push("blackjack");
      } else if (dealerBJ) {
        net -= hand.bet;
        hand.result = "lose";
        hand.payout = -hand.bet;
        details.push("dealer BJ");
      } else if (dealerBust || playerTotal > dealerTotal) {
        player.chips += hand.bet * 2;
        net += hand.bet;
        hand.result = "win";
        hand.payout = hand.bet;
        details.push("win");
      } else if (playerTotal === dealerTotal) {
        player.chips += hand.bet;
        hand.result = "push";
        hand.payout = 0;
        details.push("push");
      } else {
        net -= hand.bet;
        hand.result = "lose";
        hand.payout = -hand.bet;
        details.push("lose");
      }
    }
    results.push({
      playerId: player.id,
      name: player.displayName,
      net,
      detail: details.join(" · ") || "no action",
    });
  }
  table.lastResults = results;
  const dealerText = dealerBust
    ? `Dealer busts with ${dealerTotal}.`
    : dealerBJ
      ? "Dealer has blackjack."
      : `Dealer stands on ${dealerTotal}.`;
  table.message = dealerText;
}

function playDealerAndSettle(table: TableState) {
  playDealer(table);
  settle(table);
}

function closeInsurance(table: TableState) {
  if (dealerHasBJ(table)) {
    table.dealerRevealed = true;
    settle(table);
    table.message = "Dealer has blackjack.";
    return;
  }
  beginActing(table);
}

function takeEvenMoney(player: PlayerState, table: TableState) {
  for (const hand of player.hands) {
    if (isBlackjack(hand.cards) && !hand.fromSplit) {
      player.chips += hand.bet * 2;
      hand.status = "even-money";
      hand.result = "even-money";
      hand.payout = hand.bet;
    }
  }
  player.insuranceDecision = "yes";
  table.message = `${player.displayName} took even money.`;
}

function playAIHand(table: TableState, player: PlayerState) {
  let guard = 0;
  while (
    table.phase === "acting" &&
    table.currentPlayerId === player.id &&
    guard < 16
  ) {
    guard += 1;
    const hand = currentHand(player);
    if (!hand) break;
    const up = dealerUp(table);
    if (!up) break;
    let advice = advise(hand, up, {
      canDouble: canDoubleHand(player, hand),
      canSplit: canSplitHand(player, hand),
      canSurrender: canSurrenderHand(hand),
    });
    if (advice === "double" && !canDoubleHand(player, hand)) advice = "hit";
    if (advice === "split" && !canSplitHand(player, hand)) {
      advice = advise({ ...hand, cards: hand.cards }, up, {
        canDouble: canDoubleHand(player, hand),
        canSplit: false,
        canSurrender: canSurrenderHand(hand),
      });
    }
    if (advice === "surrender" && !canSurrenderHand(hand)) advice = "hit";
    if (advice === "insurance-no") advice = "hit";
    applyPlayerDecision(table, player, advice);
  }
}

function applyPlayerDecision(
  table: TableState,
  player: PlayerState,
  action: "hit" | "stand" | "double" | "split" | "surrender",
) {
  const hand = currentHand(player);
  if (!hand) throw new GameError("No active hand.");
  if (action === "hit") {
    if (hand.splitAces) throw new GameError("Split aces receive one card only.");
    hand.cards.push(draw(table));
    table.message = `${player.displayName} hits.`;
    finishIfNeeded(table, player, hand);
    return;
  }
  if (action === "stand") {
    hand.status = "stood";
    table.message = `${player.displayName} stands.`;
    advanceHand(table, player);
    return;
  }
  if (action === "double") {
    if (!canDoubleHand(player, hand)) throw new GameError("Cannot double this hand.");
    player.chips -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(draw(table));
    table.message = `${player.displayName} doubles.`;
    if (isBust(hand.cards)) {
      hand.status = "bust";
      hand.result = "bust";
    } else {
      hand.status = "stood";
    }
    advanceHand(table, player);
    return;
  }
  if (action === "split") {
    if (!canSplitHand(player, hand)) throw new GameError("Cannot split this hand.");
    const [a, b] = hand.cards;
    player.chips -= hand.bet;
    const splitAces = a.rank === "A" && b.rank === "A";
    const first = emptyHand(hand.bet, true, splitAces);
    const second = emptyHand(hand.bet, true, splitAces);
    first.cards = [a];
    second.cards = [b];
    first.status = "playing";
    second.status = "pending";
    player.hands.splice(player.activeHand, 1, first, second);
    first.cards.push(draw(table));
    table.message = `${player.displayName} splits.`;
    if (splitAces) {
      second.cards.push(draw(table));
      first.status = "stood";
      second.status = "stood";
      advanceHand(table, player);
      return;
    }
    finishIfNeeded(table, player, first);
    return;
  }
  if (action === "surrender") {
    if (!canSurrenderHand(hand)) throw new GameError("Cannot surrender this hand.");
    hand.status = "surrender";
    hand.result = "surrender";
    table.message = `${player.displayName} surrenders.`;
    advanceHand(table, player);
  }
}

function resolveAutomatic(table: TableState) {
  let guard = 0;
  while (guard < 40) {
    guard += 1;
    if (table.phase === "insurance") {
      const humansPending = table.players.filter(
        (p) =>
          !p.isAI &&
          !p.sittingOut &&
          p.hands.length > 0 &&
          !p.insuranceDecision,
      );
      for (const ai of table.players.filter((p) => p.isAI && !p.sittingOut && !p.insuranceDecision)) {
        ai.insuranceDecision = "no";
      }
      if (humansPending.length === 0) {
        closeInsurance(table);
        continue;
      }
      return;
    }
    if (table.phase === "acting") {
      const player = currentPlayer(table);
      if (!player) {
        playDealerAndSettle(table);
        continue;
      }
      const hand = currentHand(player);
      if (!hand || (hand.status !== "playing" && hand.status !== "pending")) {
        advanceHand(table, player);
        continue;
      }
      if (player.isAI || player.leaving) {
        playAIHand(table, player);
        continue;
      }
      return;
    }
    return;
  }
}

function startDeal(table: TableState) {
  placeAIBets(table);
  lockBets(table);
  dealRound(table);
  if (dealerShowsAce(table)) {
    table.phase = "insurance";
    table.message = "Dealer shows an Ace. Insurance?";
    resolveAutomatic(table);
    return;
  }
  if (dealerShowsTen(table) && dealerHasBJ(table)) {
    table.dealerRevealed = true;
    settle(table);
    table.message = "Dealer has blackjack.";
    return;
  }
  beginActing(table);
  resolveAutomatic(table);
}

function resetRound(table: TableState) {
  for (const card of table.dealerCards) table.discard.push(card);
  table.dealerCards = [];
  table.dealerRevealed = false;
  table.currentPlayerId = null;
  for (const player of table.players) {
    for (const hand of player.hands) {
      table.discard.push(...hand.cards);
    }
    player.hands = [];
    player.activeHand = 0;
    player.pendingBet = 0;
    player.insuranceBet = 0;
    player.insuranceDecision = undefined;
    player.sittingOut = false;
  }
  table.players = table.players.filter((p) => !p.leaving);
  table.phase = "betting";
  table.statsRecorded = false;
  table.message = "Place your bets.";
}

async function persistPlayers(table: TableState, withStats = false) {
  for (const player of table.players) {
    if (player.isAI) continue;
    const user = await getUserById(player.id);
    if (!user) continue;
    const result = table.lastResults.find((r) => r.playerId === player.id);
    if (withStats && result && !table.statsRecorded) {
      const stats = { ...user.stats };
      stats.hands += Math.max(1, player.hands.length);
      if (player.hands.some((h) => h.result === "blackjack")) stats.blackjacks += 1;
      if (result.net > 0) stats.wins += 1;
      else if (result.net < 0) stats.losses += 1;
      else stats.pushes += 1;
      if (result.net > stats.biggestWin) stats.biggestWin = result.net;
      const history = [
        ...user.history,
        { at: Date.now(), net: result.net, result: result.detail },
      ].slice(-MAX_HISTORY);
      await patchUser(player.id, { chips: player.chips, stats, history });
    } else {
      await patchUser(player.id, { chips: player.chips });
    }
  }
  if (withStats) table.statsRecorded = true;
}

async function persistIfSettled(table: TableState) {
  if (table.phase === "payout") await persistPlayers(table, true);
}

export async function applyAction(
  table: TableState,
  userId: string,
  action: ClientAction,
) {
  const player = table.players.find((p) => p.id === userId);
  if (!player && action.type !== "leave") {
    throw new GameError("You are not seated at this table.");
  }
  table.updatedAt = Date.now();

  if (action.type === "chat") {
    const text = action.text.trim().slice(0, 180);
    if (!text) throw new GameError("Message is empty.");
    const name = player?.displayName ?? "Guest";
    table.chat = [
      ...table.chat,
      { id: crypto.randomUUID(), userId, name, text, at: Date.now() },
    ].slice(-MAX_CHAT);
    return table;
  }

  if (action.type === "leave") {
    if (!player) return table;
    if (table.phase === "betting" || table.phase === "payout") {
      table.players = table.players.filter((p) => p.id !== userId);
    } else {
      player.leaving = true;
      if (table.currentPlayerId === player.id) {
        playAIHand(table, player);
        resolveAutomatic(table);
      }
    }
    if (!player.isAI) await patchUser(player.id, { chips: player.chips });
    if (table.players.filter((p) => !p.isAI && !p.leaving).length === 0) {
      tables().delete(table.id);
    }
    return table;
  }

  if (action.type === "rebuy") {
    if (!player) throw new GameError("Not seated.");
    if (player.chips >= REBUY_THRESHOLD) {
      throw new GameError("Rebuy is only available when your stack is low.");
    }
    player.chips += REBUY_AMOUNT;
    table.message = `${player.displayName} bought in for ${REBUY_AMOUNT.toLocaleString()}.`;
    await persistPlayers(table, false);
    return table;
  }

  if (action.type === "addAI") {
    if (table.mode !== "solo") throw new GameError("Computer seats are for private tables.");
    if (table.phase !== "betting") throw new GameError("Wait for the next betting round.");
    addAIPlayer(table);
    table.message = "A computer player took a seat.";
    return table;
  }

  if (!player) throw new GameError("Not seated.");

  if (action.type === "addChip") {
    if (table.phase !== "betting") throw new GameError("Betting is closed.");
    const next = player.pendingBet + action.value;
    if (action.value <= 0) throw new GameError("Invalid chip.");
    if (next > player.chips) throw new GameError("Not enough chips.");
    if (next > table.maxBet) throw new GameError("That exceeds the table maximum.");
    player.pendingBet = next;
    return table;
  }

  if (action.type === "clearBet") {
    if (table.phase !== "betting") throw new GameError("Betting is closed.");
    player.pendingBet = 0;
    return table;
  }

  if (action.type === "deal") {
    if (table.phase !== "betting") throw new GameError("Cards are already in play.");
    if (player.pendingBet < table.minBet) throw new GameError("Place a bet first.");
    startDeal(table);
    await persistIfSettled(table);
    return table;
  }

  if (action.type === "insurance") {
    if (table.phase !== "insurance") throw new GameError("Insurance is not offered.");
    if (player.insuranceDecision) throw new GameError("You already decided.");
    const hasBJ = player.hands.some((h) => isBlackjack(h.cards) && !h.fromSplit);
    if (action.take && hasBJ) {
      takeEvenMoney(player, table);
    } else if (action.take) {
      const base = player.hands[0]?.bet ?? 0;
      const cost = Math.floor(base / 2);
      if (cost <= 0) throw new GameError("No bet to insure.");
      if (player.chips < cost) throw new GameError("Not enough chips for insurance.");
      player.chips -= cost;
      player.insuranceBet = cost;
      player.insuranceDecision = "yes";
      table.message = `${player.displayName} took insurance.`;
    } else {
      player.insuranceDecision = "no";
    }
    resolveAutomatic(table);
    await persistIfSettled(table);
    return table;
  }

  if (action.type === "nextRound") {
    if (table.phase !== "payout") throw new GameError("The round is still in play.");
    resetRound(table);
    return table;
  }

  if (table.phase !== "acting" || table.currentPlayerId !== player.id) {
    throw new GameError("It is not your turn.");
  }

  if (
    action.type === "hit" ||
    action.type === "stand" ||
    action.type === "double" ||
    action.type === "split" ||
    action.type === "surrender"
  ) {
    applyPlayerDecision(table, player, action.type);
    resolveAutomatic(table);
    await persistIfSettled(table);
    return table;
  }

  throw new GameError("Unknown action.");
}

export async function mutateTable(
  tableId: string,
  userId: string,
  action: ClientAction,
) {
  return withTableLock(tableId, async () => {
    const table = getTable(tableId);
    if (!table) throw new GameError("Table not found.");
    await applyAction(table, userId, action);
    table.updatedAt = Date.now();
    broadcast(table);
    return toPublicTable(table, userId);
  });
}

export function broadcast(table: TableState) {
  notifyListeners(table.id, (listenerId) => toPublicTable(table, listenerId));
}
