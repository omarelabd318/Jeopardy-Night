/* 6.80 (Omar): Tarneeb, the Egyptian (Masri) partnership card game on phones. Four players sit N/E/S/W, partners opposite (seats 0 and 2 are team 0, seats 1 and 3 are team 1,
   going round the table in play order). Each phone shows its own hand; the TV is the table. The rules live in the "rules" region below, which has no screen code in it, so
   v4work/tools/tarneeb-test.js can load just that region and play thousands of random hands against it.
   Rules (all Omar's answers, 2026-10-14): a call is a number 1 to 7 plus a suit, where 1 means 7 tricks and 7 means all 13. Suits rank spades > hearts > diamonds > clubs, so
   2 spades beats 2 hearts. There is no No trump: the suit in the winning call is the tarneeb. One auction, anticlockwise from the player after the dealer, players may raise, and
   it ends when three players have passed after a call. Any opponent of the current high call may Double at any time, which ends the auction: nobody can call or raise after
   it, and every point in the hand is worth twice as much, for both teams, made or missed (no redouble). Scoring: made = + tricks taken; missed = minus the tricks called
   (call 3 = 9 tricks) and the defenders score what they took; taking all 13 without calling 7 = +16; calling 7 and making it = +26; calling 7 and missing = minus 16.
   First team to 31 (setup: 31, 41 or 61) wins; if both pass it in one hand the higher total wins, level plays on. Anything that was my choice is in NOTES.md under 6.80.
   The Game object in the same region is the referee: it holds every hand and the whole state of a game, and pub() and priv() are the only things that ever leave it (priv is one player's own hand
   and the move they may make, like ER.priv in src/estrules.js). The screens are further down. Built on the card kit (src/cards.js, CK, look "ahwa") and the phone page cards.html (MODES.tn); the relay routes are the generic crd* ones.
   To remove: delete this file, v4work/tools/tarneeb-test.js, the MODES.tn block in cards.html, the 6.80 CSS block and #tno section in head.html, the Tarneeb button, tnLeave() in showHome and 'tarneeb' in MODE_FILES in build.js. */

