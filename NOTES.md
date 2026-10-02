# Jeopardy Night: project notes

Source: https://claude.ai/artifact/X5vXepDtYQ7JTracXSmAeq (Omar's artifact, version saved 2026-10-02)

## What's here
- `index.html`: the whole game, v4.27 (published 2026-10-02 as artifact version 1790946562-d421). It's one file with every clue built in.
- `index-v3.59.html`: backup of the previous version.
- `photos/`: 420 built-in photos (cars, actors, footballers, and 70 for Guess the Person), loaded as `photos/<key>.jpg`.
- `v4work/`: the v4 build inputs. `out/<id>.json` holds each category's final clues and `out/<id>.log.md` lists what changed.
- The page needs internet for its CDN scripts (QR code, JSZip, world map) and Google Fonts.

## State at v3.59
- 67 categories, 6,832 clues (the title screen says "6,300+").
- Smallest pools: World Cup 2026 (50), Emoji Sentences: Egypt Edition (50).
- Teams, a turn highlight, score editing, half points, an Act It Out QR code and 1-minute timer, photo zoom rounds, and photo import and export.

## Photos that were duplicates (fixed in v4.01)
- bukayosaka = abdelzaherelsaqqa
- hossamashour = emamashour
- rivaldo = carlosvalderrama
- zinedinezidane = mohamedzidan

## Visual check of all 244 photos (2026-10-02; the car issues below were fixed in v4.01)
- Wrong car version, because the photo source maps to a general Wikipedia page:
  - lanciadeltaintegrale shows a plain Lancia Delta (source "Lancia_Delta").
  - lotusesprits1 shows a later rounded Esprit (source "Lotus_Esprit").
  - subaruimpreza22b shows a modern Impreza hatchback.
  - mercedesbenz300slgullwing shows the 1952 W194 racing coupe, not the road car (minor).
- I couldn't confirm by eye which Ashour the #25 photo shows. I also can't strictly verify lesser-known faces.

## v4.00 plan (built and published 2026-10-02)
1. Quality check of every existing clue.
2. 50 new clues per category (about 30 for the thinner ones).
3. Power-ups in each team's scoreboard box, one use each per team:
   - ×2 (Double points): tapped on the team's turn before picking a tile, turns gold as "×2 ready", can be cancelled before picking, and doubles any points won on that tile. It greys out once used.
   - 2 answers: tapped while a clue is open; the card shows "2 answers allowed". It greys out once used.
   - Both appear only if power-ups are switched on in setup.
4. Winner screen.
5. Countdown sound "C_soft_end": five soft ticks in the last 5 seconds, then a quiet bell-like chime that fades out (no buzzer). Mute switch in setup and a sound on/off button in the in-game top bar next to Full screen. The two stay in sync, and the setting is saved.
6. Optional: a What's New page on the title screen.

### Scope Omar confirmed (2026-10-02, thread "Planning version 4")
- Items 1 to 5 are in. The What's New page is out.
- No new clues for the three photo rounds (Guess the Car, Actor, Footballer).
- No hand-added clues for TV Show Mix. It is built from the 7 single-show categories (`index.html` ~line 2278), so it grows when they do.
- New: an End game button that opens the winner screen early.
- New category: Guess the Person. A zoomed photo of a famous person, and teams guess who it is. It works like the other photo rounds. 80 people (16 per value), anyone famous, half of them Egyptian. Nobody who already appears in Guess the Actor or Guess the Footballer.
- General polish: fix bugs found while testing, smooth out the animations and transitions, make buttons and spacing consistent, check the layout on a TV, laptop and phone, and tidy setup.
- Rebalance values: inside each category, move clues that are too easy or too hard to a lower or higher value. Keep the counts per value roughly even.

