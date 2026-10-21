/* 7.0 (Omar): For Sale?, a property auction game mode (from the card game For Sale). Everyone scans one code and joins from their phone (sale.html at /f?r=ROOM, the same join step as
   Imposter and Decrypto). Phase 1, buying: each round the TV lays out one property per player (numbered 1 to 30, from a box under a bridge to a villa with a Pyramids view). Going round the table you
   raise the top bid (+1M, +2M or +5M) or pass. A player who passes takes the CHEAPEST property still on the table and gets half their bid back (rounded down); the last one left pays their full bid and
   takes the BEST property, then opens the next round. Phase 2, selling: each round the TV lays out one cheque per player (0 to 15M); everybody secretly picks one of their properties on their phone, all
   are revealed together, and the best property gets the best cheque. Most money (cheques plus unspent coins) wins; a tie goes to the player with more coins left, then they share the win.
   Coins are Egyptian pounds in millions: 18M each for 3 or 4 players, 14M for 5 or 6. With 3 players 6 properties and 6 cheques are set aside unseen, with 4 players 2 of each. Coins are private (only on your own phone);
   bids, passes and the cards taken are public. Title Deeds look (his pick of three previews, 2026-10-14): green felt, cream deed cards with a colour band per price tier (Starter, City, Compound, Coast),
   pale-green bank cheques. sale.html uses the same palette. The laptop is the referee: the rules and the whole state of a game live in SLR below (no screen code in it, so v4work/tools/forsale-test.js can
   load just that region). pub() is what every phone may see, priv(p) is one player's own coins and hand. The phones talk through the same generic relay routes as the card games (join, players, crd,
   crdstate, crdact, crdacts in worker/index.js). Needs the Cloudflare link. It doesn't use the clue card or the Jeopardy scores; app.js only calls slLeave from showHome. Bid and sell timers are saved on this
   device (jn_slCfg); a game is not saved. A timed-out bid is a pass; a timed-out sale sells your cheapest property.
   To remove: delete this file, sale.html, v4work/tools/forsale-test.js and forsale-e2e.js, the 7.0 CSS block and #slo section in head.html, the For Sale? button, the /f route in worker/index.js,
   sale.html in wrangler.jsonc, the TT.modeSale entry in title.js, 'forsale' in MODE_FILES in build.js and the slLeave() call in showHome. */

