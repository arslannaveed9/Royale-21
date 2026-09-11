import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { createUser, toPublicUser } from "@/lib/store";
import { fail } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      displayName?: string;
      password?: string;
    };
    const user = await createUser({
      username: body.username ?? "",
      displayName: body.displayName ?? "",
      password: body.password ?? "",
    });
    await setSessionCookie(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return fail(error);
  }
}
