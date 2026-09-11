import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import {
  broadcast,
  getTable,
  joinTable,
  withTableLock,
} from "@/lib/table-engine";

export const dynamic = "force-dynamic";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const user = await currentUser();
  if (!user) redirect(`/login?next=/join/${encodeURIComponent(code)}`);

  const existing = getTable(code);
  if (!existing) redirect("/lobby?missing=1");

  await withTableLock(existing.id, async () => {
    const table = getTable(existing.id);
    if (!table) return;
    joinTable(table, user);
    broadcast(table);
  });

  redirect(`/play/${existing.id}`);
}
