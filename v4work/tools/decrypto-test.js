// 6.82: tests the Decrypto rules and referee in src/decrypto.js (the "rules" region, no screen code). Run: node v4work/tools/decrypto-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/decrypto.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const D = new Function(m[1] + "; return DCR;")();
const deck = JSON.parse(fs.readFileSync(path.join(__dirname, "../decrypto/keywords.json"), "utf8"));
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const roster = (a, b) => [a.map(x => ({p:"p" + x, n:x})), b.map(x => ({p:"p" + x, n:x}))];
const mk = (cfg = {}, r = roster(["Ali", "Mona", "Sara"], ["Karim", "Nour"])) => { const g = D.Game(Object.assign({rounds:8}, cfg), r, deck); g.start(); return g; };

// keywords: 8 different words, none from the same family, only from packs that are on
const fam = deck.fam, famIdx = w => fam.map((f, i) => f.includes(w) ? i : -1).filter(i => i >= 0);
for(let i = 0; i < 300; i++){ const [a, b] = D.dealWords(deck, {}), all = a.concat(b); ok(a.length === 4 && b.length === 4 && new Set(all).size === 8, "8 different words");
  const fs2 = all.flatMap(famIdx); ok(new Set(fs2).size === fs2.length, "no two words of one family: " + all); }
for(let i = 0; i < 50; i++){ const all = D.dealWords(deck, {everyday:false, egypt:false, football:false, movies:false}).flat(); ok(all.every(w => deck.packs.places.includes(w)), "only the Places pack"); }
eq(D.CODES.length, 24, "24 codes"); ok(D.CODES.every(D.validCode), "all codes valid");

// a round: codes are valid, differ round to round per team, Encryptors rotate in join order
let g = mk(), seen = [new Set(), new Set()], encs = [];
for(let r = 1; r <= 8; r++){ [0, 1].forEach(t => { ok(D.validCode(g.code[t]), "valid code"); const k = g.code[t].join(""); ok(!seen[t].has(k), "no code twice for a team"); seen[t].add(k); }); encs.push(g.nameOf(g.enc[0]));
  play(g, () => true, () => false); }
eq(encs.slice(0, 4), ["Ali", "Mona", "Sara", "Ali"], "Encryptor rotates through the team");

// writing clues: only the Encryptor, three non-blank clues, never containing the keyword
g = mk(); const e0 = g.enc[0], e1 = g.enc[1], t0 = 0, w0 = g.teams[0].words[g.code[0][0] - 1];
ok(!g.act("pMona", {k:"clues", r:1, c:["a", "b", "c"]}).ok || g.enc[0] === "pMona", "a teammate can't send clues");
eq(g.act(e0, {k:"clues", r:1, c:["a", "", "c"]}).err, "blank", "blank clue refused");
eq(g.act(e0, {k:"clues", r:1, c:["a", "b"]}).err, "blank", "two clues refused");
eq(g.act(e0, {k:"clues", r:1, c:["I love " + w0.toUpperCase(), "b", "c"]}).err, "keyword", "the keyword in a clue is refused");
eq(g.act(e0, {k:"clues", r:2, c:["a", "b", "c"]}).err, "stale", "wrong round refused");
ok(g.act(e0, {k:"clues", r:1, c:["one", "two", "three"]}).ok && g.phase === "write", "first Encryptor sends");
eq(g.act(e0, {k:"clues", r:1, c:["x", "y", "z"]}).err, "locked", "can't send twice");
ok(JSON.stringify(g.pub()).indexOf("three") < 0 && g.pub().clues === null, "clues stay private until their turn");
ok(g.act(e1, {k:"clues", r:1, c:["uno", "dos", "tres"]}).ok && g.phase === "guess" && g.turn === 0, "both sent: guessing starts with Team A");
ok(g.pub().clues.join() === "one,two,three", "Team A's clues are public now"); ok(JSON.stringify(g.pub()).indexOf("uno") < 0, "Team B's clues are still private");

