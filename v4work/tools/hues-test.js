// 7.44: tests the Hues and Cues rules in src/hues.js (the "rules" region, no screen code) and that the phone page's clue check (hues.html) agrees with it. Run: node v4work/tools/hues-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/hues.js"), "utf8"), m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const T = new Function(m[1] + "; return HCR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const ids = ["a", "b", "c", "d"], mk = o => { let k = 0; return T.Game(Object.assign({players:ids, turns:1, rand:() => ((k++ * 0.37) + .11) % 1}, o)); };
eq(T.Game({players:["a", "b"]}), null, "needs 3 players");

// the clue check
const chk = (t, k) => T.check(t, k);
eq(chk("Pool", 1), "", "a plain word"); eq(chk("", 1), "Type a clue.", "empty"); eq(chk("sea breeze", 1), "One word only.", "two words for clue 1"); eq(chk("sea breeze", 2), "", "two words for clue 2"); eq(chk("one two three", 2), "Two words at most.", "three words");
eq(chk("Blue", 1), "No colour names.", "colour"); eq(chk("BLUE", 1), "No colour names.", "case"); eq(chk("sky blue", 2), "No colour names.", "colour inside two words"); eq(chk("bluetooth", 1), "", "a colour inside another word is fine"); eq(chk("redbull", 1), "", "redbull is an object");
eq(chk("a7mar", 1), "No colour names.", "Egyptian Arabic colour"); eq(chk("azra2", 1), "No colour names.", "Egyptian Arabic colour 2"); eq(chk("أحمر", 1), "No colour names.", "Arabic script colour"); eq(chk("بحر", 1), "", "an Arabic word that isn't a colour (sea)");
eq(chk("dark", 1), "No light, dark or pale.", "dark"); eq(chk("Lighter", 1), "No light, dark or pale.", "lighter"); eq(chk("corner", 1), "No board positions.", "position"); eq(chk("C12", 1), "No numbers.", "coordinates"); eq(chk("top left", 2), "No board positions.", "two positions");
eq(chk("Ahly", 1), "", "a team is fine"); eq(chk("koshari", 1), "", "food is fine"); eq(chk("x".repeat(30), 1), "Too long.", "too long");
// the phone page's copy of the check gives the same answers
{ const h = fs.readFileSync(path.join(__dirname, "../../hues.html"), "utf8"), w = h.match(/const WHY = [\s\S]*?\n\}\n/); ok(w, "phone check found"); const C = new Function(w[0] + "; return check;")();
  ["Pool", "", "sea breeze", "Blue", "sky blue", "bluetooth", "a7mar", "azra2", "أحمر", "بحر", "dark", "Lighter", "corner", "C12", "top left", "Ahly", "koshari", "one two three", "x".repeat(30), "  spaced   out  "].forEach(t => [1, 2].forEach(k => eq(C(t, k, T.BAN), T.check(t, k), `phone and game agree on "${t}" (${k})`))); }

