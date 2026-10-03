# Jeopardy Night v4.00: clue work brief

Jeopardy Night is a party Jeopardy game. The players are Egyptians in their mid-20s who speak English and know both Western and Egyptian pop culture. Each category has five values (100 to 500). A tile pulls a random clue from that value's pool, so each pool holds many clues.

Today is 2026-10-02. Your knowledge may stop before mid-2026, so use WebSearch (and WebFetch where needed) to check anything that could have changed recently: transfers, records, "current" holders, the 2026 World Cup (played June to July 2026; Spain beat Argentina 1–0 in the final), recent seasons, and recent releases. If you can't verify a clue, rewrite it so it doesn't depend on that fact, or drop it.

## Your job, for each category you're given
Input: `/mnt/project-files/jeopardy/v4work/in/<id>.json` has `{id, name, type, desc, data:{"100":[...],...,"500":[...]}}`, plus extra keys for some types. Read it with a script, or in chunks, if it's large.

1. **Quality check every clue.** Fix wrong facts. Fix or replace outdated ones. Remove exact and near duplicates within the category. Fix questions that are ambiguous (more than one fair answer, unless the answer lists the alternatives). Fix typos. Keep answers short enough for a host to judge at a glance. Remove anything that doesn't fit the category.
2. **Rebalance values.** 100 means nearly everyone at the party knows it. 300 means a typical fan or a well-read person. 500 means hard, even for fans, but still fair and gettable. Move clues that are too easy or too hard to the right value. Keep each value's pool about the same size, within 2 of the others.
3. **Add new clues.** Add 50 (10 per value), or 30 (6 per value) for categories marked "+30" in your assignment. Match the category's existing style and wording templates exactly (for example `Which film or TV show is this line from? “…”`). Don't duplicate existing clues, and don't reuse an answer that's already in the category unless the question is clearly different. Mix in Egyptian and Arab content where the category already does, and keep it fun for a party.

## Entry formats by `type` (keep them exactly)
- `text`: `["question", "answer"]`
- `emoji`: `["emoji string", "answer"]`. For an Arabic-language answer (an Egyptian phrase or title written in Latin letters), also list the answer in `arabic_answers`.
- `act`: `"Title"` (string). Every title needs an entry in `act_kind`: `{"Title": "film"|"series"|"play"}`. The QR code shows the title, so keep it plain.
- `password`: `"word"` (one word for a one-word-clues game)
- `closest`: `["question", number, "unit"]`. The number must be accurate and checkable, and the unit can be `""`.
- `pin`: `["City", "Country", lat, lon]`. Use real coordinates to 2 decimal places.
- `shape`: `["Country display name", ["Map name", ...]]`. The aliases must match names in `/mnt/project-files/jeopardy/v4work/lib/world-map-names.json` exactly.
- `flag`: `"flagId"`. New flags need `new_flags: {"flagId": ["Country", "<svg inner markup on a 300×200 field>"]}`. Draw them as simple SVG (rect, polygon, circle, path; no `<svg>` wrapper, no scripts). Render each one to PNG and look at it to check it's correct. A simplified emblem is fine.

## Output
Write `/mnt/project-files/jeopardy/v4work/out/<id>.json` in the same shape as the input, with the full final `data` (not a diff) plus any `act_kind`, `arabic_answers` and `new_flags`. Then write `/mnt/project-files/jeopardy/v4work/out/<id>.log.md`: counts (fixed, removed, moved up, moved down, added, final total per value) and a short list of the notable fixes. The fixes list is for the game owner, so use plain language.

Validate each output with a script before you finish: it must be valid JSON, every entry must have the right shape for its type, there must be no duplicate questions, and the per-value counts must be balanced.

## Rules
- Write only your own `out/<id>.*` files. Don't edit `in/`, the game's `index.html`, or anything else in `/mnt/project-files`. Don't install packages. Don't call any `mcp__hearthbot__` tools.
- Keep scratch files outside `/mnt/project-files`.
- When you finish, reply with one line per category: the id, the final total, and the counts of added, fixed, removed and moved clues. Add anything the game owner must decide.
