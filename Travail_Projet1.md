# TP1-AppWeb2_Jeu_d-checs
Création d'un jeu d'échecs simple où deux personnes peuvent s'affronter normalement tout en suivant les règles préétablis des échecs

# Points important
- **Pondération** : 10 %
- **Remise **: dépôt final, le dimanche 11 octobre 2026, à 23 h 59
- **Correction** : entretien individuel de 20 minutes, sous forme de revue de code, sur rendez-vous. Le lien pour réserver votre plage sera envoyé plus tard.
- **L'intelligence artificielle** : permise, pour tout : le code, les tests, etc. Une seule règle : tout ce qui est dans le dépôt doit pouvoir être expliqué,
                                    quel que soit l'auteur, humain ou non. Par exemple, une personne qui ne sait pas dire ce que fait un test ou pourquoi
                                    une route vérifie ce qu'elle vérifie n'a pas atteint l'objectif, même si le code marche.

# Description du jeu 
Une application où deux personnes jouent une partie d'échecs l'une contre l'autre, chacune depuis son navigateur. Un joueur se connecte avec son compte GitHub. Il a un nom et un classement Elo : un entier de 100 à 3000. Un nouveau joueur est inscrit avec un Elo de 1000.

Pour trouver un adversaire, on crée une partie privée : on reçoit un code, on le donne à la personne de son choix, qui rejoint avec ce code.

## Les règles des échecs
Les règles des échecs elles-mêmes (coups légaux, échec, mat, pat) ne sont pas l'objectif du cours. Prenez une bibliothèque existante (chess.js, par exemple). Vous n'avez pas à comprendre le fonctionnement interne de cette bibliothèque, mais vous devez justifier son choix et expliquer comment vous l'avez intégrée dans votre application.

## La partie privée
Un code est valide une seule fois : un code inconnu ou déjà utilisé est refusé. Une même personne ne peut pas jouer contre elle-même. Les couleurs sont tirées au sort quand l'adversaire rejoint.

## La fin d'une partie
Une partie se termine de trois façons : par mat, par nulle (pat, répétition, matériel insuffisant, règle des cinquante coups) ou par abandon. Un joueur peut abandonner à tout moment ; la partie est alors perdue pour lui et gagnée pour son adversaire. Dans les trois cas, le classement des deux joueurs est mis à jour.

Pour la partie nulle, il est possible de négliger les règles de répétition, de matériel insuffisant ou des cinquante coups dans ce projet.

## Le classement
Le classement Elo mesure la force d'un joueur. Il est mis à jour après chaque partie terminée, même si elle s'est terminée par un abandon. Le calcul se fait par la formule suivante :
``` bash
attendu(A) = 1 / (1 + 10 ** ((eloB - eloA) / 400))
nouvelElo(A) = eloA + 20 * (score(A) - attendu(A))
```
où score(A) vaut 1, 0,5 ou 0 selon que A gagne, annule ou perd. Celui qui abandonne perd. Le résultat est arrondi à l'entier le plus proche, puis ramené dans l'intervalle 100 à 3000.

# Description techniques
- Express pour l'API, React Router en mode framework pour le client, rendu côté serveur là où c'est bénéfique.
- La position vit dans la base (FEN et liste des coups), pas dans la mémoire du serveur : une partie survit à un redémarrage.
- La mise à jour de l'échiquier adverse se fait par interrogation périodique de l'API.
- Tout le SQL dans ``repository/`` ; SQLite (``node:sqlite``), le fichier de base sur un volume Docker.
- Tests d'intégration de l'API.
- ``.github/workflows/ci.yml`` : les tests à chaque ``push`` sur ``main``, si les tests passent, les images publiées sur ``ghcr.io`` avec les tags ``latest`` et ``sha-``.
- ``deploy/compose.yml`` avec ``image:`` et non ``build:``, le compte et le tag lus dans un ``.env`` posé à côté, hors dépôt, qui démarre l'application sur une machine où il n'y a que Docker.
- Les secrets (ex : identifiant et secret de l'application GitHub OAuth, clé de session) dans l'environnement, jamais dans le dépôt.
- ``deploy/.env.example`` : les variables attendues, avec des valeurs d'exemple, et un README.md qui dit comment démarrer l'application, en développement et sur la machine de déploiement.

# La remise
Avant le mercredi 7 octobre 2026, à 23 h 59 :

Le dépôt GitHub de l'équipe. S'il est privé, ajoutez-moi comme collaborateur (archambaultv) ; le paquet ghcr.io devra alors être rendu public.
Un tag Git v1 sur le commit remis. Ce qui est poussé après ne compte pas.
Sur LÉA : une seule remise par équipe, un fichier texte contenant
l'URL du dépôt ;
le nom des membres de l'équipe ;
le tag sha- des images à corriger, celui que la chaîne d'intégration continue a publié pour le commit marqué v1.
C'est ce tag que je mettrai dans mon .env pour démarrer votre application.
