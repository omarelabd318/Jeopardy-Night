# Jeopardy Night: project notes

Source: https://claude.ai/artifact/X5vXepDtYQ7JTracXSmAeq (Omar's artifact, version saved 2026-10-02)

## What's here
- `index.html`: the whole game, v4.58. It's built from `src/` and `v4work/` by `node build.js` (see BUILD.md), with every clue built in. The setup screen offers 85 categories in 7 groups; Football mode adds its own World Cup category on top.
- `photos/`: 649 jpgs loaded as `photos/<key>.jpg`: 539 for Guess the Car, Actor, Footballer and Person, 30 stadium photos (`stadium-*.jpg`), and 80 Guess the Food photos (`food-*.jpg`). The game loads the food photos from the five `food-100.js` … `food-500.js` bundles; the jpgs stay because the build only adds a food clue when its jpg exists.
- `sounds/siuuu.mp3`: the Football mode winner clip.
- `v4work/`: the v4 build inputs. `out/<id>.json` holds each category's final clues and `out/<id>.log.md` lists what changed.
- The page needs internet for its CDN scripts (QR code, JSZip, world map) and Google Fonts.
- The v3.59 backup (`index-v3.59.html`) is not in this repo or its history.

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

## Missing photos (checked at v4.37)
- Guess the Person launched in v4.00 with 70 of the planned 80 people. Umm Kulthum was dropped because her photo looked like someone else. Photos were added later for Hamaki, Ahmed Amin, Asser Yassin, Dina El Sherbiny and Hisham Abbas.
- 14 clues in `v4work/new-photos.json` still have no photo, so the build leaves them out and they don't appear in the setup photo checklist either. To add one, put `photos/<key>.jpg` in the repo and rebuild.
  - No free photo found: Yasmin Abdulaziz, Ahmed Belal, Taher Abouzeid, Mohamed Fouad, Marwan Pablo, Hassan Shakosh, Abu.
  - Photo too low-res, too blurry, or a painting: Ezzat Abou Aouf, Hassan Hosny, Salah Abdallah, Ahmed El Kass, Mahmoud Mokhtar El Tetsh, Ahmed Shawqi, Mohamed Hassanein Heikal.

## Version history (from the original chat)
- **1.x: Launch & The Egypt Update**
  - 1.0 First Jeopardy Night: 12 categories, 659 clues, teams and scoring, drawn flags, zoomed photo rounds, Act It Out and a timer.
  - 1.1 Classic Jeopardy look, with a blue board and gold numbers.
  - 1.2 Removed the "Different clue" button.
  - 1.3 5 more clues per value in every category (959 total) and 25 new flags.
  - 1.4 All timers set to 45 seconds.
  - 1.5 Photos save in the browser, and each car or actor gets its own Add photo button.
  - 1.6 Photo tiles pick clues that have a photo.
  - 1.7 Photos zoomed in further.
  - 1.8 Added Egypt and Arab World, plus 450 new clues and 25 flags (1,409 total).
  - 1.9 Scoring buttons appear only after the answer is revealed.
  - 1.10 Added Emoji Movies, Emoji Sentences and Riddles.
  - 1.11 Added Money & Business, Egyptian Cinema & Ramadan Series, and Tech & Gaming.
  - 1.12 "Obscure Flags" renamed to Flags; Act It Out timer set to 60 seconds.
  - 1.13 Score editing moved behind an "Edit scores" toggle.
  - 1.14 Bigger category names on the board.
