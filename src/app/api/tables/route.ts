import { NextResponse } from "next/server";
import { currentUser, fail } from "@/lib/api";
import {
  broadcast,
  createTable,
  listPublicTables,
  toPublicTable,
} from "@/lib/table-engine";

export async function GET() {
  const user = await currentUser();
  if (!user) return fail(new Error("Unauthorized"));
  return NextResponse.json({ tables: listPublicTables() });
}

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return fail(new Error("Unauthorized"));
    const body = (await request.json()) as {
      name?: string;
      mode?: "solo" | "multi";
      aiCount?: number;
      maxSeats?: number;
    };
    const mode = body.mode === "multi" ? "multi" : "solo";
    const table = createTable({
      host: user,
      name: body.name ?? "",
      mode,
      aiCount: Number(body.aiCount ?? 0),
      maxSeats: body.maxSeats,
    });
    broadcast(table);
    return NextResponse.json({ table: toPublicTable(table, user.id) });
  } catch (error) {
    return fail(error);
  }
}
