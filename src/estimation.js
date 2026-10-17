/* 6.79 (Omar): Estimation, the Egyptian trick-taking card game as a game mode. Four players each scan one code and play from their phone (cards.html at /c?r=ROOM&g=est, the same join step
   as Imposter and Psych); the TV shows the table. The rules and scoring are in src/estrules.js (ER), the cards, table and Classic Felt look in src/cards.js (CK). This file is the screens and the
   link to the phones: the laptop is the referee, it holds every hand, posts the table to the relay (POST /api/crd: pub = what everyone sees, priv = each phone's own hand and the move it
   may make) and reads the moves back (GET /api/crdacts). A phone only ever receives its own cards.
   Setup (the bola: Full 18 rounds, Mini 13, Micro 5, and Dash Calls on or off) is saved on this device in jn_estCfg. The game is not saved. The winner screen plays the Siuuu clip.
   It doesn't use the clue card or the team scores. app.js only calls estLeave from showHome.
   To remove: delete this file, src/estrules.js and src/cards.js (if no other card mode uses it), cards.html, the 6.79 CSS block and #esto section in head.html, the Estimation button,
   the /c and /api/crd* routes in worker/index.js, the CARDS lines in build.js, cards.html and cards.js in wrangler.jsonc and the estLeave() call in showHome. */
const ES = {cfg:null, room:null, players:[], phase:"lobby", g:null, relay:null, poll:null, since:0, busy:false};
ES.cfg = Object.assign({bola:"full", dash:true}, store.get("jn_estCfg", {}));
const esSave = () => store.set("jn_estCfg", ES.cfg);
const esUrl = () => new URL(`c?r=${ES.room}&g=est`, location.href).href;
const esSigned = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
const esOrd = n => { const x = ["th", "st", "nd", "rd"], v = n % 100; return n + (x[(v - 20) % 10] || x[v] || x[0]); };
const BOLAS = [["full", "Full bola", "18 rounds: 13 bidding, then 5 Speed rounds"], ["mini", "Mini bola", "13 rounds: 8 bidding, then 5 Speed rounds"], ["micro", "Micro bola", "5 bidding rounds"]];

