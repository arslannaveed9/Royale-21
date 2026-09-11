import { NextResponse } from "next/server";
import { currentUser, fail } from "@/lib/api";
import { GameError } from "@/lib/types";
import { getTable, joinTable, toPublicTable, withTableLock, broadcast } from "@/lib/table-engine";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user) return fail(new Error("Unauthorized"));
    const { id } = await context.params;
    const table = getTable(id);
    if (!table) throw new GameError("Table not found.");
    return NextResponse.json({ table: toPublicTable(table, user.id) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user) return fail(new Error("Unauthorized"));
    const { id } = await context.params;
    const publicTable = await withTableLock(id, async () => {
      const table = getTable(id);
      if (!table) throw new GameError("Table not found.");
      joinTable(table, user);
      broadcast(table);
      return toPublicTable(table, user.id);
    });
    return NextResponse.json({ table: publicTable });
  } catch (error) {
    return fail(error);
  }
}
