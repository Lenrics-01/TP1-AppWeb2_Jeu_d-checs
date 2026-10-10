// Le classement des meilleurs joueurs (données fournies par le loader de l'accueil).
// Props :
// - players : les joueurs, déjà triés par Elo par l'API ;
// - currentId : l'id du joueur connecté, surligné dans la liste (absent si personne n'est connecté).
export default function Leaderboard({ players, currentId }) {
  return (
    <section className="card">
      <h2>Classement mondial</h2>
      {players.length === 0 ? (
        <p className="muted">Aucun joueur pour l’instant.</p>
      ) : (
        // <ol> : liste numérotée, le rang (1, 2, 3...) s'affiche tout seul.
        <ol className="leaderboard">
          {/* key={p.id} : un identifiant unique par ligne, pour que React sache quelle ligne a changé. */}
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