/* ---------- talking to the phones ---------- */
function esPost(){ const g = ES.g; if(!g) return; const priv = {}; g.pids.forEach((p, i) => priv[p] = ER.priv(g, i));
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:ES.room, crd:{pub:ER.pub(g), priv}})}).catch(() => {}); }
async function esPoll(){ if($("#esto").hidden || ES.busy) return; ES.busy = true;
  try{
    if(ES.relay !== RELAY){ ES.relay = RELAY; if(ES.phase === "lobby") esRender(); }
    if(ES.phase === "lobby"){ if(RELAY !== true) return;
      const j = await (await fetch(`api/players?r=${encodeURIComponent(ES.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
      if(ES.phase === "lobby" && JSON.stringify(ps) !== JSON.stringify(ES.players)){ ES.players = ps; esRender(); } }
    else if(ES.g && ES.g.phase !== "over"){
      const j = await (await fetch(`api/crdacts?r=${encodeURIComponent(ES.room)}&since=${ES.since}`, {cache:"no-store"})).json(); ES.since = j.n; let changed = false;
      for(const x of j.acts || []){ const g = ES.g, seat = g.pids.indexOf(x.p); if(seat < 0 || x.v !== g.v) continue; if(g.act(seat, x.a).ok){ changed = true; cardSfx(x.a); } }
      if(changed) esChanged(); } }
  catch(e){} finally { ES.busy = false; } }

/* ---------- the flow ---------- */
function esStart(){
  if(ES.players.length !== 4 || RELAY !== true) return;
  ES.g = ER.Game({bola:ES.cfg.bola, dash:ES.cfg.dash}, ES.players.map(x => x.n), ES.players.map(x => x.p)); ES.since = 0; ES.g.start(); ES.phase = "play"; esChanged(); }
function esChanged(){ const g = ES.g; esPost(); esRender(); cardTableSfx(g);   // 7.77: deal and trick-sweep sounds
  if(g.phase === "over"){ playWinSiu(); return; }
  const wait = {redeal:2600, trickdone:1700}[g.phase];
  if(wait){ const v = g.v, ph = g.phase; setTimeout(() => { if(ES.g === g && g.v === v && g.phase === ph){ g.advance(); esChanged(); } }, wait); } }
function esNext(){ const g = ES.g; if(g && g.phase === "scored"){ g.advance(); esChanged(); } }

/* ---------- screens ---------- */
function esEnter(){ if(S.mode === "estimation") return; S.mode = "estimation"; document.body.classList.add("esmode"); }
function estLeave(){ if(S.mode !== "estimation") return; stopSiu(); clearInterval(ES.poll); ES.poll = null; ES.g = null; ES.phase = "lobby"; S.mode = null; document.body.classList.remove("esmode"); $("#esto").hidden = true; }
function estShow(){ esEnter(); CK.inject(); try{ Snd.unlock(); }catch(e){}
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  ES.room = newRoom(); ES.players = []; ES.phase = "lobby"; ES.g = null; ES.since = 0; ES.relay = RELAY;
  $("#esto").hidden = false; esRender(); window.scrollTo(0, 0);
  clearInterval(ES.poll); ES.poll = setInterval(esPoll, 800); esPoll(); }
const esSeg = (key, opts, cur) => `<div class="esseg">${opts.map(([v, t, tip]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}"${tip ? ` title="${esc(tip)}"` : ""}>${t}</button>`).join("")}</div>`;
const esSuit = s => s === "N" ? "NT" : CK.SYM[s];
const esSuitHtml = s => `<b class="${s === "H" || s === "D" ? "" : "blk"}">${esSuit(s)}</b>`;
function esSeatHtml(i, p, g){ const pos = CK.POS[i], turn = p.turn === i, dash = p.dash[i], tags = [];
  if(p.caller === i) tags.push("Caller " + p.callerN); else if(p.callerN != null && p.ests[i] === p.callerN && !dash && p.phase !== "dash" && p.phase !== "auction") tags.push("With"); if(dash) tags.push("Dash");
  if(p.dealer === i && (p.phase === "dash" || p.phase === "auction")) tags.push("Dealer");
  let meta;
  if(p.phase === "dash") meta = dash ? "Dash Call" : p.turn === i ? "deciding…" : "";
  else if(p.phase === "auction") meta = dash ? "Dash Call" : p.bids[i] || (p.turn === i ? "calling…" : "");
  else { const e = p.ests[i], w = p.won[i], n = Math.max(e == null ? 0 : e, w);
    meta = `Est ${e == null ? "…" : e} · Won ${w} <span class="ckpips">${Array.from({length:Math.min(n, 13)}, (_, k) => `<i class="${k < w ? "on" : ""}"></i>`).join("")}</span>`; }
  return `<div class="ckseat ${pos}${turn ? " turn" : ""}"><div class="ckplate">${esc(p.names[i])}${tags.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div><div class="ckmeta">${meta}</div></div>`; }
function esMsg(p){ const nm = i => esc(p.names[i]);
  if(p.phase === "dash") return `<div><b>${nm(p.turn)}</b>: Dash Call?<br><small>A promise to take no tricks</small></div>`;
  if(p.phase === "auction") return `<div><b>${nm(p.turn)}</b> is calling${p.high ? `<br><small>Highest: ${nm(p.high.seat)} · ${p.high.n} ${esSuit(p.high.s)}</small>` : `<br><small>Minimum 4 tricks</small>`}</div>`;
  if(p.phase === "est") return `<div><b>${nm(p.turn)}</b> is estimating<br><small>${p.rk === "speed" ? "Speed round, trump " + esSuit(p.trump) : "Caller " + nm(p.caller) + " has " + p.callerN}${p.turn === p.last ? " · last estimate, Risk applies" : ""}</small></div>`;
  if(p.phase === "redeal") return `<div><b>Everyone passed</b><br><small>Dealing again…</small></div>`;
  return ""; }
function esScoredHtml(p, g){ const rows = p.rows, last = g.ri + 1 >= g.plan.length;
  return `<div class="ckmsg es-sum"><table><thead><tr><th></th><th>Est</th><th>Won</th><th>Points</th><th>Total</th></tr></thead><tbody>${[0, 1, 2, 3].map(i => `<tr class="${rows[i].hit ? "hit" : "miss"}"><td>${esc(p.names[i])}</td><td>${p.ests[i]}</td><td>${p.won[i]}</td><td><b>${esSigned(rows[i].pts)}</b>${rows[i].tags.length ? `<small>${rows[i].tags.map(esc).join(" · ")}</small>` : ""}</td><td>${p.scores[i]}</td></tr>`).join("")}</tbody></table>
    <div class="es-note">${p.over ? "Over" : "Under"} round · total ${p.total}</div><button class="esbtn go" data-act="next">${last ? "See the winner" : "Next round"}</button></div>`; }
function esRender(){
  const el = $("#estBody"), ph = ES.phase, g = ES.g;
  if(ph === "lobby"){ const ps = ES.players, c = ES.cfg, off = RELAY !== true, ok = ps.length === 4 && !off;
    el.innerHTML = `<div class="eshead"><div class="esbadge">Card game</div><h1>Estimation</h1><p class="sub">Four players, 13 cards each. Call how many tricks you'll take, then take exactly that many. Cards are on your phone, the table is on the TV.</p></div>
      <div class="esgrid">
      <div class="espanel">${off
        ? `<div class="eseye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Estimation runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="eseye">Scan to join</div><div id="esQr" class="esqr"></div><p class="note">Each of the four players scans once and types a name. Keep the page open for the whole game.</p>`}</div>
      <div class="espanel"><div class="eseye">Players · ${ps.length} of 4</div>${ps.length ? `<ol class="esnames">${ps.map((p, i) => `<li><button data-kick="${i}" title="Remove ${esc(p.n)}">${esc(p.n)}</button></li>`).join("")}</ol><p class="note">${ps.length > 4 ? "Tap a name to remove the extra players." : "Seats go round the table in this order, counter-clockwise."}</p>${ps.length > 1 ? `<button class="esbtn small" data-act="shuffle">Shuffle seats</button>` : ""}` : `<p class="note">Waiting for players… Estimation needs exactly four.</p>`}</div>
      <div class="espanel"><div class="eseye">Length</div>${esSeg("bola", BOLAS.map(b => [b[0], b[1], b[2]]), c.bola)}<p class="note">${BOLAS.find(b => b[0] === c.bola)[2]}.</p>
        <div class="eseye">Dash Call</div>${esSeg("dash", [[1, "On"], [0, "Off"]], c.dash ? 1 : 0)}<p class="note">Before the auction a player can promise to take no tricks (at most two players a round).</p>
        <button class="esbtn go" id="esGo" ${ok ? "" : "disabled"}>Start</button></div>
      </div>`;
    const q = $("#esQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(ES.phase === "lobby" && !$("#esto").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:esUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const p = ER.pub(g);
  if(p.phase === "over"){ const order = [0, 1, 2, 3].sort((a, b) => p.scores[b] - p.scores[a]); let rank = 0; const rk = [];
    order.forEach((s, i) => { if(i === 0 || p.scores[s] !== p.scores[order[i - 1]]) rank = i + 1; rk[s] = rank; });
    const win = order.filter(s => rk[s] === 1).map(s => esc(p.names[s]));
    el.innerHTML = `<div class="eshead"><div class="esbadge">Game over</div><h1>${win.join(" and ")} ${win.length > 1 ? "win" : "wins"}</h1></div>
      <ol class="espod">${order.map(s => `<li class="r${Math.min(rk[s], 4)}"><b>${esOrd(rk[s])}</b><span>${esc(p.names[s])}</span><em class="${p.scores[s] < 0 ? "neg" : ""}">${p.scores[s]}</em></li>`).join("")}</ol>
      <div class="esrow"><button class="esbtn go" data-act="again">Play again</button><button class="esbtn ghost" data-act="home">Title screen</button></div>`; return; }
  const lead = Math.max(...p.scores), trick = p.trick.map(t => CK.face(t.c, CK.POS[t.seat] + (t.seat === p.winner ? " win" : "") + " in")).join("");
  const chipTrump = p.trump ? `Trump ${esSuitHtml(p.trump)}` : p.phase === "dash" || p.phase === "auction" ? "Bidding" : "";
  const ovun = p.total != null ? `${p.total > 13 ? "Over" : "Under"} ${Math.abs(p.total - 13) > 0 ? (p.total > 13 ? "+" : "−") + Math.abs(p.total - 13) : ""}` : "";
  el.innerHTML = `<div class="ckw es-tv" data-look="felt"><div class="es-stage"><div class="ckt"><div class="cktin"><div class="ckfelt"></div>
    ${[0, 1, 2, 3].map(i => esSeatHtml(i, p, g)).join("")}
    <div class="cktrick">${trick}</div>
    ${p.phase === "scored" ? esScoredHtml(p, g) : esMsg(p) ? `<div class="ckmsg">${esMsg(p)}</div>` : ""}
    <div class="ckchip">Round ${p.round}/${p.of}${p.rk === "speed" ? " · Speed" : ""}${chipTrump ? " · " + chipTrump : ""}${ovun ? " · " + ovun : ""}</div></div></div></div>
    <div class="ckside"><h3>Scores</h3>${[0, 1, 2, 3].map(i => `<div class="cksc${p.scores[i] === lead && lead > 0 ? " lead" : ""}${p.scores[i] < 0 ? " neg" : ""}">${esc(p.names[i])}<b>${p.scores[i]}</b>${p.phase === "scored" ? `<small>${esSigned(p.rows[i].pts)} this round</small>` : ""}</div>`).join("")}
      <div class="es-tools"><button class="esbtn ghost small" data-act="end">End game</button></div></div></div>`; }
$("#esto").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; ES.cfg[k] = k === "dash" ? v === "1" : v; esSave(); esRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const x = ES.players[+kick.dataset.kick]; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:ES.room, p:x.p})}).catch(() => {});
    ES.players.splice(+kick.dataset.kick, 1); esRender(); return; }
  if(e.target.closest("#esGo")){ esStart(); return; }
  if(e.target.closest("#esHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "next") esNext();
  else if(act.dataset.act === "shuffle"){ CK.shuffle(ES.players); esRender(); }
  else if(act.dataset.act === "again"){ stopSiu(); ES.phase = "lobby"; ES.g = null; esRender(); esPoll(); }
  else if(act.dataset.act === "home") showHome();
  else if(act.dataset.act === "end") askConfirm("End the game now?", "This shows the winner screen with the current scores.", "End game", () => { const g = ES.g; if(g){ g.phase = "over"; g.v++; esChanged(); } }); });
$("#modeEst").onclick = estShow;
