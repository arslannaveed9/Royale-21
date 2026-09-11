import { GameTable } from "@/components/GameTable";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <GameTable tableId={id} />;
}
