import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import {
  MAX_HISTORY,
  STARTING_CHIPS,
} from "./constants";
import type { PublicUser, UserRecord, UserStats } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

type StoreShape = { users: UserRecord[] };

const g = globalThis as unknown as {
  __royaleUsers?: Map<string, UserRecord>;
  __royaleUserLock?: Promise<void>;
};

function emptyStats(): UserStats {
  return {
    hands: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    blackjacks: 0,
    biggestWin: 0,
  };
}

async function ensureLoaded() {
  if (g.__royaleUsers) return;
  g.__royaleUsers = new Map();
  try {
    const raw = await fs.readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as StoreShape;
    for (const user of parsed.users ?? []) {
      g.__royaleUsers.set(user.id, user);
    }
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function persist() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const users = [...(g.__royaleUsers?.values() ?? [])];
  await fs.writeFile(
    USERS_FILE,
    JSON.stringify({ users }, null, 2),
    "utf8",
  );
}

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const prior = g.__royaleUserLock ?? Promise.resolve();
  let release: () => void = () => {};
  g.__royaleUserLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prior;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    chips: user.chips,
    stats: user.stats,
    history: user.history,
  };
}

export async function getUserById(id: string) {
  await ensureLoaded();
  return g.__royaleUsers!.get(id) ?? null;
}

export async function getUserByUsername(username: string) {
  await ensureLoaded();
  const key = username.trim().toLowerCase();
  for (const user of g.__royaleUsers!.values()) {
    if (user.username === key) return user;
  }
  return null;
}

export async function createUser(input: {
  username: string;
  displayName: string;
  password: string;
}) {
  return withLock(async () => {
    await ensureLoaded();
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,16}$/.test(username)) {
      throw new Error("Username must be 3-16 characters: letters, numbers, underscore.");
    }
    if (input.password.length < 6) {
      throw new Error("Password must be at least 6 characters.");
    }
    const displayName = input.displayName.trim().slice(0, 24) || username;
    if (await getUserByUsername(username)) {
      throw new Error("That username is already taken.");
    }
    const user: UserRecord = {
      id: crypto.randomUUID(),
      username,
      displayName,
      passwordHash: bcrypt.hashSync(input.password, 10),
      chips: STARTING_CHIPS,
      stats: emptyStats(),
      history: [],
      createdAt: Date.now(),
    };
    g.__royaleUsers!.set(user.id, user);
    await persist();
    return user;
  });
}

export async function verifyLogin(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new Error("Invalid username or password.");
  }
  return user;
}

export async function saveUser(next: UserRecord) {
  return withLock(async () => {
    await ensureLoaded();
    g.__royaleUsers!.set(next.id, next);
    await persist();
    return next;
  });
}

export async function patchUser(
  id: string,
  patch: Partial<Pick<UserRecord, "chips" | "stats" | "history">>,
) {
  return withLock(async () => {
    await ensureLoaded();
    const user = g.__royaleUsers!.get(id);
    if (!user) return null;
    if (patch.chips !== undefined) user.chips = patch.chips;
    if (patch.stats) user.stats = patch.stats;
    if (patch.history) user.history = patch.history.slice(-MAX_HISTORY);
    await persist();
    return user;
  });
}

export async function listLeaderboard(_viewerId?: string) {
  await ensureLoaded();
  return [...g.__royaleUsers!.values()]
    .filter((user) => user.stats.hands > 0)
    .map(toPublicUser)
    .sort((a, b) => b.chips - a.chips || b.stats.wins - a.stats.wins)
    .slice(0, 20);
}
