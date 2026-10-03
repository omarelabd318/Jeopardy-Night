# Map Pin (pin): v4 log

| | count |
|---|---|
| Fixed | 0 coordinate errors found (all 100 existing checked) |
| Removed | 4 |
| Moved up | 8 |
| Moved down | 9 |
| Added | 50 |
| Final per value | 100: 30 · 200: 29 · 300: 29 · 400: 29 · 500: 29 (total 146) |

I rendered the new pins, and the old pins most at risk of being confused, with the game's own `pinSVG`. The map shows a region about 46° wide, so two cities less than about 1° apart look like the same pin.

## Notable fixes
- **Removed four pins that looked the same as another pin**, because the tile had two fair answers:
  - Jeddah, which sat on top of Mecca.
  - Abu Dhabi, which looked the same as Dubai.
  - Damascus, which looked the same as Beirut and nearly the same as Amman.
  - Hurghada, which looked the same as Sharm El Sheikh.
- **Moved down:**
  - Sharm El Sheikh: 400 to 100. Egyptians know the tip of Sinai.
  - Aswan, Havana, Miami and Hong Kong: to 200.
  - Santiago and Hanoi: 400 to 300.
  - Khartoum, Siwa and Montevideo: 500 to 400.
- **Moved up:**
  - Kuwait City, Chicago and Munich: to 300.
  - Lagos and Karachi: to 400.
  - Kabul and Ulaanbaatar: to 500.
- Cairo and Port Said are about 1.5° apart. I kept both, because Port Said sits clearly on the coast at the canal.

## Added (50, all checked to be more than 1.6° from any other pin)
- 100: New Delhi, Shanghai, Baghdad, Medina, Melbourne, São Paulo, Johannesburg, Saint Petersburg, Kuala Lumpur, Osaka
- 200: Auckland, Vancouver, Edinburgh, Tripoli, Frankfurt, Ankara, Algiers, Manila, Las Vegas, Perth
- 300: Marseille, Seville, Boston, Montreal, Jakarta, Taipei, Warsaw, Budapest, Copenhagen, Denpasar (Bali)
- 400: Porto, Bucharest, Abu Simbel, Marsa Matruh, Zanzibar City, Sana'a, Islamabad, Colombo, Honolulu, Ho Chi Minh City
- 500: Marsa Alam, Samarkand, Malé, Kigali, Djibouti City, Port Sudan, Yangon, Vladivostok, Dubrovnik, Abidjan
