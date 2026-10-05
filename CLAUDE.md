# Jeopardy Night

Omar's Jeopardy party game. It's played on a TV or laptop by a group of Egyptians in their mid-20s who speak English and know both Western and Egyptian pop culture. Teams pick tiles from 100 to 500, and each tile draws a random clue from that value's pool.

The game is a single page, `index.html`, that is **generated**. Don't edit it by hand. Edit the sources, then rebuild.

## Layout

- `index.html`: the built game, about 1 MB, with every clue inlined. It loads `photos/` and `sounds/` by relative path.
- `src/head.html`: the CSS and page shell. The Football mode colours are in the `body.football` rules near the top.
- `src/changelog.json`: the player-facing version history, shown when you tap the version on the title screen.
- `src/app.js`: the game logic. `CAT_GROUPS` sets the setup-screen groups, and `FOOTBALL` sets the Football mode pool (a random 6 are picked per game).
- `src/builtin.js` and `src/base.json`: the original categories and clues.
- `src/extra.js`: adds the v4 categories (Who Am I?, Stadiums, Formations, Guess the Food and others), and adds photo clues only when their photo exists.
- `build.js`: run `node build.js` to write `index.html`.
- `mkpacks.js`: run `node mkpacks.js` only when Guess the Food photos change. It rebuilds `photos/food-100.js` to `food-500.js` from `v4work/food-photos/` and needs ImageMagick's `convert`. Run `node mkpacks.js logo` when Guess the Logo images change; it rebuilds `photos/logo-100.js` to `logo-500.js` from `v4work/logo-photos/` (listed in `v4work/logo-photos.json`, downloaded by `v4work/logo-fetch.py`).
- `v4work/out/<id>.json`: each file replaces that category's clues at build time, in the shape `{id, name, type, desc, data:{"100":[...],...,"500":[...]}}`. The matching `.log.md` files list what each v4 pass changed.
- `v4work/*.json`: lists of photo clues (`new-photos.json`, `stadium-photos.json`, `food-photos.json`, `category-photos.json` for photo clues inside text categories, `photo-cats.json` for Guess the Country and Egypt: Photo Edition) and zoom spots (`new-photo-spots.json`).
- `v4work/BRIEF.md`: the clue-writing brief, covering audience, difficulty per value and the entry format for each category type. Read it before writing clues.
- `v4work/form/`, `form-sources.txt`, `form-gen.js`: Formations sources and generators.
- `photos/`: `<key>.jpg` photos for the photo rounds, plus `food-*.js` and `logo-*.js` bundles. Since 5.3 the game loads each `photos/food-*.jpg` directly and only uses a bundle when the single file is missing. Since 5.6 the food and `stadium-*` jpgs are web-sized copies (1024 px, quality 76) of the originals in `v4work/food-photos/` and `v4work/stadium-photos/`; re-make them from there if a photo changes.
- `answer.html` and `worker/index.js` (5.9): the phone answer page that teams reach by scanning a clue's QR code, and the small Cloudflare relay (`/api/*`, one Durable Object per game room) that passes answers to the laptop. They only work on the Cloudflare link; elsewhere the game hides the codes. `STEAL_SKIP` in `src/app.js` lists categories that never get a steal code.
- `sounds/siuuu.mp3`: the Football mode winner clip.
- `v4work/balls/`: round 128px .webp match balls shown next to the Football mode title, one per board. The build embeds them, so they don't add artifact files.
- `NOTES.md`: project notes, the full version history and how to undo each experiment.
- `BUILD.md`: a short build how-to.

## Making a change

1. Edit `src/` or `v4work/`.
2. Bump the version. The label is the `v5.N` string in `src/head.html` and `src/app.js`. Run `sed -i 's/v5\.3\b/v5.4/g' src/head.html src/app.js` with the current and next numbers (the `\b` stops `v5.1` also matching `v5.10`). 4.x ran from 4.00 to 4.99; 5.0 started a new era in `src/changelog.json`.
3. Run `node build.js`.
4. Add the new version at the top of `src/changelog.json` (one or two short lines a player would care about; it shows in the game when you tap the version number). Then update `NOTES.md`. Change the version line under "What's here", then add a `- 5.N (YYYY-MM-DD): …` entry at the end of the version history. Write it in plain language, and say what Omar asked for when it was his call.
5. Open `index.html` in a browser and check the change, on the board and in Football mode if it's affected.
6. Commit `src/`, `v4work/`, `index.html` and `NOTES.md` together.

## Conventions

- **Reversible experiments:** when Omar wants to try a look (for example the navy accents or the green shades), keep the previous values in a comment next to the new rule. Put the undo steps in that version's NOTES entry, so "go back" is a one-step change.
- **Clue quality:** follow `v4work/BRIEF.md`. Check facts that may have changed recently. Keep the counts per value within 2 of each other. Don't repeat an answer within a category unless the question is clearly different.
- **Photo clues:** a photo clue is included only when its `photos/<key>.jpg` exists. Blur visible signage or brand badges that would give the answer away.
- **File limit:** the live artifact holds at most 511 files. Since 4.56 the photo rounds use about 580, so the artifact can only be republished after bundling them as `.js` packs, the way Guess the Food does (see `mkpacks.js`). GitHub Pages, which Omar uses, has no limit.
- **Ask Omar first** before removing categories or clues, or changing how scoring works.

## Playing and publishing

- **Locally:** open `index.html` in a browser from a checkout. It works from `file://` because photos, sounds and food bundles load by relative path. It needs internet for its CDN scripts (QR code, JSZip, world map) and Google Fonts.
- **GitHub Pages:** in the repo's Settings, open Pages, set Source to "Deploy from a branch" and choose `main` / root. The game is then served at the Pages URL. A private repo needs a paid GitHub plan for Pages.
- **Cloudflare (faster for Omar):** GitHub Pages is very slow from Omar's connection (about 25 KB/s in `speed.html`, against 2 MB/s from Cloudflare), so the game is also deployed by Cloudflare Workers & Pages from this repo. Each merge to `main` runs `npx wrangler deploy`, which uses `wrangler.jsonc`: its build step copies `index.html`, `answer.html`, `speed.html`, `photos/` and `sounds/` into `dist/` and uploads only that, and `worker/index.js` answers `/api/*`. Keep any new file the browser loads in that copy list.
- **The live artifact** (https://claude.ai/artifact/X5vXepDtYQ7JTracXSmAeq) can only be republished from a claude.ai session with the Artifact tool, not from Claude Code. When Omar is back there, that session publishes `index.html` with `photos/` and `sounds/` as its files. Until then, Claude Code sessions commit to this repo, and the repo is where the latest version lives.