// guessing round 1: the Encryptor can't guess, no interception in round 1, reveal when the own team has locked
eq(g.act(e0, {k:"guess", r:1, t:0, g:[1, 2, 3]}).err, "enc", "own Encryptor can't guess");
const mate = g.teams[0].ps.find(x => x.p !== e0).p, foe = g.teams[1].ps[0].p;
eq(g.act(foe, {k:"guess", r:1, t:0, g:[1, 2, 3]}).err, "r1", "no interception in round 1");
eq(g.act(mate, {k:"guess", r:1, t:0, g:[1, 1, 3]}).err, "bad", "needs three different numbers");
eq(g.act(mate, {k:"guess", r:1, t:1, g:[1, 2, 3]}).err, "stale", "wrong turn refused");
const right = g.code[0].slice(), wrong = D.CODES.find(c => !D.same(c, right));
ok(g.act(mate, {k:"guess", r:1, t:0, g:right}).ok && g.phase === "reveal", "locking the own guess reveals in round 1");
ok(g.rev.ownOk && g.teams[0].mis === 0 && g.teams[1].int === 0, "right guess: no tokens");
eq(g.teams[0].log[right[0] - 1][0], {r:1, w:"one"}, "the clue drops into its log column");
ok(JSON.stringify(g.pub()).indexOf("uno") < 0, "Team B's clues still private during Team A's reveal");
g.advance(); eq([g.phase, g.turn], ["guess", 1], "then Team B's clues");
const mate1 = g.teams[1].ps.find(x => x.p !== e1).p, foe0 = g.teams[0].ps[0].p;
ok(g.act(mate1, {k:"guess", r:1, t:1, g:wrong}).ok && g.phase === "reveal" && !g.rev.ownOk && g.teams[1].mis === 1, "wrong own guess: Miscommunication");
g.advance(); eq([g.phase, g.round, g.turn], ["write", 2, 0], "round 2 starts");

// round 2: interception counts, locks are first-come
const clues = t => { const e = g.enc[t]; return g.act(e, {k:"clues", r:g.round, c:["a" + g.round, "b" + g.round, "c" + g.round]}); };
clues(0); clues(1); eq(g.phase, "guess", "round 2 guessing");
const mateA = g.teams[0].ps.find(x => x.p !== g.enc[0]).p;
ok(g.act("pKarim", {k:"guess", r:2, t:0, g:g.code[0]}).ok && g.phase === "guess", "an interceptor locks, still waiting for the own team");
eq(g.act("pNour", {k:"guess", r:2, t:0, g:[1, 2, 3]}).err, "locked", "the interception is locked by the first");
ok(g.pub().locks.opp === "Karim" && g.pub().locks.own === null, "the TV sees who has locked, not what");
ok(g.act(mateA, {k:"guess", r:2, t:0, g:wrong}).ok && g.phase === "reveal", "own lock completes the turn");
ok(g.rev.oppOk && !g.rev.ownOk && g.teams[1].int === 1 && g.teams[0].mis === 1, "Interception for B, Miscommunication for A");

// win by tokens: play on until someone has 2 Interceptions or 2 Miscommunications
g.advance(); const mateB = g.teams[1].ps.find(x => x.p !== g.enc[1]).p;
g.timeout(); eq(g.phase, "reveal", "timeout with no guesses reveals");
ok(g.teams[1].mis === 2 && !g.rev.ownOk && g.rev.own === null, "no guess counts as a mistake");
g.advance(); eq([g.phase, g.over && g.over.winner, g.over && g.over.why], ["over", 0, "tokens"], "Team B has 2 Miscommunications: Team A wins");
ok(g.pub().over.words[0].length === 4 && g.pub().over.words[1].length === 4, "keywords are revealed at the end");

// the pub never carries a team's keywords or an unrevealed code before the end
g = mk(); const pj = JSON.stringify(g.pub()); ok(g.teams.every(t => t.words.every(w => pj.indexOf(w) < 0)), "no keywords in pub");
const ids = g.teams.flatMap(t => t.ps.map(x => x.p));
ids.forEach(p => { const v = g.priv(p), t = g.teamOf(p); eq(v.words, g.teams[t].words, "a player sees their own team's words"); ok(!v.words.some(w => g.teams[1 - t].words.includes(w)), "never the other team's");
  eq(!!v.code, g.enc[t] === p, "only the Encryptor sees the code"); });

