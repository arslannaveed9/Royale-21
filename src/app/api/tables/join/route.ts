import { NextResponse } from "next/server";
import { currentUser, fail } from "@/lib/api";
import { GameError } from "@/lib/types";
import {
  broadcast,
  getTable,
  joinTable,
  toPublicTable,
  withTableLock,
} from "@/lib/table-engine";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail(new Error("Unauthorized"));
    const body = (await request.json()) as { code?: string; id?: string };
    const key = (body.id || body.code || "").trim();
    if (!key) throw new GameError("Enter a table code.");
    const existing = getTable(key);
    if (!existing) throw new GameError("No table found with that code.");
    const publicTable = await withTableLock(existing.id, async () => {
      const table = getTable(existing.id);
      if (!table) throw new GameError("No table found with that code.");
      joinTable(table, user);
      broadcast(table);
      return toPublicTable(table, user.id);
    });
    return NextResponse.json({ table: publicTable });
  } catch (error) {
    return fail(error);
  }
}
