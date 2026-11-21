# Chrono Renfo — V3

Application web progressive (PWA) de chronométrage de routines de renforcement musculaire. Aucun framework ni dépendance externe.

## Nouveautés V3
- Nombre de tours configurable par routine (1 à 20).
- Durée de récupération configurable entre les tours.
- Écran d’accueil simplifié : toucher une carte ouvre son détail ; le bouton vert lance directement la séance.
- Modification et suppression accessibles depuis l’édition de la routine.
- Sauvegarde et restauration de toutes les routines au format JSON.
- Migration automatique des routines V1 : les routines existantes conservent leurs exercices, durées et récupérations ; elles reçoivent 1 tour par défaut.

## Déploiement GitHub Pages
1. Décompresser l’archive.
2. Remplacer les fichiers du dépôt par le contenu du dossier `chrono-renfo` (à la racine du dépôt).
3. Commit / push sur la branche configurée dans GitHub Pages.
4. Ouvrir l’application et attendre le rechargement de la nouvelle version.

## Important : conservation des routines
La clé de stockage locale reste `chrono-renfo-routines-v1`, identique à la V1. Les données ne sont pas supprimées lors du déploiement. La V3 ajoute les champs `rounds` et `interRoundRest` à la volée, avec des valeurs par défaut, sans effacer les données existantes.

Par précaution, après l’installation de la V3, utiliser **Sauvegarder** et conserver le fichier JSON dans iCloud Drive ou Fichiers.

## Installation iPhone
Ouvrir l’URL GitHub Pages dans Safari, puis Partager → Sur l’écran d’accueil.

## Fichiers
- `index.html` : structure de l’application
- `styles.css` : interface
- `app.js` : routines, éditeur, sauvegarde/restauration et chronomètre
- `manifest.json` : configuration PWA
- `sw.js` : cache hors connexion et mise à jour
- `assets/` : icônes
