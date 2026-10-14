// 6.80: tests the Tarneeb rules region of src/tarneeb.js. Run: node v4work/tools/tarneeb-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/tarneeb.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//);
if(!m) throw new Error("rules region not found");
const T = new Function(m[1] + "; return {TN_SUITS,tnCallValue,tnBeats,tnTricks,tnTeam,tnNext,tnDeal,tnWeakHand,tnAuction,tnCanPass,tnCanCall,tnCanDouble,tnDoCall,tnDoPass,tnDoDouble,tnLegal,tnTrickWinner,tnScoreHand,tnWinner,tnSortHand,tnDeck};")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); };

// calls rank by number first, then suit (clubs lowest, spades highest)
ok(T.tnBeats({n:2, s:"S"}, {n:2, s:"H"}), "2S beats 2H");
ok(T.tnBeats({n:3, s:"C"}, {n:2, s:"S"}), "3C beats 2S");
ok(!T.tnBeats({n:1, s:"C"}, null) === false, "anything beats no call");
ok(T.tnTricks({n:1}) === 7 && T.tnTricks({n:7}) === 13, "1 means 7 tricks, 7 means 13");

// scoring examples from the doc
const S = T.tnScoreHand;
assert.deepStrictEqual(S(0, {n:3, s:"H"}, [10, 3], false), [10, 0]);   n++;      // made 9, took 10
assert.deepStrictEqual(S(0, {n:3, s:"H"}, [7, 6], false), [-9, 6]);    n++;      // missed
assert.deepStrictEqual(S(0, {n:3, s:"H"}, [13, 0], false), [16, 0]);   n++;      // all 13 without calling 7
assert.deepStrictEqual(S(0, {n:7, s:"S"}, [13, 0], false), [26, 0]);   n++;      // called 7, made
assert.deepStrictEqual(S(0, {n:7, s:"S"}, [12, 1], false), [-16, 1]);  n++;      // called 7, missed
assert.deepStrictEqual(S(1, {n:3, s:"H"}, [3, 10], true), [0, 20]);    n++;      // doubled, made
assert.deepStrictEqual(S(0, {n:3, s:"H"}, [7, 6], true), [-18, 12]);   n++;      // doubled, missed
assert.deepStrictEqual(S(0, {n:7, s:"S"}, [13, 0], true), [52, 0]);    n++;      // doubled Kaboot
assert.deepStrictEqual(S(0, {n:3, s:"H"}, [13, 0], true), [32, 0]);    n++;
assert.deepStrictEqual(S(0, {n:1, s:"C"}, [8, 5], false, {defenders:true}), [8, 5]); n++;
ok(T.tnWinner([31, 20], 31) === 0 && T.tnWinner([30, 20], 31) === -1 && T.tnWinner([33, 35], 31) === 1 && T.tnWinner([32, 32], 31) === 2, "winner");

// auction: basic flow, raising, three passes end it
let a = T.tnAuction(3);                                  // dealer is seat 3, so seat 0 speaks first
ok(a.turn === 0, "first to speak is after the dealer");
ok(T.tnDoCall(a, 0, {n:1, s:"C"}) && a.turn === 1, "call moves the turn");
ok(!T.tnDoCall(a, 1, {n:1, s:"C"}), "can't repeat a call");
ok(T.tnDoCall(a, 1, {n:2, s:"D"}), "raise");
ok(T.tnDoPass(a, 2) && T.tnDoPass(a, 3), "pass, pass");
ok(a.turn === 0 && !a.done, "outbid caller 0 may raise");
ok(T.tnDoPass(a, 0) && a.done && a.result === "won" && a.high.seat === 1, "third pass ends it, seat 1 wins");
// double ends the auction at once, only by an opponent of the high call
a = T.tnAuction(3); T.tnDoCall(a, 0, {n:2, s:"S"});
ok(!T.tnCanDouble(a, 2) && !T.tnCanDouble(a, 0) && T.tnCanDouble(a, 1) && T.tnCanDouble(a, 3), "only opponents double");
ok(T.tnDoDouble(a, 3) && a.done && a.doubled && a.result === "won", "double ends the auction");
ok(!T.tnDoCall(a, 1, {n:3, s:"S"}) && !T.tnDoDouble(a, 1), "nothing after a double");
a = T.tnAuction(0); ok(!T.tnCanDouble(a, 1), "can't double before any call");
// everybody passes: redeal; with mustCall the dealer can't pass
a = T.tnAuction(0); T.tnDoPass(a, 1); T.tnDoPass(a, 2); T.tnDoPass(a, 3); T.tnDoPass(a, 0);
ok(a.done && a.result === "redeal", "four passes = redeal");
a = T.tnAuction(0); T.tnDoPass(a, 1); T.tnDoPass(a, 2); T.tnDoPass(a, 3);
ok(!T.tnCanPass(a, 0, {mustCall:true}) && T.tnCanPass(a, 0, {}), "mustCall stops the dealer passing");

