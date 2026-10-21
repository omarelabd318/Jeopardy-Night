/* 7.4 (Omar): Taboo, the describe-it-without-saying-it party game, as a game mode. 2 to 4 teams join from their phones (taboo.html at /t?r=ROOM, one name, then a team). In a turn the describer sees a
   target word and 5 banned words on their phone and gets their team to say the word before the clock runs out; the team shouts guesses out loud. The other teams' phones show the same card with a buzz
   button per banned word (plus "The word itself" and "Other foul"): the first buzz ends the card and costs the describing team half its value. Teammates' phones show only the clock, and the TV never
   shows the card. The describer taps Got it (+value) or Skip (free, 3 a turn by default). The laptop is the referee: it posts the table with POST /api/crd (pub = what every phone may see, priv = the card,
   sent only to the describer and the opposing phones) and reads the phones' moves from GET /api/crdacts, the same generic relay the other phone modes use. The host can also tap Got it, Skip or End turn
   on the laptop, and undo a card in the turn recap (a wrong buzz or a disputed Got it scores 0).
   Game: 3 rounds, each team gets 2 turns a round (setup: 1 to 4). Round 1 Warm-up 100 a card on easy cards, round 2 Harder 200, round 3 Lightning 300 with a shorter clock; the describer rotates through
   the team. A tie on top plays sudden death (30 s, 300 a card, only the tied teams, up to 3 times). The winner screen plays the Siuuu clip. Translating the word into Arabic or English counts as a foul
   (house rule, said out loud, the game can't check it). Needs the Cloudflare link: there is no one-screen version, the card must be private.
   Look: On Air (his pick of three previews: On Air, Redacted, Truck Art): burgundy studio, gold marquee bulbs, a red ON AIR light that flashes on a buzz with a bleep. Only this look is built.
   Cards: v4work/taboo/cards-*.json {w, ban:[5], lvl:"e"|"h"} (embedded as TBC by build.js): Everyday, Pop culture, Egypt & Arab, Football and Spicy (off by default). A card isn't dealt again on this device until
   its pack level runs out (jn_tbSeen). Setup is saved on this device in jn_tbCfg; a game is not saved. It doesn't use the clue card or the Jeopardy scores; app.js only calls tbLeave from showHome.
   The rules and the state of a game live in TBR below (no screen code in it, so v4work/tools/taboo-test.js can load just that region).
   To remove: delete this file, taboo.html, v4work/taboo/, v4work/tools/taboo-test.js and taboo-e2e.js, the 7.4 CSS block and #tbo section in head.html, the Taboo button and the modeTb entry in title.js,
   the /t route and the crdat/ago lines in worker/index.js, taboo.html in wrangler.jsonc, the TBC lines and 'taboo' in MODE_FILES in build.js, Snd.buzz in app.js and the tbLeave() call in showHome. */

