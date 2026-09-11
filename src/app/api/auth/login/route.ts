import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { toPublicUser, verifyLogin } from "@/lib/store";
import { fail } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const user = await verifyLogin(body.username ?? "", body.password ?? "");
    await setSessionCookie(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (error) {
    return fail(error);
  }
}
