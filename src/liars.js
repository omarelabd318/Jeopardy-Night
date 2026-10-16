/* 7.1 (Omar): Liar's Bar, a bluffing card game mode, after the card table in the video game Liar's Bar. 3 to 8 players join from their phone (liars.html at /l?r=ROOM, one name, no teams).
   Each round the TV calls a table card (Kings, Queens or Aces) and deals every player 5 cards, which only their own phone shows. On your turn you play 1 to 3 cards face down and they count as the table
   card; Jokers are wild and always count. The next player either plays on or calls Liar! on the last play (only the next player can call; nobody can call the first play of a round). The TV flips the
   cards: if any is not the table card (and not a Joker) the player who played them was lying, otherwise the caller was wrong. The loser spins their own cylinder, 6 chambers with 1 bust placed in secret
   and never re-spun, so the odds go 1 in 6, 1 in 5 and so on (a PG roulette: a safe click, or a BUSTED stamp and you are out). Last player left wins and the winner screen plays the Siuuu clip.
   A player whose hand is empty is safe for the rest of the round and is skipped; when every other player is empty-handed the one with cards can only call Liar!, so a round always ends in a challenge.
   A turn is 30 seconds by default (setup: Off, 20, 30 or 60); when it runs out the game plays one random card for you (or calls Liar! when that is the only move).
   Deck: Kings, Queens and Aces of a count that grows with the table plus Jokers (LBR.MIX): 4 players = 6 of each rank and 2 Jokers, like the video game. Deck size is fixed for the game; busted players' cards go back.
   Saloon look (his pick of three previews: Saloon, Neon Dive, Ahwa): green felt, brass rim, Rye lettering, red card backs; a BUSTED stamp with a small confetti burst. Only this look is built.
   Rules and the whole state of a game live in LBR below (no screen code in it, so v4work/tools/liars-test.js can load just that region). The laptop is the referee: it posts pub (what every phone may see)
   and priv (each player's own hand) with POST /api/crd and reads the phones' moves from GET /api/crdacts, the same generic relay the card modes use. Needs the Cloudflare link. Setup is saved on this
   device in jn_lbCfg; a game is not saved. It doesn't use the clue card or the Jeopardy scores; app.js only calls lbLeave from showHome. "Play again" keeps the names and phones, makes new cylinders
   and counts wins for the night in the corner of the TV.
   To remove: delete this file, liars.html, v4work/tools/liars-test.js and liars-e2e.js, the 7.1 CSS block and #lbo section in head.html, the Liar's Bar button and the modeLb entry in title.js,
   the /l route in worker/index.js, liars.html in wrangler.jsonc, 'liars' in MODE_FILES in build.js and the lbLeave() call in showHome. */

