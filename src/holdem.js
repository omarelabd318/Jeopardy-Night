/* 7.2 (Omar): Texas Hold'em, no-limit poker for 2 to 9 players with play chips only. Everyone scans one code and plays from their phone (cards.html at /c?r=ROOM&g=hd, the shared card phone page);
   the TV shows the table: the shared cards, the pot, every stack and whose turn it is. Omar picked the Vegas Classic look (green felt, walnut rail with a gold edge, red card backs, gold for whose turn it is)
   and said no trivia, so the trivia comeback from the framework doc is not in the game. Everything else follows the framework doc (Claude Doc "Texas Hold'em Mode").
   Rules (defaults from the doc): everyone starts with the same chips (setup: 500, 1,000 or 2,000), blinds start 10/20 and go up every 5, 8 or 12 hands (table in BLINDS, then doubling), standard no-limit
   betting (a raise is at least the size of the last bet or raise; a short all-in does not reopen the betting), side pots, best five of seven cards, ties split, an odd chip goes to the first winner left of the button.
   Heads-up (two left): the button posts the small blind and acts first before the flop. The game ends when one player has all the chips (setup: or after 20, 30 or 40 hands, most chips wins); the host can tap
   Final hands at any time (5 more hands, then most chips wins). Each decision has a timer (20, 30 or 45 seconds or off): when it runs out the player checks if they can, otherwise folds.
   The rules and the referee are in the "rules" region below, which has no screen code in it, so v4work/tools/holdem-test.js can load just that region and play thousands of random games against it.
   The Game object is the referee: it holds every card; pub() is what every phone and the TV may see, priv() is one player's own two cards and the move they may make (like TNR in src/tarneeb.js).
   Built on the card kit (src/cards.js, CK, look "vegas") and the shared phone page cards.html (MODES.hd); the relay routes are the generic crd* ones. The winner screen plays the Siuuu clip.
   To remove: delete this file, v4work/tools/holdem-test.js, the MODES.hd block in cards.html, the 'vegas' look and four-colour lines in src/cards.js, the 7.2 CSS block and #hdo section in head.html, the Texas Hold'em button,
   the modeHold entry in src/title.js, hdLeave() in showHome and 'holdem' in MODE_FILES in build.js. */