// the board and scoring
eq(T.COLS * T.ROWS, 660, "660 shades"); ok(/^hsl\(/.test(T.shade(3, 4)), "a shade"); eq(T.shade(0, 8), T.shade(30, 8), "the hue wheel wraps");
eq([[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 0], [3, 3]].map(([a, b]) => T.pts(T.dist([5, 5], [5 + a, 5 + b]))), [300, 200, 200, 100, 100, 0, 0], "300 on the target, 200 in the frame, 100 on the ring, 0 beyond");
{ const r = (() => { let k = 0; return () => ((k++ * 0.6180339) % 1); })(); for(let i = 0; i < 50; i++){ const c = Array.from({length:4}, () => 0), card = (() => { const g = T.Game({players:ids, rand:r}); g.begin(0); return g.card; })(); eq(card.length, 4, "4 shades"); for(let x = 0; x < 4; x++) for(let y = x + 1; y < 4; y++) ok(T.dist(card[x], card[y]) >= 6, "shades are at least 6 apart"); } }

// a full turn
{ const g = mk(); g.begin(0); eq(g.ph, "pick", "starts on pick"); const gv = g.giver, gs = ids.filter(p => p !== gv); eq(g.seq.length, 4, "1 turn each"); eq(mk({turns:0}).seq.length, 8, "auto = 2 each for 4 players");
  ok(!g.pick(gs[0], 0, "pool", 1), "only the giver picks"); ok(!g.pick(gv, 0, "blue", 1), "a banned clue is refused"); eq(g.rej.why, "No colour names.", "reason recorded"); eq(g.ph, "pick", "still picking"); ok(!g.pick(gv, 7, "pool", 1), "bad shade index");
  ok(g.pick(gv, 1, "Pool", 1), "clue 1 accepted"); eq(g.tgt, g.card[1], "target chosen"); eq(g.ph, "g1", "first guesses"); eq(g.c1, "Pool", "clue stored");
  ok(!g.mark(gv, 1, 1, 2), "the giver can't guess"); ok(!g.mark(gs[0], 99, 1, 2), "off the board"); const t = g.tgt;
  ok(g.mark(gs[0], t[0], t[1], 2), "exact"); ok(!g.mark(gs[0], 0, 0, 2), "one marker per round"); ok(g.mark(gs[1], Math.min(29, t[0] + 1), t[1], 2), "next to it"); eq(g.ph, "g1", "waiting for the last");
  ok(g.mark(gs[2], Math.min(29, t[0] + 2), t[1], 2), "ring"); eq(g.ph, "pick2", "everyone locked: clue 2");
  ok(!g.clue2(gv, "red sea", 3), "banned in clue 2"); ok(g.clue2(gv, "sea breeze", 3), "clue 2 accepted"); eq(g.ph, "g2", "second guesses");
  g.mark(gs[0], t[0], t[1], 4); g.mark(gs[1], t[0], t[1], 4); g.mark(gs[2], (t[0] + 8) % 30 === t[0] ? 0 : (t[0] > 20 ? 0 : t[0] + 8), t[1], 4); eq(g.ph, "reveal", "reveal"); eq(g.kind, "done", "scored");
  eq(g.deltas[gs[0]], 600, "two exact markers"); eq(g.deltas[gs[1]], 200 + 300, "next to + exact"); eq(g.deltas[gs[2]], 100 + 0, "ring + a miss");
  eq(g.deltas[gv], 400, "the giver gets 100 for each of the 4 markers inside the frame (the ring does not count)"); ok(g.next(5), "next turn"); eq(g.ph, "pick", "new turn"); ok(g.giver !== gv, "a new giver"); }
// the 900 cap
{ const big = Array.from({length:10}, (_, i) => "p" + i), g = T.Game({players:big, turns:1, rand:() => .5}); g.begin(0); const gs = big.filter(p => p !== g.giver); g.pick(g.giver, 0, "x", 1); const t = g.tgt; gs.forEach(p => g.mark(p, t[0], t[1], 2)); g.clue2(g.giver, "y", 3); gs.forEach(p => g.mark(p, t[0], t[1], 4)); eq(g.deltas[g.giver], 900, "capped at 900 (18 markers inside)"); }
// timers
{ const g = mk({t1:10, t2:5, tg:20}); g.begin(1000); eq(g.dl, 11000, "clue 1 timer"); ok(!g.tick(10999), "not yet"); ok(g.tick(11000), "clue 1 timed out"); eq(g.kind, "skip", "skipped turn"); eq(g.deltas[g.giver], 0, "no points for a skipped turn"); }
{ const g = mk({t1:10, t2:5, tg:20}); g.begin(0); const gs = ids.filter(p => p !== g.giver); g.pick(g.giver, 0, "pool", 1000); eq(g.dl, 21000, "guess timer"); g.mark(gs[0], g.tgt[0], g.tgt[1], 2000); ok(g.tick(21000), "guess timer ends the round"); eq(g.ph, "pick2", "to clue 2"); eq(g.dl, 26000, "clue 2 timer"); ok(g.tick(26000), "no second clue"); eq(g.kind, "late", "late"); eq(g.deltas[gs[0]], 300, "first marker scored"); }
{ const g = mk({t1:0, t2:0, tg:0}); g.begin(0); eq(g.dl, 0, "timer off"); ok(!g.tick(1e12), "never times out"); }
// flags
{ const g = mk(); g.begin(0); const gv = g.giver, gs = ids.filter(p => p !== gv); g.pick(gv, 0, "pool", 100); ok(!g.flag(gv, 200), "the giver can't flag"); ok(!g.flag(gs[0], 100 + T.FLAG_MS + 1), "too late to flag");
  ok(g.flag(gs[0], 200), "first flag"); ok(!g.flag(gs[0], 300), "one flag each"); eq(g.ph, "g1", "not enough flags yet"); ok(g.flag(gs[1], 400), "second flag = more than half of 3"); eq(g.ph, "pick", "struck: back to pick"); eq(g.c1, "", "clue cleared"); ok(g.tgt, "the shade is kept"); eq(g.rej.why, "Your clue was flagged. Send a new one.", "told why");
  ok(g.pick(gv, 0, "lagoon", 500), "a new clue"); eq(g.ph, "g1", "guessing again"); ok(g.flag(gs[0], 600) && g.flag(gs[1], 700), "flagged again"); eq(g.ph, "reveal", "twice struck ends the turn"); eq(g.kind, "skip", "skip"); eq(g.deltas[gv], 0, "no points"); }
// last turn and leaving
{ const g = mk(); g.begin(0); for(let i = 0; i < 4; i++){ ok(g.timeout(i), "skip"); ok(g.next(i), "next"); } eq(g.ph, "over", "over after the last turn"); }
{ const g = mk(); g.begin(0); const gv = g.giver, gs = ids.filter(p => p !== gv); g.pick(gv, 0, "pool", 1); g.mark(gs[0], 1, 1, 2); g.mark(gs[1], 1, 1, 2); ok(g.drop(gs[2], 3), "a player leaves"); eq(g.ph, "pick2", "the rest were locked in, so it moves on"); ok(g.drop(gv, 4), "the giver leaves"); eq(g.ph, "over", "two players left: over"); }
{ const g = mk({players:["a", "b", "c", "d", "e"]}); g.begin(0); const gv = g.giver; ok(g.drop(gv, 1), "giver leaves"); eq(g.ph, "reveal", "turn skipped"); eq(g.kind, "skip", "skip"); g.next(2); ok(g.giver !== gv, "someone else"); }
console.log(`hues-test: ${n} checks passed`);