/*@rules*/
const SLR = (() => {
  const shuffle = (a, rnd = Math.random) => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const PROPS = ["Cardboard box under the 6th of October Bridge", "Rooftop room in Imbaba", "Kiosk in Ataba", "Tuk-tuk garage in Boulaq", "Red-brick building, no paint", "Shared student flat in Giza",
    "Shubra ground floor", "Haram Street flat", "Unfinished flat in October", "Old rent flat in Sayeda Zeinab", "Faisal flat, 7th floor, no lift", "Ain Shams studio", "Dokki flat", "Nasr City apartment",
    "Heliopolis flat near Korba", "Mohandessin apartment", "Rehab City apartment", "Madinaty apartment", "Downtown Belle Epoque flat", "Maadi garden flat", "Ain Sokhna chalet", "New Capital villa",
    "Fifth Settlement villa", "Sheikh Zayed townhouse", "Hurghada beach villa", "El Gouna lagoon villa", "Marassi chalet, first row", "Hacienda Bay villa", "Zamalek Nile-view penthouse",
    "Villa with a private Pyramids view"];
  const CHEQUES = [0, 0]; for(let q = 2; q <= 15; q++) CHEQUES.push(q, q);   // 30 cheques: two 0M, then two each of 2M to 15M (no 1M)
  const plan = n => { const remove = n === 3 ? 6 : n === 4 ? 2 : 0; return {remove, coins:n <= 4 ? 18 : 14, rounds:(30 - remove) / n}; };
  const tier = c => c <= 7 ? 0 : c <= 15 ? 1 : c <= 23 ? 2 : 3;
  function Game(cfg, roster, rnd = Math.random){
    const n = roster.length; if(n < 3 || n > 6) return null;
    const pl = plan(n), raises = cfg.raises || [1, 2, 5];
    const g = {cfg, v:0, n, rounds:pl.rounds, round:0, sround:0, phase:"idle", step:0, turn:0, cur:0, top:-1, starter:Math.floor(rnd() * n), table:[], ctable:[], last:null, res:null, rv:null, over:null, best:null,
      deck:shuffle(PROPS.map((x, i) => i + 1), rnd).slice(pl.remove), cdeck:shuffle(CHEQUES.slice(), rnd).slice(pl.remove),
      ps:roster.map(x => ({p:x.p, n:x.n, coins:pl.coins, hand:[], chq:[], bid:0, out:false, pick:null, got:null, sold:null}))};
    const idxOf = p => g.ps.findIndex(x => x.p === p);
    const nextTurn = from => { for(let k = 1; k <= n; k++){ const i = (from + k) % n; if(!g.ps[i].out) return i; } return from; };
    const total = x => x.coins + x.chq.reduce((a, b) => a + b, 0);
    function deal(){ g.round++; g.phase = "bid"; g.table = g.deck.splice(0, n).sort((a, b) => a - b); g.ps.forEach(x => { x.bid = 0; x.out = false; x.got = null; });
      g.cur = 0; g.top = -1; g.turn = g.starter; g.last = null; g.res = null; g.step++; }
    function endRound(){ g.phase = "sold"; g.res = g.ps.map(x => ({p:x.p, n:x.n, c:x.got.c, paid:x.got.paid, back:x.got.back, won:!!x.got.won})).sort((a, b) => a.c - b.c); g.ps.forEach(x => x.hand.sort((a, b) => a - b)); }
    function dealCheques(){ g.phase = "sell"; g.ctable = g.cdeck.splice(0, n).sort((a, b) => b - a); g.ps.forEach(x => { x.pick = null; x.sold = null; }); g.rv = null; g.step++; }
    function reveal(){ const order = g.ps.map((x, i) => i).sort((a, b) => g.ps[b].pick - g.ps[a].pick);
      g.rv = order.map((i, k) => { const x = g.ps[i], c = x.pick, q = g.ctable[k]; x.hand.splice(x.hand.indexOf(c), 1); x.chq.push(q); x.sold = {c, q}; x.pick = null;
        if(!g.best || q - c > g.best.q - g.best.c) g.best = {n:x.n, c, q}; return {p:x.p, n:x.n, c, q}; });
      g.phase = "reveal"; }
    function finish(){ const rows = g.ps.map(x => ({p:x.p, n:x.n, coins:x.coins, chq:x.chq.slice().sort((a, b) => b - a), total:total(x)})).sort((a, b) => b.total - a.total || b.coins - a.coins);
      rows.forEach((r, i) => { r.rank = i && r.total === rows[i - 1].total && r.coins === rows[i - 1].coins ? rows[i - 1].rank : i + 1; });
      g.over = {rows, winners:rows.filter(r => r.rank === 1).map(r => r.n), best:g.best && g.best.q - g.best.c > 0 ? g.best : null}; g.phase = "over"; }
    function raise(i, d){ const x = g.ps[i], nb = g.cur + d; if(nb > x.coins) return {ok:false, err:"coins"};
      g.cur = nb; x.bid = nb; g.top = i; g.last = {k:"raise", n:x.n, bid:nb}; g.turn = nextTurn(i); g.step++; return {ok:true}; }
    function pass(i){ const x = g.ps[i], c = g.table.shift(), back = Math.floor(x.bid / 2);
      x.coins -= x.bid - back; x.hand.push(c); x.got = {c, paid:x.bid - back, back}; x.out = true; g.last = {k:"pass", n:x.n, c, back};
      const left = g.ps.filter(y => !y.out);
      if(left.length === 1){ const y = left[0], w = g.ps.indexOf(y), cw = g.table.shift(); y.coins -= y.bid; y.hand.push(cw); y.got = {c:cw, paid:y.bid, back:0, won:true}; y.out = true; g.starter = w; endRound(); }
      else g.turn = nextTurn(i);
      g.step++; return {ok:true}; }
    Object.assign(g, {idxOf, total,
      start(){ deal(); },
      act(p, a){ const i = idxOf(p); if(i < 0 || !a) return {ok:false, err:"unknown"};
        if(a.k === "raise" || a.k === "pass"){ if(g.phase !== "bid") return {ok:false, err:"stale"}; if(a.s !== g.step) return {ok:false, err:"stale"}; if(i !== g.turn) return {ok:false, err:"turn"};
          if(a.k === "pass") return pass(i); if(!raises.includes(a.d)) return {ok:false, err:"bad"}; return raise(i, a.d); }
        if(a.k === "pick"){ if(g.phase !== "sell") return {ok:false, err:"stale"}; const x = g.ps[i]; if(x.pick) return {ok:false, err:"locked"}; if(!x.hand.includes(a.c)) return {ok:false, err:"bad"};
          x.pick = a.c; if(g.ps.every(y => y.pick)) reveal(); return {ok:true}; }
        return {ok:false, err:"phase"}; },
      timeout(){   // the clock ran out (or the host skipped ahead): the player on turn passes, or whoever hasn't picked sells their cheapest property
        if(g.phase === "bid") pass(g.turn);
        else if(g.phase === "sell"){ g.ps.forEach(x => { if(!x.pick) x.pick = Math.min(...x.hand); }); reveal(); } },
      advance(){ if(g.phase === "sold"){ if(g.deck.length) deal(); else { g.sround = 1; dealCheques(); } }
        else if(g.phase === "reveal"){ if(g.sround >= g.rounds) finish(); else { g.sround++; dealCheques(); } } },
      endGame(){ finish(); },
      pub(){ const bid = g.phase === "bid", sell = g.phase === "sell";
        const last = g.last && (g.last.k === "pass" ? {k:"pass", n:g.last.n, c:g.last.c, nm:PROPS[g.last.c - 1], back:g.last.back} : {k:"raise", n:g.last.n, bid:g.last.bid});
        return {phase:g.phase, round:g.round, sround:g.sround, of:g.rounds, step:g.step, cur:g.cur, top:g.top >= 0 ? g.ps[g.top].n : null, turn:bid ? g.ps[g.turn].n : null,
          ps:g.ps.map((x, i) => ({n:x.n, bid:x.bid, out:bid && x.out, took:bid && x.got ? x.got.c : null, turn:bid && i === g.turn, pick:sell ? !!x.pick : null})),
          table:g.table.map(c => [c, PROPS[c - 1]]), ctable:g.phase === "sell" || g.phase === "reveal" ? g.ctable : [], last,
          res:g.phase === "sold" ? g.res.map(r => ({n:r.n, c:r.c, nm:PROPS[r.c - 1], paid:r.paid, back:r.back, won:r.won})) : null,
          rv:g.phase === "reveal" ? g.rv.map(r => ({n:r.n, c:r.c, nm:PROPS[r.c - 1], q:r.q})) : null,
          over:g.phase === "over" ? {rows:g.over.rows.map(r => ({n:r.n, coins:r.coins, chq:r.chq, total:r.total, rank:r.rank})), winners:g.over.winners,
            best:g.over.best ? {n:g.over.best.n, c:g.over.best.c, nm:PROPS[g.over.best.c - 1], q:g.over.best.q} : null} : null}; },
      priv(p){ const i = idxOf(p); if(i < 0) return null; const x = g.ps[i], nm = c => PROPS[c - 1];
        return {i, coins:x.coins, bid:x.bid, out:x.out, myTurn:g.phase === "bid" && i === g.turn, hand:x.hand.map(c => [c, nm(c)]), chq:x.chq, pick:x.pick,
          got:x.got ? {c:x.got.c, nm:nm(x.got.c), paid:x.got.paid, back:x.got.back, won:!!x.got.won} : null, sold:x.sold ? {c:x.sold.c, nm:nm(x.sold.c), q:x.sold.q} : null, total:total(x)}; }});
    return g; }
  return {shuffle, PROPS, CHEQUES, plan, tier, Game};
})();
/*@end-rules*/

