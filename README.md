# Hamster Chariot

A browser game. You're a hamster in a chariot pulled by an AI agent, dodging merge requests, issues, CVEs and red pipelines while the agent burns tokens.

Steer with the arrow keys or W/S (on a phone, drag up and down). P pauses, M mutes, N toggles music, H shows high scores, C hands the run to Claude, K makes Claude crash.

## Run it

```sh
go run . -addr :8080 -scores scores.json
```

Open http://localhost:8080. The Go server serves the game and a shared high-score board, stored in the `-scores` JSON file. Opened straight from disk, `index.html` keeps scores in that browser only.

Options:

- `-password` (or `HAMSTER_PASSWORD`): ask players for a password first (case-insensitive). Empty means no password.
- `-behind-proxy`: trust `X-Forwarded-For` for the per-player rate limits.

## What's where

| File | What it holds |
|---|---|
| `index.html` | The page structure: HUD, buttons, overlays |
| `style.css` | All styling, including each theme's look |
| `game.js` | The game: loop, blockers, Claude's autopilot, themes, music, sound |
| `main.go` | The server: static files, high scores, cache headers |
| `gate.go` | The password page and login rate limit |
| `assets/` | Images |

## Feature flags

The defaults live in `FEATURES` at the top of `game.js`. Override any of them for one visit from the URL, for example `?on=extraAgents,botToasts&off=coins`.

| Flag | Default | What it does |
|---|---|---|
| `agentCode` | off | Agents throw off snippets of real code |
| `autoMusic` | on | The theme's song starts 5s into a run |
| `musicNotes` | off | Music notes float up while the song plays |
| `coins` | on | +1K and +5K token coins |
| `lgtm` | on | The LGTM! banner and ×2 burn rate every 25 blockers |
| `celebrations` | off | Bursts of tadas, parrots, check marks and `:merged:` every 50 and 100 |
| `matrixMode` | on | Every 250 blockers, 10s of matrix mode with a deploy pipeline |
| `claudeButtons` | on | "Make Claude play", the mid-run hand-over and "Kill Claude" |
| `characterButton` | on | The "Change character" button |
| `themeButton` | on | The "Theme" button |
| `extraThemes` | off | Adds Medieval, RuneScape, Age of Empires, Sci-fi city, Zen garden and Fancy hotel |
| `whip` | off | Riders other than the hamster crack a whip |
| `extraAgents` | off | More agents keep joining |
| `botToasts` | off | The agents' own passive-aggressive chatter |
| `gameToasts` | on | Plain game updates when the bot is quiet |

`?code=go,ruby,python` picks the code languages (`CODE_LANGUAGES` in `game.js`). `?agents=N` starts with N agents; runs started that way don't count for high scores.

## Themes

The Theme button cycles GitLab, Matrix, Desert, Retro 2000s, Retro 90s, Windows XP and LGTM (plus the extra themes when that flag is on). Each theme has its own scene, sound font and song. The songs are synthesised in the browser from specs in `SONGS`; the LGTM theme plays `assets/lgtm.mp3`, which is not in this repository: put your own MP3 there, or the LGTM theme plays silently. Changing theme mid-song pauses the music for 5s before the new song starts.

## High-score API

- `GET /api/scores` returns the top 5.
- `POST /api/scores` with `{"name", "score", "agents", "secs"}` adds a score and returns the new top 5.

The server checks names (1 to 16 characters) and rejects impossible scores. Scores come from the browser, so a determined player can still post a fake one. Runs Claude plays never offer to save a score.

## Deploy

`docker-compose.yml` builds the server and joins the shared `edge` Docker network, where a reverse proxy serves it. Copy `.env.example` to `.env` and set `HAMSTER_PASSWORD` first; `.env` is kept out of git. Scores persist in `./data`.

```sh
docker compose up -d --build
```

Image credits: agent logos from LobeHub icons and `@gitlab/svgs`, the ship-it parrot from Cult of the Party Parrot, the "This is fine" dog by KC Green (from his webcomic *Gunshow*), `:merged:` icons from Slackmojis. Code snippets are real lines from MIT, BSD and Apache-licensed projects (credited in `game.js`).
