import { NextResponse } from "next/server";
import { requireUser } from "./auth";
import { GameError } from "./types";
import type { PublicUser } from "./types";

export async function currentUser(): Promise<PublicUser | null> {
  try {
    return await requireUser();
  } catch {
    return null;
  }
}

export function fail(error: unknown, fallback = "Something went wrong.") {
  const message = error instanceof Error ? error.message : fallback;
  const status =
    message === "Unauthorized"
      ? 401
      : error instanceof GameError || message !== fallback
        ? 400
        : 500;
  return NextResponse.json({ error: message }, { status });
}