- **2.x: Party, Smart Zoom, Fandoms & Photos Everywhere**
  - 2.0 Act It Out QR codes, so only the actor sees the title.
  - 2.1 Hold-to-peek removed; the QR shows only the title.
  - 2.2 Act It Out timer starts manually.
  - 2.3 Title screen with a Start button.
  - 2.4 "Answer if you dare" removed from the tagline.
  - 2.5 Title screen shows every time, with buttons back to it.
  - 2.6 Added Act It Out: Egypt.
  - 2.7 Renamed it "Act It Out: Egyptian Edition."
  - 2.8 Added Who's the Impostor? (one QR code per player).
  - 2.9 Added One Word Clues, with a turn tracker.
  - 2.10 Half-points button on photo rounds.
  - 2.11 Less zoom on hard photos, aimed nearer the centre.
  - 2.12 Fixed actor photos not showing.
  - 2.13 Tap-to-set zoom spot, full photo on the last zoom-out, and "Wrong spot? Fix zoom."
  - 2.14 Added Famous Movie & TV Quotes.
  - 2.15 Easier 400 and 500 quotes.
  - 2.16 Egypt act-out moved next to Act It Out.
  - 2.17 Start game moved before Back to title.
  - 2.18 Photo rounds section hidden by default in setup.
  - 2.19 "Are you sure?" prompt before leaving mid-game.
  - 2.20 Category descriptions on hover or tap.
  - 2.21 Impostor rules explain who wins.
  - 2.22 Added Sports.
  - 2.23 Added Closest Wins, with automatic winner detection.
  - 2.24 Descriptions shown in setup only.
  - 2.25 "Pick your poison" added to the tagline.
  - 2.26 Tagline kept on one line.
  - 2.27 Added Finish the Song Title and Fill in the Quote.
  - 2.28 Added Game of Thrones, Peaky Blinders, Friends, Harry Potter, and Disney/CN/Nick.
  - 2.29 Cartoons refocused on 2005–2015.
  - 2.30 Renamed to "Disney/Cartoon Network/Nickelodeon."
  - 2.31 Export and Import photos buttons.
  - 2.32 160 photos built into the game for every device and player.
  - 2.33 Exports include only new photos.
  - 2.34 Arabic emoji clues tagged "(Arabic)."
  - 2.35 Scoreboard highlights whose turn it is.
  - 2.36 Full-screen button.
  - 2.37 Added Brands & Famous Companies.
  - 2.38 Added Country Outlines.
  - 2.39 Outlines centred.
  - 2.40 Added Marvel and Map Pin.
  - 2.41 Map Pin crash fix; a clue that fails now shows an error message.
  - 2.42 Added Cairo Streets & Places.
