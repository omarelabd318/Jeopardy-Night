// 6.79: plays Estimation games with random bots and checks the rules: node v4work/tools/est-sim.js [games]
// Checks: 13 tricks per round, hands empty, the last estimator never makes the total 13, at most 2 Dash Calls, only legal cards are accepted, and the scoring examples from the framework doc.
const fs = require("fs"), path = require("path"), root = path.resolve(__dirname, "../..");
const src = ["cards", "estrules"].map(f => fs.readFileSync(path.join(root, "src", f + ".js"), "utf8")).join("\n");
const {CK, ER} = new Function(src + "\nreturn {CK, ER};")();
let bad = 0; const fail = m => { bad++; console.log("FAIL", m); };
const pick = a => a[Math.floor(Math.random() * a.length)];
const games = +process.argv[2] || 50; let rounds = 0, redeals = 0, dashes = 0, bigs = 0;
for(let n = 0; n < games; n++){
  const bola = pick(["full", "mini", "micro"]), g = ER.Game({bola, dash:Math.random() < .7}, ["A", "B", "C", "D"], ["a", "b", "c", "d"]); g.start();
  let guard = 0;
  while(g.phase !== "over" && guard++ < 5000){
    if(["redeal", "trickdone", "scored"].includes(g.phase)){
      if(g.phase === "redeal") redeals++;
      if(g.phase === "scored"){ rounds++; const sum = g.won.reduce((a, b) => a + b, 0); if(sum !== 13) fail("tricks " + sum); if(g.hands.some(h => h.length)) fail("hands not empty");
        const tot = g.ests.reduce((a, b) => a + b, 0); if(g.round().k !== "x" && tot === 13) fail("total 13 in round " + g.ri); if(g.dash.filter(Boolean).length > 2) fail("dash > 2"); dashes += g.dash.filter(Boolean).length; if(g.ests.some(e => e >= 8)) bigs++; }
      g.advance(); continue; }
    const seat = g.turn, p = ER.priv(g, seat), a = p.act; if(!a){ fail("no act in " + g.phase); break; }
    let r;
    if(a.k === "dash") r = g.act(seat, {k:"dash", yes:Math.random() < .25});
    else if(a.k === "bid"){ if(Math.random() < .45 || (g.high && g.high.n >= 13 && g.high.s === "N")) r = g.act(seat, {k:"pass"});
      else { let tries = 0, b; do { b = {n:4 + Math.floor(Math.random() * 7), s:pick(["S", "H", "D", "C", "N"])}; } while(!ER.beats(b, g.high) && tries++ < 30); r = tries >= 30 ? g.act(seat, {k:"pass"}) : g.act(seat, {k:"bid", n:b.n, s:b.s}); } }
    else if(a.k === "est"){ let e; do { e = Math.floor(Math.random() * (a.max + 1)); } while(e === a.ban); r = g.act(seat, {k:"est", n:e});
      if(a.ban != null && g.act(seat, {k:"est", n:a.ban}).ok) fail("risk number accepted"); }
    else { const bad1 = p.hand.find(c => !a.legal.includes(c)); if(bad1 && g.act(seat, {k:"play", c:bad1}).ok) fail("illegal card accepted " + bad1); r = g.act(seat, {k:"play", c:pick(a.legal)}); }
    if(!r.ok) fail("rejected " + JSON.stringify(a) + " " + r.err);
    if(ER.pub(g).v !== g.v) fail("version");
  }
  if(g.phase !== "over") fail("game did not finish (" + g.phase + ")");
  const expect = {full:18, mini:13, micro:5}[bola]; if(g.plan.length !== expect) fail("plan length " + bola);
}
// scoring examples from the doc
const S = x => ER.score(Object.assign({dash:[0, 0, 0, 0].map(() => false), caller:null, callerN:null, last:null}, x));
let s = S({ests:[5, 0, 3, 4], won:[5, 1, 3, 2], caller:0, callerN:5, last:3});
const eq = (a, b, m) => { if(a !== b) fail(m + ": got " + a + " want " + b); };
eq(s.rows[0].pts, 25, "caller hit 5 (10+5+10)"); eq(s.rows[1].pts, -1, "miss by 1"); eq(s.rows[2].pts, 13, "hit 3 = 13"); eq(s.rows[3].pts, -2 + (Math.abs(s.total - 13) >= 2 ? -10 : 0), "last estimator miss by 2");
s = S({ests:[8, 2, 2, 0], won:[8, 3, 1, 0], caller:0, callerN:8, last:3}); eq(s.rows[0].pts, 64 + 10, "8 squared + caller"); 
s = S({ests:[9, 2, 1, 0], won:[6, 3, 3, 1], caller:0, callerN:9, last:3}); eq(s.rows[0].pts, -41 - 10, "miss on 9: half of 81 rounded, minus caller");
s = S({ests:[5, 3, 2, 0], won:[5, 4, 2, 2], caller:0, callerN:5, last:3, dash:[false, false, false, true]}); eq(s.rows[3].pts, -33, "dash miss in Under round"); eq(s.rows[0].pts, 25 + 0, "only winner? two hits");
console.log(`${games} games, ${rounds} rounds scored, ${redeals} redeals, ${dashes} dash calls, ${bigs} rounds with a big call: ${bad ? bad + " FAILURES" : "all good"}`);
process.exit(bad ? 1 : 0);
