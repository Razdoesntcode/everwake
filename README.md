# Everwake

A single-player MMO simulation: a living fantasy realm that keeps playing while you
find your own road. Built with Vite + TypeScript and a hand-drawn canvas renderer.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev        # dev server with hot reload
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
```

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | Move |
| `Tab` | Cycle target |
| `1`–`4` | Abilities |
| `E` | Interact / loot / turn in |
| `C` | Character, bag and equipment |
| `L` | Quest log |
| `M` | World map |
| `O` | Social panel |
| `H` | Help |
| `Enter` or `/` | Chat |
| `Esc` | Close panel |

## Deploying to GitHub Pages

The site is a static bundle. `vite.config.ts` sets `base: "./"` so the build works at a
project path such as `https://<user>.github.io/everwake/` as well as at a custom domain.

1. Push this repository to GitHub with `main` as the default branch.
2. In **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
   This one-time toggle is required: the workflow cannot enable Pages with the default
   `GITHUB_TOKEN` (the `configure-pages` `enablement` option needs a separate
   administrator-scoped token).
3. Push to `main`, or run the **Deploy to GitHub Pages** workflow manually from the
   Actions tab. It typechecks, builds, uploads `dist/` and deploys it.

On GitHub's free plan, Pages only publishes from a **public** repository; publishing from
a private repository requires GitHub Pro. The published site itself is always public.

## Layout

- `src/main.ts` — bootstrap, input handling, game loop
- `src/game/engine.ts` — simulation: movement, combat, quests, loot, NPCs, events
- `src/game/render.ts` — canvas world, entities, effects, minimap and world map
- `src/game/data.ts` — classes, abilities, items, quests, zones, dialogue
- `src/game/ui.ts` — HUD, panels, character creation, chat, tooltips
- `src/game/audio.ts` — procedural Web Audio sound and ambience
- `src/game/types.ts` — shared types
- `src/style.css` — UI styling
