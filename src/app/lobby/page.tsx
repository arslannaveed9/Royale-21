import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { listLeaderboard } from "@/lib/store";
import { LobbyClient } from "@/components/LobbyClient";

export const dynamic = "force-dynamic";

export default async function LobbyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const board = await listLeaderboard(user.id);
  return <LobbyClient user={user} board={board} />;
}
