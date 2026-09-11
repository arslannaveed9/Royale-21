export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type Phase =
  | "betting"
  | "insurance"
  | "acting"
  | "dealer"
  | "payout";

export type HandResult =
  | "win"
  | "lose"
  | "push"
  | "blackjack"
  | "surrender"
  | "bust"
  | "even-money";

export type HandStatus =
  | "pending"
  | "playing"
  | "stood"
  | "bust"
  | "blackjack"
  | "surrender"
  | "even-money";

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
}

export interface Hand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  result?: HandResult;
  payout?: number;
}

export interface PlayerState {
  id: string;
  username: string;
  displayName: string;
  chips: number;
  isAI: boolean;
  seat: number;
  hands: Hand[];
  activeHand: number;
  pendingBet: number;
  insuranceBet: number;
  insuranceDecision?: "yes" | "no";
  sittingOut: boolean;
  leaving: boolean;
  connected: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

export interface RoundResult {
  playerId: string;
  name: string;
  net: number;
  detail: string;
}

export interface TableState {
  id: string;
  code: string;
  name: string;
  hostId: string;
  mode: "solo" | "multi";
  maxSeats: number;
  minBet: number;
  maxBet: number;
  phase: Phase;
  message: string;
  players: PlayerState[];
  dealerCards: Card[];
  dealerRevealed: boolean;
  shoe: Card[];
  discard: Card[];
  currentPlayerId: string | null;
  chat: ChatMessage[];
  lastResults: RoundResult[];
  statsRecorded: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserStats {
  hands: number;
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
  biggestWin: number;
}

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  chips: number;
  stats: UserStats;
  history: { at: number; net: number; result: string }[];
  createdAt: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  chips: number;
  stats: UserStats;
  history: UserRecord["history"];
}

export interface ActionFlags {
  canAddChip: boolean;
  canClearBet: boolean;
  canDeal: boolean;
  canHit: boolean;
  canStand: boolean;
  canDouble: boolean;
  canSplit: boolean;
  canSurrender: boolean;
  canInsurance: boolean;
  evenMoney: boolean;
  canNextRound: boolean;
  canRebuy: boolean;
  canAddAI: boolean;
}

export interface PublicPlayer {
  id: string;
  username: string;
  displayName: string;
  chips: number;
  isAI: boolean;
  seat: number;
  hands: Hand[];
  activeHand: number;
  pendingBet: number;
  insuranceBet: number;
  insuranceDecision?: "yes" | "no";
  sittingOut: boolean;
  connected: boolean;
}

export interface PublicDealerCard {
  id: string;
  suit?: Suit;
  rank?: Rank;
  hidden?: boolean;
}

export interface PublicTable {
  id: string;
  code: string;
  name: string;
  hostId: string;
  mode: "solo" | "multi";
  maxSeats: number;
  minBet: number;
  maxBet: number;
  phase: Phase;
  message: string;
  players: PublicPlayer[];
  dealerCards: PublicDealerCard[];
  dealerRevealed: boolean;
  shoeCount: number;
  currentPlayerId: string | null;
  chat: ChatMessage[];
  lastResults: RoundResult[];
  you?: PublicPlayer;
  actions: ActionFlags;
  hint: string | null;
}

export interface TableSummary {
  id: string;
  code: string;
  name: string;
  mode: "solo" | "multi";
  hostName: string;
  playerCount: number;
  maxSeats: number;
  phase: Phase;
}

export type ClientAction =
  | { type: "addChip"; value: number }
  | { type: "clearBet" }
  | { type: "deal" }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "double" }
  | { type: "split" }
  | { type: "surrender" }
  | { type: "insurance"; take: boolean }
  | { type: "nextRound" }
  | { type: "chat"; text: string }
  | { type: "addAI" }
  | { type: "leave" }
  | { type: "rebuy" };

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}