## Version history (from the original chat)
- v1.x: Core game. 12 starting categories, a classic blue board, 45 s timer, photo rounds, Egypt and Arab World.
- v2.x: Many new categories (emoji, riddles, Egypt editions, shows, football competitions, languages, and more). Act It Out QR code, half points, turn highlight, "Are you sure?" prompts, a score-edit toggle, title screen, full screen, zoom spots, photo export and import.
- v3.0–3.27: Polish, a version label, the Guess the Footballer round, and a setup counter and Clear button.
- 3.28 Photo checklist split per category · 3.29 Setup in 7 groups · 3.30 Badly Explained Plots, What's the Link? · 3.31 Literally Translated, Nicknames · 3.32 Nicknames moved · 3.33 Guess the Year, Mythology · 3.34 Breaking Bad, Prison Break, GTA V, Marvel/DC · 3.35 Actor questions removed from new shows · 3.36 Stranger Things, The Office (US) · 3.37 Renamed The Office · 3.38 Common Club · 3.39 Career Path · 3.40 Common Club and Career Path made harder, long clues shrink · 3.41 Badly Explained Plots: Egypt · 3.42 Swap clue button, Quotes: Egypt · 3.43 TV Show Mix · 3.44 Zoom-spot picker fix · 3.45 Export saves changed zoom spots · 3.46 84 footballer photos built in · 3.47 Footballer reshuffle · 3.48 Premier League 2000–Now (+40) · 3.49 Flags and outlines centred · 3.50 +240 clues · 3.51 80 actor zoom spots · 3.52 Cars · 3.53 Translate It · 3.54 Rename · 3.55 School Books · 3.56 School Books moved to Knowledge · 3.57 Description shortened · 3.58 Egyptian Cinema moved to Entertainment · 3.59 "Wrong spot? Fix zoom" removed from in-game cards
- 4.00 (2026-10-02): Every clue checked, rebalanced and expanded (68 categories, 9,246 clues; TV Show Mix not counted). ×2 and 2-answers power-ups (setup switch), a winner screen with podium and confetti, an End game button, the soft countdown ticks and chime with a mute switch in setup and the top bar, and Guess the Person (70 photos, about 30 Egyptian). Polish includes fixed China, Portugal, Norway and Ecuador outlines, phone and TV layouts, and a self-counting clue label.
- 4.01 (2026-10-02): Correct photos for Bukayo Saka, Emam Ashour, Rivaldo, Zidane, Lancia Delta Integrale, Lotus Esprit S1, Subaru Impreza 22B and Mercedes 300 SL Gullwing (photo batch 4, which also resets old zoom spots for them). The old shared Ashour photo was Hossam (2018 Egypt friendly), so it stays as hossamashour. Winner podium now reads 1st, 2nd, 3rd from the left.
- 4.02 (2026-10-02): Winner screen says "[team] win!" instead of "wins!" (Omar's wording).
- 4.03 (2026-10-02): Hand-picked zoom spots for all 80 Guess the Car photos (headlights, grilles, vents, wheels), kept off brand badges, with less obvious details at higher values. They carry focus batch `fb:1`, which replaces spots saved on a device once (`jn_focus_batch`) without dropping any imported photos; later custom spots are kept.
- 4.04 (2026-10-02): New category Guess the Song (121 clues: 60 English/international, 61 Arabic of which 47 by Egyptian artists; v4work/out/song.json; Arabic lines checked against lyrics sites, many with one source). 70 new photo-round clues (cars, actors, footballers) from v4work/new-photos.json, photo batch 5, zoom spots in v4work/new-photo-spots.json. Still to add: the whole new Guess the Person batch, 3 cars (Ramses, Dodge Viper, AC Cobra), 7 actors, 8 footballers, plus redone BMW 2002 (photo showed a 4-door) and El Tetsh (too blurry). src/extra.js adds a new-photos.json entry only when photos/<key>.jpg exists.
- 4.05 (2026-10-02): 29 more new photos (AC Cobra, first-gen Dodge Viper, 6 actors/footballers, 21 Guess the Person). 99 of the 120 new photos are now in. Left out: ezzatabouaouf, ahmedshawqi, mohamedhassaneinheikal (too low-res for the zoom), bmw2002 (photo showed a 4-door), mahmoudmokhtareltetsh (too blurry), plus 16 still downloading (ramses, yasminabdulaziz, hassanhosny, salahabdallah, mahmoudkahraba, emadmoteab, ahmedbelal, taherabouzeid, ahmedelkass, rabahmadjer, mohamedhamaki, mohamedfouad, ahmedsaad, marwanpablo, hassanshakosh, abu).
- 4.06 (2026-10-02): 7 more (2-door BMW 2002, Ramses, Kahraba, Emad Moteab, Rabah Madjer, Hamaki, Ahmed Saad). 106 of the 120 new photos are live. Not in the game: no free photo on Wikimedia for yasminabdulaziz, taherabouzeid, ahmedbelal, mohamedfouad, marwanpablo, hassanshakosh, abu; too low-res or not a photo for ahmedelkass, mahmoudmokhtareltetsh, hassanhosny, salahabdallah (painting), ezzatabouaouf, ahmedshawqi, mohamedhassaneinheikal. Omar can add any of these himself from the photo checklist in setup.
- 4.07 (2026-10-02): The "2 answers" power-up button on an open clue now shows only for the team whose turn it is (Omar).
- 4.08 (2026-10-02): Two new categories after Food & Drink: Fast Food (80 trivia clues, v4work/out/ffood.json; KFC-Egypt 1973 and hawawshi 1971 rest on single sources) and Most Calories (80 clues of 3 items, v4work/out/cal.json; McDonald's figures from US official pages, other chains from aggregator sites, Egyptian dishes estimated per stated portion; winner beats second by at least 8%). Clue text now keeps line breaks (.qtext white-space:pre-line).
- 4.09 (2026-10-02): Starbucks removed from Fast Food and Most Calories at Omar's request; 4 Fast Food clues and 14 Most Calories clues replaced with other chains/items, each category still 80. Starbucks clues in other categories (e.g. brands) left as is.
- 4.10 (2026-10-02): Football mode button on setup (right of Back to title). Starts a game at once with a fixed board in a green pitch theme: Common Club, Career Path, Football Transfers, Guess the Footballer, Premier League (2000–Now), Champions League (2000–Now) and World Cup (mode-only category fwc built in src/extra.js from every World Cup clue plus the World Cup 2026 clues prefixed "2026: "). Going to setup or title restores blue and the previous picks. Colours now come from CSS variables (body.football overrides them). Also fixed the setup screen scrolling sideways on phones.
- 4.11 (2026-10-02): Who Am I? category (v4work/out/whoami.json, 80 clues, 16 per value; three numbered facts about a footballer, about a fifth Egyptian; written from well-known facts, not source-checked one by one). Sits after Career Path in setup and in Football mode, which now has 8 categories. Boards with 8+ columns use smaller, tighter headers so long words fit.
- 4.12 (2026-10-02): Football Stadiums category (v4work/out/stad.json, 80 text clues: stadium to club and club to stadium, 16 per value), after Football Transfers and in Football mode (now 9 categories). Text clues can now carry an optional third element, an image path shown full-size. Stadium photo clues come from v4work/stadium-photos.json (30 stadiums, key/value/name/wiki) and join the pool automatically at build time once photos/<key>.jpg exists; publish the new photos through files.
- 4.13 (2026-10-02): Egyptian Football category (v4work/out/egfb.json, 80 clues; 52 copied from Football's Egypt clues, 28 new, e.g. Koller/Mosimane CAF titles, Afsha 2020 final, Zamalek Confederation Cups 2019/2024). After Football in setup; in Football mode (now 10 categories). Board headers scale with column count (--hvw = 12/cols vw).
- 4.14 (2026-10-02): Guess the Year: Football (v4work/out/fyear.json, 80 clues of three same-calendar-year events, 74 from 2000 on, 2026 clue relies on the wc26 data). After Who Am I? in setup; in Football mode (now 11 categories). Boards with 8+ columns use a 92px minimum column so 11 fit from 1280px wide; narrower screens scroll the board sideways.
- 4.15 (2026-10-02): Football mode uses a lighter pitch green (tile #2A9A4C, background #1C6E37) with a lighter red for minus scores, and shows a ⚽ after Jeopardy Night in the game's top bar.
- 4.16 (2026-10-02): Board tile values are white in Football mode (gold elsewhere).
- 4.17 (2026-10-02): Football mode picks a random 6 of its 11 categories (kept in pool order) each time it starts and on Play again; New board keeps the same 6.
- 4.18 (2026-10-02): Football mode button moved to sit right of Start game, in the lighter green.
- 4.19 (2026-10-02): Renamed Guess the Year: Football to "Guess the Year: Football Edition" (id fyear unchanged).
- 4.20 (2026-10-02): Experiment, Omar may reverse it: in Football mode every gold accent is navy #0F2557 (title word, picking-team card, Start/Play again, timer bar, half-points and End game buttons, winner title and podium, confetti), with white text on navy. To undo: in src/head.html delete the 'Football mode navy accents' rule and the three body.football rules right after it, and in src/app.js drop the S.football check in confetti's cols. Gold now comes from variables --brass/--brass-dim/--on-brass/--brass-rgb.
- 4.21 (2026-10-02): Football mode board values are navy (var(--brass)) with a faint white shadow, replacing the white from 4.16. Undo with the navy rule: values then fall back to gold; to restore white instead, set the body.football .tile:not(.done) rule back to color:#fff.
- 4.22 (2026-10-02): Football mode board values back to white (Omar); the rest of the navy experiment stays.
- 4.23 (2026-10-02): Football mode winner screen plays sounds/siuuu.mp3 (last 9 s of Omar's Ronaldo 'Inshallah Siuuu' clip, mono 96k, 0.15 s fade-in; copy in jeopardy/sounds/) instead of the fanfare; respects the sound toggle, stops on mute or leaving the winner screen, falls back to the fanfare if it can't play. Publish it via files: {"sounds/siuuu.mp3": ...}.
- 4.24 (2026-10-02): First 18 of 30 stadium photos built into Football Stadiums as "Name this stadium." clues (photos/stadium-*.jpg, from v4work/stadium-photos/; signage blurred by the download thread). 12 still to come: campnou, santiagobernabeu, allianzarena, stamfordbridge, metropolitano, stadevelodrome, borgelarabstadium, estadioazteca, cravencottage, sanmames, stadelouisii, estadiododragao.
- 4.25 (2026-10-02): Winner podium steps read 1st/2nd/3rd (ordinals, both modes). Experiment: Football mode category titles navy with a faint white shadow; undo by deleting the 'Football mode navy category titles' rule in src/head.html.
- 4.26 (2026-10-02): All 30 stadium photos in (last 12 added); Football Stadiums now 110 clues, 22 per value with 6 photo clues each. Bernabéu and Camp Nou photos show the pre-renovation look; Stade Louis II and Borg El Arab are inside views.
- 4.27 (2026-10-02): Football mode navy category titles have no shadow now. To put it back, set text-shadow:2px 2px 0 rgba(255,255,255,.35) in the body.football .head rule (the old value is in a comment next to it).

## Guess the Person gaps (v4.00)
- 70 of the planned 80 people. Umm Kulthum was dropped because her photo looked like someone else.
- No photo was found for: Mohamed Hamaki, Marwan Pablo, Mohamed Fouad, Dina El Sherbiny, Ahmed Amin, Hassan Shakosh, Asser Yassin, Abu, Hisham Abbas.
