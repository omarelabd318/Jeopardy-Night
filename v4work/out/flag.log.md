# Flags (flag): v4 log

| | count |
|---|---|
| Fixed | 6 (4 redrawn, 2 answers widened) |
| Removed | 2 |
| Moved up | 14 |
| Moved down | 32 |
| Added | 49 |
| Final per value | 100: 40 · 200: 40 · 300: 39 · 400: 39 · 500: 39 (total 197) |

All 150 existing flags and all 49 new flags were rendered to PNG and checked by eye.

## Notable fixes
- **Syria**: the drawing was the old Assad-era flag (red, white and black with two green stars). It now shows the current flag, adopted in 2025: green, white and black with three red stars.
- **Marshall Islands**: the two diagonal stripes were the wrong way round. Orange now sits above white.
- **Haiti**: the drawing was plain blue over red, which is easy to mistake for Liechtenstein. It now has the white panel with the coat of arms.
- **Guatemala**: added the central emblem so the flag isn't just blue, white and blue stripes.
- **Monaco and Chad removed from the pool.** Monaco's flag is the same as Indonesia's, and Chad's is almost the same as Romania's, so those tiles had two fair answers. The flags are still defined; they're just no longer dealt.
- **Indonesia and Romania** now show their lookalike in the answer: "Indonesia (or Monaco, same flag)" and "Romania (or Chad, near-identical)".
- **Rebalanced for an Egyptian crowd.** Palestine, Tunisia, Algeria, Morocco, UAE, Argentina, Brazil, Spain and China moved down to 100. Jordan, Kuwait, Libya, Sudan, Qatar, Yemen, Pakistan and Uruguay moved down to 200. Harder lookalikes (Mali, Guinea, Burkina Faso, the Baltic states, Luxembourg, Honduras) moved up to 300.

## Added (49 sovereign countries that weren't in the pool)
- 100: Egypt, Saudi Arabia, Canada, Mexico, Portugal, South Korea, Croatia
- 200: Iran, Iraq, Albania, Oman
- 300: Cyprus, Kazakhstan, Cambodia, Ecuador, Paraguay, Uganda
- 400: Slovenia, Slovakia, Moldova, Belarus, Sri Lanka, Mongolia, Malta, Angola, Zimbabwe, Montenegro, Kyrgyzstan, Liechtenstein
- 500: Tajikistan, Turkmenistan, Bhutan, Brunei, Nicaragua, El Salvador, Belize, Dominica, Fiji, Papua New Guinea, Kiribati, Tuvalu, Mozambique, Zambia, Eritrea, Lesotho, Eswatini, Equatorial Guinea, Andorra, Vatican City

The only sovereign countries still missing are Israel and Afghanistan. I left both out on purpose: Israel because of sensitivity at an Egyptian party, and Afghanistan because which flag counts as its national flag is disputed.

## Notes for integration
- `new_flags` has 55 entries: the 49 new flags, plus replacement drawings for 6 existing ids (syria, marshall, haiti, guatemala, indonesia, romania). Merge it over the existing flag table (`Object.assign(F, new_flags)`).
- Each lookalike pair now has its own emblem: Slovenia, Slovakia and Russia; Andorra, Moldova and Romania; Ecuador and Colombia; Liechtenstein and Haiti.
- The Fiji, Tuvalu and Croatia drawings use a `<clipPath>` with unique ids (ujfj, ujtv, hrc).
- `flags` (id to name) includes every id.