/* ---------- screens and the link to the phones ---------- */
const SL = {cfg:null, room:null, players:[], phase:"lobby", g:null, relay:null, poll:null, tm:null, since:0, busy:false, v:0, dl:null, total:0, key:""};
SL.cfg = Object.assign({bid:30, sell:45}, store.get("jn_slCfg", {}));
const slSave = () => store.set("jn_slCfg", SL.cfg);
const slUrl = () => new URL(`f?r=${SL.room}`, location.href).href;
const slLeft = () => SL.dl ? Math.max(0, Math.round((SL.dl - Date.now()) / 1000)) : null;
const SL_TIER = ["Starter", "City", "Compound", "Coast"];

function slPost(){ if(!SL.room) return; SL.v++; const g = SL.g, priv = {}; let pub;
  if(g){ pub = Object.assign(g.pub(), {v:SL.v, secs:slLeft()}); g.ps.forEach(x => priv[x.p] = g.priv(x.p)); } else pub = {v:SL.v, phase:"lobby"};
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:SL.room, crd:{pub, priv}})}).catch(() => {}); }
async function slPoll(){ if($("#slo").hidden || SL.busy) return; SL.busy = true;
  try{
    if(SL.relay !== RELAY){ SL.relay = RELAY; if(SL.phase === "lobby") slRender(); }
    if(RELAY !== true) return;
    if(SL.phase === "lobby"){
      const j = await (await fetch(`api/players?r=${encodeURIComponent(SL.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
      if(JSON.stringify(ps) !== JSON.stringify(SL.players)){ SL.players = ps; slRender(); } }
    else if(SL.g){
      const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(SL.room)}&since=${SL.since}`, {cache:"no-store"})).json(); SL.since = a.n; let changed = false;
      for(const x of a.acts || []){ if(!SL.g || SL.g.phase === "over") break; if(SL.g.act(x.p, x.a).ok) changed = true; }
      if(changed) slChanged(); } }
  catch(e){} finally { SL.busy = false; } }

