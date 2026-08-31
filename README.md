# Super Mario Bros - Retro Game Clone (Next.js / HTML5 Canvas / Web Audio)

Un hommage rétro et démonstration technique complète de jeu de plateforme 2D inspiré du classique *Super Mario Bros.*, développé avec **Next.js (App Router)**, **React**, **TypeScript**, **HTML5 Canvas** (résolution interne 256x240) et un synthétiseur audio **Web Audio API** 8-bit chiptune 100% autonome.

---

## ⚠️ Avertissement Légal & Clause de Non-Responsabilité / Legal Disclaimer

> **IMPORTANT :**
> - Ce projet est une **démonstration technique open-source à but strictement éducatif et non commercial**.
> - Ce projet n'est **NI affilié, NI sponsorisé, NI approuvé, NI développé en partenariat avec Nintendo Co., Ltd.** de quelque manière que ce soit.
> - **Super Mario Bros.**, **Mario**, **Nintendo** ainsi que tous les noms de personnages, graphismes, thèmes musicaux originaux et marques associées sont des propriétés intellectuelles et marques déposées exclusives de **Nintendo Co., Ltd.**
> - Aucun fichier de jeu original, ROM, extrait audio propriétaire MP3/WAV ou asset sous copyright de Nintendo n'est hébergé ou distribué dans ce dépôt. L'intégralité du rendu visuel Canvas et des effets sonores chiptune est générée dynamiquement par du code algorithmique open-source.

---

## 🚀 Fonctionnalités Principales

- **Rendu Canvas Auto-Adaptatif & Plein Écran Natif :** Support de l'API Fullscreen avec raccourci `F`, letterboxing propre et filtres CRT Scanlines configurables.
- **Moteur Audio Synthétique 8-bit (Web Audio API) :** Musiques BGM en boucle (Overworld, Underground, Castle, Starman), jingles d'événements et bruitages SFX 100% synthétisés sans fichier audio externe.
- **Menu Principal & Écrans de Transition Rétro :** Écran titre animé, sélecteur de modes (*1 Player Game* & *Endless Runner*), écran d'état "WORLD 1-1" et écran Game Over avec gestion du meilleur score (*High Score*).
- **Panneau de Réglages (Settings) & Persistance :** Contrôle des volumes (Master, BGM, SFX, Mute), choix des ratios d'affichage, filtres visuels, remapping complet des touches du clavier et sauvegarde automatique dans le `localStorage`.
- **Commandes Tactiles Réactives :** D-Pad virtuel et boutons A/B semi-transparents avec détection automatique sur smartphones et tablettes.

---

## 🎮 Contrôles & Raccourcis en Jeu

| Action | Clavier (Par défaut) | Commandes Tactiles (Mobile) |
| :--- | :--- | :--- |
| **Déplacement Gauche / Droite** | Flèches `◀` / `▶` ou `A` / `D` | D-Pad Virtuel `◀` / `▶` |
| **s'Accroupir** | Flèche `▼` ou `S` | D-Pad Virtuel `▼` |
| **Sauter** | Space / Flèche `▲` / `W` | Bouton **A (Jump)** |
| **Courir / Tirer Boule de Feu** | `Shift` ou `K` | Bouton **B (Run/Fire)** |
| **Pause** | `Escape` ou `P` | Bouton Pause en interface |
| **Plein Écran** | Touche `F` | Bouton Fullscreen `⛶` |

*Note : Les touches du clavier peuvent être librement personnalisées dans le menu **SETTINGS > CONTROLS**.*

---

## 🛠️ Installation & Lancement Local

### Prérequis
- Node.js (version 18+ recommandée)
- npm ou yarn

### Étapes d'installation

1. Cloner le dépôt et accéder au répertoire :
   ```bash
   git clone <URL_DU_DEPOT>
   cd super-mario-bros-clone
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Lancer le serveur de développement :
   ```bash
   npm run dev
   ```
   Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans votre navigateur.

4. Compiler pour la production :
   ```bash
   npm run build
   npm start
   ```

---

## 📄 Licence

Ce projet est sous licence [MIT](LICENSE). Développé à des fins éducatives et de démonstration technique.
