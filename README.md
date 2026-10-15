# Self-driving greenhouse

A browser game about self-driving labs, made for teaching. Players run an automated greenhouse and see the idea from
"In Pursuit of the Exceptional" (JACS 2023): the chance of finding an exceptional result is

P = 1 − (1 − p)^(N·t)

More beds raise N (automation). Smarter planners raise p (AI).

- **Round 1: Grow tall plants.** Spend $12,000 on beds and planners, then run a 49-day campaign.
- **Round 2: What is a healthy plant?** Define health with several objectives, choose a ready-made or modular lab,
  pick sensors, and let a plant expert judge the result.

## Play

Open `index.html` through the website (GitHub Pages). It needs no login and no installation, and works on laptops and phones.

## Class leaderboard

When a team finishes, its result is sent to a live class board. Results are short text messages
(team name and scores only) passed through the free public relay [ntfy.sh](https://ntfy.sh) and kept there for about 12 hours.

- The class name is set near the top of `index.html` (`window.SDL_CLASS = "..."`).
- You can also use another class name for a session by adding it to the link: `.../?class=monday`.
- Open the leaderboard on the teacher screen: `.../?class=monday#board`.
- Anyone who knows the class name can see or add results, so use a name that is hard to guess.
- If the relay cannot be reached, every team still gets a result code. Type the codes into the leaderboard.
- "Clear this board" hides older results on that one screen.

## Files

- `index.html`: the game (everything in one file)
- `three.min.js`: three.js r128 (MIT licence), used for the 3D view