/*@rules*/
const TBR = (() => {
  const RND = [null, {n:1, name:"Warm-up", val:100, lvl:"e"}, {n:2, name:"Harder", val:200, lvl:"h"}, {n:3, name:"Lightning", val:300, lvl:"h"}, {n:4, name:"Sudden death", val:300, lvl:"h"}];
  const FOUL = ["The word itself", "Other foul"];
  /* o = {teams:2..4, tpr:turns per team per round, secs, lsecs, skips (0..5, 99 = no limit), members:t => [player ids] (read at the start of each turn), draw:lvl => {w, ban:[5]}} */
  function Game(o){
    const nt = o.teams; if(!(nt >= 2 && nt <= 4)) return null;
    const g = {nt, scores:Array(nt).fill(0), turns:[], ti:-1, ph:"ready", cur:null, hist:[], dIdx:Array(nt).fill(0), sd:0, winners:null, id:0};
    for(let r = 1; r <= 3; r++) for(let k = 0; k < o.tpr; k++) for(let t = 0; t < nt; t++) g.turns.push({r, t});
    const secsFor = r => r >= 3 ? o.lsecs : o.secs;
    const draw = () => { const c = g.cur; c.card = o.draw(c.lvl); c.card.id = ++g.id; };
    const finish = () => {   // after the last turn: a clear leader wins, a tie plays sudden death
      const mx = Math.max(...g.scores), lead = g.scores.map((s, i) => s === mx ? i : -1).filter(i => i >= 0);
      if(lead.length > 1 && g.sd < 3){ g.sd++; g.ti = g.turns.length - 1; lead.forEach(t => g.turns.push({r:4, t})); return setup(); }
      g.winners = lead; g.ph = "over"; g.cur = null; return true; };
    function setup(){   // the next turn that has someone to describe
      while(++g.ti < g.turns.length){ const T = g.turns[g.ti], mem = o.members(T.t); if(!mem.length) continue;
        const d = mem[g.dIdx[T.t]++ % mem.length], R = RND[T.r];
        g.cur = {team:T.t, desc:d, round:T.r, rname:R.name, val:R.val, lvl:R.lvl, secs:secsFor(T.r), card:null, skipsLeft:o.skips, res:[], dl:0}; g.ph = "ready"; return true; }
      return finish(); }
    const add = (r, pts, extra) => { const c = g.cur; c.res.push(Object.assign({w:c.card.w, r, pts}, extra || {})); g.scores[c.team] += pts; };
    const endTurn = () => { g.ph = "recap"; g.hist.push({team:g.cur.team, desc:g.cur.desc, round:g.cur.round, res:g.cur.res}); };
    g.start = now => { if(g.ph !== "ready" || !g.cur) return false; draw(); g.ph = "run"; g.cur.dl = now + g.cur.secs * 1000; return true; };
    g.got = now => { if(g.ph !== "run" || now >= g.cur.dl) return false; add("got", g.cur.val); draw(); return true; };
    g.skip = now => { if(g.ph !== "run" || now >= g.cur.dl || g.cur.skipsLeft <= 0) return false; g.cur.skipsLeft--; add("skip", 0); draw(); return true; };
    /* team = the buzzing player's team, b = 0..4 a banned word, 5 the word itself, 6 other foul; by = that player's id. The first buzz ends the card. */
    g.buzz = (team, b, by, now) => { if(g.ph !== "run" || now >= g.cur.dl || team == null || team === g.cur.team || !(b >= 0 && b <= 6)) return false;
      const c = g.cur; add("buzz", -Math.round(c.val / 2), {word:b < 5 ? c.card.ban[b] : FOUL[b - 5], by:by || null}); draw(); return true; };
    g.tick = (now, force) => { if(g.ph !== "run" || (!force && now < g.cur.dl)) return false; g.cur.res.push({w:g.cur.card.w, r:"time", pts:0}); endTurn(); return true; };
    g.undo = i => { const e = g.ph === "recap" && g.cur && g.cur.res[i]; if(!e || (e.r !== "got" && e.r !== "buzz")) return false; g.scores[g.cur.team] -= e.pts; e.pts = 0; e.r = "void"; return true; };
    g.next = () => g.ph === "recap" ? setup() : false;
    g.tally = () => { const t = {got:0, skip:0, buzz:0}; if(g.cur) g.cur.res.forEach(e => { if(t[e.r] != null) t[e.r]++; }); return t; };
    g.stats = () => { const d = {}, b = {}; g.hist.forEach(h => { h.res.forEach(e => { if(e.r === "got") d[h.desc] = (d[h.desc] || 0) + 1; if(e.r === "buzz" && e.by) b[e.by] = (b[e.by] || 0) + 1; }); }); return {desc:d, buz:b}; };
    g.last = () => g.ph === "recap" && g.ti >= g.turns.length - 1;
    setup(); return g; }
  return {Game, RND, FOUL};
})();
/*@end-rules*/