/*@rules*/
const LBR = (() => {
  const shuffle = (a, rnd = Math.random) => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MIX = {3:[5, 1], 4:[6, 2], 5:[8, 2], 6:[9, 3], 7:[11, 3], 8:[12, 4]};   // players: [of each of Kings, Queens, Aces, Jokers]
  const RANKS = ["K", "Q", "A"], ORD = {K:0, Q:1, A:2, J:3}, HAND = 5, CHAMBERS = 6;
  const deckFor = n => { const [k, j] = MIX[n], d = []; RANKS.forEach(r => { for(let i = 0; i < k; i++) d.push(r); }); for(let i = 0; i < j; i++) d.push("J"); return d; };
  function Game(players, rnd = Math.random){
    const n = players.length; if(n < 3 || n > 8) return null;
    const g = {n, round:0, tbl:null, turn:0, last:null, pile:0, phase:"turn", rev:null, res:null, winner:null, order:[],
      seats:players.map(x => ({p:x.p, n:x.n, hand:[], bust:Math.floor(rnd() * CHAMBERS), spins:0, out:false}))};
    const idx = p => g.seats.findIndex(s => s.p === p);
    const alive = () => g.seats.filter(s => !s.out);
    const nextWith = (from, needCards) => { for(let k = 1; k <= n; k++){ const j = (from + k) % n, s = g.seats[j]; if(!s.out && (!needCards || s.hand.length)) return j; } return -1; };
    /* only Liar! is allowed when every other living player has an empty hand (the last play can't be passed on) */
    const liarOnly = () => !!g.last && g.seats.every((s, j) => j === g.turn || s.out || !s.hand.length);
    g.liarOnly = () => g.phase === "turn" && liarOnly();
    g.deal = first => {
      const deck = shuffle(deckFor(n), rnd); g.round++;
      g.seats.forEach(s => { s.hand = s.out ? [] : deck.splice(0, HAND).sort((a, b) => ORD[a] - ORD[b]); });
      g.tbl = RANKS[Math.floor(rnd() * 3)]; g.last = null; g.pile = 0; g.turn = first; g.phase = "turn"; g.rev = g.res = null; };
    g.start = () => g.deal(Math.floor(rnd() * n));
    g.play = (p, ix) => {
      if(g.phase !== "turn" || idx(p) !== g.turn) return false; const i = g.turn, s = g.seats[i];
      if(!Array.isArray(ix) || ix.length < 1 || ix.length > 3) return false;
      const u = [...new Set(ix)]; if(u.length !== ix.length || u.some(x => !Number.isInteger(x) || x < 0 || x >= s.hand.length)) return false;
      if(liarOnly()) return false;
      const cards = u.map(x => s.hand[x]); s.hand = s.hand.filter((_, k) => !u.includes(k));
      g.last = {by:i, cards, n:cards.length}; g.pile += cards.length; g.turn = nextWith(i, true); return true; };
    g.call = p => {
      if(g.phase !== "turn" || !g.last || idx(p) !== g.turn || g.turn === g.last.by) return false;
      const liar = g.last.cards.some(c => c !== g.tbl && c !== "J"), loser = liar ? g.last.by : g.turn;
      g.rev = {cards:g.last.cards, liar, claimer:g.last.by, caller:g.turn, loser}; g.phase = "reveal"; return true; };
    g.spin = () => {
      if(g.phase !== "reveal") return false; const s = g.seats[g.rev.loser], k = s.spins, bust = k === s.bust;
      s.spins++; g.res = {loser:g.rev.loser, k:k + 1, odds:CHAMBERS - k, bust, had:s.hand.length, handBefore:s.hand.slice()};   // had/handBefore: what to keep showing until the spin result is revealed (7.58)
      if(bust){ s.out = true; s.hand = []; g.order.push(s.p); }
      g.phase = "spin"; return true; };
    g.next = () => {
      if(g.phase !== "spin") return false; const left = alive();
      if(left.length === 1){ g.winner = left[0].p; g.phase = "over"; return true; }
      let f = g.res.loser; if(g.seats[f].out) f = nextWith(f, false); g.deal(f); return true; };
    g.auto = () => { if(g.phase !== "turn") return false; const s = g.seats[g.turn]; return liarOnly() ? g.call(s.p) : g.play(s.p, [Math.floor(rnd() * s.hand.length)]); };
    const pid = i => g.seats[i].p;
    g.pub = (showRes = true) => ({ph:g.phase, round:g.round, tbl:g.tbl, turn:g.phase === "turn" ? pid(g.turn) : null, pile:g.pile, lo:g.liarOnly(),
      last:g.last ? {by:pid(g.last.by), n:g.last.n} : null, seats:g.seats.map(s => { const hid = !showRes && g.phase === "spin" && g.res && g.seats[g.res.loser] === s;   // 7.58: until the TV shows the result, the spinner looks exactly as before the spin
        return {p:s.p, n:s.n, c:hid ? g.res.had : s.hand.length, sp:hid ? s.spins - 1 : s.spins, out:s.out && !hid}; }),
      rev:g.rev && g.phase !== "turn" ? {cards:g.rev.cards, liar:g.rev.liar, claimer:pid(g.rev.claimer), caller:pid(g.rev.caller), loser:pid(g.rev.loser)} : null,
      res:g.res && g.phase !== "turn" ? {loser:pid(g.res.loser), k:g.res.k, odds:g.res.odds, bust:showRes || g.phase !== "spin" ? g.res.bust : null} : null,
      winner:g.winner, order:g.order.filter(x => showRes || g.phase !== "spin" || !g.res || x !== pid(g.res.loser))});
    g.priv = (p, showRes = true) => { const s = g.seats[idx(p)]; if(s && !showRes && g.phase === "spin" && g.res && g.seats[g.res.loser] === s) return {hand:g.res.handBefore.slice()}; return s && !s.out ? {hand:s.hand.slice()} : {}; };
    return g; }
  return {Game, MIX, RANKS, HAND, CHAMBERS, deckFor};
})();
/*@end-rules*/

