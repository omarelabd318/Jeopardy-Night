/* 7.4 (Omar): 3-5-8, the three-player trick-taking card game (also called Sergeant Major), on phones. Three players, 16 cards each and a 4-card kitty. Each hand the dealer needs 8 tricks, the player after the
   dealer needs 5 and leads, and the third needs 3 (16 tricks in all). Each phone shows its own hand; the TV is the table. The rules live in the "rules" region below, which has no screen code in it, so
   v4work/tools/threefive-test.js can load just that region and play thousands of random hands against it. Built on the card kit (src/cards.js, CK, look "felt") and the phone page cards.html (MODES.tf);
   the relay routes are the generic crd* ones (see tarneeb.js). Omar's answers, 2026-10-14: Classic Felt, NO instant wins, and the dealer names trump FIRST, then buries 4 cards, then receives the kitty.
   Hand: deal 16 each, swap (from hand 2), the dealer names trump, buries 4 of their 16, takes the kitty, then the player after the dealer leads. Swap: players who took more tricks than their target last hand
   give worst cards to players who fell short (one card per trick of difference, capped by the 3-card setting); each receiver's highest card of the same suit comes back automatically, or the same card if they have nothing
   higher (Aces high). Score per hand = tricks taken minus target, so the three scores always add up to zero. A game is a number of full turns of the targets (3 players: 3, 6 or 9 hands; 4 players: 4, 8 or 12), or
   Race to 0 (7.19, Omar): everyone starts on 10 or 15 points, tricks over target take points off, tricks short add them, first to 0 wins, always 3 players (stored as len "t" and cfg.goal; points left = goal - score). A tie after the last hand gets one extra hand, and if it is still tied the leaders share the win. With 4 players the player the button points at sits out each hand (the next three take 5, 3, and the
   last of them is the dealer with 8), so the swap only happens between players who played both hands. Anything that was my choice is in NOTES.md under 7.4.
   The Game object in the rules region is the referee: it holds every hand and the whole state of a game, and pub() and priv() are the only things that ever leave it (priv is one player's own hand and the move
   they may make, like TNR.priv in src/tarneeb.js). The screens are further down.
   To remove: delete this file, v4work/tools/threefive-test.js and threefive-e2e.js, the MODES.tf block in cards.html, the ups option in CK.hand (src/cards.js), the 7.4 CSS block and #tfo section in head.html,
   the 3-5-8 button, tfLeave() in showHome, modeTf in src/title.js and 'threefive' in MODE_FILES in build.js. */

