/* 6.80 (Omar): Tarneeb, the Egyptian (Masri) partnership card game on phones. Four players sit N/E/S/W, partners opposite (seats 0 and 2 are team 0, seats 1 and 3 are team 1,
   going round the table in play order). Each phone shows its own hand; the TV is the table. The rules live in the "rules" region below, which has no screen code in it, so
   v4work/tools/tarneeb-test.js can load just that region and play thousands of random hands against it.
   Rules (all Omar's answers, 2026-10-14): a call is a number 1 to 7 plus a suit, where 1 means 7 tricks and 7 means all 13. Suits rank spades > hearts > diamonds > clubs, so
   2 spades beats 2 hearts. There is no No trump: the suit in the winning call is the tarneeb. One auction, anticlockwise from the player after the dealer, players may raise, and
   it ends when three players have passed after a call. Any opponent of the current high call may Double at any time, which ends the auction: nobody can call or raise after
   it, and every point in the hand is worth twice as much, for both teams, made or missed (no redouble). Scoring: made = + tricks taken; missed = minus the tricks called
   (call 3 = 9 tricks) and the defenders score what they took; taking all 13 without calling 7 = +16; calling 7 and making it = +26; calling 7 and missing = minus 16.
   First team to 31 (setup: 31, 41 or 61) wins; if both pass it in one hand the higher total wins, level plays on. Anything that was my choice is in NOTES.md under 6.80.
   Screen and phone code: see the "screens" region further down. To remove: delete this file, cards-based Tarneeb files and the Tarneeb button (see NOTES 6.80). */

/*@rules*/
const TN_SUITS = ["C", "D", "H", "S"];          // lowest to highest, used for ranking calls
const TN_SYM = {S:"♠", H:"♥", D:"♦", C:"♣"};
const TN_SHOW = ["S", "H", "C", "D"];            // order cards are shown in a hand: alternating colours
const TN_RANK = {11:"J", 12:"Q", 13:"K", 14:"A"};
const tnRankName = r => TN_RANK[r] || String(r);
const tnCallValue = c => (c.n - 1) * 4 + TN_SUITS.indexOf(c.s);   // 1 clubs = 0 ... 7 spades = 27
const tnBeats = (a, b) => !b || tnCallValue(a) > tnCallValue(b);
const tnTricks = c => c.n + 6;                    // call number to tricks: 1 = 7 ... 7 = 13
const tnCallText = c => c.n + " " + TN_SYM[c.s];
const tnTeam = seat => seat % 2;
const tnNext = seat => (seat + 1) % 4;            // play order: anticlockwise, the next player to the right
const tnPartner = seat => (seat + 2) % 4;

function tnDeck(){ const d = []; for(const s of TN_SUITS) for(let r = 2; r <= 14; r++) d.push({s, r}); return d; }
function tnShuffle(a, rnd = Math.random){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function tnSortHand(h){ return h.slice().sort((x, y) => TN_SHOW.indexOf(x.s) - TN_SHOW.indexOf(y.s) || y.r - x.r); }
function tnDeal(rnd = Math.random){ const d = tnShuffle(tnDeck(), rnd), hands = [[], [], [], []]; d.forEach((c, i) => hands[i % 4].push(c)); return hands.map(tnSortHand); }
const tnWeakHand = h => h.every(c => c.r <= 10);   // no card above a 10: may ask for a redeal

/* ---- the auction ----
   state: {dealer, turn, high:{seat, call}|null, passed:[seat,...], doubled:false, done:false, result:null|"redeal"|"won", log:[]}
   opts: {mustCall:false}  (the dealer may not pass when everyone else has and nothing has been called) */
function tnAuction(dealer){ return {dealer, turn:tnNext(dealer), high:null, passed:[], doubled:false, done:false, result:null, log:[]}; }

function tnAdvance(a){   // move to the next player who hasn't passed; end the auction when it comes back to the high caller or everybody passed
  let t = a.turn;
  for(let i = 0; i < 4; i++){
    t = tnNext(t);
    if(a.high && t === a.high.seat){ a.done = true; a.result = "won"; return a; }
    if(!a.passed.includes(t)){ a.turn = t; return a; }
  }
  a.done = true; a.result = a.high ? "won" : "redeal"; return a;
}

function tnCanPass(a, seat, opts = {}){
  if(a.done || a.turn !== seat) return false;
  if(opts.mustCall && !a.high && a.passed.length === 3) return false;   // the last player can't throw the hand in
  return true;
}
function tnCanCall(a, seat, call){
  if(a.done || a.turn !== seat || !call) return false;
  if(!(call.n >= 1 && call.n <= 7) || !TN_SUITS.includes(call.s)) return false;
  return tnBeats(call, a.high && a.high.call);
}
function tnCanDouble(a, seat){   // any opponent of the current high call, at any time, once
  return !a.done && !!a.high && !a.doubled && tnTeam(seat) !== tnTeam(a.high.seat);   // an opponent who has already passed may still double
}
function tnDoCall(a, seat, call){ if(!tnCanCall(a, seat, call)) return false; a.high = {seat, call:{n:call.n, s:call.s}}; a.log.push({seat, call:a.high.call}); tnAdvance(a); return true; }
function tnDoPass(a, seat, opts){ if(!tnCanPass(a, seat, opts)) return false; a.passed.push(seat); a.log.push({seat, pass:true}); tnAdvance(a); return true; }
function tnDoDouble(a, seat){ if(!tnCanDouble(a, seat)) return false; a.doubled = true; a.log.push({seat, dbl:true}); a.done = true; a.result = "won"; return true; }

/* ---- playing a hand ---- */
function tnLegal(hand, trick){   // trick: [{seat, card}, ...] in play order; follow the suit that was led if you hold it
  if(!trick.length) return hand.slice();
  const led = trick[0].card.s, same = hand.filter(c => c.s === led);
  return same.length ? same : hand.slice();
}
function tnTrickWinner(trick, trump){   // returns the seat that wins
  const led = trick[0].card.s; let best = trick[0];
  for(const t of trick.slice(1)){
    const a = t.card, b = best.card;
    if(a.s === b.s ? a.r > b.r : (a.s === trump && b.s !== trump)) best = t;
  }
  return best.seat;
}

/* ---- scoring one hand ----
   tricks: [team0Tricks, team1Tricks] out of 13. opts: {defenders:false} (defenders always score their tricks, off by default). Returns [team0Points, team1Points]. */
function tnScoreHand(caller, call, tricks, doubled, opts = {}){
  const ct = tnTeam(caller), dt = 1 - ct, need = tnTricks(call), got = tricks[ct], pts = [0, 0];
  if(got >= need){
    pts[ct] = call.n === 7 ? 26 : got === 13 ? 16 : got;   // calling 7 and taking all 13 = 26; 13 without calling 7 = 16
    if(opts.defenders) pts[dt] = tricks[dt];
  } else {
    pts[ct] = call.n === 7 ? -16 : -need;
    pts[dt] = tricks[dt];
  }
  return doubled ? pts.map(p => p * 2) : pts;
}
function tnWinner(scores, target){   // -1 = nobody yet; 0 or 1 = that team won; 2 = both passed the target level, play another hand
  const a = scores[0] >= target, b = scores[1] >= target;
  if(!a && !b) return -1;
  if(a && b) return scores[0] === scores[1] ? 2 : scores[0] > scores[1] ? 0 : 1;
  return a ? 0 : 1;
}
/*@end-rules*/