const LB = {cfg:null, room:null, players:[], phase:"lobby", g:null, vc:0, relay:null, poll:null, tm:null, since:0, busy:false, psig:"", dl:0, at:0, resAt:0, resShown:false, wins:{}, sung:false, lastKey:"", revMs:(window.__lbMs || [3800, 3400])[0], spinMs:(window.__lbMs || [3800, 3400])[1]};   // revMs: how long the flipped cards show before the spin; spinMs: how long the cylinder spins (v4work/tools/liars-e2e.js sets window.__lbMs to shorten both)
LB.cfg = Object.assign({timer:30}, store.get("jn_lbCfg", {}));
const lbSave = () => store.set("jn_lbCfg", LB.cfg);
const LB_NAME = {K:"Kings", Q:"Queens", A:"Aces"}, LB_ONE = {K:"King", Q:"Queen", A:"Ace", J:"Joker"};
const lbUrl = () => new URL(`l?r=${LB.room}`, location.href).href;
const lbSeat = p => LB.g ? LB.g.seats.find(s => s.p === p) : null;
const lbNm = p => { const s = lbSeat(p) || LB.players.find(x => x.p === p); return s ? s.n : "Someone"; };

/* ---------- talking to the phones ---------- */
function lbPost(){
  if(RELAY !== true) return; const g = LB.g, priv = {}; let pub;
  if(g){ pub = g.pub(LB.resShown); pub.secs = LB.cfg.timer || 0; g.seats.forEach(s => { priv[s.p] = g.priv(s.p, LB.resShown); }); pub.wins = LB.wins; }
  else { const names = {}; LB.players.forEach(x => names[x.p] = x.n); pub = {ph:"lobby", names, order:LB.players.map(x => x.p)}; }
  pub.v = ++LB.vc;
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:LB.room, crd:{pub, priv}})}).catch(() => {}); }
async function lbPoll(){ if($("#lbo").hidden || LB.busy) return; LB.busy = true;
  try{
    if(LB.relay !== RELAY){ LB.relay = RELAY; if(LB.phase === "lobby") lbRender(); }
    if(RELAY !== true) return;
    const j = await (await fetch(`api/players?r=${encodeURIComponent(LB.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n})), sig = JSON.stringify(ps), changed = sig !== LB.psig;
    LB.psig = sig; LB.players = ps; if(changed && LB.phase === "lobby"){ lbRender(); lbPost(); }
    const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(LB.room)}&since=${LB.since}`, {cache:"no-store"})).json(); LB.since = a.n; let ch = false;
    for(const x of a.acts || []){ if(!LB.g || x.v !== LB.vc || LB.phase !== "play" || !ps.some(y => y.p === x.p)) continue;
      const act = x.a || {}; if(act.k === "play" ? LB.g.play(x.p, act.i) : act.k === "liar" ? LB.g.call(x.p) : false){ ch = true; break; } }   // one move per version: the board has moved on after the first
    if(ch) lbChanged(); }
  catch(e){} finally { LB.busy = false; } }

/* ---------- the flow ---------- */
function lbStart(){
  if(RELAY !== true || LB.players.length < 3 || LB.players.length > 8) return; stopSiu();
  const g = LBR.Game(LB.players.map(x => ({p:x.p, n:x.n}))); if(!g) return; g.start(); LB.g = g; LB.phase = "play"; LB.sung = false; lbPhaseStart(); lbChanged(); }