/*@rules*/
const TFR = (() => {
  const SUITS = ["S", "H", "C", "D"], SYM = {S:"♠", H:"♥", D:"♦", C:"♣", N:"NT"};
  const suit = c => c.slice(-1), rank = c => parseInt(c, 10);   // cards are codes like CK's: "14S" = ace of spades, "10H" = ten of hearts
  const TARGETS = {"853":[5, 3, 8], "952":[5, 2, 9]};          // [eldest, middle, dealer]
  const deck = () => { const d = []; for(const s of SUITS) for(let r = 2; r <= 14; r++) d.push(r + s); return d; };
  const shuffle = (a, rnd = Math.random) => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const sortHand = h => h.slice().sort((x, y) => SUITS.indexOf(suit(x)) - SUITS.indexOf(suit(y)) || rank(y) - rank(x));
  /* seats 0..n-1 go round the table in the order of play; b = the button. 3 players: b deals. 4 players: b sits out and the last of the other three deals. */
  const roles = (n, b) => n === 3 ? {eldest:(b + 1) % 3, middle:(b + 2) % 3, dealer:b, rest:-1} : {eldest:(b + 1) % 4, middle:(b + 2) % 4, dealer:(b + 3) % 4, rest:b};
  const targetsFor = (key, r) => { const t = TARGETS[key] || TARGETS["853"], o = {}; o[r.eldest] = t[0]; o[r.middle] = t[1]; o[r.dealer] = t[2]; return o; };
  const legal = (hand, trick) => { if(!trick.length) return hand.slice(); const led = suit(trick[0].c), same = hand.filter(c => suit(c) === led); return same.length ? same : hand.slice(); };
  const trickWinner = (trick, trump) => { let best = trick[0];   // trick = [{seat, c}] in play order; trump = a suit letter or null (no trump); returns the winning seat
    for(const t of trick.slice(1)){ const a = t.c, b = best.c; if(suit(a) === suit(b) ? rank(a) > rank(b) : (trump && suit(a) === trump && suit(b) !== trump)) best = t; }
    return best.seat; };
  /* who gives cards to whom after a hand. prev = {d:{seat:tricks - target}, t:{seat:target}}; active = the seats playing the new hand; max = 0 for no limit or the most cards in one swap.
     Players who were up give to players who were down; the one with the higher target goes first. Returns [{from, to, n}]. */
  const swapPlan = (prev, active, max) => {
    const ok = s => active.includes(s), seats = Object.keys(prev.d).map(Number).filter(ok);
    const ups = seats.filter(s => prev.d[s] > 0).sort((a, b) => prev.t[b] - prev.t[a] || a - b), downs = seats.filter(s => prev.d[s] < 0).sort((a, b) => prev.d[a] - prev.d[b] || a - b);
    const need = {}; downs.forEach(s => { need[s] = -prev.d[s]; });
    const out = [];
    for(const u of ups){ let left = prev.d[u];
      for(const dn of downs){ if(left <= 0) break; const n = Math.min(left, need[dn]); if(n > 0){ out.push({from:u, to:dn, n:max ? Math.min(n, max) : n}); left -= n; need[dn] -= n; } } }
    return out; };
  /* the giver hands over cs; for each card the receiver sends back their highest card of that suit if it is higher, otherwise the same card. Returns both new hands and the cards that came back, in order. */
  const exchange = (gh, rh, cs) => { const back = []; gh = gh.filter(c => !cs.includes(c)); rh = rh.slice();
    for(const c of cs){ rh.push(c); let best = null;
      for(const x of rh) if(x !== c && suit(x) === suit(c) && rank(x) > rank(c) && (!best || rank(x) > rank(best))) best = x;
      const r = best || c; rh.splice(rh.indexOf(r), 1); back.push(r); }
    return {giver:sortHand(gh.concat(back)), receiver:sortHand(rh), back}; };

  /* ---- the game: the referee. cfg = {targets:"853"|"952", nt, swapMax, len:1|2|3|"t"}. act(seat, a) takes {k:"give",cs} | {k:"trump",s} | {k:"bury",cs} | {k:"play",c} and returns {ok} or {ok:false, err}.
     After "trickdone" and "handdone" the screen calls advance() (on a timer or a click). ---- */
  function Game(cfg, names, pids){
    const n = names.length;
    const g = {cfg, names, pids, n, v:0, phase:"", button:Math.floor(Math.random() * n), hand:0, roles:null, tgt:{}, hands:[], kitty:[], kittyTaken:null, trump:null, turn:0, trick:[], won:[], played:0, winner:null, last:null,
      scores:Array(n).fill(0), history:[], prev:null, swap:null, swapLog:{}, swapDone:[], summary:null, winners:[], tieHand:false, total:cfg.len === "t" ? 0 : cfg.len * n};
    const nextActive = (g, seat) => { let s = (seat + 1) % n; while(s === g.roles.rest) s = (s + 1) % n; return s; };
    const bump = () => { g.v++; }, ok = {ok:true}, bad = err => ({ok:false, err});
    g.deal = () => { const d = shuffle(deck()); g.hand++; g.roles = roles(n, g.button); g.tgt = targetsFor(cfg.targets, g.roles);
      g.hands = Array.from({length:n}, () => []); [g.roles.eldest, g.roles.middle, g.roles.dealer].forEach((s, k) => { g.hands[s] = sortHand(d.slice(k * 16, k * 16 + 16)); });
      g.kitty = d.slice(48, 52); g.kittyTaken = null; g.trump = null; g.trick = []; g.won = Array(n).fill(0); g.played = 0; g.winner = null; g.last = null; g.summary = null; g.swapLog = {}; g.swapDone = []; g.swap = null;
      const list = g.prev ? swapPlan(g.prev, [g.roles.eldest, g.roles.middle, g.roles.dealer], cfg.swapMax) : [];
      if(list.length){ g.swap = {list, i:0}; g.phase = "swap"; g.turn = list[0].from; } else { g.phase = "trump"; g.turn = g.roles.dealer; } };
    g.start = () => { g.deal(); bump(); };
    const isOver = () => { const top = Math.max(...g.scores), leaders = g.scores.map((s, i) => s === top ? i : -1).filter(i => i >= 0);
      if(cfg.len === "t"){ if(top >= (cfg.goal || 10) && leaders.length === 1){ g.winners = leaders; return true; } return false; }
      if(g.hand < g.total) return false;
      if(leaders.length === 1 || g.tieHand){ g.winners = leaders; return true; }   // level after the extra hand: the leaders share the win
      g.tieHand = true; g.total++; return false; };
    g.act = (seat, a) => {
      if(!a || !(seat >= 0 && seat < n) || seat !== g.turn) return bad("turn");
      const mine = g.hands[seat];
      if(g.phase === "swap"){ const st = g.swap.list[g.swap.i];
        if(a.k !== "give" || !Array.isArray(a.cs) || a.cs.length !== st.n || new Set(a.cs).size !== st.n || !a.cs.every(c => mine.includes(c))) return bad("give");
        const r = exchange(mine, g.hands[st.to], a.cs); g.hands[seat] = r.giver; g.hands[st.to] = r.receiver;
        (g.swapLog[seat] = g.swapLog[seat] || []).push(...a.cs.map((c, i) => ({gave:c, got:r.back[i]}))); (g.swapLog[st.to] = g.swapLog[st.to] || []).push(...a.cs.map((c, i) => ({recv:c, sent:r.back[i]})));
        g.swapDone.push({from:seat, to:st.to, n:st.n}); g.swap.i++;
        if(g.swap.i < g.swap.list.length) g.turn = g.swap.list[g.swap.i].from; else { g.swap = null; g.phase = "trump"; g.turn = g.roles.dealer; }
        bump(); return ok; }
      if(g.phase === "trump"){ if(a.k !== "trump" || !(SUITS.includes(a.s) || (a.s === "N" && cfg.nt))) return bad("trump");
        g.trump = a.s === "N" ? "N" : a.s; g.phase = "bury"; bump(); return ok; }
      if(g.phase === "bury"){ if(a.k !== "bury" || !Array.isArray(a.cs) || a.cs.length !== 4 || new Set(a.cs).size !== 4 || !a.cs.every(c => mine.includes(c))) return bad("bury");
        g.hands[seat] = sortHand(mine.filter(c => !a.cs.includes(c)).concat(g.kitty)); g.kittyTaken = g.kitty.slice(); g.phase = "play"; g.turn = g.roles.eldest; bump(); return ok; }
      if(g.phase === "play"){
        if(a.k !== "play" || !mine.includes(a.c) || !legal(mine, g.trick).includes(a.c)) return bad("play");
        mine.splice(mine.indexOf(a.c), 1); g.trick.push({seat, c:a.c});
        if(g.trick.length === 3){ g.winner = trickWinner(g.trick, g.trump === "N" ? null : g.trump); g.phase = "trickdone"; }
        else g.turn = nextActive(g, seat);
        bump(); return ok; }
      return bad("phase"); };
    g.advance = () => {
      if(g.phase === "trickdone"){ g.last = {plays:g.trick.slice(), winner:g.winner}; g.won[g.winner]++; g.played++; g.trick = [];
        if(g.played < 16){ g.phase = "play"; g.turn = g.winner; g.winner = null; }
        else { const act = [g.roles.eldest, g.roles.middle, g.roles.dealer], d = {}, t = {}, rows = [];
          act.forEach(s => { d[s] = g.won[s] - g.tgt[s]; t[s] = g.tgt[s]; g.scores[s] += d[s]; });
          act.forEach(s => rows.push({seat:s, target:g.tgt[s], tricks:g.won[s], d:d[s], role:s === g.roles.dealer ? "dealer" : s === g.roles.eldest ? "eldest" : "middle"}));
          g.summary = {hand:g.hand, rows, totals:g.scores.slice(), trump:g.trump, dealer:g.roles.dealer, rest:g.roles.rest, tie:g.tieHand}; g.history.push(g.summary); g.prev = {d, t}; g.phase = "handdone"; g.winner = null; } }
      else if(g.phase === "handdone"){ if(isOver()) g.phase = "over"; else { g.button = (g.button + 1) % n; g.deal(); } }
      else return false;
      bump(); return true; };
    return g; }

  const pub = g => ({g:"tf", v:g.v, phase:g.phase, names:g.names, n:g.n, hand:g.hand, total:g.total, len:g.cfg.len, goal:g.cfg.goal || 10, roles:g.roles, tgt:Array.from({length:g.n}, (_, i) => i in g.tgt ? g.tgt[i] : -1), won:g.won,
    trump:g.trump, turn:g.turn, trick:g.trick, winner:g.winner, played:g.played, last:g.last, scores:g.scores, swap:g.swap ? g.swap.list[g.swap.i] : null, swapDone:g.swapDone, swapN:g.swap ? g.swap.list.length : 0,
    summary:g.summary, history:g.history.slice(-8), winners:g.winners, tie:g.tieHand, cfg:{nt:g.cfg.nt, targets:g.cfg.targets}});
  const priv = (g, i) => { let act = null;
    if(g.turn === i){
      if(g.phase === "swap") act = {k:"give", n:g.swap.list[g.swap.i].n, to:g.swap.list[g.swap.i].to};
      else if(g.phase === "trump") act = {k:"trump", nt:!!g.cfg.nt};
      else if(g.phase === "bury") act = {k:"bury", n:4};
      else if(g.phase === "play") act = {k:"play", legal:legal(g.hands[i], g.trick)}; }
    return {seat:i, hand:g.hands[i] || [], act, swaps:g.swapLog[i] || [], kitty:i === g.roles.dealer && g.kittyTaken && g.played === 0 ? g.kittyTaken : null}; };

  return {SUITS, SYM, TARGETS, suit, rank, deck, shuffle, sortHand, roles, targetsFor, legal, trickWinner, swapPlan, exchange, Game, pub, priv};
})();
/*@end-rules*/

