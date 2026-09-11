import { NextResponse } from "next/server";
import { currentUser, fail } from "@/lib/api";
import { mutateTable } from "@/lib/table-engine";
import type { ClientAction } from "@/lib/types";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user) return fail(new Error("Unauthorized"));
    const { id } = await context.params;
    const action = (await request.json()) as ClientAction;
    const table = await mutateTable(id, user.id, action);
    return NextResponse.json({ table });
  } catch (error) {
    return fail(error);
  }
}