/* ---------- the flow ---------- */
async function slStart(){
  if(SL.players.length < 3 || SL.players.length > 6 || RELAY !== true) return;
  try{ const j = await (await fetch(`api/crdacts?r=${encodeURIComponent(SL.room)}&since=1000000000`, {cache:"no-store"})).json(); SL.since = j.n || 0; }catch(e){ return; }   // moves from an earlier game in this room are skipped
  const g = SLR.Game({}, SL.players.map(x => ({p:x.p, n:x.n}))); if(!g) return;
  SL.g = g; SL.key = ""; g.start(); SL.phase = "play"; slChanged(); }
function slChanged(){ const g = SL.g, key = [g.phase, g.round, g.sround, g.step].join("|");
  if(key !== SL.key){ SL.key = key;
    const secs = g.phase === "bid" ? SL.cfg.bid : g.phase === "sell" ? SL.cfg.sell : 0;
    SL.total = secs; SL.dl = secs ? Date.now() + secs * 1000 : null; if(g.phase === "over") SL.dl = null;
    try{ if(g.phase === "bid" && g.last) Snd.blip(); else if(g.phase === "reveal" || g.phase === "sold") Snd.chime(); }catch(e){} }
  slPost(); slRender();
  if(g.phase === "over"){ try{ confetti(); }catch(e){} playWinSiu(); } }

/* ---------- screens ---------- */
function slEnter(){ if(S.mode === "forsale") return; S.mode = "forsale"; document.body.classList.add("slmode"); }
function slLeave(){ if(S.mode !== "forsale") return; stopSiu(); clearInterval(SL.poll); clearInterval(SL.tm); SL.poll = SL.tm = null; SL.g = null; SL.phase = "lobby"; S.mode = null; document.body.classList.remove("slmode"); $("#slo").hidden = true; }
function slShow(){ slEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#cno","#dco"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  SL.room = newRoom(); SL.players = []; SL.phase = "lobby"; SL.g = null; SL.since = 0; SL.relay = RELAY; SL.v = 0;
  $("#slo").hidden = false; slRender(); window.scrollTo(0, 0);
  clearInterval(SL.poll); SL.poll = setInterval(slPoll, 1000); clearInterval(SL.tm); SL.tm = setInterval(slTick, 250); slPoll(); }
