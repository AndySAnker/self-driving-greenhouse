# Self-driving greenhouse: notes for Claude

A browser game for teaching self-driving labs (Andy S. Anker, DTU / ScatterLab). Hosted on GitHub Pages
at https://andysanker.github.io/self-driving-greenhouse/ (leaderboard screen: add `#board`).

## Build

- Source lives in `src/`: `head.html` (CSS + page skeleton, with a `/*__GAME_JS__*/` placeholder) and `js/*.js`,
  concatenated in file-name order.
- Run `python3 src/build.py` after every change. It rewrites `index.html` in the repo root.
- Never edit `index.html` by hand. Commit both `src/` and the rebuilt `index.html`.
- `three.min.js` is three.js r128 (MIT), served next to `index.html`.

## Code map

- `1_model.js`: conditions (water, light, fertiliser, temperature), the hidden height formula, planners
  (random, Bayesian optimisation, BO + rough twin, BO + detailed twin), economy ($12,000 budget).
- `2_world.js`: the 3D voxel greenhouse (three.js), camera, keyboard.
- `3_game.js`: Round 1 game loop, phases (build, plan, think, grow, wait), panels, charts, end screen, start screen.
- `3b_round2.js`: Round 2: multi-objective health score, ready-made GrowBox vs modular lab, sensors, breakdowns,
  halfway review, plant expert judge.
- `3c_tour.js`: first-time guided tour (full tour in Round 1, only the new features in Round 2).
- `4_board.js`: result codes and the class leaderboard. On GitHub Pages the live board uses ntfy.sh with
  the class name in `window.SDL_CLASS`; result codes are the fallback.

## Style rules from the author

- Easy to understand and dyslexia-friendly: Lexend font, short sentences, plain words, a Read aloud option.
- Budget is $12,000 everywhere. Do not show the hidden growth formula to players.
- Plot legends go in the upper right corner.
- Say "plants", not "beds", in player-facing text: N is the number of plants grown at once. (`G.beds` in code.)

## Testing

Headless Chromium with Playwright works (`--use-gl=swiftshader`). Route the cdnjs/fonts requests or serve the repo
folder with `python3 -m http.server` so `three.min.js` loads.
