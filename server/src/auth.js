// Connexion avec GitHub (OAuth).
//
// 1. Le client redirige le navigateur vers github.com/login/oauth/authorize.
// 2. GitHub renvoie le navigateur vers le client avec un "code" à usage unique.
// 3. Le client envoie ce code à l'API (POST /api/auth/github).
// 4. L'API échange le code contre un jeton d'accès GitHub (c'est ici qu'on a
//    besoin du secret : il reste donc côté API) puis lit le profil de l'utilisateur.
//
// Ce module est injecté dans createApp : les tests le remplacent par un faux,
// pour ne pas dépendre de GitHub.

export function createGithubClient({ clientId, clientSecret, fetchFn = fetch }) {
  return {
    /** Renvoie { githubId, name } pour le code reçu de GitHub, ou lève une erreur. */
    async exchangeCode(code, redirectUri) {
      const tokenResponse = await fetchFn('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) {
        throw new Error(tokenData.error_description ?? 'Échange du code GitHub refusé');
      }

      const userResponse = await fetchFn('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'tp1-echecs',
        },
      });
      if (!userResponse.ok) throw new Error('Profil GitHub illisible');
      const user = await userResponse.json();

      // L'id numérique ne change jamais, contrairement au login : c'est lui qui identifie.
      return { githubId: String(user.id), name: user.login };
    },
  };
}