const TB = {cfg:null, room:null, players:[], tm:{}, seenT:{}, phase:"lobby", g:null, vc:0, since:0, busy:false, poll:null, tmr:null, psig:"", relay:null, flash:null, sung:false, n:0, seen:store.get("jn_tbSeen", {})};
TB.cfg = Object.assign({teams:2, tpr:2, secs:60, lsecs:30, skips:3, names:["Koshari", "Feteer", "Konafa", "Basbousa"], packs:{}}, store.get("jn_tbCfg", {}));
const tbSave = () => store.set("jn_tbCfg", TB.cfg);
const TB_PACKS = [["everyday", "Everyday"], ["pop", "Pop culture"], ["egypt", "Egypt & Arab"], ["football", "Football"], ["spicy", "Spicy"]];
const TB_COL = ["#e3263b", "#4fb3d9", "#7bd88f", "#c78bff"];
const tbOn = k => k in TB.cfg.packs ? !!TB.cfg.packs[k] : k !== "spicy";
const tbPick = a => a[Math.floor(Math.random() * a.length)];
const tbUrl = () => new URL(`t?r=${TB.room}`, location.href).href;
const tbName = p => { const x = TB.players.find(y => y.p === p); return x ? x.n : ""; };
const tbTeamName = t => "Team " + (TB.cfg.names[t] || "").trim();
const tbMembers = t => TB.players.filter(x => TB.tm[x.p] === t);
const tbClock = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/* ---------- cards ---------- */
function tbDraw(lvl){
  const packs = TB_PACKS.map(x => x[0]).filter(k => tbOn(k) && TBC[k]); let pool = [];
  packs.forEach(k => TBC[k].forEach((c, i) => { if(c.lvl === lvl) pool.push([k, i]); }));
  if(!pool.length) packs.forEach(k => TBC[k].forEach((c, i) => pool.push([k, i])));
  let ok = pool.filter(([k, i]) => !(TB.seen[k] || []).includes(i));
  if(!ok.length){ pool.forEach(([k]) => { TB.seen[k] = (TB.seen[k] || []).filter(i => TBC[k][i].lvl !== lvl); }); ok = pool; }
  const [k, i] = tbPick(ok); (TB.seen[k] = TB.seen[k] || []).push(i); store.set("jn_tbSeen", TB.seen); const c = TBC[k][i]; return {w:c.w, ban:c.ban.slice()}; }

/* ---------- teams ---------- */
function tbSync(){   // keeps every player on a team: a team picked on the phone counts once, the rest go to the smallest team
  const n = TB.cfg.teams, ids = new Set(TB.players.map(x => x.p)); Object.keys(TB.tm).forEach(p => { if(!ids.has(p)) delete TB.tm[p]; });
  const size = t => TB.players.filter(x => TB.tm[x.p] === t).length;
  TB.players.forEach(x => { const t = x.t;
    if(Number.isInteger(t) && t >= 0 && t < n && TB.seenT[x.p] !== t){ TB.tm[x.p] = t; TB.seenT[x.p] = t; return; }
    if(Number.isInteger(t)) TB.seenT[x.p] = t;
    if(!(TB.tm[x.p] >= 0 && TB.tm[x.p] < n)){ let b = 0; for(let k = 1; k < n; k++) if(size(k) < size(b)) b = k; TB.tm[x.p] = b; } }); }
