# Country Outlines (shape): v4 log

| | count |
|---|---|
| Fixed | 1 |
| Removed | 1 |
| Moved up | 2 |
| Moved down | 42 |
| Added | 50 |
| Final per value | 100: 30 · 200: 30 · 300: 30 · 400: 29 · 500: 30 (total 149) |

Every outline, old and new, was drawn with the game's own `shapeSVG` and checked by eye.

## Notable fixes
- **Laos never appeared.** The map calls it "Lao PDR", so the game silently dropped it. I added that alias.
- **Taiwan removed.** It isn't a separate shape on this world map, so the game was already dropping it.
- **Rebalanced.** About 40 well-known outlines moved down a level, because the hardest values were crowded and 100 had only 20 clues. For example, Turkey, Greece, Argentina, New Zealand, Madagascar, Cuba, Morocco, Libya and Germany moved to 100; Iran, Iraq, Jordan, Syria, Tunisia and Algeria moved to 200; and Lebanon, Oman and Croatia moved to 300. Venezuela moved up from 100 to 300, and Finland from 100 to 200.

## Added (50, no tiny islands)
- 100: Russia
- 200: United Arab Emirates
- 300: Belgium, Bangladesh, North Korea, Romania, Hungary, Czech Republic, Jamaica, Haiti, Dominican Republic, DR Congo, Gambia, Serbia, Mali, Cameroon, Senegal, Albania
- 400: Qatar, Kuwait, Bosnia and Herzegovina, Costa Rica, Belarus, Uzbekistan, Niger, Estonia, Lithuania, Ivory Coast, Papua New Guinea, Nicaragua, Zimbabwe, Uganda, Slovenia, Guyana
- 500: Central African Republic, Republic of the Congo, Benin, Togo, Liberia, Sierra Leone, Gabon, Guinea, Equatorial Guinea, Moldova, North Macedonia, Montenegro, South Sudan, El Salvador, Suriname, Turkmenistan

## Needs a code fix in index.html (I couldn't fix these through the data)
- **China always fails.** Its map data contains an empty polygon, so `shapeSVG` throws and the tile shows "The world map didn't load". China is a 100 clue. Fix: in `decodeWorld`, drop empty polygons before storing them (`feats[nm] = polys.filter(p => p.length && p[0] && p[0].length)`), or skip them in `shapeSVG`.
- **Far-off islands aren't fully left out.** The 25° distance filter still keeps the Azores and Madeira with Portugal, so mainland Portugal is drawn tiny. It also keeps Svalbard with Norway and the Galápagos with Ecuador. A tighter rule would fix it, for example dropping any part smaller than 2% of the main part's area that is more than 5° away.