function slTick(){ const g = SL.g; if(!g || !SL.dl) return;
  const f = $("#slFill"); if(f) f.style.width = Math.max(0, Math.min(100, (SL.dl - Date.now()) / (SL.total * 10))) + "%";
  if(Date.now() >= SL.dl && (g.phase === "bid" || g.phase === "sell")){ SL.dl = null; g.timeout(); slChanged(); } }
const slSeg = (key, opts, cur) => `<div class="slseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const slDeed = (c, nm, cls = "") => { const t = SLR.tier(c); return `<div class="deed t${t} ${cls}"><div class="band">${SL_TIER[t]}</div><div class="dn">${c}<small>M</small></div><div class="dnm">${esc(nm)}</div></div>`; };
const slChq = (q, cls = "") => `<div class="chq ${q === 0 ? "zero" : ""} ${cls}"><small>${q === 0 ? "Buyer backed out" : "Cheque"}</small><b>${q}M</b></div>`;
const slTimer = () => SL.dl ? `<div class="sltimer"><b id="slFill" style="width:${Math.max(0, Math.min(100, (SL.dl - Date.now()) / (SL.total * 10)))}%"></b></div>` : "";
function slLastText(l){ if(!l) return ""; return l.k === "pass" ? `${esc(l.n)} passed and took ${l.c}M, ${esc(l.nm)}${l.back ? ` · ${l.back}M back` : ""}` : `${esc(l.n)} bid ${l.bid}M`; }
function slSeats(p){ return `<div class="slseats">${p.ps.map(x => `<div class="seat${x.turn ? " turn" : ""}${x.out ? " out" : ""}"><div class="sn">${esc(x.n)}</div>
  <div class="ss">${p.phase === "sell" ? (x.pick ? "locked ✓" : "choosing…") : x.out ? `passed${x.took ? ` · took ${x.took}M` : ""}` : x.turn ? "bidding…" : x.bid ? "in the bidding" : "no bid yet"}</div>
  ${p.phase === "bid" && !x.out ? `<b>${x.bid ? x.bid + "M" : "–"}</b>` : ""}</div>`).join("")}</div>`; }
function slMid(p){
  if(p.phase === "bid") return `<div class="slround">Round ${p.round} of ${p.of} · Buying</div>
    <div class="sltable">${p.table.map(([c, nm]) => slDeed(c, nm)).join("")}</div>
    <div class="slturn"><b>${esc(p.turn)}</b>'s turn</div>${slTimer()}
    <div class="slcur">${p.cur ? `Top bid <b>${p.cur}M</b> by ${esc(p.top)}` : "No bids yet. Open the bidding or pass."}</div>
    <div class="sllast">${slLastText(p.last) || "&nbsp;"}</div>${slSeats(p)}`;
  if(p.phase === "sold") return `<div class="slround">Round ${p.round} of ${p.of} · Sold</div>
    <div class="slres">${p.res.map(r => `<div class="rs">${slDeed(r.c, r.nm, r.won ? "won" : "")}<div class="rn">${esc(r.n)}</div><div class="rp">${r.won ? `won it · paid ${r.paid}M` : r.back ? `paid ${r.paid}M · ${r.back}M back` : `paid ${r.paid}M`}</div></div>`).join("")}</div>`;
  if(p.phase === "sell") return `<div class="slround">Sale ${p.sround} of ${p.of} · Selling</div>
    <div class="slnote big">Everyone picks one deed on their phone. The best deed gets the best cheque.</div>
    <div class="sltable">${p.ctable.map(q => slChq(q)).join("")}</div>${slTimer()}${slSeats(p)}`;
  if(p.phase === "reveal") return `<div class="slround">Sale ${p.sround} of ${p.of} · Revealed</div>
    <div class="slrv">${p.rv.map((r, i) => `<div class="rs">${slDeed(r.c, r.nm)}<div class="arrow">▼</div>${slChq(r.q, i === 0 ? "top" : "")}<div class="rn">${esc(r.n)}</div></div>`).join("")}</div>`;
  return ""; }
function slOver(p){ const o = p.over, tie = o.winners.length > 1, rows = o.rows.slice().reverse();
  return `<div class="slhead"><div class="slbadge">Tycoon of the night</div><h1>${tie ? esc(o.winners.join(" and ")) + " share the win" : esc(o.winners[0]) + " wins"}</h1>
    <p class="slsub">${o.best ? `Best deal: ${esc(o.best.n)} sold ${esc(o.best.nm)} (${o.best.c}M) for ${o.best.q}M.` : "Cheques plus unspent coins, in millions of pounds."}</p></div>
    <div class="slrows">${rows.map((r, i) => `<div class="row${r.rank === 1 ? " win" : ""}" style="animation-delay:${i * .6}s"><span class="rk">${r.rank}</span><span class="nm">${esc(r.n)}</span>
      <span class="ch">${r.chq.map(q => `<i class="${q === 0 ? "zero" : ""}">${q}</i>`).join("")}</span><span class="co">+ ${r.coins}M coins</span><b>${r.total}M</b></div>`).join("")}</div>
    <div class="slrow"><button class="slbtn go" id="slAgain">Play again</button><button class="slbtn ghost" id="slHome2">Title screen</button></div>`; }
function slRender(){
  const el = $("#slBody"), ph = SL.phase, g = SL.g;
  if(ph === "lobby"){ const ps = SL.players, c = SL.cfg, off = RELAY !== true, ok = ps.length >= 3 && ps.length <= 6 && !off;
    el.innerHTML = `<div class="slhead"><div class="slbadge">Game mode</div><h1>For Sale?</h1>
      <p class="sub">Buy properties cheap, then sell them for more. Whoever ends with the most money wins. Everyone plays on their own phone.</p></div>
      <div class="slgrid">
      <div class="slpanel">${off
        ? `<div class="sleye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "For Sale? runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="sleye">Scan to join</div><div id="slQr" class="slqr"></div><p class="note">Everyone scans once and types a name. Keep the page open for the whole game.</p>`}</div>
      <div class="slpanel"><div class="sleye">Players · ${ps.length}</div>${ps.length ? `<ul class="slnames">${ps.map(x => `<li><span>${esc(x.n)}</span><button data-kick="${esc(x.p)}" title="Remove ${esc(x.n)}" aria-label="Remove ${esc(x.n)}">×</button></li>`).join("")}</ul>` : `<p class="note">Waiting for players…</p>`}
        <p class="note">${ps.length > 6 ? "Up to 6 players. Tap × to remove someone." : ps.length < 3 ? "Needs 3 to 6 players." : `${ps.length} players: ${ps.length <= 4 ? "18M" : "14M"} each, ${(30 - (ps.length === 3 ? 6 : ps.length === 4 ? 2 : 0)) / ps.length} rounds of buying, then ${(30 - (ps.length === 3 ? 6 : ps.length === 4 ? 2 : 0)) / ps.length} of selling.`}</p></div>
      <div class="slpanel"><div class="sleye">Time to bid on your turn</div>${slSeg("bid", [[15, "15 s"], [30, "30 s"], [45, "45 s"], [60, "60 s"], [0, "Off"]], c.bid)}
        <div class="sleye">Time to pick a deed to sell</div>${slSeg("sell", [[30, "30 s"], [45, "45 s"], [60, "60 s"], [0, "Off"]], c.sell)}
        <p class="note">When the clock runs out a bid becomes a pass, and your cheapest deed is sold.</p>
        <button class="slbtn go" id="slGo" ${ok ? "" : "disabled"}>Start</button></div>
      <div class="slpanel slguide"><div class="sleye">How to play</div>
        <p class="slidea">You are a property dealer. Every property has a value from <b>1M to 30M</b> printed on its card (this is what it is worth, not what you pay): the higher, the better the property. First you <b>buy</b> properties as cheaply as you can. Then you <b>sell</b> them to buyers for as much as you can. You do everything on your phone. Your coins and your properties are secret; the TV shows the bids and who took what.</p>
        <div class="slsteps">
          <div class="step"><div class="sn1">1</div><h3>Buying</h3>
            <p>Each round the TV lays out a few properties, one for every player. When it's your turn, raise the top bid by <b>+1M, +2M or +5M</b>, or <b>pass</b>.</p>
            <ul><li><b>Pass:</b> you take the <b>cheapest</b> property on the table and get <b>half your bid back</b> (rounded down).</li>
            <li><b>Last one left:</b> when everybody else has passed, you pay your <b>whole bid</b> and take the <b>best</b> property.</li>
            <li>You can't bid more coins than you have.</li></ul></div>
          <div class="step"><div class="sn1">2</div><h3>Selling</h3>
            <p>Once all the properties are bought, the TV lays out cheques, one for every player, from <b>0M to 15M</b>. Everybody secretly picks one of their properties to sell.</p>
            <ul><li>All picks are revealed together. The <b>best property</b> gets the <b>biggest cheque</b>, the next best gets the next cheque, and so on.</li>
            <li>Look at the cheques first: a big cheque wants a high property, and a <b>0M</b> cheque (the buyer backed out) is where your worst property goes.</li></ul></div>
          <div class="step"><div class="sn1">3</div><h3>Winning</h3>
            <p>Add up your cheques and the coins you didn't spend. <b>The most money wins.</b> A tie goes to whoever has more coins left.</p>
            <ul><li>Spending a lot on one great property can leave you short later, so keep some coins.</li>
            <li>If the clock runs out, a bid counts as a pass and your cheapest property is sold.</li></ul></div>
        </div>
        <p class="slex"><b>Example of one buying round.</b> The table shows 7M, 18M, 22M and 26M. Mona bids 3M and Karim bids 6M. Mona passes: she takes the 7M and gets 1M back, so it cost her 2M. Youssef and Nour pass without bidding: they take the 18M and 22M for free. Karim is the last one left: he pays all 6M and takes the 26M.</p>
        <p class="note">Everyone starts with <b>18M</b> in coins (3 or 4 players) or <b>14M</b> (5 or 6 players). With 3 players a few properties and cheques are left out, so every game is a little different.</p></div>
      </div>`;
    const q = $("#slQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(SL.phase === "lobby" && !$("#slo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:slUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const p = g.pub();
  if(p.phase === "over"){ el.innerHTML = `<div class="slwrap over">${slOver(p)}</div>`; return; }
  const ctl = (p.phase === "bid" || p.phase === "sell" ? `<button class="slbtn small" data-act="skip">${p.phase === "bid" ? "Skip turn (pass)" : "Skip ahead"}</button><button class="slbtn small" data-act="more">+30 s</button>`
    : `<button class="slbtn go small" data-act="next">${p.phase === "sold" ? (g.deck.length ? "Next round" : "Time to sell") : p.sround >= p.of ? "Final results" : "Next sale"}</button>`) + `<span class="gap"></span><button class="slbtn ghost small" data-act="end">End game</button>`;
  el.innerHTML = `<div class="slwrap"><div class="slin">${slMid(p)}</div><div class="slctl">${ctl}</div></div>`; }
$("#slo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ SL.cfg[set.dataset.set] = +set.dataset.v; slSave(); slRender(); return; }
  const kk = e.target.closest("[data-kick]"); if(kk){ fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:SL.room, p:kk.dataset.kick})}).catch(() => {}); SL.players = SL.players.filter(x => x.p !== kk.dataset.kick); slRender(); return; }
  if(e.target.closest("#slGo")){ slStart(); return; }
  if(e.target.closest("#slAgain")){ stopSiu(); SL.phase = "lobby"; SL.g = null; SL.dl = null; SL.v++; slPost(); slRender(); slPoll(); return; }
  if(e.target.closest("#slHome") || e.target.closest("#slHome2")){ leaveAsk(cfLive(SL), "For Sale?"); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "skip" && SL.g){ SL.dl = null; SL.g.timeout(); slChanged(); }
  else if(act.dataset.act === "more" && SL.g){ SL.dl = (SL.dl || Date.now()) + 30000; SL.total += 30; slPost(); slRender(); }
  else if(act.dataset.act === "next" && SL.g){ SL.g.advance(); slChanged(); }
  else if(act.dataset.act === "end") askConfirm("End the game now?", "This shows the final standings with the money so far.", "End game", () => { if(SL.g){ SL.g.endGame(); slChanged(); } }); });
$("#modeSale").onclick = slShow;
