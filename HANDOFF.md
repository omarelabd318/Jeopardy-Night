# Handoff: where Jeopardy Night stands (7 October 2026)

This is for a new Claude session picking up the game, for example in Omar's Claude Project. Read `CLAUDE.md` first: it has the
layout, the build and the publishing steps. This file adds what isn't written down anywhere else: how Omar likes to work,
what's open, and how to test. `NOTES.md` has the full version history and the undo steps for every change.

## The state of the game

- **Version:** v6.43, merged to `main` in PR #94 on 2026-10-07. 112 categories (not counting mixes), about 16,800 clues, 12 mixes.
- **Where it lives:**
  - The GitHub repo `omarelabd318/Jeopardy-Night` is the only up-to-date copy.
  - Cloudflare Workers & Pages deploys every merge to `main`. This is the link Omar plays from, because it's fast for him.
  - GitHub Pages also works.
  - The old claude.ai artifact is out of date and can only be republished from claude.ai.
- **The Project's own files are out of date.** Omar used this Claude Project for part of v4 (4.00–4.99), before the game moved to this repo.
  - Any game files, clue JSON or notes stored in the Project's knowledge are old. Treat the repo as the truth and don't copy from them.
  - `v4work/BRIEF.md` still mentions `/mnt/project-files/jeopardy/...` paths from that time. In the repo those are `v4work/in/`, `v4work/out/` and so on.
  - The brief's rules on audience, difficulty and entry formats still apply.

## How Omar works (keep doing this)

- **Messages:**
  - He sends several requests in one message, or queues them while away.
  - When he asks, give a numbered preview of every task before starting, and an overview at the end with screenshots of what changed.
  - Then do the work without asking again.
- **Batching and merging:**
  - Batch the work into PRs and update the PR description as each version is added.
  - After he merges, Cloudflare must finish its build (the green tick in Build history) before the next merge, or a build gets skipped.
  - Remind him of this when you hand over a PR.
- **Every change** follows the steps in `CLAUDE.md`:
  1. Bump the version.
  2. Add a changelog line.
  3. Add a NOTES entry in plain language, saying what Omar asked and how to undo it.
  4. Build and test.
  5. Commit and push.
  - Keep old values in comments so "go back" is one step.
- **Ask Omar first** before removing clues or categories, or changing scoring. When he asks for something to be "better" or "harder", keep the old file in `v4work/out/old/` and say so.
- **Scenes:** he cares a lot about realism in the bottom-of-screen scenes and checks small details: hands, timing, which side of the car, speeds. Always test with frame captures (below) and look at the frames before pushing.
- **Branches:**
  - Work on the session's designated branch only.
  - If its PR was already merged, restart the branch from `main` and open a new PR.
  - Never force-push.

## Open items

1. **Photo credits.** The 50 Animal Kingdom (`an-*`) and Landmarks (`lm-*`) photos (6.42) are each the lead image of the matching Wikipedia article. Their file name and licence still need adding to `v4work/category-photos/SOURCES.md`; Wikimedia rate-limited the lookup. The article titles are:
   - **Animals:** Red panda, Brown-throated sloth, Platypus, Toco toucan, Veiled chameleon, Axolotl, Sunda pangolin, Capybara, Meerkat, Narwhal, Okapi, Fennec fox, South American tapir, West Indian manatee, Quokka, Aye-aye, Shoebill, Star-nosed mole, Saiga antelope, Maned wolf, North Sulawesi babirusa, Gerenuk, Binturong, Fossa (animal), Takin.
   - **Landmarks:** Colosseum, Taj Mahal, Statue of Liberty, Big Ben, Sydney Opera House, Al-Khazneh, Machu Picchu, Christ the Redeemer (statue), Sagrada Família, Golden Gate Bridge, Angkor Wat, Neuschwanstein Castle, Hagia Sophia, El Castillo, Chichen Itza, Moai, Alhambra, Potala Palace, Sheikh Zayed Grand Mosque, Mont-Saint-Michel, Forbidden City, Meteora, Hallgrímskirkja, Atomium, Prambanan, Fushimi Inari-taisha.
   - **Done so far:** Red panda, Axolotl and Platypus are all CC BY-SA 4.0.