function lbPhaseStart(){   // timers that belong to the current phase
  const g = LB.g; LB.at = Date.now(); LB.resShown = false;
  LB.dl = g.phase === "turn" && LB.cfg.timer ? Date.now() + LB.cfg.timer * 1000 : 0;
  if(g.phase === "spin"){ LB.resAt = Date.now() + LB.spinMs; try{ Snd.spin(); }catch(e){} } }   // 7.58: the cylinder spinning
function lbChanged(){   // call after the game state changed
  const g = LB.g, pk = g.round + ":" + g.pile;
  if(g.phase === "turn" && g.last && LB.sndPile !== pk){ LB.sndPile = pk; try{ Snd.place(g.last.n); }catch(e){} }   // 7.64: the sound of the cards going down
  if(g.phase !== "turn") LB.sndPile = null;
  const key = g.phase + ":" + g.round + ":" + g.pile + ":" + (g.turn) + ":" + (g.res ? g.res.k + g.res.loser : "");
  if(key !== LB.lastKey){ LB.lastKey = key; lbPhaseStart(); }
  if(g.phase === "over" && !LB.sung){ LB.sung = true; const w = g.winner; LB.wins[w] = (LB.wins[w] || 0) + 1; playWinSiu(); }
  lbPost(); lbRender(); }
function lbAgain(){ stopSiu(); try{ Snd.stopSpin(); }catch(e){} LB.g = null; LB.phase = "lobby"; LB.lastKey = ""; lbRender(); lbPost(); }
function lbTick(){ const g = LB.g; if(!g || LB.phase !== "play") return; const now = Date.now();
  if(g.phase === "turn"){ const f = $("#lbFill"); if(f && LB.dl) f.style.width = Math.max(0, Math.min(100, (LB.dl - now) / (LB.cfg.timer * 10))) + "%";
    if(LB.dl && now >= LB.dl && g.auto()) lbChanged(); }
  else if(g.phase === "reveal"){ if(now - LB.at >= LB.revMs && g.spin()) lbChanged(); }
  else if(g.phase === "spin" && !LB.resShown && now >= LB.resAt) lbShowRes(); }
function lbShowRes(){ const g = LB.g; if(!g || g.phase !== "spin" || LB.resShown) return; LB.resShown = true; lbPost(); lbRender();
  try{ Snd.stopSpin(); if(g.res.bust) Snd.bang(); else Snd.dry(); }catch(e){} }   // 7.58 (Omar): gunshot on a bust, a dry click when safe (was a fanfare and a chime)

/* ---------- screens ---------- */
function lbEnter(){ if(S.mode === "liars") return; S.mode = "liars"; document.body.classList.add("lbmode"); }
function lbLeave(){ if(S.mode !== "liars") return; stopSiu(); try{ Snd.stopSpin(); }catch(e){} clearInterval(LB.poll); clearInterval(LB.tm); LB.poll = LB.tm = null; LB.g = null; LB.phase = "lobby"; S.mode = null; document.body.classList.remove("lbmode"); $("#lbo").hidden = true; }
function lbShow(){ lbEnter(); try{ Snd.unlock(); }catch(e){}
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#cno","#dco"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  LB.room = newRoom(); LB.players = []; LB.phase = "lobby"; LB.g = null; LB.since = 0; LB.relay = RELAY; LB.psig = ""; LB.wins = {}; LB.sung = false; LB.lastKey = ""; LB.vc = 0;
  $("#lbo").hidden = false; lbRender(); window.scrollTo(0, 0); lbPost();
  clearInterval(LB.poll); LB.poll = setInterval(lbPoll, 800); clearInterval(LB.tm); LB.tm = setInterval(lbTick, 250); lbPoll(); }
