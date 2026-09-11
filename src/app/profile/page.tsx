import { redirect } from "next/navigation";
import { currentUser } from "@/lib/api";
import { ClubNav } from "@/components/ClubNav";
import { money, signedMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { stats } = user;
  const winRate = stats.hands ? Math.round((stats.wins / stats.hands) * 100) : 0;

  return (
    <main className="page-shell">
      <ClubNav user={user} />
      <section className="panel" style={{ width: "min(720px, 100%)", margin: "0 auto" }}>
        <p className="eyebrow">Membership book</p>
        <h1>{user.displayName}</h1>
        <p className="muted">@{user.username}</p>
        <div className="stats-grid" style={{ marginTop: 24 }}>
          <div className="stat">
            <span>Bankroll</span>
            <b>{money(user.chips)}</b>
          </div>
          <div className="stat">
            <span>Hands</span>
            <b>{stats.hands}</b>
          </div>
          <div className="stat">
            <span>Win rate</span>
            <b>{winRate}%</b>
          </div>
          <div className="stat">
            <span>Blackjacks</span>
            <b>{stats.blackjacks}</b>
          </div>
          <div className="stat">
            <span>Biggest win</span>
            <b>{money(stats.biggestWin)}</b>
          </div>
          <div className="stat">
            <span>Record</span>
            <b>
              {stats.wins}-{stats.losses}-{stats.pushes}
            </b>
          </div>
        </div>
        <h2 style={{ marginTop: 28 }}>Recent markers</h2>
        {user.history.length === 0 ? (
          <p className="muted">No hands recorded yet. The felt is waiting.</p>
        ) : (
          <ol className="leader">
            {user.history
              .slice()
              .reverse()
              .map((row, i) => (
                <li key={`${row.at}-${i}`}>
                  <span>{row.result}</span>
                  <b>{signedMoney(row.net)}</b>
                </li>
              ))}
          </ol>
        )}
      </section>
    </main>
  );
}
