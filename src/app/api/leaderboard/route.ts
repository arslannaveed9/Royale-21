import { NextResponse } from "next/server";
import { currentUser } from "@/lib/api";
import { listLeaderboard } from "@/lib/store";

export async function GET() {
  const user = await currentUser();
  const players = await listLeaderboard(user?.id);
  return NextResponse.json({ players });
}