/* ---------- screens and the link to the phones ---------- */
const TF = {cfg:null, room:null, players:[], phase:"lobby", g:null, relay:null, poll:null, since:0, busy:false};
TF.cfg = Object.assign({targets:"853", nt:false, swapMax:0, len:"t", goal:10}, store.get("jn_tfCfg", {}));
const tfSave = () => store.set("jn_tfCfg", TF.cfg);
const tfUrl = () => new URL(`c?r=${TF.room}&g=tf`, location.href).href;
const tfSigned = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
const tfSuit = s => s === "N" ? `<b class="blk">NT</b>` : `<b class="${s === "H" || s === "D" ? "" : "blk"}">${TFR.SYM[s]}</b>`;
const tfPos = (i, n) => n === 3 ? ["s", "e", "w"][i] : CK.POS[i];   // 3 players sit bottom, upper right, upper left
const tfRole = (p, i) => i === p.roles.dealer ? "Dealer" : i === p.roles.rest ? "Resting" : "";
const tfOrd = n => { const x = ["th", "st", "nd", "rd"], v = n % 100; return n + (x[(v - 20) % 10] || x[v] || x[0]); };
const tfHands = (len, n) => len === "t" ? "race to 0" : `${len * n} hands`;
/* 7.19 (Omar): "Race to 0": everyone starts on 10 or 15 and each hand takes off the tricks over your target (and adds the tricks short of it); first to 0 wins. It is the old first-to-+N race with the score shown as points left: left = goal - score. */
const tfRace = p => p.len === "t", tfLeft = (p, v) => Math.max(0, p.goal - v), tfTot = (p, v) => tfRace(p) ? tfLeft(p, v) : v, tfHandD = (p, d) => tfSigned(tfRace(p) ? -d : d);