/*@rules*/
const TNR = (() => {
  const SUITS = ["C", "D", "H", "S"], SHOW = ["S", "H", "C", "D"], SYM = {S:"♠", H:"♥", D:"♦", C:"♣"};   // SUITS lowest to highest (ranking calls); SHOW = order cards appear in a hand (colours alternate)
  const suit = c => c.slice(-1), rank = c => parseInt(c, 10);   // cards are codes like CK's: "14S" = ace of spades, "10H" = ten of hearts
  const callValue = c => (c.n - 1) * 4 + SUITS.indexOf(c.s);   // 1 clubs = 0 ... 7 spades = 27
  const beats = (a, b) => !b || callValue(a) > callValue(b);
  const tricksFor = c => c.n + 6;                              // call number to tricks: 1 = 7 ... 7 = 13
  const team = seat => seat % 2, next = seat => (seat + 1) % 4;   // seats run counter-clockwise from the bottom, the order of play
  const deck = () => { const d = []; for(const s of SUITS) for(let r = 2; r <= 14; r++) d.push(r + s); return d; };
  const shuffle = (a, rnd = Math.random) => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sortHand = h => h.slice().sort((x, y) => SHOW.indexOf(suit(x)) - SHOW.indexOf(suit(y)) || rank(y) - rank(x));
  const deal = rnd => { const d = shuffle(deck(), rnd); return [0, 1, 2, 3].map(i => sortHand(d.slice(i * 13, i * 13 + 13))); };
  const weakHand = h => h.every(c => rank(c) <= 10);   // no card above a 10: may ask for a redeal

  /* ---- the auction: {dealer, turn, high:{seat, call}|null, passed:[seat], doubled, done, result:null|"won"|"redeal", log} ---- */
  const auction = dealer => ({dealer, turn:next(dealer), high:null, passed:[], doubled:false, done:false, result:null, log:[]});
  const advance = a => {   // next player who hasn't passed; the auction ends when it comes back to the high caller, or everybody passed
    let t = a.turn;
    for(let i = 0; i < 4; i++){
      t = next(t);
      if(a.high && t === a.high.seat){ a.done = true; a.result = "won"; return a; }
      if(!a.passed.includes(t)){ a.turn = t; return a; }
    }
    a.done = true; a.result = a.high ? "won" : "redeal"; return a; };
  const canPass = (a, seat, o = {}) => !a.done && a.turn === seat && !(o.mustCall && !a.high && a.passed.length === 3);   // the last player can't throw the hand in when mustCall
  const canCall = (a, seat, c) => !a.done && a.turn === seat && !!c && Number.isInteger(c.n) && c.n >= 1 && c.n <= 7 && SUITS.includes(c.s) && beats(c, a.high && a.high.call);
  const canDouble = (a, seat) => !a.done && !!a.high && !a.doubled && team(seat) !== team(a.high.seat);   // an opponent of the current high call, any time (even after passing); it ends the auction
  const doCall = (a, seat, c) => { if(!canCall(a, seat, c)) return false; a.high = {seat, call:{n:c.n, s:c.s}}; a.log.push({seat, call:a.high.call}); advance(a); return true; };
  const doPass = (a, seat, o) => { if(!canPass(a, seat, o)) return false; a.passed.push(seat); a.log.push({seat, pass:true}); advance(a); return true; };
  const doDouble = (a, seat) => { if(!canDouble(a, seat)) return false; a.doubled = true; a.log.push({seat, dbl:true}); a.done = true; a.result = "won"; return true; };

  /* ---- playing ---- */
  const legal = (hand, trick) => { if(!trick.length) return hand.slice(); const led = suit(trick[0].c), same = hand.filter(c => suit(c) === led); return same.length ? same : hand.slice(); };
  const trickWinner = (trick, trump) => { let best = trick[0];   // trick = [{seat, c}] in play order; returns the winning seat
    for(const t of trick.slice(1)){ const a = t.c, b = best.c; if(suit(a) === suit(b) ? rank(a) > rank(b) : (suit(a) === trump && suit(b) !== trump)) best = t; }
    return best.seat; };

  /* ---- scoring one hand: tricks = [team0, team1] out of 13; returns [team0Points, team1Points] ---- */
  const scoreHand = (caller, call, tricks, doubled, o = {}) => {
    const ct = team(caller), dt = 1 - ct, need = tricksFor(call), got = tricks[ct], pts = [0, 0];
    if(got >= need){
      pts[ct] = call.n === 7 ? 26 : got === 13 ? 16 : got;   // calling 7 and making it = 26; all 13 without calling 7 = 16
      if(o.defenders) pts[dt] = tricks[dt];
    } else { pts[ct] = call.n === 7 ? -16 : -need; pts[dt] = tricks[dt]; }
    return doubled ? pts.map(p => p * 2) : pts; };
  const winner = (scores, target) => { const a = scores[0] >= target, b = scores[1] >= target;   // -1 = nobody yet; 0 or 1 = that team won; 2 = both passed it level, play on
    if(!a && !b) return -1; if(a && b) return scores[0] === scores[1] ? 2 : scores[0] > scores[1] ? 0 : 1; return a ? 0 : 1; };

  /* ---- the game: the referee. cfg = {target, weak, dbl, mustCall, defenders}. act(seat, a) takes {k:"bid",n,s} | {k:"pass"} | {k:"double"} | {k:"weak"} | {k:"play",c} and returns {ok} or {ok:false, err}.
     After "redeal", "trickdone" and "handdone" the screen calls advance() (on a timer or a click). ---- */
  function Game(cfg, names, pids){
    const g = {cfg, names, pids, scores:[0, 0], v:0, phase:"", dealer:Math.floor(Math.random() * 4), hands:[[], [], [], []], hand:1, history:[], trick:[], last:null, won:[0, 0], au:null,
      caller:null, call:null, doubled:false, doubledBy:null, trump:null, turn:0, winner:null, summary:null, weak:null, redealWhy:null, played:0, winTeam:null};
    const bump = () => { g.v++; }, ok = {ok:true}, bad = err => ({ok:false, err});
    g.deal = () => { g.hands = deal(); g.au = auction(g.dealer); g.phase = "auction"; g.trick = []; g.last = null; g.won = [0, 0]; g.caller = null; g.call = null; g.doubled = false; g.doubledBy = null; g.trump = null;
      g.winner = null; g.summary = null; g.weak = null; g.redealWhy = null; g.played = 0; g.turn = g.au.turn; };
    g.start = () => { g.deal(); bump(); };
    const endAuction = () => { const au = g.au;
      if(!au.done){ g.turn = au.turn; bump(); return ok; }
      if(au.result === "redeal"){ g.phase = "redeal"; g.redealWhy = "pass"; bump(); return ok; }
      g.caller = au.high.seat; g.call = au.high.call; g.doubled = au.doubled; g.trump = g.call.s; g.phase = "play"; g.turn = g.caller; bump(); return ok; };
    g.act = (seat, a) => {
      if(!a || !(seat >= 0 && seat < 4)) return bad("move");
      if(g.phase === "auction"){ const au = g.au;
        if(a.k === "double"){ if(!cfg.dbl || !doDouble(au, seat)) return bad("double"); g.doubledBy = seat; return endAuction(); }
        if(a.k === "weak"){ if(!cfg.weak || au.high || !weakHand(g.hands[seat])) return bad("weak"); g.weak = {seat, hand:g.hands[seat].slice()}; g.phase = "redeal"; g.redealWhy = "weak"; bump(); return ok; }
        if(a.k === "bid"){ if(!doCall(au, seat, {n:a.n, s:a.s})) return bad("bid"); return endAuction(); }
        if(a.k === "pass"){ if(!doPass(au, seat, {mustCall:cfg.mustCall})) return bad("pass"); return endAuction(); }
        return bad("kind"); }
      if(g.phase === "play"){
        if(a.k !== "play" || seat !== g.turn || !g.hands[seat].includes(a.c) || !legal(g.hands[seat], g.trick).includes(a.c)) return bad("play");
        g.hands[seat].splice(g.hands[seat].indexOf(a.c), 1); g.trick.push({seat, c:a.c});
        if(g.trick.length === 4){ g.winner = trickWinner(g.trick, g.trump); g.phase = "trickdone"; } else g.turn = next(seat);
        bump(); return ok; }
      return bad("phase"); };
    g.advance = () => {
      if(g.phase === "redeal") g.deal();
      else if(g.phase === "trickdone"){ g.last = {plays:g.trick.slice(), winner:g.winner}; g.won[team(g.winner)]++; g.played++; g.trick = [];
        if(g.played < 13){ g.phase = "play"; g.turn = g.winner; g.winner = null; }
        else { const pts = scoreHand(g.caller, g.call, g.won, g.doubled, {defenders:cfg.defenders}); g.scores = [g.scores[0] + pts[0], g.scores[1] + pts[1]];
          g.summary = {hand:g.hand, dealer:g.dealer, caller:g.caller, call:g.call, doubled:g.doubled, tricks:g.won.slice(), pts, made:g.won[team(g.caller)] >= tricksFor(g.call), totals:g.scores.slice(), win:winner(g.scores, cfg.target)};
          g.history.push(g.summary); g.phase = "handdone"; g.winner = null; } }
      else if(g.phase === "handdone"){ if(g.summary.win === 0 || g.summary.win === 1){ g.winTeam = g.summary.win; g.phase = "over"; } else { g.dealer = next(g.dealer); g.hand++; g.deal(); } }
      else return false;
      bump(); return true; };
    return g; }

  const nm = (g, t) => g.names[t] + " & " + g.names[t + 2];   // team 0 = seats 0 and 2, team 1 = seats 1 and 3
  const pub = g => ({g:"tn", v:g.v, phase:g.phase, names:g.names, teams:[nm(g, 0), nm(g, 1)], scores:g.scores, target:g.cfg.target, dealer:g.dealer, turn:g.turn, hand:g.hand,
    high:g.au && g.au.high ? {seat:g.au.high.seat, n:g.au.high.call.n, s:g.au.high.call.s} : null, passed:g.au ? g.au.passed : [], doubled:g.au ? g.au.doubled : false, doubledBy:g.doubledBy,
    calls:g.au ? [0, 1, 2, 3].map(i => { const l = g.au.log.filter(x => x.seat === i && !x.dbl).pop(); return l ? (l.pass ? {pass:1} : l.call) : null; }) : [],
    caller:g.caller, call:g.call, trump:g.trump, trick:g.trick, winner:g.winner, won:g.won, played:g.played, last:g.last, weak:g.weak, redealWhy:g.redealWhy,
    summary:g.summary, winTeam:g.winTeam, history:g.history.slice(-8), cfg:{dbl:g.cfg.dbl, weak:g.cfg.weak}});
  const priv = (g, i) => { let act = null;
    if(g.phase === "auction"){ const au = g.au; act = {k:"bid", turn:au.turn === i, canPass:canPass(au, i, {mustCall:g.cfg.mustCall}), canDouble:g.cfg.dbl && canDouble(au, i), canWeak:!!(g.cfg.weak && !au.high && weakHand(g.hands[i])), high:au.high ? {n:au.high.call.n, s:au.high.call.s, seat:au.high.seat} : null}; }
    else if(g.phase === "play" && g.turn === i) act = {k:"play", legal:legal(g.hands[i], g.trick)};
    return {seat:i, hand:g.hands[i], act}; };

  return {SUITS, SYM, SHOW, suit, rank, callValue, beats, tricksFor, team, next, deck, shuffle, sortHand, deal, weakHand, auction, canPass, canCall, canDouble, doCall, doPass, doDouble, legal, trickWinner, scoreHand, winner, Game, pub, priv};
})();
/*@end-rules*/