// legal cards and trick winners
const h = [{s:"S", r:5}, {s:"H", r:9}, {s:"H", r:2}];
ok(T.tnLegal(h, [{seat:0, card:{s:"H", r:12}}]).length === 2, "must follow hearts");
ok(T.tnLegal(h, [{seat:0, card:{s:"D", r:12}}]).length === 3, "no diamonds: anything");
ok(T.tnTrickWinner([{seat:0, card:{s:"H", r:12}}, {seat:1, card:{s:"H", r:14}}, {seat:2, card:{s:"S", r:2}}, {seat:3, card:{s:"D", r:14}}], "S") === 2, "trump wins");
ok(T.tnTrickWinner([{seat:0, card:{s:"H", r:12}}, {seat:1, card:{s:"H", r:14}}, {seat:2, card:{s:"S", r:2}}, {seat:3, card:{s:"D", r:14}}], "C") === 1, "highest of led suit wins");
ok(T.tnTrickWinner([{seat:0, card:{s:"H", r:3}}, {seat:1, card:{s:"D", r:14}}, {seat:2, card:{s:"S", r:2}}, {seat:3, card:{s:"S", r:9}}], "S") === 3, "highest trump wins");

// random full games: 13 tricks each hand, every card played once, scores are consistent, auctions always end
let hands = 0, redeals = 0, doubled = 0, kaboots = 0;
for(let g = 0; g < 300; g++){
  let sc = [0, 0], dealer = g % 4, w = -1, guard = 0;
  while(w < 0 || w === 2){
    if(++guard > 200) throw new Error("game never ended");
    const H = T.tnDeal();
    ok(new Set(H.flat().map(c => c.s + c.r)).size === 52 && H.every(x => x.length === 13), "deal is 4 x 13 distinct");
    const au = T.tnAuction(dealer);
    while(!au.done){   // random bots: mostly pass, sometimes raise, sometimes double
      const seat = au.turn, r = Math.random();
      if(T.tnCanDouble(au, seat) && r < 0.08) { T.tnDoDouble(au, seat); break; }
      if(r < 0.5){ const base = au.high ? T.tnCallValue(au.high.call) + 1 : 0; if(base <= 27){ const v = base + Math.floor(Math.random() * Math.min(5, 28 - base)); if(T.tnDoCall(au, seat, {n:Math.floor(v / 4) + 1, s:T.TN_SUITS[v % 4]})) continue; } }
      if(!T.tnDoPass(au, seat, {})) T.tnDoCall(au, seat, {n:7, s:"S"}) || T.tnDoPass(au, seat, {});
    }
    ok(au.done, "auction ended");
    dealer = T.tnNext(dealer);
    if(au.result === "redeal"){ redeals++; continue; }
    hands++; if(au.doubled) doubled++;
    const trump = au.high.call.s, hs = H.map(x => x.slice()), won = [0, 0], played = [];
    let lead = au.high.seat;
    for(let t = 0; t < 13; t++){
      const trick = []; let seat = lead;
      for(let k = 0; k < 4; k++){
        const legal = T.tnLegal(hs[seat], trick), c = legal[Math.floor(Math.random() * legal.length)];
        hs[seat].splice(hs[seat].indexOf(c), 1); trick.push({seat, card:c}); played.push(c); seat = T.tnNext(seat);
      }
      lead = T.tnTrickWinner(trick, trump); won[T.tnTeam(lead)]++;
    }
    ok(won[0] + won[1] === 13 && played.length === 52 && hs.every(x => !x.length), "13 tricks, all cards played");
    if(won[T.tnTeam(au.high.seat)] === 13) kaboots++;
    const p = T.tnScoreHand(au.high.seat, au.high.call, won, au.doubled);
    ok(p.every(Number.isInteger), "integer points");
    sc = [sc[0] + p[0], sc[1] + p[1]]; w = T.tnWinner(sc, 31);
  }
}
console.log(`tarneeb rules: ${n} checks passed over ${hands} hands (${redeals} redeals, ${doubled} doubled, ${kaboots} all-13 hands)`);