/*@rules*/
const HE = (() => {
  const SYM = {S:"♠", H:"♥", D:"♦", C:"♣"}, SHOW = ["S", "H", "C", "D"];
  const SING = {2:"Two", 3:"Three", 4:"Four", 5:"Five", 6:"Six", 7:"Seven", 8:"Eight", 9:"Nine", 10:"Ten", 11:"Jack", 12:"Queen", 13:"King", 14:"Ace"};
  const PLUR = {2:"Twos", 3:"Threes", 4:"Fours", 5:"Fives", 6:"Sixes", 7:"Sevens", 8:"Eights", 9:"Nines", 10:"Tens", 11:"Jacks", 12:"Queens", 13:"Kings", 14:"Aces"};
  const suit = c => c.slice(-1), rank = c => parseInt(c, 10);   // cards are codes like CK's: "14S" = ace of spades, "10H" = ten of hearts
  const LET = r => ({11:"J", 12:"Q", 13:"K", 14:"A"})[r] || String(r);
  const deck = () => { const d = []; for(const s of SHOW) for(let r = 2; r <= 14; r++) d.push(r + s); return d; };
  const shuffle = (a, rnd = Math.random) => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---- hands: score5 gives [category, tiebreakers...] (higher is better): 8 straight flush, 7 four, 6 full house, 5 flush, 4 straight, 3 three, 2 two pair, 1 pair, 0 high card ---- */
  const score5 = cs => {
    const r = cs.map(rank).sort((a, b) => b - a), fl = cs.every(c => suit(c) === suit(cs[0]));
    let st = 0; if(new Set(r).size === 5){ if(r[0] - r[4] === 4) st = r[0]; else if(r[0] === 14 && r[1] === 5 && r[4] === 2) st = 5; }   // A-2-3-4-5 is the lowest straight
    const cnt = {}; r.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
    const g = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || b - a), pat = g.map(x => cnt[x]).join("");
    if(st && fl) return [8, st]; if(pat === "41") return [7, g[0], g[1]]; if(pat === "32") return [6, g[0], g[1]]; if(fl) return [5, ...r]; if(st) return [4, st];
    if(pat === "311") return [3, ...g]; if(pat === "221") return [2, ...g]; if(pat === "2111") return [1, ...g]; return [0, ...r]; };
  const cmp = (a, b) => { for(let i = 0; i < Math.max(a.length, b.length); i++){ const d = (a[i] || 0) - (b[i] || 0); if(d) return d < 0 ? -1 : 1; } return 0; };
  const nameOf = s => s[0] === 8 ? (s[1] === 14 ? "Royal flush" : `Straight flush, ${SING[s[1]]} high`) : s[0] === 7 ? `Four of a kind, ${PLUR[s[1]]}` : s[0] === 6 ? `Full house, ${PLUR[s[1]]} full of ${PLUR[s[2]]}`
    : s[0] === 5 ? `Flush, ${SING[s[1]]} high` : s[0] === 4 ? `Straight, ${SING[s[1]]} high` : s[0] === 3 ? `Three of a kind, ${PLUR[s[1]]}` : s[0] === 2 ? `Two pair, ${PLUR[s[1]]} and ${PLUR[s[2]]}`
    : s[0] === 1 ? `Pair of ${PLUR[s[1]]}` : `High card, ${SING[s[1]]}`;
  const best = cards => { let top = null;   // the best five of 5 to 7 cards: {s, cards, name}
    const n = cards.length, pick = [];
    const go = (from, k) => { if(k === 5){ const five = pick.map(i => cards[i]), sc = score5(five); if(!top || cmp(sc, top.s) > 0) top = {s:sc, cards:five}; return; }
      for(let i = from; i <= n - (5 - k); i++){ pick[k] = i; go(i + 1, k + 1); } };
    go(0, 0); top.name = nameOf(top.s); return top; };
  const preflop = h => { const a = rank(h[0]), b = rank(h[1]); if(a === b) return `Pocket ${PLUR[a]}`; const hi = Math.max(a, b), lo = Math.min(a, b); return `${LET(hi)} ${LET(lo)} ${suit(h[0]) === suit(h[1]) ? "suited" : "offsuit"}`; };

  /* ---- blinds ---- */
  const BLINDS = [[10, 20], [15, 30], [25, 50], [50, 100], [75, 150], [100, 200], [150, 300], [200, 400], [300, 600]];
  const blindsFor = lvl => lvl < BLINDS.length ? BLINDS[lvl] : [300 * 2 ** (lvl - 8), 600 * 2 ** (lvl - 8)];   // level 10 is 600/1200 and so on

  /* ---- side pots: tot = what each seat put in this hand, folded = who can't win. Returns [{amt, elig:[seats]}] from the main pot up; a pot with one eligible seat is an uncalled bet coming back ---- */
  const sidePots = (tot, folded, only) => {   // only (optional) = the seats whose total makes a pot level, used mid-hand so that unequal bets before anyone is all in don't look like side pots
    const top = Math.max(0, ...tot.filter((t, i) => !folded[i])), levels = [...new Set(tot.filter((t, i) => !folded[i] && t > 0 && (!only || only[i] || t === top)))].sort((a, b) => a - b), pots = []; let prev = 0;
    for(const L of levels){ let amt = 0; tot.forEach(t => { amt += Math.min(t, L) - Math.min(t, prev); });
      pots.push({amt, elig:tot.map((t, i) => i).filter(i => !folded[i] && tot[i] >= L)}); prev = L; }
    const rest = tot.reduce((s, t) => s + t, 0) - pots.reduce((s, p) => s + p.amt, 0);   // chips above the top live level (a folded player who put in more than everyone left): goes to the top pot
    if(rest > 0 && pots.length) pots[pots.length - 1].amt += rest;
    return pots; };

  /* ---- the game: the referee. cfg = {chips, up, end:"last"|"fixed", fixed, timer, helper, four}. act(seat, a) takes {k:"fold"} | {k:"check"} | {k:"call"} | {k:"raise", to} | {k:"allin"} | {k:"showcards"}
     and returns {ok} or {ok:false, err}. After "run" and "show" the screen calls advance() (on a timer or a click). Phases: hand (betting), run (everyone left is all in: the cards come one street at a time),
     show (the hand is over, pots paid), over. ---- */
  function Game(cfg, names, pids, rnd = Math.random){
    const n = names.length, z = v => Array(n).fill(v), ok = {ok:true}, bad = err => ({ok:false, err});
    const g = {cfg, names, pids, n, v:0, phase:"", hn:0, dealer:-1, sb:-1, bb:-1, lvl:0, blinds:[10, 20], street:0, board:[], hole:z(null).map(() => []), deck:[], stack:z(cfg.chips), out:z(0), folded:z(false), allin:z(false),
      bet:z(0), tot:z(0), acted:z(false), startStack:z(0), dealt:z(false), cur:0, minRaise:20, turn:-1, say:null, show:null, finalLeft:null, over:false, shown:z(false), sit:z(false), place:0};
    const alive = () => { const a = []; for(let i = 0; i < n; i++) if(!g.out[i]) a.push(i); return a; };
    const nextFrom = (i, f) => { for(let k = 1; k <= n; k++){ const j = (i + k) % n; if(f(j)) return j; } return -1; };   // the next seat clockwise (higher index) that passes f
    const live = () => alive().filter(i => !g.folded[i]);
    const canAct = () => live().filter(i => !g.allin[i] && g.stack[i] > 0);
    const pay = (i, amt) => { amt = Math.min(amt, g.stack[i]); g.stack[i] -= amt; g.bet[i] += amt; g.tot[i] += amt; if(g.stack[i] === 0) g.allin[i] = true; return amt; };
    const potTotal = () => g.tot.reduce((s, t) => s + t, 0);
    g.potTotal = potTotal;

    g.startHand = () => {
      g.hn++; g.lvl = Math.floor((g.hn - 1) / cfg.up); g.blinds = blindsFor(g.lvl);
      const al = alive(); g.dealer = g.dealer < 0 ? al[Math.floor(rnd() * al.length)] : nextFrom(g.dealer, i => !g.out[i]);
      if(al.length === 2){ g.sb = g.dealer; g.bb = nextFrom(g.dealer, i => !g.out[i]); } else { g.sb = nextFrom(g.dealer, i => !g.out[i]); g.bb = nextFrom(g.sb, i => !g.out[i]); }
      g.deck = shuffle(deck(), rnd); g.board = []; g.street = 0; g.show = null; g.say = null; g.shown = z(false);
      g.hole = z(null).map(() => []); g.bet = z(0); g.tot = z(0); g.acted = z(false); g.allin = z(false); g.startStack = g.stack.slice();
      for(let i = 0; i < n; i++){ g.folded[i] = !!g.out[i]; g.dealt[i] = !g.out[i]; }
      for(let k = 0; k < 2; k++) for(const i of al) g.hole[i].push(g.deck.pop());
      pay(g.sb, g.blinds[0]); pay(g.bb, g.blinds[1]); g.cur = g.blinds[1]; g.minRaise = g.blinds[1];
      g.phase = "hand"; g.turn = -1;
      const first = al.length === 2 ? g.sb : nextFrom(g.bb, i => !g.out[i]);   // heads-up the button (small blind) acts first before the flop
      g.turn = first; g.lastActor = (first + n - 1) % n; g.settle(); };

    /* after every action: who is next, or the street is over */
    g.settle = () => {
      const lv = live();
      if(lv.length === 1) return g.finish();
      const ca = canAct();
      const done = ca.length === 0 || (ca.length === 1 && g.bet[ca[0]] >= g.cur) || ca.every(i => g.acted[i] && g.bet[i] >= g.cur);
      if(!done){ g.turn = nextFrom(g.lastActor, i => ca.includes(i) && (!g.acted[i] || g.bet[i] < g.cur)); return; }
      g.bet = z(0); g.acted = z(false); g.cur = 0; g.minRaise = g.blinds[1]; g.lastActor = g.dealer;
      if(g.street === 3 || ca.length < 2){ if(g.board.length >= 5) return g.finish(); g.phase = "run"; g.turn = -1; g.runStreet(); return; }
      g.dealStreet(); g.turn = nextFrom(g.dealer, i => ca.includes(i)); };
    g.dealStreet = () => { const k = g.street === 0 ? 3 : 1; for(let i = 0; i < k; i++) g.board.push(g.deck.pop()); g.street++; g.say = {t:["", "flop", "turn", "river"][g.street]}; };
    g.runStreet = () => { if(g.board.length >= 5) return; g.dealStreet(); };   // the all-in run out: the first reveal comes now, the rest on advance()

    const order = from => { const o = []; for(let k = 1; k <= n; k++) o.push((from + k) % n); return o; };   // seats left of from, clockwise
    g.finish = () => {
      const lv = live(), tot = g.tot.slice(), total = potTotal(), won = z(0), res = {pots:[], hands:{}, won, unc:null};
      if(lv.length === 1){ const w = lv[0]; won[w] = total; res.unc = w; res.pots.push({amt:total, win:[w], name:""}); }
      else {
        const ev = {}; lv.forEach(i => { ev[i] = best(g.hole[i].concat(g.board)); res.hands[i] = {c:g.hole[i].slice(), name:ev[i].name, best:ev[i].cards}; });
        for(const pot of sidePots(tot, g.folded)){
          let top = null, win = []; pot.elig.forEach(i => { const c = top !== null ? cmp(ev[i].s, ev[top].s) : 1; if(c > 0){ top = i; win = [i]; } else if(c === 0) win.push(i); });
          const share = Math.floor(pot.amt / win.length); let odd = pot.amt - share * win.length;
          const seq = order(g.dealer).filter(i => win.includes(i));   // an odd chip goes to the first winner left of the button
          seq.forEach(i => { won[i] += share + (odd > 0 ? 1 : 0); if(odd > 0) odd--; });
          res.pots.push({amt:pot.amt, win:seq, name:ev[top].name, elig:pot.elig}); } }
      for(let i = 0; i < n; i++) g.stack[i] += won[i];
      const A = alive().length, busts = alive().filter(i => g.stack[i] === 0).sort((a, b) => g.startStack[a] - g.startStack[b]);   // smallest start stack gets the worst place
      busts.forEach((i, k) => { g.out[i] = A - k; });
      const glow = []; res.pots.forEach(p => p.win.forEach(i => { if(res.hands[i]) res.hands[i].best.forEach(c => { if(!glow.includes(c)) glow.push(c); }); })); res.glow = glow;
      g.show = res; g.phase = "show"; g.turn = -1; g.cur = 0; g.bet = z(0);
      if(g.finalLeft != null) g.finalLeft--; };

    g.ranks = () => { const al = alive(), r = z(0); al.forEach(i => { r[i] = 1 + al.filter(j => g.stack[j] > g.stack[i]).length; }); for(let i = 0; i < n; i++) if(g.out[i]) r[i] = g.out[i]; return r; };
    g.toCall = i => g.cur - g.bet[i];
    g.canRaise = i => g.stack[i] > g.toCall(i) && !g.acted[i];
    g.limits = i => { const maxTo = g.bet[i] + g.stack[i], minTo = Math.min(maxTo, g.cur + g.minRaise); return {minTo, maxTo}; };
    g.act = (seat, a) => {
      if(!a || !(seat >= 0 && seat < n)) return bad("move");
      if(a.k === "showcards"){ if(g.phase !== "show" || !g.show || g.show.unc !== seat || g.shown[seat]) return bad("show"); g.shown[seat] = true; g.v++; return ok; }
      if(g.phase !== "hand" || seat !== g.turn) return bad("turn");
      const tc = g.toCall(seat), st = g.stack[seat], {minTo, maxTo} = g.limits(seat);
      if(a.k === "fold"){ g.folded[seat] = true; g.say = {seat, t:"fold"}; }
      else if(a.k === "check"){ if(tc !== 0) return bad("check"); g.say = {seat, t:"check"}; }
      else if(a.k === "call"){ if(tc <= 0) return bad("call"); const amt = pay(seat, tc); g.say = {seat, t:g.allin[seat] ? "allin" : "call", amt}; }
      else if(a.k === "raise" || a.k === "allin"){
        const to = a.k === "allin" ? maxTo : a.to;
        if(!Number.isInteger(to) || !g.canRaise(seat) || to > maxTo || to <= g.cur || (to < minTo && to !== maxTo)) return bad("raise");
        const size = to - g.cur; pay(seat, to - g.bet[seat]);
        if(size >= g.minRaise){ g.minRaise = size; for(let i = 0; i < n; i++) if(i !== seat) g.acted[i] = false; }   // a full raise reopens the betting; a short all-in does not
        const was = g.cur; g.cur = to; g.say = {seat, t:g.allin[seat] ? "allin" : was === 0 ? "bet" : "raise", amt:to}; }
      else return bad("kind");
      g.acted[seat] = true; g.lastActor = seat; g.settle(); g.v++; return ok; };
    /* run and show move on by themselves: advance() reveals the next street, ends the hand or deals the next one */
    g.advance = () => {
      if(g.phase === "run"){ if(g.board.length >= 5) g.finish(); else g.dealStreet(); }
      else if(g.phase === "show"){
        const al = alive();
        if(al.length <= 1 || (cfg.end === "fixed" && g.hn >= cfg.fixed) || (g.finalLeft != null && g.finalLeft <= 0)){ g.phase = "over"; g.over = true; g.turn = -1; g.final = g.ranks(); }
        else g.startHand(); }
      else return false;
      g.v++; return true; };
    g.start = () => { g.startHand(); g.v++; };
    g.autoAct = seat => { if(g.phase !== "hand" || g.turn !== seat) return bad("turn"); return g.act(seat, g.toCall(seat) <= 0 ? {k:"check"} : {k:"fold"}); };
    g.makeFinal = () => { if(g.finalLeft == null){ g.finalLeft = g.phase === "show" ? 5 : 6; g.v++; } };   // the hand in play counts as one of them, so mid-hand it is 6
    g.endNow = () => { g.phase = "over"; g.over = true; g.turn = -1; g.final = g.ranks(); g.v++; };
    return g; }

  const upIn = g => g.cfg.up - ((g.hn - 1) % g.cfg.up);   // hands left at this blind level, this one included
  const pubPots = g => { const kept = sidePots(g.tot, g.folded, g.allin).filter(p => p.elig.length >= 2); return kept.length > 1 ? kept.map(p => ({amt:p.amt, who:p.elig})) : []; };
  const pub = g => ({g:"hd", v:g.v, phase:g.phase, n:g.n, names:g.names, hn:g.hn, street:g.street, board:g.board.slice(), stacks:g.stack.slice(), bets:g.bet.slice(), tot:g.tot.slice(), folded:g.folded.slice(), allin:g.allin.slice(), out:g.out.slice(),
    dealt:g.dealt.slice(), dealer:g.dealer, sb:g.sb, bb:g.bb, turn:g.turn, pot:g.potTotal(), pots:g.phase === "hand" || g.phase === "run" ? pubPots(g) : [], cur:g.cur, blinds:g.blinds, lvl:g.lvl, up:g.hn ? upIn(g) : 0, say:g.say,
    faceUp:g.phase === "run" || (g.phase === "show" && g.show && !g.show.unc) ? Object.fromEntries(live2(g).map(i => [i, g.hole[i]])) : g.phase === "show" && g.show && g.show.unc != null && g.shown[g.show.unc] ? {[g.show.unc]:g.hole[g.show.unc]} : null,
    show:g.show ? {unc:g.show.unc, pots:g.show.pots, won:g.show.won, glow:g.show.glow, hands:g.show.hands} : null, final:g.finalLeft != null, finalLeft:g.finalLeft, ranks:g.over ? g.final : null,
    secs:g.phase === "hand" && g.turn >= 0 ? g.cfg.timer : 0, sit:g.sit.slice(), cfg:{timer:g.cfg.timer, helper:g.cfg.helper, four:g.cfg.four, end:g.cfg.end, fixed:g.cfg.fixed, chips:g.cfg.chips}});
  const live2 = g => { const a = []; for(let i = 0; i < g.n; i++) if(!g.out[i] && !g.folded[i] && g.dealt[i]) a.push(i); return a; };
  const priv = (g, i) => { const hand = g.over || g.out[i] && g.phase !== "show" ? [] : g.hole[i].slice(); let act = null;
    if(g.phase === "hand" && g.turn === i){ const tc = Math.max(0, g.toCall(i)), {minTo, maxTo} = g.limits(i), cr = g.canRaise(i);
      act = {k:"bet", toCall:Math.min(tc, g.stack[i]), canCheck:tc === 0, canRaise:cr, minTo, maxTo, allinCall:tc > 0 && g.stack[i] <= tc, pot:g.potTotal(), cur:g.cur, bb:g.blinds[1], stack:g.stack[i], bet:g.bet[i]}; }
    const helper = g.cfg.helper && hand.length === 2 && !g.folded[i] && g.phase !== "over" ? (g.board.length >= 3 ? best(hand.concat(g.board)).name : preflop(hand)) : "";
    const canShow = g.phase === "show" && g.show && g.show.unc === i && !g.shown[i];
    return {seat:i, hand, act, helper, folded:g.folded[i], out:g.out[i], canShow}; };

  return {SYM, SHOW, SING, PLUR, suit, rank, deck, shuffle, score5, cmp, nameOf, best, preflop, BLINDS, blindsFor, sidePots, Game, pub, priv, upIn};
})();
/*@end-rules*/