const lbDeckN = n => LBR.MIX[Math.max(3, Math.min(8, n))];   // 7.58 (Omar): [of each of Kings, Queens, Aces, Jokers] for n players
const lbDeckChips = n => { const [k, j] = lbDeckN(n); return [["K", "Kings", k], ["Q", "Queens", k], ["A", "Aces", k], ["J", "Jokers", j]].map(([c, nm, x]) => `<span class="dk${c === "J" ? " jk" : ""}"><i>${c === "J" ? "★" : c}</i><b>${x}</b><em>${nm}</em></span>`).join(""); };
const lbCard = (c, cls = "") => `<i class="lbc${c === "J" ? " jk" : ""} ${cls}"><b>${c === "J" ? "★" : c}</b><small>${c === "J" ? "★" : c}</small></i>`;
const lbBacks = n => `<span class="lbbacks">${Array.from({length:Math.min(n, 5)}, () => "<b></b>").join("")}</span>`;
const lbPips = sp => `<span class="lbpips">${Array.from({length:6}, (_, k) => `<u class="${k < sp ? "f" : ""}"></u>`).join("")}</span>`;
function lbSeatHtml(s, i, n, turn, g){   // seat 0 at the bottom, then round the table counter-clockwise (the order of play)
  const a = Math.PI / 2 + i * 2 * Math.PI / n, x = 50 + Math.cos(a) * 41, y = 53 + Math.sin(a) * 36;
  const hid = g.phase === "spin" && !LB.resShown && g.seats[g.res.loser] === s, out = s.out && !hid;   // 7.58: until the result shows, the spinner looks exactly as before the spin
  return `<div class="lbseat${turn === s.p ? " now" : ""}${out ? " out" : ""}" style="left:${x}%;top:${y}%"><div class="nm">${esc(s.n)}</div>${out ? `<div class="lbstamp">BUSTED</div>` : lbBacks(hid ? g.res.had : s.hand.length) + lbPips(hid ? s.spins - 1 : s.spins)}${turn === s.p && LB.dl ? `<div class="lbtmr"><i id="lbFill" style="width:${Math.max(0, Math.min(100, (LB.dl - Date.now()) / (LB.cfg.timer * 10)))}%"></i></div>` : ""}</div>`; }
function lbDrum(sp, bust){   // the cylinder, seen end on: sp chambers used (the last one is the bust when bust is true)
  let s = `<svg viewBox="0 0 100 100" role="img" aria-label="Cylinder, ${sp} of 6 chambers used"><circle cx="50" cy="50" r="46" fill="#b8913f" stroke="#f3d27a" stroke-width="2.4"/><circle cx="50" cy="50" r="9" fill="#6b4a1c"/>`;
  for(let k = 0; k < 6; k++){ const a = k * Math.PI / 3 - Math.PI / 2, x = 50 + Math.cos(a) * 28, y = 50 + Math.sin(a) * 28, used = k < sp, hit = bust && k === sp - 1;
    s += `<circle cx="${x}" cy="${y}" r="10.5" fill="${hit ? "#9b1c16" : used ? "#3a2a10" : "#1a0f09"}" stroke="#f3d27a" stroke-width="1.6"/>`;
    if(used) s += `<text x="${x}" y="${y + 4.5}" font-size="13" text-anchor="middle" fill="${hit ? "#f0e2c2" : "#f3d27a"}">${hit ? "✖" : "✓"}</text>`; }
  return s + "</svg>"; }