/* ---------- screens and the link to the phones ---------- */
const TN = {cfg:null, room:null, players:[], phase:"lobby", g:null, relay:null, poll:null, since:0, busy:false};
TN.cfg = Object.assign({target:31, weak:true, dbl:true, mustCall:false, defenders:false}, store.get("jn_tnCfg", {}));
const tnSave = () => store.set("jn_tnCfg", TN.cfg);
const tnUrl = () => new URL(`c?r=${TN.room}&g=tn`, location.href).href;
const tnSigned = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
const tnSuit = s => `<b class="${s === "H" || s === "D" ? "" : "blk"}">${TNR.SYM[s]}</b>`;
const tnCall = c => `${c.n} ${tnSuit(c.s)}`;
const tnTeamName = (p, t) => esc(p.teams[t]);
const tnPartnerNames = (ps, t) => ps[t] && ps[t + 2] ? `${esc(ps[t].n)} &amp; ${esc(ps[t + 2].n)}` : "";

function tnPost(){ const g = TN.g; if(!g) return; const priv = {}; g.pids.forEach((p, i) => priv[p] = TNR.priv(g, i));
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:TN.room, crd:{pub:TNR.pub(g), priv}})}).catch(() => {}); }
async function tnPoll(){ if($("#tno").hidden || TN.busy) return; TN.busy = true;
  try{
    if(TN.relay !== RELAY){ TN.relay = RELAY; if(TN.phase === "lobby") tnRender(); }
    if(TN.phase === "lobby"){ if(RELAY !== true) return;
      const j = await (await fetch(`api/players?r=${encodeURIComponent(TN.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
      if(TN.phase === "lobby" && JSON.stringify(ps) !== JSON.stringify(TN.players)){ TN.players = ps; tnRender(); } }
    else if(TN.g && TN.g.phase !== "over"){
      const j = await (await fetch(`api/crdacts?r=${encodeURIComponent(TN.room)}&since=${TN.since}`, {cache:"no-store"})).json(); TN.since = j.n; let changed = false;
      for(const x of j.acts || []){ const g = TN.g, seat = g.pids.indexOf(x.p); if(seat < 0 || x.v !== g.v) continue; if(g.act(seat, x.a).ok){ changed = true; cardSfx(x.a); } }
      if(changed) tnChanged(); } }
  catch(e){} finally { TN.busy = false; } }

/* ---------- the flow ---------- */
function tnStart(){
  if(TN.players.length !== 4 || RELAY !== true) return;
  TN.g = TNR.Game(Object.assign({}, TN.cfg), TN.players.map(x => x.n), TN.players.map(x => x.p)); TN.since = 0; TN.g.start(); TN.phase = "play"; tnChanged(); }
function tnChanged(){ const g = TN.g; tnPost(); tnRender(); cardTableSfx(g);   // 7.77: deal and trick-sweep sounds
  if(g.phase === "over"){ playWinSiu(); return; }
  const wait = {redeal:g.redealWhy === "weak" ? 4200 : 2600, trickdone:1700, handdone:12000}[g.phase];
  if(wait){ const v = g.v, ph = g.phase; setTimeout(() => { if(TN.g === g && g.v === v && g.phase === ph){ g.advance(); tnChanged(); } }, wait); } }
function tnNext(){ const g = TN.g; if(g && g.phase === "handdone"){ g.advance(); tnChanged(); } }

/* ---------- screens ---------- */
function tnEnter(){ if(S.mode === "tarneeb") return; S.mode = "tarneeb"; document.body.classList.add("tnmode"); }
function tnLeave(){ if(S.mode !== "tarneeb") return; stopSiu(); clearInterval(TN.poll); TN.poll = null; TN.g = null; TN.phase = "lobby"; S.mode = null; document.body.classList.remove("tnmode"); $("#tno").hidden = true; }
function tnShow(){ tnEnter(); CK.inject(); try{ Snd.unlock(); }catch(e){}
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  TN.room = newRoom(); TN.players = []; TN.phase = "lobby"; TN.g = null; TN.since = 0; TN.relay = RELAY;
  $("#tno").hidden = false; tnRender(); window.scrollTo(0, 0);
  clearInterval(TN.poll); TN.poll = setInterval(tnPoll, 800); tnPoll(); }
const tnSeg = (key, opts, cur) => `<div class="tnseg">${opts.map(([v, t, tip]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}"${tip ? ` title="${esc(tip)}"` : ""}>${t}</button>`).join("")}</div>`;
const tnOnOff = (key, cur) => tnSeg(key, [[1, "On"], [0, "Off"]], cur ? 1 : 0);
function tnSeatHtml(i, p){ const pos = CK.POS[i], turn = (p.phase === "auction" || p.phase === "play") && p.turn === i && !(p.phase === "auction" && p.high && p.doubled), tags = [];
  if(p.dealer === i && p.phase === "auction") tags.push("Dealer"); if(p.caller === i && p.phase !== "auction" && p.phase !== "redeal") tags.push("Called");
  let meta = "";
  if(p.phase === "auction"){ const c = p.calls[i]; meta = c ? (c.pass ? "Pass" : `${c.n} ${tnSuit(c.s)}`) : (p.turn === i ? "calling…" : ""); }
  else if(p.phase === "play" || p.phase === "trickdone") meta = `Team ${TNR.team(i) + 1}`;
  return `<div class="ckseat ${pos} t${TNR.team(i)}${turn ? " turn" : ""}"><div class="ckplate">${esc(p.names[i])}${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div><div class="ckmeta">${meta}</div></div>`; }
function tnMsg(p){ const nm = i => esc(p.names[i]);
  if(p.phase === "auction"){ const hi = p.high ? `Highest: ${nm(p.high.seat)} · ${tnCall(p.high)} (${TNR.tricksFor(p.high)} tricks)` : "No call yet: 1 means 7 tricks, 7 means all 13";
    return `<div><b>${nm(p.turn)}</b> is calling<br><small>${hi}</small>${p.high && p.cfg.dbl ? `<br><small>The other team can Double</small>` : ""}</div>`; }
  if(p.phase === "redeal"){ if(p.redealWhy === "weak") return `<div><b>${nm(p.weak.seat)}</b> has a weak hand<br><div class="tn-weak">${p.weak.hand.map(c => CK.face(c)).join("")}</div><small>Dealing again…</small></div>`;
    return `<div><b>Everyone passed</b><br><small>Dealing again…</small></div>`; }
  return ""; }
function tnSumHtml(p){ const s = p.summary, ct = TNR.team(s.caller), last = s.win === 0 || s.win === 1;
  return `<div class="ckmsg tn-sum"><div class="tn-sumhead"><b>${esc(p.names[s.caller])}</b> called ${tnCall(s.call)} (${TNR.tricksFor(s.call)} tricks)${s.doubled ? ` · <span class="tn-dbl">DOUBLED ×2</span>` : ""}<br><small>${s.made ? `${esc(p.teams[ct])} made it` : `${esc(p.teams[ct])} missed it`}</small></div>
    <table><thead><tr><th></th><th>Tricks</th><th>Points</th><th>Total</th></tr></thead><tbody>${[0, 1].map(t => `<tr class="${t === ct ? (s.made ? "hit" : "miss") : ""}"><td>${esc(p.teams[t])}</td><td>${s.tricks[t]}</td><td><b>${tnSigned(s.pts[t])}</b></td><td>${s.totals[t]}</td></tr>`).join("")}</tbody></table>
    <button class="tnbtn go" data-act="next">${last ? "See the winner" : "Next hand"}</button></div>`; }
function tnRender(){
  const el = $("#tnBody"), ph = TN.phase, g = TN.g;
  if(ph === "lobby"){ const ps = TN.players, c = TN.cfg, off = RELAY !== true, ok = ps.length === 4 && !off;
    const team = t => ps.length > t && ps[t] ? `<li class="t${t}"><b>Team ${t + 1}</b> ${tnPartnerNames(ps, t) || esc(ps[t].n) + (ps.length > t + 2 ? "" : " &amp; …")}</li>` : `<li class="t${t}"><b>Team ${t + 1}</b> waiting…</li>`;
    el.innerHTML = `<div class="tnhead"><div class="tnbadge">Card game</div><h1>Tarneeb</h1><p class="sub">Two teams of two, partners sit opposite. Call how many tricks your team will take and name the trump suit with the call. Cards are on your phone, the table is on the TV.</p></div>
      <div class="tngrid">
      <div class="tnpanel">${off
        ? `<div class="tneye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Tarneeb runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="tneye">Scan to join</div><div id="tnQr" class="tnqr"></div><p class="note">Each of the four players scans once and types a name. Keep the page open for the whole game.</p>`}</div>
      <div class="tnpanel"><div class="tneye">Players · ${ps.length} of 4</div>${ps.length ? `<ol class="tnnames">${ps.map((p, i) => `<li class="t${i % 2}"><button data-kick="${i}" title="Remove ${esc(p.n)}">${esc(p.n)}</button></li>`).join("")}</ol>` : `<p class="note">Waiting for players… Tarneeb needs exactly four.</p>`}
        <ul class="tnteams">${team(0)}${team(1)}</ul><p class="note">${ps.length > 4 ? "Tap a name to remove the extra players. " : ""}Seats go round the table in this order, so players 1 and 3 are partners and so are 2 and 4.</p>${ps.length > 1 ? `<button class="tnbtn small" data-act="shuffle">Shuffle seats</button>` : ""}</div>
      <div class="tnpanel"><div class="tneye">Play to</div>${tnSeg("target", [[31, "31"], [41, "41"], [61, "61"]], c.target)}
        <div class="tneye">Double</div>${tnOnOff("dbl", c.dbl)}<p class="note">The other team can Double a call at any moment of the auction. It ends the auction and doubles every point, made or missed.</p>
        <div class="tneye">Weak hand redeal</div>${tnOnOff("weak", c.weak)}<p class="note">A player with no card above a 10 can ask for a redeal before the first call. Everyone sees the hand.</p>
        <div class="tneye">Dealer must call</div>${tnOnOff("mustCall", c.mustCall)}<p class="note">If three players pass, the dealer has to call instead of throwing the hand in.</p>
        <div class="tneye">Defenders always score</div>${tnOnOff("defenders", c.defenders)}<p class="note">The team that didn't call also scores its tricks when the call is made.</p>
        <button class="tnbtn go" id="tnGo" ${ok ? "" : "disabled"}>Start</button></div>
      </div>`;
    const q = $("#tnQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(TN.phase === "lobby" && !$("#tno").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:tnUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const p = TNR.pub(g);
  if(p.phase === "over"){ const draw = p.winTeam === 2, w = draw ? 0 : p.winTeam, l = 1 - w;
    el.innerHTML = `<div class="tnhead"><div class="tnbadge">Game over</div><h1>${draw ? "It's a draw" : tnTeamName(p, w) + " win"}</h1></div>
      <ol class="tnpod"><li class="r1 t${w}"><b>${draw ? "=" : "1st"}</b><span>${tnTeamName(p, w)}</span><em>${p.scores[w]}</em></li><li class="${draw ? "r1 " : ""}t${l}"><b>${draw ? "=" : "2nd"}</b><span>${tnTeamName(p, l)}</span><em class="${p.scores[l] < 0 ? "neg" : ""}">${p.scores[l]}</em></li></ol>
      <div class="tnrow"><button class="tnbtn go" data-act="again">Play again</button><button class="tnbtn ghost" data-act="home">Title screen</button></div>`; return; }
  const fl = CK.fly("tn", p.trick.map(t => t.c)), trick = p.trick.map(t => { const f = fl(t.c); return CK.face(t.c, CK.POS[t.seat] + (t.seat === p.winner ? " win" : "") + f[0], f[1]); }).join("");
  const need = p.call ? TNR.tricksFor(p.call) : 0, ct = p.caller != null ? TNR.team(p.caller) : -1;
  const chip = p.call ? `Hand ${p.hand} · Call ${tnCall(p.call)} · ${need} tricks${p.doubled ? ` · <span class="tn-dbl">×2</span>` : ""}` : `Hand ${p.hand} · Bidding${p.high ? ` · High ${tnCall(p.high)}${p.doubled ? " ×2" : ""}` : ""}`;
  const counter = t => { const got = p.won[t]; if(ct < 0 || p.phase === "auction" || p.phase === "redeal") return ""; const goal = t === ct ? need : 14 - need; return `<small>Tricks ${got} / ${goal}${t === ct ? " needed" : " to stop them"}</small>`; };
  el.innerHTML = `<div class="ckw tn-tv" data-look="ahwa"><div class="tn-stage"><div class="ckt"><div class="cktin"><div class="ckfelt"></div>
    ${[0, 1, 2, 3].map(i => tnSeatHtml(i, p)).join("")}
    <div class="cktrick">${trick}</div>
    ${p.phase === "handdone" ? tnSumHtml(p) : tnMsg(p) ? `<div class="ckmsg">${tnMsg(p)}</div>` : ""}
    ${p.doubled && p.phase !== "handdone" ? `<div class="tn-dblbadge">DOUBLED ×2${p.doubledBy != null ? `<small>by ${esc(p.names[p.doubledBy])}</small>` : ""}</div>` : ""}
    ${p.trump && p.phase !== "handdone" ? `<div class="tn-trump" title="Trump suit">${tnSuit(p.trump)}</div>` : ""}
    <div class="ckchip">${chip}</div></div></div></div>
    <div class="ckside"><h3>Score · first to ${p.target}</h3>${[0, 1].map(t => `<div class="cksc t${t}${p.scores[t] < 0 ? " neg" : ""}${p.scores[t] === Math.max(...p.scores) && p.scores[t] > 0 ? " lead" : ""}">${tnTeamName(p, t)}<b>${p.scores[t]}</b>${counter(t)}</div>`).join("")}
      ${p.history.length ? `<h3>Hands</h3><div class="tn-hist">${p.history.slice().reverse().map(h => `<div><span>${h.hand}</span><span>${tnCall(h.call)}${h.doubled ? " ×2" : ""}</span><span class="${h.pts[0] < 0 ? "neg" : ""}">${tnSigned(h.pts[0])}</span><span class="${h.pts[1] < 0 ? "neg" : ""}">${tnSigned(h.pts[1])}</span></div>`).join("")}</div>` : ""}
      <div class="tn-tools"><button class="tnbtn ghost small" data-act="end">End game</button></div></div></div>`; }
$("#tno").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; TN.cfg[k] = k === "target" ? +v : v === "1"; tnSave(); tnRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const x = TN.players[+kick.dataset.kick]; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:TN.room, p:x.p})}).catch(() => {});
    TN.players.splice(+kick.dataset.kick, 1); tnRender(); return; }
  if(e.target.closest("#tnGo")){ tnStart(); return; }
  if(e.target.closest("#tnHome")){ leaveAsk(cfLive(TN), "Tarneeb"); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "next") tnNext();
  else if(act.dataset.act === "shuffle"){ CK.shuffle(TN.players); tnRender(); }
  else if(act.dataset.act === "again"){ stopSiu(); TN.phase = "lobby"; TN.g = null; tnRender(); tnPoll(); }
  else if(act.dataset.act === "home") showHome();
  else if(act.dataset.act === "end") askConfirm("End the game now?", "This shows the winner screen with the current scores.", "End game", () => { const g = TN.g; if(g){ g.winTeam = g.scores[0] === g.scores[1] ? 2 : g.scores[1] > g.scores[0] ? 1 : 0; g.phase = "over"; g.v++; tnChanged(); } }); });
$("#modeTn").onclick = tnShow;