function tfPost(){ const g = TF.g; if(!g) return; const priv = {}; g.pids.forEach((p, i) => priv[p] = TFR.priv(g, i));
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:TF.room, crd:{pub:TFR.pub(g), priv}})}).catch(() => {}); }
async function tfPoll(){ if($("#tfo").hidden || TF.busy) return; TF.busy = true;
  try{
    if(TF.relay !== RELAY){ TF.relay = RELAY; if(TF.phase === "lobby") tfRender(); }
    if(TF.phase === "lobby"){ if(RELAY !== true) return;
      const j = await (await fetch(`api/players?r=${encodeURIComponent(TF.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
      if(TF.phase === "lobby" && JSON.stringify(ps) !== JSON.stringify(TF.players)){ TF.players = ps; tfRender(); } }
    else if(TF.g && TF.g.phase !== "over"){
      const j = await (await fetch(`api/crdacts?r=${encodeURIComponent(TF.room)}&since=${TF.since}`, {cache:"no-store"})).json(); TF.since = j.n; let changed = false;
      for(const x of j.acts || []){ const g = TF.g, seat = g.pids.indexOf(x.p); if(seat < 0 || x.v !== g.v) continue; if(g.act(seat, x.a).ok){ changed = true; cardSfx(x.a); } }
      if(changed) tfChanged(); } }
  catch(e){} finally { TF.busy = false; } }

/* ---------- the flow ---------- */
function tfStart(){
  const k = TF.players.length; if((k !== 3 && k !== 4) || (k === 4 && TF.cfg.len === "t") || RELAY !== true) return;
  TF.g = TFR.Game(Object.assign({}, TF.cfg), TF.players.map(x => x.n), TF.players.map(x => x.p)); TF.since = 0; TF.g.start(); TF.phase = "play"; tfChanged(); }
function tfChanged(){ const g = TF.g; tfPost(); tfRender(); cardTableSfx(g);   // 7.77: deal and trick-sweep sounds
  if(g.phase === "over"){ playWinSiu(); return; }
  const wait = {trickdone:1700, handdone:14000}[g.phase];
  if(wait){ const v = g.v, ph = g.phase; setTimeout(() => { if(TF.g === g && g.v === v && g.phase === ph){ g.advance(); tfChanged(); } }, wait); } }
function tfNext(){ const g = TF.g; if(g && g.phase === "handdone"){ g.advance(); tfChanged(); } }

/* ---------- screens ---------- */
function tfEnter(){ if(S.mode === "threefive") return; S.mode = "threefive"; document.body.classList.add("tfmode"); }
function tfLeave(){ if(S.mode !== "threefive") return; stopSiu(); clearInterval(TF.poll); TF.poll = null; TF.g = null; TF.phase = "lobby"; S.mode = null; document.body.classList.remove("tfmode"); $("#tfo").hidden = true; }
function tfShow(){ tfEnter(); CK.inject(); try{ Snd.unlock(); }catch(e){}
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#hdo"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  TF.room = newRoom(); TF.players = []; TF.phase = "lobby"; TF.g = null; TF.since = 0; TF.relay = RELAY;
  $("#tfo").hidden = false; tfRender(); window.scrollTo(0, 0);
  clearInterval(TF.poll); TF.poll = setInterval(tfPoll, 800); tfPoll(); }
const tfSeg = (key, opts, cur) => `<div class="tfseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const tfOnOff = (key, cur) => tfSeg(key, [[1, "On"], [0, "Off"]], cur ? 1 : 0);
function tfSeatHtml(i, p){ const pos = tfPos(i, p.n), turn = p.turn === i && ["swap", "trump", "bury", "play"].includes(p.phase), tag = tfRole(p, i);
  let meta = "";
  if(i === p.roles.rest) meta = "sitting out";
  else if(p.phase === "swap" && p.swap) meta = p.swap.from === i ? `giving ${p.swap.n} to ${esc(p.names[p.swap.to])}` : p.swap.to === i ? "receiving" : "";
  else if(p.phase === "trump") meta = i === p.roles.dealer ? "choosing trump…" : `needs ${p.tgt[i]}`;
  else if(p.phase === "bury") meta = i === p.roles.dealer ? "burying 4…" : `needs ${p.tgt[i]}`;
  else if(p.tgt[i] >= 0){ const got = p.won[i], t = p.tgt[i]; meta = `needs ${t} · won ${got}${got >= t ? (got > t ? ` (+${got - t})` : " ✓") : ""}`; }
  return `<div class="ckseat ${pos}${turn ? " turn" : ""}"><div class="ckplate">${esc(p.names[i])}${tag ? `<span class="tag">${tag}</span>` : ""}</div><div class="ckmeta">${meta}</div></div>`; }
function tfMsg(p){ const nm = i => esc(p.names[i]);
  if(p.phase === "swap" && p.swap){ const s = p.swap; return `<div><b>${nm(s.from)}</b> gives <b>${nm(s.to)}</b> ${s.n} card${s.n > 1 ? "s" : ""}<br><small>${nm(s.to)}'s highest card of each suit goes back</small></div>`; }
  if(p.phase === "trump") return `<div><b>${nm(p.roles.dealer)}</b> is choosing trump<br><small>The dealer needs ${p.tgt[p.roles.dealer]} tricks</small></div>`;
  if(p.phase === "bury") return `<div><b>${nm(p.roles.dealer)}</b> chose ${tfSuit(p.trump)} and is burying 4 cards<br><small>Then the kitty is theirs</small></div>`;
  return ""; }
function tfSumHtml(p){ const s = p.summary, last = p.hand >= p.total && p.total > 0 || (p.len === "t" && Math.max(...s.totals) >= p.goal);
  return `<div class="ckmsg tf-sum"><div class="tf-sumhead">Hand ${s.hand}${p.total ? ` of ${p.total}` : ""}${s.tie ? " · tiebreak" : ""} · trump ${s.trump ? tfSuit(s.trump) : "none"}</div>
    <table><thead><tr><th></th><th>Needed</th><th>Tricks</th><th>Hand</th><th>${p.len === "t" ? "Left" : "Total"}</th></tr></thead><tbody>${s.rows.map(r => `<tr class="${r.d > 0 ? "hit" : r.d < 0 ? "miss" : ""}"><td>${esc(p.names[r.seat])}<small>${r.role}</small></td><td>${r.target}</td><td>${r.tricks}</td><td><b>${tfHandD(p, r.d)}</b></td><td>${tfTot(p, s.totals[r.seat])}</td></tr>`).join("")}${s.rest >= 0 ? `<tr><td>${esc(p.names[s.rest])}<small>resting</small></td><td>–</td><td>–</td><td>0</td><td>${tfTot(p, s.totals[s.rest])}</td></tr>` : ""}</tbody></table>
    <button class="tfbtn go" data-act="next">${last ? "See the result" : "Next hand"}</button></div>`; }
function tfRender(){
  const el = $("#tfBody"), ph = TF.phase, g = TF.g;
  if(ph === "lobby"){ const ps = TF.players, c = TF.cfg, off = RELAY !== true, ok = (ps.length === 3 || (ps.length === 4 && c.len !== "t")) && !off, n = Math.max(3, Math.min(4, ps.length));
    el.innerHTML = `<div class="tfhead"><div class="tfbadge">Card game</div><h1>3-5-8</h1><p class="sub">Three players, 16 tricks. The dealer needs 8, the next player 5, the last 3, and the targets move round the table every hand. Swap cards after each hand, name trump, bury 4, take the kitty. Cards are on your phone, the table is on the TV.</p></div>
      <div class="tfgrid">
      <div class="tfpanel">${off
        ? `<div class="tfeye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "3-5-8 runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="tfeye">Scan to join</div><div id="tfQr" class="tfqr"></div><p class="note">Each player scans once and types a name. Keep the page open for the whole game.</p>`}</div>
      <div class="tfpanel"><div class="tfeye">Players · ${ps.length}</div>${ps.length ? `<ol class="tfnames">${ps.map((p, i) => `<li><button data-kick="${i}" title="Remove ${esc(p.n)}">${esc(p.n)}</button></li>`).join("")}</ol>` : `<p class="note">Waiting for players… 3-5-8 needs three. A fourth sits out each hand in turn.</p>`}
        <p class="note">${ps.length > 4 ? "Tap a name to remove the extra players. " : ""}${ps.length === 4 ? "With four players, one sits out each hand and the deal passes round. " : ""}Seats go round the table in this order.</p>${ps.length > 1 ? `<button class="tfbtn small" data-act="shuffle">Shuffle seats</button>` : ""}</div>
      <div class="tfpanel"><div class="tfeye">Targets</div>${tfSeg("targets", [["853", "8 · 5 · 3"], ["952", "9 · 5 · 2"]], c.targets)}<p class="note">What the dealer, the next player and the last player need.</p>
        <div class="tfeye">Game length</div>${tfSeg("len", [[1, tfHands(1, n)], [2, tfHands(2, n)], [3, tfHands(3, n)], ["t", "Race to 0"]], c.len)}<p class="note">${c.len === "t" ? "Everyone starts on the same number. Each trick over your target takes one off, each trick short adds one. First to 0 wins, always with three players." : "Score each hand is tricks minus target. The top total wins."}</p>
        ${c.len === "t" ? `<div class="tfeye">Start at</div>${tfSeg("goal", [[10, "10"], [15, "15"]], c.goal)}<p class="note">Points each player has to get rid of.</p>` : ""}
        <div class="tfeye">No trump</div>${tfOnOff("nt", c.nt)}<p class="note">The dealer may play the hand with no trump suit.</p>
        <div class="tfeye">Swap limit</div>${tfSeg("swapMax", [[0, "No limit"], [3, "3 cards"]], c.swapMax)}<p class="note">The most cards one swap can move.</p>
        <button class="tfbtn go" id="tfGo" ${ok ? "" : "disabled"}>Start</button></div>
      </div>`;
    const q = $("#tfQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(TF.phase === "lobby" && !$("#tfo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:tfUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const p = TFR.pub(g);
  if(p.phase === "over"){ const order = p.names.map((_, i) => i).sort((a, b) => p.scores[b] - p.scores[a]), rk = i => 1 + p.scores.filter(x => x > p.scores[i]).length;
    el.innerHTML = `<div class="tfhead"><div class="tfbadge">Game over</div><h1>${p.winners.length > 1 ? p.winners.map(i => esc(p.names[i])).join(" and ") + " share it" : esc(p.names[p.winners[0]]) + " wins"}</h1></div>
      <ol class="tfpod">${order.map(i => `<li class="${rk(i) === 1 ? "r1" : ""}"><b>${tfOrd(rk(i))}</b><span>${esc(p.names[i])}</span><em class="${p.scores[i] < 0 && p.len !== "t" ? "neg" : ""}">${p.len === "t" ? tfLeft(p, p.scores[i]) : tfSigned(p.scores[i])}</em></li>`).join("")}</ol>
      <div class="tfrow"><button class="tfbtn go" data-act="again">Play again</button><button class="tfbtn ghost" data-act="home">Title screen</button></div>`; return; }
  const fl = CK.fly("tf", p.trick.map(t => t.c)), trick = p.trick.map(t => { const f = fl(t.c); return CK.face(t.c, tfPos(t.seat, p.n) + (t.seat === p.winner ? " win" : "") + f[0], f[1]); }).join("");
  const chip = `Hand ${p.hand}${p.total ? ` of ${p.total}` : ""}${p.tie ? " · Tiebreak" : ""} · ${p.len === "t" ? "Race to 0" : "Most points wins"}`;
  el.innerHTML = `<div class="ckw tf-tv" data-look="felt"><div class="tf-stage"><div class="ckt"><div class="cktin tf${p.n}"><div class="ckfelt"></div>
    ${p.names.map((_, i) => tfSeatHtml(i, p)).join("")}
    <div class="cktrick">${trick}</div>
    ${p.phase === "handdone" ? tfSumHtml(p) : tfMsg(p) ? `<div class="ckmsg">${tfMsg(p)}</div>` : ""}
    ${p.trump && p.phase !== "handdone" && p.phase !== "bury" ? `<div class="tf-trump" title="Trump suit">${tfSuit(p.trump)}</div>` : ""}
    <div class="ckchip">${chip}</div></div></div></div>
    <div class="ckside"><h3>${p.len === "t" ? "Points left · first to 0" : "Score"}</h3>${p.names.map((_, i) => `<div class="cksc${p.scores[i] < 0 ? " neg" : ""}${p.scores[i] === Math.max(...p.scores) && p.scores[i] > 0 ? " lead" : ""}">${esc(p.names[i])}<b>${p.len === "t" ? tfLeft(p, p.scores[i]) : tfSigned(p.scores[i])}</b>${p.tgt[i] >= 0 && ["trump", "bury", "play", "trickdone", "swap"].includes(p.phase) ? `<small>${tfRole(p, i) ? tfRole(p, i) + " · " : ""}needs ${p.tgt[i]}${["play", "trickdone"].includes(p.phase) ? " · has " + p.won[i] : ""}</small>` : i === p.roles.rest ? `<small>Resting</small>` : ""}</div>`).join("")}
      ${p.history.length ? `<h3>Hands</h3><div class="tf-hist" style="--cols:${p.n}">${p.history.slice().reverse().map(h => `<div><span>${h.hand}</span>${p.names.map((_, i) => { const r = h.rows.find(x => x.seat === i); return `<span class="${r && r.d < 0 ? "neg" : ""}">${r ? tfHandD(p, r.d) : "–"}</span>`; }).join("")}</div>`).join("")}</div>` : ""}
      <div class="tf-tools"><button class="tfbtn ghost small" data-act="end">End game</button></div></div></div>`; }
$("#tfo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; TF.cfg[k] = k === "targets" ? v : k === "len" ? (v === "t" ? "t" : +v) : k === "swapMax" || k === "goal" ? +v : v === "1"; tfSave(); tfRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const x = TF.players[+kick.dataset.kick]; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:TF.room, p:x.p})}).catch(() => {});
    TF.players.splice(+kick.dataset.kick, 1); tfRender(); return; }
  if(e.target.closest("#tfGo")){ tfStart(); return; }
  if(e.target.closest("#tfHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "next") tfNext();
  else if(act.dataset.act === "shuffle"){ CK.shuffle(TF.players); tfRender(); }
  else if(act.dataset.act === "again"){ stopSiu(); TF.phase = "lobby"; TF.g = null; tfRender(); tfPoll(); }
  else if(act.dataset.act === "home") showHome();
  else if(act.dataset.act === "end") askConfirm("End the game now?", "This shows the result with the current scores.", "End game", () => { const g = TF.g; if(g){ const top = Math.max(...g.scores); g.winners = g.scores.map((s, i) => s === top ? i : -1).filter(i => i >= 0); g.phase = "over"; g.v++; tfChanged(); } }); });
$("#modeTf").onclick = tfShow;