const lbConfetti = () => `<div class="lbconf">${Array.from({length:28}, (_, i) => `<i style="--a:${(i * 360 / 28 + (i % 3) * 7).toFixed(0)}deg;--d:${14 + (i * 7) % 18}u;--c:${["#d8342a", "#f3d27a", "#f0e2c2", "#2c6b49"][i % 4]};--t:${(i % 5) * 0.04}s"></i>`).join("")}</div>`;
function lbCenter(g){
  if(g.phase === "turn"){
    const k = g.round + ":" + g.pile, fresh = g.last && LB.dropKey !== k; LB.dropKey = k;   // the pile is a messy stack; a new play drops on top of it
    const n = g.last ? g.last.n : 0, old = Math.min(g.pile - n, 14), rr = j => ((j * 37 + 11) % 29) - 14, xx = j => ((j * 53 + 7) % 11) - 5, yy = j => ((j * 29 + 3) % 7) - 3;
    return `<div class="lbmid mid1">
      <div class="lbpile">${Array.from({length:old}, (_, j) => `<i style="--r:${rr(j)}deg;--x:${xx(j)};--y:${yy(j)}"></i>`).join("")}${Array.from({length:n}, (_, j) => `<i class="nw${fresh ? " drop" : ""}" style="--r:${rr(old + j + 5)}deg;--x:${xx(old + j + 3)};--y:${yy(old + j + 2)};--j:${j}"></i>`).join("")}${g.last ? "" : `<em>Pile is empty</em>`}</div></div>`; }
  if(g.phase === "reveal"){ const r = g.rev, who = g.seats[r.claimer].n, caller = g.seats[r.caller].n;
    return `<div class="lbmid rev"><div class="lbflip">${r.cards.map(c => lbCard(c, c === g.tbl || c === "J" ? "" : "bad")).join("")}<div class="lbverdict">${r.liar ? "LIAR!" : "TRUTH!"}</div></div>
      <p class="lbwho">${esc(caller)} called Liar on ${esc(who)}'s ${r.cards.length} ${r.cards.length === 1 ? LB_ONE[g.tbl] : LB_NAME[g.tbl]}.<br><b>${esc(g.seats[r.loser].n)} ${r.liar ? "was lying" : "was telling the truth"}</b> and spins.</p></div>`; }
  if(g.phase === "spin"){ const s = g.seats[g.res.loser], done = LB.resShown, bust = done && g.res.bust, sp = g.res.k;
    return `<div class="lbmid spin"><div class="lbdrum ${done ? "" : "go"}">${lbDrum(done ? sp : sp - 1, bust)}</div>
      <div class="lbodds"><span class="who">${esc(s.n)} spins</span><span class="n">1 in ${g.res.odds}</span>${done ? (bust ? `<span class="res bad">BUSTED</span>${lbConfetti()}` : `<span class="res ok">Click. Safe.</span>`) : `<span class="s">spinning…</span>`}</div></div>`; }
  return ""; }
function lbOver(g){ const w = g.seats.find(s => s.p === g.winner), place = [w.p, ...g.order.slice().reverse()];
  return `<div class="lbover"><div class="lbwin">${esc(w.n)}<span>is the last one standing</span></div>
    <ol class="lbplace">${place.map((p, i) => `<li><b>${i + 1}${["th", "st", "nd", "rd"][i + 1 > 3 ? 0 : i + 1]}</b>${esc(lbNm(p))}${LB.wins[p] ? `<em>${LB.wins[p]} win${LB.wins[p] > 1 ? "s" : ""} tonight</em>` : ""}</li>`).join("")}</ol></div>`; }
function lbCtl(g){ const out = [];
  if(g.phase === "reveal") out.push(`<button class="lbbtn go small" data-act="spin">Spin now</button>`);
  if(g.phase === "spin") out.push(LB.resShown ? `<button class="lbbtn go small" data-act="next">${g.seats.filter(s => !s.out).length === 1 ? "See the winner" : "Next round"}</button>` : `<button class="lbbtn small" data-act="skip">Skip the spin</button>`);
  if(g.phase === "over") out.push(`<button class="lbbtn go small" data-act="again">Play again</button>`);
  out.push(`<span class="gap"></span><button class="lbbtn ghost small" data-act="end-game">End game</button>`); return out.join(""); }