2. **NSFW round top-up** (the locked x18 category, about 20 photos per value from Wikimedia Commons). This was on the list but never started. Ask Omar before doing it.
3. **Side-game ideas** Omar asked about, with no decision yet:
   - Who Wants to Be a Millionaire, using the Facts and Real Headline A/B/C clues and phones for Ask the Audience;
   - a 60-second Hot Seat;
   - Higher or Lower on the Spotify, Instagram and Price Is Right numbers;
   - a category draft;
   - a photo sprint.

## Recent decisions worth knowing (6.20–6.43)

- **Mixes** (`MIXES` in `build.js`, `mixPick` in `src/app.js`):
  - A mix tile opens a real clue from one of its source categories. It prefers sources that aren't on the board, and a mix can include another mix.
  - The clue heading reads "Mix · Source", with the source in gold.
  - Players edit each mix's sources in the Edit mixes panel, which sits above Teams. A mix can only use categories from its own section (`MIX_SECTION`, `mixAllowed`); Everything Mix can use any.
  - Edits are saved per device in `jn_mixes`. An edited mix shows a ✎ on its chip, and its hover tip is a bullet list of its sources.
  - TV Show Mix is a real mix of the eight show categories (plus Netflix Hits if chosen).
  - Everything Mix (`mixall`) is every category except Act It Out (both), One Word Clues, the locked one and hidden ones. New categories join it automatically.
- **Counting and hiding categories:**
  - The title count leaves out mixes.
  - The Parent Trap is hidden (`HIDDEN_IDS`); its clues stay in the build.
  - NSFW (`x18`) is locked behind a code. Its tip says "Code required" until it's unlocked.
- **Street scene** (normal mode; the big block in `src/app.js` starting "5.52 (Omar): normal mode street scene"):
  - Seven acts play in turn (ten until 6.46, when three pairs were combined), and every other full round is mirrored (`flip`).
  - A bawab with his plastic chair visits now and then (`bawabOnAct`).
  - Since 6.41 it keeps playing, faint, behind an open clue.
  - Each act's NOTES entry explains its timing variables.
  - Recent asks: the sweeper begs at the driver's window, going round to the far side on mirrored rounds (6.43); one sheep stops halfway and one near the exit, and the man never speeds up (6.41).
- **Football mode kickers:**
  - A 22-touch rotation (`ROT`).
  - Each board opens with a sole roll, flick-up and volley (`INTRO`), added in 6.41.
- **Flags:** the drawings live in `photos/flags/<iso>.svg`, and since 6.41 they download with the board so they appear without delay.
- **Clue content in 6.42:**
  - New categories: Tennis, Oldies, Facts, Holidays & Traditions, Animal Kingdom, Cocktails & Drinks and Landmarks.
  - What's the Link? was made a level harder.
  - Riddles were fully rewritten to avoid the classic clichés.
  - Put It in Order got 50 more clues.

## Testing toolkit (`v4work/tools/`)

- **`mktest.py`:** writes `_test.html`, a copy of the game with optional tweaks. Never commit it.
  - `--flip` mirrors every street round.
  - `--bawab KIND SIDE` forces the bawab's visit.
  - `--unlock` lets any code open the locked category.
- **`scene.js`:** saves street-scene frames at exact times using a fake clock, so the act order is repeatable. Its header lists rough start times for each act at 1400 px. Check frames at 800 px too, because some acts depend on the screen width.
- **`kick.js`:** saves Football mode kicker frames at exact times.
- **`check-out.py`:** validates `v4work/out/*.json`: valid JSON, no duplicate clues, value counts within 2.
- **Playwright** is preinstalled in Claude Code cloud sessions (`require('playwright')`). Don't run `playwright install`.
- **Contact sheets:** look at frames by stitching them with ImageMagick (`convert a.png b.png -append out.png`, or `montage`), then open the result.

## Network quirks in Claude Code cloud sessions

- **Works:** Wikipedia (WebFetch and its REST API), the npm registry and Wikimedia.
- **Blocked:** IMDb, Fandom, TV Tropes, Wikiquote, jsDelivr, githubstatus.com and workers.dev.
- **Wikimedia rate limits:** it rate-limits quickly (HTTP 429).
  - Space requests several seconds apart and wait about a minute after a 429.
  - Thumbnails only come in standard widths; 960 px sometimes fails, and the full original always works.
  - `v4work/photo-fetch.py` shows a pattern that works.
- **GitHub pushes** sometimes fail for a while with "Internal Server Error". Retry about once a minute; it went through on the 7th try on 7 October.
- **Fact checking:** for anything about 2026 (tournaments, results, releases), check with a web search first and leave it out if you can't confirm it.