- **3.x: The Big Refill, Football & History**
  - 3.0 About 830 new clues across every non-photo category, plus 25 flags (4,039 total).
  - 3.1 Added Emoji Movies & TV: Egypt Edition, World War II, Egypt History, Premier League, World Cup, and Champions League.
  - 3.2 Added Football Transfers; half points on every round.
  - 3.3 Added World Cup 2026, built from research.
  - 3.4 Added Emoji Sentences: Egypt Edition.
  - 3.5 Friends made harder; Peaky Blinders actor questions replaced.
  - 3.6 Removed Who's the Impostor?
  - 3.7 Game of Thrones cast questions replaced.
  - 3.8 Cast questions restored alongside the new ones.
  - 3.9 Added Languages.
  - 3.10 Every "Egyptian Edition" renamed to "Egypt Edition."
  - 3.11 Bigger team names.
  - 3.12 Scoring-button names back to normal size; only the scoreboard stays bigger.
  - 3.13 Fixed photo and map layouts covering the buttons.
  - 3.14 "Categories chosen" counter in setup.
  - 3.15 Clear button for category selection.
  - 3.16 All button removed.
  - 3.17 Act It Out gained TV shows, and titles are labelled film, series or play.
  - 3.18 Emoji Movies became Emoji Movies & TV, with 25 shows added.
  - 3.19 Version number shown on the title and setup screens.
  - 3.20–3.27 Polish and the Guess the Footballer round.
  - 3.30 Added Badly Explained Plots and What's the Link?
  - 3.31 Added Literally Translated and Nicknames.
  - 3.32 Nicknames moved.
  - 3.33 Added Guess the Year and Mythology.
  - 3.34 Added Breaking Bad, Prison Break, GTA V and Marvel/DC.
  - 3.35 Actor questions removed from the new shows.
  - 3.36 Added Stranger Things and The Office (US).
  - 3.37 Renamed The Office.
  - 3.38 Added Common Club.
  - 3.39 Added Career Path.
  - 3.40 Common Club and Career Path made harder; long clues shrink to fit.
  - 3.41 Added Badly Explained Plots: Egypt.
  - 3.42 Swap clue button; added Quotes: Egypt.
  - 3.43 Added TV Show Mix.
  - 3.44 Zoom-spot picker fix.
  - 3.45 Export saves changed zoom spots.
  - 3.46 84 footballer photos built in.
  - 3.47 Footballer reshuffle.
  - 3.48 40 more Premier League (2000–Now) clues.
  - 3.49 Flags and outlines centred.
  - 3.50 240 new clues.
  - 3.51 80 actor zoom spots.
  - 3.52 Added Cars.
  - 3.53 Added Translate It.
  - 3.54 Category renamed.
  - 3.55 Added School Books.
  - 3.56 School Books moved to Knowledge.
  - 3.57 Description shortened.
  - 3.58 Egyptian Cinema moved to Entertainment.
  - 3.59 "Wrong spot? Fix zoom" removed from in-game cards.
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
- 4.28 (2026-10-02): Football mode green a step lighter (tile #33A957, background #238541, panel #228A44). The 4.27 values are in a comment above the body.football rule in src/head.html for a one-step revert. White tile values still read clearly (they keep their dark shadow).
- 4.29 (2026-10-02): Football mode green shifted toward lime (tile #58B82C, background #3E9A1F, panel #449F22), as a try. The 4.28 values are in a comment above the body.football rule in src/head.html for a one-step revert. White values and navy titles checked readable in screenshots.
- 4.30 (2026-10-02): Football mode uses Omar's neon swatch green #00FF14 (tiles and clue card; background #00E012). White would not read on it, so in Football mode the main text, tile values, and the winner headline are dark navy (#0B1530 / #0F2557) and the black text shadows are removed; plus/minus colours are dark green and dark red. To go back to the 4.29 lime, restore the values in the 4.30 comment in src/head.html and delete the "4.30 text rule" lines.
- 4.31 (2026-10-02): Football mode text is black instead of navy (title, category titles, tile values, clue text and value, winner headline). Navy fills with white text (End game, the picking team, podium) are unchanged. To go back to navy text, delete the two "4.31 black text" lines in src/head.html and set the body.football .head colour back to var(--brass).
- 4.32 (2026-10-02): new Formations category (v4work/out/form.json, 60 clues, 12 per value, generated by v4work/form-gen.js). Each clue shows the formation and a full starting XI, strikers on top and keeper at the bottom, centred like a pitch; the answer is team, year and match. Mostly famous finals since 2000 (100 = iconic finals, 500 = upsets and lesser-known XIs, incl. Egypt v Uruguay 2018). It is in the Football & Sports group and in the Football mode pool, which is now 12 categories (still a random 6 per game). Lineups were written from memory, not checked against a source.
- 4.33 (2026-10-02): Formations rebuilt to 93 lineups (18/18/19/19/19), every one checked against a lineup page (source per clue in v4work/form-sources.txt; agent check files in v4work/form/). Source checks fixed five wrong starters (Man City 2023 Akanji not Walker; Frankfurt 2022 Touré not Hinteregger; Atalanta 2024 Scamacca not De Roon; Saudi 2022 Al-Tambakti not Al-Amri; Morocco v Portugal El Yamiq not Dari) and several formations/sides. 33 harder lineups added (old European finals, FA Cup finals, Egypt 2009/2010/2017, Al Ahly 2020 CAF final, South Korea 2002, Senegal 2002, Zambia 2012, etc.); Egypt 2008 was left out because no full team sheet could be confirmed. No existing lineup was removed; easier ones moved down a value. form.json is now built by v4work/form/build2.js from the res*.txt files (form-gen.js is the old 4.32 generator).
- 4.34 (2026-10-03): Football mode green changed to Omar's swatch row 2, far right (#00D700, tiles and clue card; background #00BE00); answer and plus/minus colours darkened to stay readable. The 4.30–4.33 neon values are in a comment above the body.football rule. Also wired (not yet visible) the Guess the Food photo category: src/extra.js builds "foodpic" from v4work/food-photos.json for each photos/<key>.jpg that exists, and shows it only when every value has at least one photo; photos are being downloaded to v4work/food-photos/.
- 4.35 (2026-10-03): Guess the Food is live with the first 47 of 80 photos (all the 100s and 200s and 15 of 16 300s; photos/food-*.jpg, unzoomed, "Name this food."). In the Knowledge group after Most Calories; not in Football mode. While any value has no photos, src/extra.js temporarily spreads the existing ones across the five values in difficulty order; once all 80 are in, each food goes back to its own value from v4work/food-photos.json. The other 33 (goulash and all 400s/500s) are still downloading in the photos thread.
- 4.36 (2026-10-03): Guess the Food moved from Knowledge to the Photo Rounds group on the setup screen.
- 4.37 (2026-10-03): All 80 Guess the Food photos in, each at its own value (16 per value). The artifact can hold at most 511 files, so the food photos are no longer separate jpgs: they are re-encoded (1280px, q78) and bundled into photos/food-100.js … food-500.js, one per value (~3–4 MB each), built by mkpacks.js in this folder from v4work/food-photos/ (see BUILD.md). Clue images use "pack:food-<value>:<key>"; app.js loads a pack when a board with that category is drawn and fills the image once it arrives. Use the same pack approach for any future photo category; the artifact has about 457 files now.
- 4.38 (2026-10-03): Omar asked for the out-of-date photo section on the setup screen to be updated. Its heading is now just "Photo rounds". Its count reads "530 built in" (every photo in the game, including Guess the Food and the stadiums, plus "N added on this device" when there are any), instead of "420 saved", which made the built-in photos look like they were saved on that device. Next to the photo pack button it says how many of them can be replaced there (420). The text explains that every car, actor, footballer and person already has a photo, and that the checklist is for previewing, setting zoom spots and replacing. It also says the Guess the Food (80) and stadium (30) photos are built in but can't be changed there. The checklist heading is now "Photo checklist: preview, zoom spot or replace", and the unmatched-file hint points to the Replace buttons.
- 4.39 (2026-10-03): Six new categories Omar asked for, 80 clues each (16 per value): Egyptian Proverbs (Egypt & Arab World; finish the مثل, in Arabic), How I Met Your Mother (Entertainment, also in TV Show Mix), Guess the Score (Football & Sports and the Football mode pool, now 13; a normal clue, not Closest Wins, as Omar asked), Space & Planets (Knowledge, after Science), Most Spotify Listeners and Most Instagram Followers (Entertainment, after Guess the Song; three names, pick the biggest). The two ranking categories are generated by v4work/rank/gen.js from Wikipedia's lists (Instagram Sept 2026, Spotify 2 Oct 2026) plus web-search figures, with a safety margin so small changes don't flip an answer; re-run it to refresh the numbers. Each category has a log in v4work/out/<id>.log.md. Guess the Logo (Photo Rounds, blurred as Omar asked): 80 logos, 16 per value, about a sixth Egyptian or Arab (Al Ahly, Zamalek, Pyramids, Banque Misr, CIB, WE, EgyptAir, Talabat, Swvl, Careem, Emirates, Qatar Airways). The blur starts stronger at lower values (famous logos) and is sized to the picture, so it looks the same on a phone or a TV. The host can tap "Less blur", and the logo shows clearly on reveal. Logos come from each brand's Wikipedia infobox (v4work/logo-fetch.py, list in v4work/logo-photos.json) and ship as photos/logo-100.js … logo-500.js (node mkpacks.js logo), so the artifact gains 5 files, not 80. To change the blur, edit BLUR in src/extra.js.
- 4.40 (2026-10-03): Omar found the full 1.0–3.19 update history and it's now in this list and in the game's version history (src/changelog.json, grouped by era, old versions as one line each). Omar asked for the version number on the title screen to be clickable. It looks the same as before apart from a dotted underline (gold on hover; Omar didn't want "What's new" written on the title page), and tapping it opens a panel: "What's new" shows the latest two versions, and "Version history" (tap to open) lists every version back to 1.x in short, player-friendly lines. The text lives in src/changelog.json (newest first), separate from these notes; add an entry there with each new version. Escape, Close or a tap outside closes it. Also, the setup screen's photo count now includes the 80 logos (610 built in). The title line now reads "84 Categories · 10,716 Clues · v4.40" with capitals (Omar). This reverses the v4.00 call to leave out a What's New page; that was Omar's call then and his call now.
- 4.41 (2026-10-03): Omar found Guess the Logo started a bit too blurred and Less blur gave away too much per tap. The starting blur is about 20% lower (BLUR in src/extra.js: 100 .024, 200 .022, 300 .02, 400 .018, 500 .016), and each Less blur tap now keeps 72% of the blur instead of 55%, so a logo clears in about 5 or 6 taps instead of 2 or 3. To go back, restore the v4.40 values kept in comments next to BLUR in src/extra.js and the "unblur" line in src/app.js. Omar also asked for more logos: 30 added, 6 per value (now 110, 22 per value): Facebook, Twitter (now X), Samsung, Disney, Lay's, Ford; Honda, Nissan, Hyundai, Chanel, Louis Vuitton, Air Jordan; Skype, Jaguar, Nintendo, Xbox, Pinterest, LinkedIn; Ismaily, e& (Etisalat), Al Jazeera, MBC, Arsenal, Bayern Munich; Aston Martin, Bentley, Škoda, Opel, Kia, SEAT. KFC, Rolex and Reddit were tried but had no usable logo file; Gucci's is plain grey text, unguessable when blurred. The setup photo count is now 640.
- 4.42 (2026-10-03): Experiment, Omar may reverse it: Football mode board values (100–500) are white with a faint dark shadow (2px 2px 0 rgba(0,0,0,.35)) so they read on the #00D700 green. Category titles and everything else stay black. To undo: in src/head.html delete the line marked "4.42 try (Omar)" near the top; the values go back to black from the 4.31 rule.
- 4.43 (2026-10-03): Experiment, Omar may reverse it: Football mode has a retro poster collage behind the whole page, styled after the poster Omar sent (kept as v4work/football-theme-ref.avif). Football phrases packed in blocks with mixed retro fonts (Bebas Neue, Alfa Slab One, Lobster, Rye, Abril Fatface, plus Rakkas for Arabic, all from Google Fonts), some filled blocks, some vertical, offset shadows, in navy, cream, mint and dark pitch green (no coral, which clashed with the green), at 20% opacity as Omar chose. The layout is fixed, doesn't move, and sits behind the board so nothing changes size. Phrases: Omar's SIIIIIUUUUUU!, It's a f*cking disgrace, After review… #10 Paraguay, AGÜEROOOOO, Qué mirás, bobo?, Mo Salah running down the wing, Ankara Messi, and Medhat Shalaby lines (الكورة أجوان، يا نهار أبيض، لفها لفة جاتوه، يخرب بيتك يا مجرم، الله عليك يا حبيب والديك, sourced from Youm7 and El Watan round-ups), plus short fillers (GOAL!, VAR, 90+7', OLÉ, 1–0, Full time, Yalla, Hat-trick). To undo: in src/head.html delete the block from "4.43 try (Omar)" to "end 4.43" and the fbBg div; optionally drop the five extra font families from the Google Fonts link. The scrolling LED strip idea is parked (Omar: not for now).
- 4.44 (2026-10-03): Experiment, Omar may reverse it: Omar wanted the collage across the whole page, not just around the board, so it now shows through the board. In Football mode the tiles and category headers are 60% solid green (rgba(0,215,0,.6), hover .75) and the board's black grid is 50% see-through. 85% solid was tried on paper first, but with the collage at 20% that would leave only about 3% visible. The tiles read a little deeper green as a result. To undo: in src/head.html delete the block from "4.44 try (Omar)" to "end 4.44".
- 4.45 (2026-10-03): Omar wanted the collage only behind the board, with the board as its edge, and a bit more obvious. The fbBg div now sits inside .boardwrap (absolute, same size as the board) instead of fixed over the whole page, so the rest of the page is plain green again. The collage goes from 20% to 32% and the tiles from 60% to 50% solid. To go back to 4.44 (whole page): move the fbBg div back to just before <div class="wrap">, and restore the values in the comments next to the .fbbg, .boardwrap and tile rules in src/head.html.
- 4.46 (2026-10-03): Omar found the collage still too faint. The collage is now at 80% (was 32%) and the tiles are 35% solid (was 50%). The category header row is kept at 72% solid so the category names don't compete with the phrases behind them. White values still read clearly thanks to their shadow. The old values are in comments next to the rules in src/head.html; to go back to 4.45, set the collage opacity to .32 and use rgba(0,215,0,.5) for both headers and tiles.
- 4.47 (2026-10-03): Omar wanted the collage to start under the category name row. placeFbBg() in src/app.js sets the collage's top edge to just below the header row each time the board is drawn and on window resize, and the headers are solid green again (4.46 had them 72% solid). To undo: delete placeFbBg (the function, its resize listener and the call after b.innerHTML in renderBoard), and set body.football .head back to rgba(0,215,0,.72) (value in the comment next to it).
- 4.48 (2026-10-03): Omar didn't want any phrase cut off at the edges of the collage. placeFbBg() now works out how many whole cells fit under the category row (about 96x56px each), and footballBg(cols, rows) packs blocks into exactly that grid, so no block hangs off the edge. A leftover gap gets a short filler instead of a squeezed phrase. fitFbBg() then shrinks any text that is still too big for its block, once at once and again after the fonts load. No phrase or filler ever appears twice (Omar: "no repeats"). When there is more room than phrases (a big TV), the cells grow so the phrases fill it, and any leftover cell widens the block to its left. When room is tight (a laptop or phone), phrases come first and fillers only plug gaps, so a few phrases may not show on small screens. "Mo Salah, running down the wing" is now just "Running down the wing", and AGÜEROOOOO is spelled AGUEROOOOO without the dots (Omar). Arabic phrases get at least two cells, and vertical text is limited to plain words (VAR, YALLA, OLÉ…). Added نادي القرن, الفراعنة, Hand of God, If I speak, I am in big trouble, Good ebening, Cold rainy night in Stoke, Fergie time, Tiki-taka and What do we think of shit? at Omar's request (his wording; "shit" is uncensored as he wrote it). Checked by measuring every block at 1280x800, 1920x1080 and 390x800: none outside the area, no text overflowing and no duplicates. At 1920x1080 all 21 phrases and 10 fillers show once; at 1280x800, 20 of the 21 phrases.
- 4.49 (2026-10-03): Experiment, Omar may reverse it: Omar asked for a scrolling LED strip saying "siiiiiiiuuuuuuuuuuuuuuuuuuuuu" at the very bottom of the Football mode winner screen. It's a 60px black stadium-board strip pinned to the bottom of #winBox, with amber Bebas Neue letters, a glow and a dot-grid overlay. SIIIIIIIUUUUUUUUUUUUUUUUUUUUU and a ⚽ scroll right to left on a seamless 18-second loop (60 seconds for people who've turned on reduced motion). Football mode only; the normal winner screen is unchanged. To undo: in src/head.html delete the block from "4.49 try (Omar)" to "end 4.49" and the ledstrip div inside #winBox.
- 4.50 (2026-10-03): Omar asked for fireworks instead of confetti in Football mode. fireworks() in src/app.js draws on the same canvas: rockets rise from just above the LED strip and burst into 60–90 sparks that fall and fade. Launches run for about six seconds, then the last sparks finish. The colours (white, gold, red, navy, purple, orange, pink) are thick strokes with a dot head and a faint dark shadow, so they read on the bright green. It still stops when the winner screen closes and is skipped when reduced motion is on. The normal mode keeps its confetti. To undo: delete the "if(S.football) return fireworks();" line in confetti() (fireworks() can stay unused). Omar also asked for the LED strip to go half as fast and say ssssssiiiiiiiiuuuuuuuuuuuuuuuuuuuuu: it now reads SSSSSSIIIIIIIIUUUUUUUUUUUUUUUUUUUUU (6 S, 8 I, 21 U), and the loop is 43 s (4.49: 18 s), which with the longer text halves how fast the letters move. Reduced motion is 120 s.
- 4.51 (2026-10-03): Omar wanted the LED strip to read "sssiiiiiiiiuuuu…" with U's that never end, starting from the right, at half the speed again. ledStart() in src/app.js now drives the strip (it's no longer a CSS loop). SSSIIIIIIII (3 S, 8 I) enters from the right edge, followed directly by U's. Once the SSSIII has passed off the left, the U run shifts back by one U whenever needed, which looks identical, so the U's scroll forever with no restart. Speed is 65 px/s (4.50 was 130), or 32 with reduced motion. ledStop() runs when the winner screen closes. To go back to the 4.50 loop: restore the ledtrack spans and the animation value kept in the comment on the .ledtrack rule in src/head.html, and remove ledStart()/ledStop().
- 4.52 (2026-10-03): Omar asked to swap the ⚽ in the Football mode title for classic match balls, as little emoji all the same size, one per board. v4work/balls/ has five 128px round cut-outs (WebP, about 3–5 KB each). build.js embeds them as BALLS (data URIs, so no extra artifact files), and pickBall() in src/app.js puts a random one in the title's ::after on every new game and New board, never the same one twice in a row. The balls are aerow (Total 90 Aerow Hi-Vis 2004/05) and seitiro (Premier League 2011/12), both from Omar's photos; ordem3, from Omar's photo of the LFP/La Liga 2015/16 version; and jabulani and teamgeist, from Omar's product photos (he replaced the Wikimedia ones I had first). To add a ball, drop a round 128px .webp into v4work/balls/ and rebuild. To undo: set the body.football .topbar h1::after rule back to the value in its comment.
- 4.53 (2026-10-03): Omar wanted the version panel to show only the version history, kept collapsed. Tapping the version now opens a panel titled "Jeopardy Night v4.53" with just the collapsed "Version history" (every version, newest first); the "What's new" section with the latest two versions is gone. The panel reopens collapsed each time. To go back: restore the newsNow div in src/head.html and the two lines in openNews() described in its comment.
- 4.54 (2026-10-03): Omar asked for 30 more clues in every category unless a category had run out. 72 categories got 30 new clues each (six per value), about 2,160 in total, so the per-value counts stay level. How: each batch was written to `v4work/add/<id>.json` and merged into `out/<id>.json` by `v4work/add/merge.py`, which refuses a repeated question and, unless the batch lists it in `allow_dup_answers`, a repeated answer (emoji puzzles are compared as written). `v4work/add/peek.py <id>` prints a category's style and existing answers; merged batches are kept as `v4work/add/done-<id>.json`. Facts that change were checked as of October 2026. Generated categories: Most Instagram Followers and Most Spotify Listeners now make 22 trios per value in `v4work/rank/gen.js` (was 16; the reuse caps went up to fit, old values in its comments), so their existing trios were reshuffled too; Most Calories got 30 new trios from `v4work/add/cal-gen.py`, which only reuses the calorie figures already in that category. Guess the Logo got 30 new logos (140 in all, 28 per value) through `v4work/logo-photos.json`, `v4work/logo-fetch.py` and `node mkpacks.js logo`. Left as they were, and why: Formations (every new lineup needs checking against a source); the photo rounds (Guess the Car, Actor, Footballer, Person and Food need new photos, and the artifact is close to its file limit); Flags (197 already covers almost every country); Country Outlines (149 already, and new shapes can't be checked here); TV Show Mix (built automatically from the show categories, so it grew with them); Peaky Blinders and School Books (119 and 128 clues on one show and six set books, so new ones would be too obscure); Egyptian Movie & TV Quotes (the exact Arabic wording of famous lines needs a source before it goes in). To undo a category: restore its `v4work/out/<id>.json` from before this version and rebuild.
- 4.55 (2026-10-03): Omar asked for an Islam category. It sits in the Knowledge group right after History, with 80 clues (16 per value) in `v4work/out/islam.json`: the pillars, Ramadan and the Eids, the Quran (surahs, verses, revelation), Hajj and Umrah, the Prophet's life and the early caliphs, prophets named in the Quran, and Egyptian links (Al-Azhar, the Mosque of Amr ibn al-As, Imam al-Shafi'i, Abdul Basit and Al-Hussary). It's written as plain facts, with no rulings or disputed points. `src/extra.js` adds it after History, and `CAT_GROUPS` in `src/app.js` lists it. To remove it: delete `v4work/out/islam.json` (or the `['islam','his']` entry in extra.js) and "islam" from CAT_GROUPS, then rebuild.
- 4.56 (2026-10-03): Omar asked for new foods in Most Calories and more photos in the photo rounds, without bundling, since he plays from GitHub Pages. Photos: 119 new ones (Guess the Car +30, Actor +29, Footballer +30, Person +30), chosen so each round now has the same count at every value (Car 28, Actor 27, Footballer 28, Person 25 per value; Person 500 has 24). Each comes from the main image on the person's or model's Wikipedia page (`v4work/photo-fetch.py <key>…`, list in `v4work/new-photos.json`), saved as `photos/<key>.jpg` at up to 960 px. Every zoom spot was checked by previewing the zoomed crop: faces for people, headlights or wheels for cars, never a brand badge or name script. The spots are in `src/builtin.js` (photo batch `b:6`) and `v4work/new-photo-spots.json`. Text that would give an answer away was cropped or blurred: Vin Diesel's panel name card (cropped), the Aston Martin sign behind the Valkyrie, and the museum info cards and plates on the Trabant and Subaru 360. Earlier misses (Yasmin Abdulaziz, Ahmed Belal, Taher Abouzeid, Mohamed Fouad, Marwan Pablo, Hassan Shakosh, Abu) still have no usable photo. Salah Jahin and Abdel Rahman El Abnoudi were dropped because their Wikipedia images are paintings. File limit: the repo now has about 580 files the game uses, more than the live claude.ai artifact's 511, so the artifact can only be republished after the photo rounds are bundled (see `mkpacks.js`); GitHub Pages and local play have no limit. Most Calories: 30 new items with their published figures (McDonald's US menu, Starbucks grande with standard milk, Burger King, Twix, M&M's, and USDA values for foods like quinoa, butter and dark chocolate) were added to NEW in `v4work/add/cal-gen.py`. That gives 30 new trios, each with at least one new item (140 clues, 28 per value). To undo the photos: delete the `b:6` entries from `src/builtin.js` and the matching `photos/<key>.jpg` files; the clues drop out automatically when their jpg is gone.
- 4.57 (2026-10-03): Omar saw the Football mode ball drop under "Jeopardy Night" instead of sitting to its right. On some screens the buttons beside the title squeezed it, so the ball (the title's ::after) wrapped to a new line. `.topbar h1` in src/head.html now has `white-space:nowrap; flex-shrink:0`, so the title and ball always stay on one line (checked at 320–1280 px wide and with the title area forced to 200 px). To undo: remove those two properties (the old rule is in the comment next to it).
- 4.58 (2026-10-03): Omar asked to rename Football Transfers to just "Transfers". The name is set in `src/base.json` (category id `xfer`) and `v4work/out/xfer.json`, and the Football mode button's tooltip in `src/head.html` lists it too. The clues are unchanged. To undo: put "Football Transfers" back in those three places.
