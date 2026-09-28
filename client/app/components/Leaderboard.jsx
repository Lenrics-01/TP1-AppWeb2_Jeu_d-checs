// Le classement des meilleurs joueurs (données fournies par le loader de l'accueil).
export default function Leaderboard({ players, currentId }) {
  return (
    <section className="card">
      <h2>Classement</h2>
      {players.length === 0 ? (
        <p className="muted">Aucun joueur pour l’instant.</p>
      ) : (
        <ol className="leaderboard">
          {players.map((p) => (
            <li key={p.id} className={p.id === currentId ? 'me' : undefined}>
              <span className="player-name">{p.name}</span>
              <span className="elo">{p.elo}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