function lbRender(){
  const el = $("#lbBody"), g = LB.g;
  if(!g){ const ps = LB.players, off = RELAY !== true, ok = !off && ps.length >= 3 && ps.length <= 8;
    el.innerHTML = `<div class="lblob"><div class="lbhead"><div class="lbbadge">Game mode</div><h1>Liar's Bar</h1><p class="sub">Play your cards face down and say they match the table card. Call out the liars. Lose a challenge and you spin the cylinder: one chamber busts you. Last one standing wins.</p></div>
      <div class="lbgrid">
      <div class="lbpanel">${off
        ? `<div class="lbeye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Everyone plays from their own phone, which sends its moves through the Cloudflare link, so this game can't start here."}</p>`
        : `<div class="lbeye">Scan to join</div><div id="lbQr" class="lbqr"></div><p class="note">Everyone scans once and types a name. Keep the page open for the whole game. 3 to 8 players.</p>`}</div>
      <div class="lbpanel"><div class="lbeye">At the table · ${ps.length}</div>${ps.length ? `<ul class="lbnames">${ps.map(x => `<li><button data-kick="${esc(x.p)}" title="Remove ${esc(x.n)}">${esc(x.n)}</button></li>`).join("")}</ul><p class="note">Tap a name to remove that player.</p>` : `<p class="note">Waiting for players…</p>`}
        ${ps.length > 8 ? `<p class="note warn">8 seats only. Remove ${ps.length - 8} player${ps.length - 8 > 1 ? "s" : ""} to start.</p>` : ps.length && ps.length < 3 ? `<p class="note">3 players are needed to start.</p>` : ""}</div>
      <div class="lbpanel"><div class="lbeye">Turn timer</div><div class="lbseg">${[[0, "Off"], [20, "20 s"], [30, "30 s"], [60, "60 s"]].map(([v, t]) => `<button data-set="timer" data-v="${v}" aria-pressed="${LB.cfg.timer === v}">${t}</button>`).join("")}</div>
        <p class="note">When it runs out, the game plays one random card for you.</p>
        <button class="lbbtn go" id="lbGo" ${ok ? "" : "disabled"}>${ok ? "Start" : ps.length < 3 ? "Need " + (3 - ps.length) + " more" : "Start"}</button></div></div>
      <div class="lbpanel lbdeckp"><div class="lbeye">The deck for ${Math.max(3, ps.length)} players · ${(() => { const [k, j] = lbDeckN(ps.length); return k * 3 + j; })()} cards</div><div class="lbdeckrow">${lbDeckChips(ps.length)}</div><p class="note">Everyone is dealt 5 cards. A Joker counts as whatever the table card is.  The deck gets bigger with more players.</p></div>
      <ol class="lbhow"><li><b>1</b><span><em>Play</em>Put 1 to 3 cards face down and claim they all match the table card.</span></li><li><b>2</b><span><em>Call</em>The next player either plays on top or shouts Liar! and the cards flip.</span></li><li><b>3</b><span><em>Spin</em>Whoever was wrong spins their cylinder. One chamber in six busts you.</span></li></ol></div>`;
    const q = $("#lbQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!LB.g && !$("#lbo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:lbUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const n = g.n, turn = g.phase === "turn" ? g.seats[g.turn].p : null, wins = Object.entries(LB.wins).filter(([p]) => lbSeat(p)).map(([p, c]) => `${esc(lbNm(p))} ${c}`).join(" · ");
  el.innerHTML = `<div class="lbtv"><div class="lbin">
    <div class="lbtitle">Liar's Bar</div><div class="lbround">Round ${g.round}</div>${g.phase !== "over" && g.tbl ? `<div class="lbtbl lbtop"><span>TABLE CARD</span><b>${LB_NAME[g.tbl]}</b></div>` : ""}${wins ? `<div class="lbwins">Tonight: ${wins}</div>` : ""}
    <div class="lbtable"></div>
    ${g.phase === "over" ? lbOver(g) : lbCenter(g)}
    ${g.seats.map((s, i) => lbSeatHtml(s, i, n, turn, g)).join("")}
    ${g.phase === "turn" ? `<div class="lbturn">${esc(g.seats[g.turn].n)}'s turn${g.liarOnly() ? " · only Liar! is left" : ""}</div>` : ""}
    <div class="lbdeckbar"><span>Deck</span>${lbDeckChips(g.n)}</div><div class="lbctl">${lbCtl(g)}</div></div></div>`; lbTick(); }
$("#lbo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ LB.cfg[set.dataset.set] = +set.dataset.v; lbSave(); lbRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:LB.room, p:kick.dataset.kick})}).catch(() => {});
    LB.players = LB.players.filter(x => x.p !== kick.dataset.kick); lbRender(); lbPost(); return; }
  if(e.target.closest("#lbGo")){ lbStart(); return; }
  if(e.target.closest("#lbHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act || !LB.g) return; const a = act.dataset.act, g = LB.g;
  if(a === "spin"){ if(g.spin()) lbChanged(); }
  else if(a === "skip") lbShowRes();
  else if(a === "next"){ if(g.next()) lbChanged(); }
  else if(a === "again" || a === "end-game") lbAgain(); });
$("#modeLb").onclick = lbShow;
