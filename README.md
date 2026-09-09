# Chrono Renfo

PWA de minuteur d'entraînement pour iPhone, sans dépendance externe.

## Fonctionnalités

- Création, modification et suppression de routines.
- Nom de routine personnalisable.
- Exercices réordonnables.
- Durée personnalisable pour chaque exercice.
- Récupération personnalisable après chaque exercice.
- Compte à rebours de préparation de 10 secondes.
- Affichage du temps restant, de l'exercice en cours et de l'étape suivante.
- Pause, reprise, passage à l'étape suivante et arrêt.
- Bips audio et vibration si le navigateur les autorise.
- Tentative de verrouillage d'écran via Screen Wake Lock quand disponible.
- Sauvegarde locale dans le navigateur (`localStorage`).
- Fonctionnement hors connexion après la première ouverture grâce au service worker.
- Aucun serveur applicatif, aucune base de données et aucune dépendance.

## Déployer sur GitHub Pages

1. Crée un dépôt GitHub, par exemple `chrono-renfo`.
2. Copie **le contenu de ce dossier** à la racine du dépôt.
3. Fais un commit puis un push.
4. Dans GitHub : **Settings → Pages**.
5. Choisis **Deploy from a branch**, puis la branche `main` et le dossier `/ (root)`.
6. Ouvre l'URL GitHub Pages fournie par GitHub.

Les chemins du projet sont relatifs afin de fonctionner aussi bien à la racine qu'à l'adresse d'un dépôt GitHub Pages.

## Installer sur iPhone

Dans Safari, ouvre l'adresse GitHub Pages, puis utilise **Partager → Sur l'écran d'accueil**. La PWA peut alors être lancée comme une application autonome.

## Données

Les routines sont stockées localement sur l'appareil dans le navigateur. Supprimer les données du site ou changer de navigateur/appareil ne transfère pas automatiquement les routines.

## Structure

```text
chrono-renfo/
├── index.html
├── styles.css
├── app.js
├── manifest.json
├── sw.js
├── README.md
└── assets/
    ├── icon.svg
    ├── icon-180.png
    ├── icon-192.png
    └── icon-512.png
```
