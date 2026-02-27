# VillePropre – Optimisation des tournées de collecte

Application front-end (React + Tailwind CSS) pour le système d’optimisation des tournées de collecte en 5 niveaux (cahier des charges PFM).

- **Niveau 1** : Graphe routier, matrice des distances, plus courts chemins (Dijkstra).
- **Niveau 2** : Affectation camion ↔ zone (graphe biparti, glouton, capacité).
- **Niveau 3** : Planification temporelle (créneaux, contraintes, plan hebdomadaire).
- **Niveau 4** : VRP enrichi – tournées optimisées (plus proche voisin, 2-opt). Itinéraires **sur les routes réelles** via Geoapify (pas de tracé au-dessus des bâtiments ou forêts).
- **Niveau 5** : Système dynamique (capteurs IoT simulés, urgences, pas de temps).

## Lancer l’application

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée (ex. http://localhost:5173).

## Geoapify

La clé API est définie dans `src/config.js`. Pour que la carte et le calcul d’itinéraires fonctionnent, **activer dans [Geoapify My Projects](https://myprojects.geoapify.com/)** les APIs : **Map Tiles** et **Routing API** (sans quoi une erreur 401 Unauthorized peut apparaître).

---

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