/* ---------- screens and the link to the phones ---------- */
const HD = {cfg:null, room:null, players:[], phase:"lobby", g:null, relay:null, poll:null, since:0, busy:false, tm:null, paused:false, dl:0, sn:0, snHn:0, rt:null, anim:-1};   // sn: how many board cards the TV (and phones) have been shown so far; they come out one at a time
HD.cfg = Object.assign({chips:1000, up:8, end:"last", fixed:30, timer:30, helper:true, four:false}, store.get("jn_hdCfg", {}));
const hdSave = () => store.set("jn_hdCfg", HD.cfg);
const hdUrl = () => new URL(`c?r=${HD.room}&g=hd`, location.href).href;
const hdRnd = () => { try{ const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }catch(e){ return Math.random(); } };   // the deck is shuffled with the browser's secure random numbers
const hdNum = n => Number(n).toLocaleString("en-US");
const hdOrd = n => { const x = ["th", "st", "nd", "rd"], v = n % 100; return n + (x[(v - 20) % 10] || x[v] || x[0]); };
const hdSuit = s => `<b class="${s === "H" || s === "D" ? "" : "blk"}">${HE.SYM[s]}</b>`;

/* while a street's cards are still being turned over one by one, the table (and the phones) show only the cards revealed so far and nobody is on turn yet */
const hdRevealing = g => g.phase !== "show" && g.phase !== "over" && HD.sn < g.board.length;
const hdPub = g => { const p = HE.pub(g); if(hdRevealing(g)){ p.board = p.board.slice(0, HD.sn); p.turn = -1; } return p; };
function hdPost(){ const g = HD.g; if(!g) return; const priv = {}, rv = hdRevealing(g); g.pids.forEach((p, i) => { priv[p] = HE.priv(g, i); if(rv){ priv[p].act = null; priv[p].helper = ""; } });
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:HD.room, crd:{pub:hdPub(g), priv}})}).catch(() => {}); }
async function hdPoll(){ if($("#hdo").hidden || HD.busy) return; HD.busy = true;
  try{
    if(HD.relay !== RELAY){ HD.relay = RELAY; if(HD.phase === "lobby") hdRender(); }
    if(HD.phase === "lobby"){ if(RELAY !== true) return;
      const j = await (await fetch(`api/players?r=${encodeURIComponent(HD.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
      if(HD.phase === "lobby" && JSON.stringify(ps) !== JSON.stringify(HD.players)){ HD.players = ps; hdRender(); } }
    else if(HD.g && HD.g.phase !== "over" && !HD.paused){
      const j = await (await fetch(`api/crdacts?r=${encodeURIComponent(HD.room)}&since=${HD.since}`, {cache:"no-store"})).json(); HD.since = j.n; let changed = false;
      for(const x of j.acts || []){ const g = HD.g, seat = g.pids.indexOf(x.p); if(seat < 0 || x.v !== g.v) continue; if(g.act(seat, x.a).ok) changed = true; }
      if(changed) hdChanged(); } }
  catch(e){} finally { HD.busy = false; } }

/* ---------- the flow ---------- */
function hdStart(){
  if(HD.players.length < 2 || HD.players.length > 9 || RELAY !== true) return;
  HD.g = HE.Game(Object.assign({}, HD.cfg), HD.players.map(x => x.n), HD.players.map(x => x.p), hdRnd); HD.since = 0; HD.paused = false; clearTimeout(HD.rt); HD.rt = null; HD.sn = 0; HD.snHn = 0; HD.anim = -1; HD.g.start(); HD.phase = "play"; hdChanged(); }
/* what is waiting on a timer: the next street on a run out, the next hand after a showdown, a player's turn running out (or a seat the host sat out) */
function hdChanged(){ const g = HD.g;
  if(g.hn !== HD.snHn){ HD.snHn = g.hn; HD.sn = 0; HD.anim = -1; }
  if(g.phase === "show" || g.phase === "over"){ HD.sn = g.board.length; HD.anim = -1; }
  hdPost(); hdRender(); clearTimeout(HD.tm);
  if(g.phase === "over"){ playWinSiu(); return; }
  if(hdRevealing(g)){ if(!HD.rt) hdReveal(g); return; }   // the timers below start once the last card is face up
  if(HD.paused) return;
  const v = g.v, ph = g.phase, run = (ms, f) => { HD.tm = setTimeout(() => { if(HD.g === g && g.v === v && g.phase === ph && !HD.paused) f(); }, ms); };
  if(ph === "run") run(2000, () => { g.advance(); hdChanged(); });
  else if(ph === "show") run(g.show && g.show.unc != null ? 4500 : 8000, () => { g.advance(); hdChanged(); });
  else if(ph === "hand" && g.turn >= 0){
    if(g.sit[g.turn]) run(700, () => { g.autoAct(g.turn); hdChanged(); });
    else if(g.cfg.timer){ HD.dl = Date.now() + g.cfg.timer * 1000; run(g.cfg.timer * 1000, () => { g.autoAct(g.turn); hdChanged(); }); } } }
function hdReveal(g){ HD.rt = setTimeout(function step(){
  if(HD.g !== g){ HD.rt = null; return; }
  HD.sn++; HD.anim = HD.sn - 1; hdPost(); hdRender();
  if(HD.sn < g.board.length) HD.rt = setTimeout(step, 800);
  else { HD.rt = null; HD.anim = -1; hdChanged(); } }, 500); }
function hdNext(){ const g = HD.g; if(g && g.phase === "show"){ g.advance(); hdChanged(); } }

/* ---------- screens ---------- */
function hdEnter(){ if(S.mode === "holdem") return; S.mode = "holdem"; document.body.classList.add("hdmode"); }
function hdLeave(){ if(S.mode !== "holdem") return; stopSiu(); clearTimeout(HD.tm); clearTimeout(HD.rt); HD.rt = null; HD.sn = 0; HD.snHn = 0; HD.anim = -1; clearInterval(HD.poll); HD.poll = null; HD.g = null; HD.phase = "lobby"; HD.paused = false; S.mode = null; document.body.classList.remove("hdmode"); $("#hdo").hidden = true; }
function hdShow(){ hdEnter(); CK.inject();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#cno","#dco"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  HD.room = newRoom(); HD.players = []; HD.phase = "lobby"; HD.g = null; HD.since = 0; HD.relay = RELAY; HD.paused = false;
  $("#hdo").hidden = false; hdRender(); window.scrollTo(0, 0);
  clearInterval(HD.poll); HD.poll = setInterval(hdPoll, 800); hdPoll(); }
const hdSeg = (key, opts, cur) => `<div class="hdseg">${opts.map(([v, t, tip]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}"${tip ? ` title="${esc(tip)}"` : ""}>${t}</button>`).join("")}</div>`;
const hdOnOff = (key, cur) => hdSeg(key, [[1, "On"], [0, "Off"]], cur ? 1 : 0);
const hdPos = (i, n) => { const a = i * 2 * Math.PI / n; return {x:50 - 41.5 * Math.sin(a), y:50 + 42 * Math.cos(a)}; };   // seat 0 at the bottom, then clockwise (left, top, right)
const hdSaid = (p, s) => { if(!s) return ""; const nm = esc(p.names[s.seat]);
  return s.t === "fold" ? `${nm} folds` : s.t === "check" ? `${nm} checks` : s.t === "call" ? `${nm} calls ${hdNum(s.amt)}` : s.t === "bet" ? `${nm} bets ${hdNum(s.amt)}` : s.t === "raise" ? `${nm} raises to ${hdNum(s.amt)}`
    : s.t === "allin" ? `${nm} is all in` : s.t === "flop" ? "The flop" : s.t === "turn" ? "The turn" : s.t === "river" ? "The river" : ""; };
function hdSeatHtml(i, p){
  const ps = hdPos(i, p.n), out = p.out[i], fold = p.folded[i], dealt = p.dealt[i] && !out, turn = p.phase === "hand" && p.turn === i, won = p.show && p.show.won[i] > 0;
  const up = p.faceUp && p.faceUp[i], glow = p.show && p.show.glow || [], tags = [];
  if(p.dealer === i && p.phase !== "over") tags.push(`<span class="hdd" title="Dealer button">D</span>`);
  if(p.sb === i && p.hn && !out) tags.push(`<span class="tag">SB</span>`); if(p.bb === i && p.hn && !out) tags.push(`<span class="tag">BB</span>`);
  if(p.allin[i] && !out) tags.push(`<span class="tag hot">All in</span>`); if(p.sit[i] && !out) tags.push(`<span class="tag">Sitting out</span>`);
  const cards = dealt ? `<div class="hdhole${fold ? " fold" : ""}">${up ? up.map(c => CK.face(c, glow.includes(c) ? "glow" : "")).join("") : CK.back() + CK.back()}</div>` : ``;
  const nm = `<div class="ckplate${won ? " won" : ""}">${esc(p.names[i])}${tags.join("")}${turn && p.secs ? `<i class="hdt" style="animation-duration:${Math.max(1, (HD.dl - Date.now()) / 1000).toFixed(1)}s"></i>` : ""}</div>`;
  const meta = `<div class="ckmeta">${out ? `Out · ${hdOrd(out)}` : hdNum(p.stacks[i])}${won ? ` <b class="hdwin">+${hdNum(p.show.won[i])}</b>` : ""}</div>`;
  const hn = p.show && p.show.hands[i] && won ? `<div class="hdhand">${esc(p.show.hands[i].name)}</div>` : "";
  const bet = p.bets[i] > 0 && (p.phase === "hand" || p.phase === "run") ? (() => { const bx = ps.x + (50 - ps.x) * .4, by = ps.y + (50 - ps.y) * .4; return `<div class="hdbet" style="left:${bx}%;top:${by}%"><span class="hdch"></span>${hdNum(p.bets[i])}</div>`; })() : "";
  const top = ps.y < 45;
  return `<div class="ckseat hds${turn ? " turn" : ""}${fold || out ? " dim" : ""}${top ? " tp" : ""}" style="left:${ps.x}%;top:${ps.y}%">${hn}${top ? nm + cards : cards + nm}${meta}</div>${bet}`; }
function hdRender(){
  const el = $("#hdBody"), ph = HD.phase, g = HD.g;
  if(ph === "lobby"){ const ps = HD.players, c = HD.cfg, off = RELAY !== true, ok = ps.length >= 2 && ps.length <= 9 && !off;
    el.innerHTML = `<div class="hdhead"><div class="hdbadge">Card game</div><h1>Texas Hold'em</h1><p class="sub">No-limit poker with play chips. Your two cards are on your phone, the table, the pot and whose turn it is are on the TV. Last player with chips wins.</p></div>
      <div class="hdgrid">
      <div class="hdpanel">${off
        ? `<div class="hdeye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Texas Hold'em runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="hdeye">Scan to join</div><div id="hdQr" class="hdqr"></div><p class="note">Each player scans once and types a name. Keep the page open for the whole game.</p>`}</div>
      <div class="hdpanel"><div class="hdeye">Players · ${ps.length} of 2 to 9</div>${ps.length ? `<ol class="hdnames">${ps.map((p, i) => `<li><button data-kick="${i}" title="Remove ${esc(p.n)}">${esc(p.n)}</button></li>`).join("")}</ol>` : `<p class="note">Waiting for players… Texas Hold'em needs at least two.</p>`}
        <p class="note">${ps.length > 9 ? "Tap a name to remove the extra players. " : ""}Seats go clockwise round the table in this order.</p>${ps.length > 1 ? `<button class="hdbtn small" data-act="shuffle">Shuffle seats</button>` : ""}</div>
      <div class="hdpanel"><div class="hdeye">Starting chips</div>${hdSeg("chips", [[500, "500", "Short game"], [1000, "1,000"], [2000, "2,000", "Long game"]], c.chips)}
        <div class="hdeye">Blinds go up every</div>${hdSeg("up", [[5, "5 hands"], [8, "8 hands"], [12, "12 hands"]], c.up)}
        <div class="hdeye">Game ends</div>${hdSeg("end", [["last", "Last stack standing"], ["fixed", "Fixed hands"]], c.end)}${c.end === "fixed" ? hdSeg("fixed", [[20, "20"], [30, "30"], [40, "40"]], c.fixed) : ""}
        <p class="note">${c.end === "fixed" ? "The game stops after the chosen number of hands and the most chips wins." : "Players drop out as they lose their chips. The last one with chips wins."} The host can always tap Final hands for 5 more hands.</p>
        <div class="hdeye">Turn timer</div>${hdSeg("timer", [[20, "20 s"], [30, "30 s"], [45, "45 s"], [0, "Off"]], c.timer)}<p class="note">When it runs out the player checks if they can, otherwise folds.</p>
        <div class="hdeye">Hand helper on phones</div>${hdOnOff("helper", c.helper)}<p class="note">The phone says what you have, like "Pair of Kings".</p>
        <div class="hdeye">Four-colour deck</div>${hdOnOff("four", c.four)}<p class="note">Diamonds blue and clubs green, easier to read on the TV.</p>
        <button class="hdbtn go" id="hdGo" ${ok ? "" : "disabled"}>Start</button></div>
      </div>`;
    const q = $("#hdQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(HD.phase === "lobby" && !$("#hdo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:hdUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const p = hdPub(g);
  if(p.phase === "over"){ const rk = p.ranks, order = [...Array(p.n).keys()].sort((a, b) => rk[a] - rk[b] || p.stacks[b] - p.stacks[a]), win = order.filter(s => rk[s] === 1).map(s => esc(p.names[s]));
    el.innerHTML = `<div class="hdhead"><div class="hdbadge">Game over</div><h1>${win.join(" and ")} ${win.length > 1 ? "win" : "wins"}</h1></div>
      <ol class="hdpod">${order.map(s => `<li class="r${Math.min(rk[s], 4)}"><b>${hdOrd(rk[s])}</b><span>${esc(p.names[s])}</span><em>${hdNum(p.stacks[s])}</em></li>`).join("")}</ol>
      <div class="hdrow"><button class="hdbtn go" data-act="again">Play again</button><button class="hdbtn ghost" data-act="home">Title screen</button></div>`; return; }
  const glow = p.show && p.show.glow || [], slots = [0, 1, 2, 3, 4].map(k => p.board[k] ? CK.face(p.board[k], (glow.includes(p.board[k]) ? "glow " : "") + (k === HD.anim ? "hdnew" : "")).trim() : `<div class="ck slot"></div>`).join("");
  const sorted = [...Array(p.n).keys()].sort((a, b) => (p.out[a] ? 1 : 0) - (p.out[b] ? 1 : 0) || (p.out[a] && p.out[b] ? p.out[a] - p.out[b] : p.stacks[b] - p.stacks[a]));
  const upTxt = p.up <= 1 ? "Blinds up next hand" : `Blinds up in ${p.up} hands`;
  const cap = p.phase === "show" ? (p.show.unc != null ? `${esc(p.names[p.show.unc])} wins ${hdNum(p.show.pots[0].amt)}` : p.show.pots.map(x => `${x.win.map(i => esc(p.names[i])).join(" and ")} ${x.win.length > 1 ? "split" : "wins"} ${hdNum(x.amt)}${x.name ? ` · ${esc(x.name)}` : ""}`).join("<br>")) : hdSaid(p, p.say) || (p.turn >= 0 ? `${esc(p.names[p.turn])} to act` : "");
  const toCall = p.turn >= 0 && p.phase === "hand" ? Math.max(0, p.cur - p.bets[p.turn]) : 0;
  el.innerHTML = `<div class="ckw hd-tv${p.phase === "hand" && p.turn >= 0 ? " hasturn" : ""}" data-look="vegas"${p.cfg.four ? " data-four" : ""}><div class="hd-stage"><div class="ckt"><div class="cktin"><div class="ckfelt"></div>
    ${[...Array(p.n).keys()].map(i => hdSeatHtml(i, p)).join("")}
    <div class="hdmid">${p.phase === "hand" && p.turn >= 0 && !HD.paused ? `<div class="hdturn"><span class="hdarr">▶</span>${esc(p.names[p.turn])}'s turn</div>` : ""}<div class="hdboard">${slots}</div><div class="hdpots"><span class="hdpot"><span class="hdch"></span>Pot ${hdNum(p.pot)}</span>${p.pots.length ? p.pots.map((x, k) => `<span class="hdpot side">${k ? "Side" : "Main"} ${hdNum(x.amt)}</span>`).join("") : ""}</div>
      <div class="hdsay">${cap}${p.phase === "hand" && toCall ? `<br><small>${hdNum(toCall)} to call</small>` : ""}</div></div>
    ${HD.paused ? `<div class="ckmsg">Paused</div>` : ""}
    <div class="ckchip">Hand ${p.hn} · Blinds ${hdNum(p.blinds[0])} / ${hdNum(p.blinds[1])} · ${p.final ? "Final hands" : p.cfg.end === "fixed" ? `Hand ${p.hn} of ${p.cfg.fixed}` : upTxt}</div></div></div></div>
    <div class="ckside"><h3>Chips</h3>${sorted.map(i => `<button class="cksc hdrow2${p.out[i] ? " neg" : ""}${!p.out[i] && p.stacks[i] === Math.max(...p.stacks) ? " lead" : ""}" data-sit="${i}" title="${p.out[i] ? "" : "Tap to sit this player out (they fold or check every hand)"}">${esc(p.names[i])}<b>${p.out[i] ? hdOrd(p.out[i]) : hdNum(p.stacks[i])}</b>${p.sit[i] && !p.out[i] ? `<small>Sitting out · tap to bring back</small>` : ""}</button>`).join("")}
      <div class="hd-tools">${p.phase === "show" ? `<button class="hdbtn go small" data-act="next">Next hand</button>` : ""}<button class="hdbtn ghost small" data-act="pause">${HD.paused ? "Resume" : "Pause"}</button>${p.final ? "" : `<button class="hdbtn ghost small" data-act="final">Final hands</button>`}<button class="hdbtn ghost small" data-act="end">End game</button></div></div></div>`; }
$("#hdo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; HD.cfg[k] = k === "end" ? v : k === "helper" || k === "four" ? v === "1" : +v; hdSave(); hdRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const x = HD.players[+kick.dataset.kick]; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:HD.room, p:x.p})}).catch(() => {});
    HD.players.splice(+kick.dataset.kick, 1); hdRender(); return; }
  const sit = e.target.closest("[data-sit]"); if(sit && HD.g){ const i = +sit.dataset.sit; if(!HD.g.out[i]){ HD.g.sit[i] = !HD.g.sit[i]; HD.g.v++; hdChanged(); } return; }
  if(e.target.closest("#hdGo")){ hdStart(); return; }
  if(e.target.closest("#hdHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "next") hdNext();
  else if(act.dataset.act === "shuffle"){ CK.shuffle(HD.players); hdRender(); }
  else if(act.dataset.act === "again"){ stopSiu(); HD.phase = "lobby"; HD.g = null; hdRender(); hdPoll(); }
  else if(act.dataset.act === "home") showHome();
  else if(act.dataset.act === "pause"){ HD.paused = !HD.paused; if(HD.g) hdChanged(); }
  else if(act.dataset.act === "final"){ const g = HD.g; if(g){ g.makeFinal(); hdChanged(); } }
  else if(act.dataset.act === "end") askConfirm("End the game now?", "This shows the winner screen with the current chips.", "End game", () => { const g = HD.g; if(g){ g.endNow(); hdChanged(); } }); });
$("#modeHold").onclick = hdShow;