function tbShuffle(){ const ps = TB.players.slice(); for(let i = ps.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
  ps.forEach((x, i) => { TB.tm[x.p] = i % TB.cfg.teams; TB.seenT[x.p] = x.t; }); tbRender(); tbPost(); }

/* ---------- talking to the phones ---------- */
function tbPub(){
  const g = TB.g, names = {}; TB.players.forEach(x => names[x.p] = x.n);
  const teams = Array.from({length:TB.cfg.teams}, (_, t) => ({n:TB.cfg.names[t], m:tbMembers(t).map(x => x.p)}));
  if(!g) return {ph:"lobby", nt:TB.cfg.teams, teams, names, tm:TB.tm};
  const c = g.cur, pub = {ph:g.ph, nt:g.nt, teams, names, tm:TB.tm, scores:g.scores};
  if(c){ Object.assign(pub, {round:c.round, rname:c.rname, val:c.val, team:c.team, desc:c.desc, secs:c.secs, skipsLeft:c.skipsLeft, tally:g.tally(), left:g.ph === "run" ? Math.max(0, (c.dl - Date.now()) / 1000) : c.secs});
    if(g.ph === "recap") pub.recap = c.res.map(e => ({w:e.w, r:e.r, pts:e.pts})); }
  if(g.ph === "over") pub.winners = g.winners;
  return pub; }
function tbPost(){
  if(RELAY !== true) return; const g = TB.g, priv = {}, pub = tbPub(); pub.v = ++TB.vc;
  if(g && g.ph === "run") TB.players.forEach(x => { const t = TB.tm[x.p]; if(x.p === g.cur.desc || t !== g.cur.team) priv[x.p] = {card:{w:g.cur.card.w, ban:g.cur.card.ban}}; });
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:TB.room, crd:{pub, priv}})}).catch(() => {}); }
async function tbPoll(){ if($("#tbo").hidden || TB.busy) return; TB.busy = true;
  try{
    if(TB.relay !== RELAY){ TB.relay = RELAY; if(TB.phase === "lobby") tbRender(); }
    if(RELAY !== true) return;
    if(TB.phase === "lobby" || ++TB.n % 5 === 0){   // the player list changes rarely: every poll in the lobby, every fifth one in a game (the moves are read on every poll)
      const j = await (await fetch(`api/players?r=${encodeURIComponent(TB.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n, t:x.t})), sig = JSON.stringify(ps);
      if(sig !== TB.psig){ TB.psig = sig; TB.players = ps; tbSync(); if(TB.phase === "lobby"){ tbRender(); tbPost(); } else { if(TB.g && TB.g.ph !== "run") tbPost(); tbRender(); } } }
    const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(TB.room)}&since=${TB.since}`, {cache:"no-store"})).json(); TB.since = a.n;
    for(const x of a.acts || []){ const g = TB.g; if(!g || x.v !== TB.vc || !TB.players.some(y => y.p === x.p)) continue;
      if(tbAct(x.p, x.a || {})){ tbChanged(); break; } } }   // one move per version: the card has moved on after the first
  catch(e){} finally { TB.busy = false; } }
function tbAct(p, a){ const g = TB.g, c = g.cur, now = Date.now(); if(!c) return false;
  if(a.k === "start") return p === c.desc && g.start(now);
  if(a.k === "got") return p === c.desc && g.got(now);
  if(a.k === "skip") return p === c.desc && g.skip(now);
  if(a.k === "buzz"){ const ok = g.buzz(TB.tm[p], a.b | 0, p, now); if(ok) tbFlash(g.cur.res[g.cur.res.length - 1], TB.tm[p]); return ok; }
  return false; }
function tbFlash(e, team){ TB.flash = {w:e.word, by:tbName(e.by), team, until:Date.now() + 2200}; try{ Snd.buzz(); }catch(x){} }

/* ---------- the flow ---------- */
function tbStart(){
  if(RELAY !== true || !TB.players.length) return; for(let t = 0; t < TB.cfg.teams; t++) if(tbMembers(t).length < 2) return; stopSiu();
  TB.g = TBR.Game({teams:TB.cfg.teams, tpr:TB.cfg.tpr, secs:TB.cfg.secs, lsecs:TB.cfg.lsecs, skips:TB.cfg.skips, members:t => tbMembers(t).map(x => x.p), draw:tbDraw});
  TB.phase = "play"; TB.sung = false; TB.flash = null; tbChanged(); }
function tbChanged(){ const g = TB.g;
  if(g.ph === "over" && !TB.sung){ TB.sung = true; playWinSiu(); }
  tbPost(); tbRender(); }
function tbAgain(){ stopSiu(); TB.g = null; TB.phase = "lobby"; TB.flash = null; tbRender(); tbPost(); }
function tbTick(){ const g = TB.g; if(!g) return; const now = Date.now();
  if(TB.flash && now >= TB.flash.until){ TB.flash = null; tbRender(); return; }
  if(g.ph !== "run") return; const left = (g.cur.dl - now) / 1000;
  const cl = $("#tbClock"); if(cl) cl.textContent = tbClock(left);
  const ring = $("#tbRing"); if(ring) ring.style.setProperty("--p", Math.max(0, Math.min(100, left / g.cur.secs * 100)) + "%"); if(cl) cl.classList.toggle("low", left <= 10);
  if(g.tick(now)) tbChanged(); }

/* ---------- screens ---------- */
function tbEnter(){ if(S.mode === "taboo") return; S.mode = "taboo"; document.body.classList.add("tbmode"); }
function tbLeave(){ if(S.mode !== "taboo") return; stopSiu(); clearInterval(TB.poll); clearInterval(TB.tmr); TB.poll = TB.tmr = null; TB.g = null; TB.phase = "lobby"; S.mode = null; document.body.classList.remove("tbmode"); $("#tbo").hidden = true; }
function tbShow(){ tbEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#cno","#dco","#lbo","#slo","#hdo"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  TB.room = newRoom(); TB.players = []; TB.tm = {}; TB.seenT = {}; TB.phase = "lobby"; TB.g = null; TB.since = 0; TB.relay = RELAY; TB.psig = ""; TB.sung = false; TB.flash = null; TB.vc = 0;
  $("#tbo").hidden = false; tbRender(); window.scrollTo(0, 0); tbPost();
  clearInterval(TB.poll); TB.poll = setInterval(tbPoll, 400); clearInterval(TB.tmr); TB.tmr = setInterval(tbTick, 250); tbPoll(); }
const tbSeg = (key, opts, cur) => `<div class="tbseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const tbBulbs = () => `<div class="tbbulbs"></div>`;
function tbScores(g){ return `<div class="tbscores">${g.scores.map((s, t) => `<div class="tbsc${g.cur && g.cur.team === t && g.ph !== "over" ? " on" : ""}" style="--c:${TB_COL[t]}"><small>${esc(tbTeamName(t))}</small><b>${s}</b></div>`).join("")}</div>`; }
function tbRecap(g){ const c = g.cur, tot = c.res.reduce((a, e) => a + e.pts, 0), lab = {got:"Got it", skip:"Skipped", buzz:"Buzzed", time:"Time ran out", void:"Undone"};
  return `<div class="tbrecap"><h2>${esc(tbTeamName(c.team))} · ${tot >= 0 ? "+" : ""}${tot}</h2><div class="tbwho">${esc(tbName(c.desc))} described ${c.res.length} card${c.res.length === 1 ? "" : "s"}</div>
    <ul>${c.res.map((e, i) => `<li class="r-${e.r}"><span class="w">${esc(e.w)}</span><span class="l">${lab[e.r]}${e.r === "buzz" ? ` on “${esc(e.word)}”${e.by ? " by " + esc(tbName(e.by)) : ""}` : ""}</span><b>${e.pts > 0 ? "+" : ""}${e.pts || ""}</b>${e.r === "got" || e.r === "buzz" ? `<button class="tbbtn small ghost" data-undo="${i}">Undo</button>` : "<i></i>"}</li>`).join("") || `<li><span class="w">No cards played</span></li>`}</ul></div>`; }
function tbOver(g){ const order = g.scores.map((s, t) => [t, s]).sort((a, b) => b[1] - a[1]), st = g.stats(), top = o => { const e = Object.entries(o).sort((a, b) => b[1] - a[1])[0]; return e ? `${esc(tbName(e[0]))} (${e[1]})` : "—"; };
  const w = g.winners.map(t => esc(tbTeamName(t))).join(" and ");
  return `<div class="tbover"><div class="tbwin">${w}<span>${g.winners.length > 1 ? "share the win" : "wins the night"}</span></div>
    <ol class="tbplace">${order.map(([t, s], i) => `<li style="--c:${TB_COL[t]}"><b>${i + 1}</b><span>${esc(tbTeamName(t))}</span><em>${s}</em></li>`).join("")}</ol>
    <p class="tbbrag">Best describer: <b>${top(st.desc)}</b> · Sharpest buzzer: <b>${top(st.buz)}</b></p></div>`; }
function tbCtl(g){ const out = [];
  if(g.ph === "ready") out.push(`<button class="tbbtn go small" data-act="start">Start the clock</button>`);
  if(g.ph === "run"){ out.push(`<button class="tbbtn small" data-act="got">Got it</button>`); if(g.cur.skipsLeft > 0) out.push(`<button class="tbbtn small" data-act="skip">Skip</button>`); out.push(`<button class="tbbtn ghost small" data-act="end">End turn</button>`); }
  if(g.ph === "recap") out.push(`<button class="tbbtn go small" data-act="next">${g.last() ? "See the result" : "Next turn"}</button>`);
  if(g.ph === "over") out.push(`<button class="tbbtn go small" data-act="again">Play again</button>`);
  out.push(`<span class="gap"></span><button class="tbbtn ghost small" data-act="end-game">End game</button>`); return out.join(""); }
function tbRender(){
  const el = $("#tbBody"), g = TB.g;
  if(!g){ const off = RELAY !== true, ps = TB.players, c = TB.cfg, small = [...Array(c.teams).keys()].some(t => tbMembers(t).length < 2), ok = !off && !small;
    el.innerHTML = `<div class="tbhead"><div class="tbbadge">Game mode</div><h1>Taboo</h1><p class="sub">Describe the word on your phone without saying any of the banned words. Your team shouts guesses, the other teams buzz you when you slip.</p></div>
      <div class="tbgrid">
      <div class="tbpanel">${off
        ? `<div class="tbeye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "The card has to stay private on each phone, so Taboo only runs where everyone can join with a code."}</p>`
        : `<div class="tbeye">Scan to join</div><div id="tbQr" class="tbqr"></div><p class="note">Everyone scans once, types a name and taps their team. Keep the page open for the whole game.</p>`}</div>
      <div class="tbpanel"><div class="tbeye">Teams</div>${off ? `<p class="note">Waiting for the connection.</p>` : `<div class="tbteams">${[...Array(c.teams).keys()].map(t => `<div class="tbteam" style="--c:${TB_COL[t]}"><input class="tbname" data-name="${t}" maxlength="14" value="${esc(c.names[t])}" aria-label="Team ${t + 1} name"><h4>${tbMembers(t).length} player${tbMembers(t).length === 1 ? "" : "s"}</h4>${tbMembers(t).length ? `<ul>${tbMembers(t).map(x => `<li><button data-kick="${esc(x.p)}" title="Remove ${esc(x.n)}">${esc(x.n)}</button></li>`).join("")}</ul>` : `<p class="note">Waiting…</p>`}</div>`).join("")}</div>
        <p class="note">Each team needs 2 or more players. Players can switch team on their phone. Tap a name to remove that player.</p><button class="tbbtn small" id="tbShuffle" ${ps.length ? "" : "disabled"}>Shuffle teams</button>`}</div>
      <div class="tbpanel"><div class="tbeye">Teams playing</div>${tbSeg("teams", [[2, "2"], [3, "3"], [4, "4"]], c.teams)}
        <div class="tbeye">Turns per team per round</div>${tbSeg("tpr", [[1, "1"], [2, "2"], [3, "3"], [4, "4"]], c.tpr)}
        <div class="tbeye">Turn length</div>${tbSeg("secs", [[45, "45 s"], [60, "60 s"], [90, "90 s"]], c.secs)}
        <div class="tbeye">Lightning round</div>${tbSeg("lsecs", [[20, "20 s"], [30, "30 s"], [45, "45 s"]], c.lsecs)}
        <div class="tbeye">Skips per turn</div>${tbSeg("skips", [[0, "None"], [3, "3"], [5, "5"], [99, "Unlimited"]], c.skips)}
        <div class="tbeye">Word packs</div><div class="tbseg">${TB_PACKS.map(([k, t]) => `<button data-pack="${k}" aria-pressed="${tbOn(k)}">${t}</button>`).join("")}</div>
        <p class="note">Saying the word in Arabic or English counts as a foul. A tie on top plays sudden death.</p>
        ${small && !off ? `<p class="note warn">Every team needs at least 2 players to start.</p>` : ""}
        <button class="tbbtn go" id="tbGo" ${ok ? "" : "disabled"}>Start</button></div></div>`;
    const q = $("#tbQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!TB.g && !$("#tbo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:tbUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const c = g.cur, run = g.ph === "run", left = run ? (c.dl - Date.now()) / 1000 : c ? c.secs : 0, t = g.tally();
  const mid = g.ph === "recap" ? tbRecap(g) : g.ph === "over" ? tbOver(g) : `<div class="tbmid"><div class="tbon"><div class="who">${g.ph === "ready" ? "Up next" : "Describing"}</div><div class="tbtn" style="color:${TB_COL[c.team]}">${esc(tbTeamName(c.team))}</div><div class="desc">${esc(tbName(c.desc))}</div></div>
      <div class="tbring" id="tbRing" style="--p:${run ? Math.max(0, Math.min(100, left / c.secs * 100)) : 100}%"><b id="tbClock" class="${run && left <= 10 ? "low" : ""}">${tbClock(left)}</b></div>
      <div class="tbtally"><div><i>${t.got}</i>Got it</div><div><i>${t.skip}</i>Skipped</div><div><i>${t.buzz}</i>Buzzed</div></div></div>
      ${g.ph === "ready" ? `<p class="tbhint">${esc(tbName(c.desc))}: tap Start on your phone when you are ready. Everyone else, no peeking.</p>` : ""}`;
  el.innerHTML = `<div class="tbtv"><div class="tbin${TB.flash ? " flash" : ""}">${tbBulbs()}
    <div class="tbtop"><span class="tbonair${TB.flash ? " lit" : ""}">On Air</span><span class="tbrnd">${c ? `Round ${c.round} · ${esc(c.rname)} · ${c.val} a card` : "Final scores"}</span></div>
    ${mid}${g.ph === "over" ? "" : tbScores(g)}
    ${TB.flash ? `<div class="tbbuzz"><b>BUZZ!</b><span>${esc(TB.flash.w)}</span>${TB.flash.by ? `<em>${esc(TB.flash.by)} · ${esc(tbTeamName(TB.flash.team))}</em>` : ""}</div>` : ""}
    <div class="tbctl">${tbCtl(g)}</div>${tbBulbs()}</div></div>`; tbTick(); }
$("#tbo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ TB.cfg[set.dataset.set] = +set.dataset.v; if(set.dataset.set === "teams") tbSync(); tbSave(); tbRender(); tbPost(); return; }
  const pk = e.target.closest("[data-pack]"); if(pk){ const k = pk.dataset.pack, on = !tbOn(k); TB.cfg.packs[k] = on; if(!TB_PACKS.some(x => tbOn(x[0]))) TB.cfg.packs[k] = true; tbSave(); tbRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:TB.room, p:kick.dataset.kick})}).catch(() => {});
    TB.players = TB.players.filter(x => x.p !== kick.dataset.kick); tbSync(); tbRender(); tbPost(); return; }
  if(e.target.closest("#tbShuffle")){ tbShuffle(); return; }
  if(e.target.closest("#tbGo")){ tbStart(); return; }
  if(e.target.closest("#tbHome")){ leaveAsk(cfLive(TB), "Taboo"); return; }
  const un = e.target.closest("[data-undo]"); if(un && TB.g){ if(TB.g.undo(+un.dataset.undo)) tbChanged(); return; }
  const act = e.target.closest("[data-act]"); if(!act || !TB.g) return; const a = act.dataset.act, g = TB.g, now = Date.now();
  if(a === "start"){ if(g.start(now)) tbChanged(); }
  else if(a === "got"){ if(g.got(now)) tbChanged(); }
  else if(a === "skip"){ if(g.skip(now)) tbChanged(); }
  else if(a === "end"){ if(g.tick(now, true)) tbChanged(); }
  else if(a === "next"){ if(g.next()) tbChanged(); }
  else if(a === "again" || a === "end-game") tbAgain(); });
$("#tbo").addEventListener("input", e => { const n = e.target.dataset && e.target.dataset.name; if(n == null) return; TB.cfg.names[+n] = e.target.value.slice(0, 14); tbSave(); tbPost(); });
$("#modeTb").onclick = tbShow;