// rounds run out: higher Interceptions minus Miscommunications wins, level goes to the tiebreak
function play(g, ownRight, oppRight){   // plays one whole round with set outcomes: ownRight(t), oppRight(t)
  [0, 1].forEach(t => g.act(g.enc[t], {k:"clues", r:g.round, c:["p", "q", "r"].map(x => x + g.round + t)}));
  for(let t = 0; t < 2; t++){ const mate = g.teams[t].ps.find(x => x.p !== g.enc[t]).p, foe = g.teams[1 - t].ps[0].p, code = g.code[t], bad = D.CODES.find(c => !D.same(c, code));
    if(g.round > 1) g.act(foe, {k:"guess", r:g.round, t, g:oppRight(t) ? code : bad}); g.act(mate, {k:"guess", r:g.round, t, g:ownRight(t) ? code : bad}); g.advance(); } }
g = mk({rounds:2}); play(g, () => true, () => false); eq(g.phase, "write", "round 1 clean"); play(g, () => true, t => t === 0); eq([g.phase, g.over.winner, g.over.why], ["over", 1, "score"], "last round: Team B has an interception, so B wins on points");
g = mk({rounds:2}); play(g, () => true, () => false); play(g, () => true, () => false); eq(g.phase, "tie", "level after the last round: tiebreak");
eq(g.act("pAli", {k:"tie", w:["x", "y", "z", "w"]}).ok, true, "a team submits"); eq(g.act("pMona", {k:"tie", w:["x", "y", "z", "w"]}).err, "locked", "only once per team");
const wb = g.teams[1].words, wa = g.teams[0].words;
g.act("pKarim", {k:"tie", w:[wa[0].toUpperCase(), wa[1], "nope", wa[3]]});
eq([g.phase, g.over.winner, g.over.why, g.tieRes.c], ["over", 1, "tiebreak", [0, 3]], "most keywords guessed wins (case doesn't matter)");
g = mk({rounds:2}); play(g, () => true, () => false); play(g, () => true, () => false); g.timeout(); eq([g.phase, g.over.winner], ["over", 2], "nobody guessed any: a draw");
g = mk(); g.endGame(); eq([g.phase, g.over.winner, g.over.why], ["over", 2, "ended"], "ending a level game is a draw");
// both teams reach a result in the same round: compare points
g = mk(); g.teams[0].int = 1; g.teams[1].int = 1; g.teams[0].mis = 1; g.round = 3; play(g, () => true, () => true); ok(g.phase === "over" && g.over.winner === 1 && g.over.why === "score", "two results at once: points decide, " + g.phase + g.over.winner);

// late joiners are added to a team and get that team's words; random games always finish
g = mk(); g.addPlayer("pNew", "New", 1); eq(g.teamOf("pNew"), 1, "late joiner"); eq(g.priv("pNew").words, g.teams[1].words, "gets the team's keywords"); g.addPlayer("pNew", "New", 0); eq(g.teamOf("pNew"), 1, "no double join");
for(let i = 0; i < 400; i++){ const g2 = mk({rounds:i % 2 ? 6 : 8}); let k = 0; while(g2.phase !== "over" && k++ < 200){
    if(g2.phase === "write"){ [0, 1].forEach(t => { if(Math.random() < .9) g2.act(g2.enc[t], {k:"clues", r:g2.round, c:["a", "b", "c"]}); }); if(Math.random() < .1) g2.timeout(); }
    else if(g2.phase === "guess"){ const t = g2.turn; const pick = () => Math.random() < .6 ? g2.code[t] : D.CODES[Math.floor(Math.random() * 24)];
      g2.teams[t].ps.forEach(x => g2.act(x.p, {k:"guess", r:g2.round, t, g:pick()})); g2.teams[1 - t].ps.forEach(x => g2.act(x.p, {k:"guess", r:g2.round, t, g:pick()})); if(g2.phase === "guess") g2.timeout(); }
    else if(g2.phase === "reveal") g2.advance(); else if(g2.phase === "tie") g2.timeout(); }
  ok(g2.phase === "over", "random game finishes"); ok(g2.round <= g2.cfg.rounds, "never past the last round"); const A = g2.teams[0], B = g2.teams[1];
  if(g2.over.why === "tokens") ok(A.int >= 2 || B.mis >= 2 || B.int >= 2 || A.mis >= 2, "a tokens win has 2 of something"); }
console.log("decrypto rules: " + n + " checks passed");
