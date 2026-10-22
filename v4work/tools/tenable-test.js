// 7.82: tests the Tenable rules in src/tenable.js (the "rules" region) and checks every list and lineup. Run: node v4work/tools/tenable-test.js
const fs = require("fs"), path = require("path"), assert = require("assert"), R = p => fs.readFileSync(path.join(__dirname, "../..", p), "utf8");
const m = R("src/tenable.js").match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const app = R("src/app.js"), fn = name => app.match(new RegExp("function " + name + "\\([\\s\\S]*?\\n(?=function |const )"))[0];
const {TER, ansNorm, lev} = new Function(fn("ansNorm") + fn("lev") + m[1] + "; return {TER, ansNorm, lev};")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const mk = (names, lives) => TER.Turn({items:names.map(a => typeof a === "string" ? {a} : a), lives, norm:ansNorm, lev});

// a turn: right, wrong, duplicate, the same wrong twice, lives, give, all found
{ const t = mk(["Russia", "Canada", "China", "United States", "Brazil", "Australia", "India", "Argentina", "Kazakhstan", "Algeria"], 3);
  eq(t.guess("canada").k, "right", "right"); eq(t.found[1], true, "slot 2 filled"); eq(t.guess("Canda").k, "dup", "a near spelling of a found one is a duplicate");
  eq(t.guess("france").k, "wrong", "wrong"); eq(t.left, 2, "a life gone"); eq(t.guess("France").k, "again", "same wrong twice"); eq(t.left, 2, "no second life lost");
  eq(t.guess("  ").k, "empty", "blank"); eq(t.guess("kazakstan").k, "right", "one slip is fine"); eq(t.guess("brasil").k, "right", "brasil");
  { const h = mk(["Russia", "X"], 3); eq(h.tap(0), "hint", "tap 1 hints"); eq(h.hintText(0), "R…", "first letter"); h.tap(0); eq(h.hintText(0), "Ru…", "two letters"); h.tap(0); eq(h.hintText(0), "Rus…", "three letters"); eq(h.n(), 0, "hints give nothing"); eq(h.tap(0), "give", "4th tap gives"); eq(h.n(), 1, "now found"); eq(h.tap(1), "give", "one-letter answer gives straight away"); }
  { const l = mk(["Russia", "Argentina", "Kazakhstan", "Spain", "Chad", "Iran", "Iraq", "Australia"], 3);   // 7.85: more leeway
    eq(l.guess("Rusia").k, "right", "one letter short"); eq(l.guess("Argntna").k, "right", "two letters short on a long name"); eq(l.guess("Kazakstn").k, "right", "two slips"); eq(l.guess("Spian").k, "right", "swapped letters (2 edits) on a 5 letter name"); eq(l.guess("Austrlai").k, "right", "swapped end letters");
    eq(l.guess("Chd").k, "right", "one letter short on a 4 letter name"); eq(l.guess("Iran").k, "right", "Iran"); eq(l.found[5], true, "Iran filled Iran"); eq(l.found[6], false, "exact beats a close spelling of another slot"); eq(l.guess("Iraq").k, "right", "Iraq is its own slot"); }
  { const l = mk(["Alpha", "Carlos Bianchi / Gunnar Andersson", "Zed"], 3);   // 7.86: a tie at the cut accepts either name
    eq(l.guess("Andersson").k, "right", "tie: second name"); eq(l.found[1], true, "tie slot filled"); eq(l.guess("Carlos Bianchi").k, "dup", "tie: the other name is a repeat, not a wrong answer"); eq(l.left, 3, "no life lost"); }
  { const l = mk(["Alpha", "Carlos Bianchi / Gunnar Andersson", "Zed"], 3); eq(l.guess("bianchi").k, "right", "tie: first name by surname"); }
  ok(t.give(0), "host gives Russia"); ok(!t.give(0), "only once"); eq(t.n(), 4, "4 found");
  t.guess("peru"); eq(t.left, 1, "1 life"); ok(!t.over, "still going"); t.guess("chile"); ok(t.over, "out of lives"); eq(t.how, "lives", "how"); eq(t.points(), 4, "1 point each");
  eq(t.guess("china").k, "over", "no guesses after the end"); }
{ const t = mk(["A1x", "Bb2", "Cc3"], 0); ["a1x", "bb2"].forEach(g => t.guess(g)); for(let i = 0; i < 9; i++) t.guess("nope" + i); ok(!t.over, "no life limit"); t.guess("cc3"); eq(t.how, "all", "all found"); eq(t.points(), 3 + TER.BONUS, "bonus"); }
// surnames, the same name twice
{ const t = mk(["Alan Shearer", "Harry Kane", {a:"Mohamed Salah", alt:["mo salah"]}, "Thierry Henry"], 3);
  eq(t.guess("shearer").k, "right", "surname"); eq(t.guess("mo salah").k, "right", "other name"); eq(t.guess("Thiery Henri").k, "right", "two slips on 12 letters"); eq(t.guess("kan").k, "wrong", "too far off"); }
{ const t = mk(["Neville", "Neville", "Giggs"], 3); eq(t.guess("neville").i.length, 2, "two players with one name both fill"); }

// every list: 10 answers, every answer (and each other name) finds only its own slot
const D = f => JSON.parse(R("v4work/tenable/" + f)), lists = {normal:D("normal.json"), football:D("football.json")};
for(const [k, L] of Object.entries(lists)){ const titles = new Set();
  for(const l of L){ ok(l.t && !titles.has(l.t), k + ": title " + l.t); titles.add(l.t); eq(l.a.length, 10, l.t + ": 10 answers"); ok(l.src && l.as, l.t + ": source and date");
    const t = mk(l.a.map(([a, v, alt]) => ({a, v, alt:alt || []})), 0);
    l.a.forEach(([a, v, alt], i) => [a].concat(alt || []).forEach(g => eq(t.match(g), l.a.map((x, j) => j).filter(j => j === i || ansNorm(l.a[j][0]) === ansNorm(a)), `${l.t}: "${g}" should match only "${a}" (got ${t.match(g).map(j => l.a[j][0])})`))); } }
// every lineup has 11 players and a score
const form = JSON.parse(R("v4work/out/form.json")).data, fs2 = D("form-scores.json"); let nl = 0;
const allLx = []; for(const v in form) form[v].forEach(x => allLx.push(x)); D("lineups.json").forEach(x => allLx.push(x));   // 8.1: Tenable-only lineups too
for(const [q, a] of allLx){ nl++; const names = q.split("\n").slice(1).join(" · ").split(" · ");
  eq(names.length, 11, a + ": 11 players"); ok(fs2[a], a + ": has a score"); ok(/^.*?, \S+ \(.*\)$/.test(a), a + ": team, year (occasion)");
  const t = mk(names, 0); names.forEach((x, i) => { const hit = t.match(x); ok(hit.includes(i) && hit.every(j => ansNorm(names[j]) === ansNorm(x)), `${a}: "${x}" matches ${hit.map(j => names[j])}`); }); }
console.log(`tenable-test: ${n} checks passed (${lists.normal.length} normal lists, ${lists.football.length} football lists, ${nl} lineups)`);
