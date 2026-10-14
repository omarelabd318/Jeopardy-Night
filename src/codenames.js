/* 6.82 (Omar): Codenames, the word-grid party game as a game mode. Two teams, Red and Blue, each with a spymaster. The TV shows a 5 by 5 grid of words; each team's spymaster sees the secret key on their
   phone (which squares are Red, Blue, neutral and the one assassin) and gives a one-word hint plus a number; the team taps the squares they think match (tap, then Confirm) on their phones.
   Phones join once with a name and a team (cn.html at /n?r=ROOM, the same join step as Imposter and Psych). The laptop is the referee: it holds the key, posts the board to the relay
   (POST /api/crd, the same relay the card modes use: pub = what everyone sees, priv = the key, sent only to the two spymasters) and reads the phones' moves back (GET /api/crdacts).
   Rules: 9 words for the team that starts, 8 for the other, 7 neutral, 1 assassin. A turn is one hint then up to number+1 guesses (0 and the infinity chip mean no limit); a wrong colour, a neutral
   or End turn passes the turn; the assassin loses that board only. The game rejects hints that are on the board or part of a board word (cnHintErr, the phone page checks the same rule).
   Match: 1 board, best of 3 (default) or best of 5; the other team starts the next board and the spymasters rotate. Winner screen plays the Siuuu clip.
   Looks (his pick of three previews, the first two kept): "mission" Mission Control (default) and "souq" Souq Tiles. A look is only a set of CSS variables on #cno / body[data-look] on the phone page.
   Words: v4work/codenames/words-*.json (embedded as CNW by build.js): Classic, Egypt & Arab, Pop culture, Football; the 25 are drawn evenly from the ticked packs and don't repeat on this device
   until a pack runs out (jn_cnSeen). Off the Cloudflare link it still plays on one screen: click a square to pick it and click Confirm, type the hint on the laptop, hold "Peek at the key".
   Setup is saved on this device in jn_cnCfg; the game is not saved. It doesn't use the clue card or the team scores. app.js only calls cnLeave from showHome.
   To remove: delete this file, cn.html, v4work/codenames/, the 6.82 CSS block and #cno section in head.html, the Codenames button, the /n route in worker/index.js, the CNW lines in build.js,
   cn.html in wrangler.jsonc and the cnLeave() call in showHome. */
const CN = {cfg:null, room:null, players:[], teams:{}, phase:"lobby", g:null, relay:null, poll:null, tm:null, since:0, busy:false, vc:0, vol:[null, null], psig:"", hist:[], sung:false, seen:store.get("jn_cnSeen", {})};
CN.cfg = Object.assign({packs:["classic", "egypt"], match:3, start:"rand", spy:"vol", timer:0, confirm:true, look:"mission"}, store.get("jn_cnCfg", {}));
const cnSave = () => store.set("jn_cnCfg", CN.cfg);
const CN_TEAM = ["Red", "Blue"], CN_KEYC = {r:"red", b:"blue", n:"neu", a:"ass"};
const CN_PACKS = [["classic", "Classic"], ["egypt", "Egypt & Arab"], ["pop", "Pop culture"], ["football", "Football"]];
const CN_LOOKS = [["mission", "Mission Control"], ["souq", "Souq Tiles"]];
const cnShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cnNorm = x => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const cnUrl = () => new URL(`n?r=${CN.room}`, location.href).href;
const cnName = p => { const x = CN.players.find(y => y.p === p); return x ? x.n : ""; };
const cnLocal = () => RELAY !== true;
const cnUnl = h => !h || h.n === 0 || h.n >= 99;

/* ---------- the rules ---------- */
function cnHintErr(g, w){   // the same rule is in cn.html
  w = String(w || "").trim(); if(!w || /\s/.test(w)) return "One word only."; const n = cnNorm(w); if(n.length < 2) return "That word is too short.";
  for(let i = 0; i < 25; i++){ if(g.rev[i]) continue; const b = cnNorm(g.words[i]); if(!b) continue;
    if(n === b) return "That word is on the board."; if(Math.min(n.length, b.length) >= 3 && (n.includes(b) || b.includes(n))) return `Too close to ${g.words[i]}.`; }
  return ""; }
function cnWords(){
  const use = CN.cfg.packs.filter(k => CNW[k] && CNW[k].length); if(!use.length) use.push("classic");
  const per = use.map(() => Math.floor(25 / use.length)); for(let r = 25 - per.reduce((a, b) => a + b, 0); r > 0; r--) per[Math.floor(Math.random() * use.length)]++;
  const out = [], seen = new Set(), take = (k, n) => { const pool = CNW[k]; let ok = pool.filter(w => !(CN.seen[k] || []).includes(w) && !seen.has(w.toLowerCase()));
    if(ok.length < n){ CN.seen[k] = []; ok = pool.filter(w => !seen.has(w.toLowerCase())); }
    cnShuffle(ok).slice(0, n).forEach(w => { out.push(w); seen.add(w.toLowerCase()); (CN.seen[k] = CN.seen[k] || []).push(w); }); };
  use.forEach((k, j) => take(k, per[j]));
  for(let g = 0; out.length < 25 && g < 40; g++) take(use[g % use.length], 1);
  store.set("jn_cnSeen", CN.seen); return cnShuffle(out).slice(0, 25); }
function cnBoard(no, wins, start, spies){
  const key = Array(25).fill("n"), idx = cnShuffle([...Array(25).keys()]), a = start === 0 ? "r" : "b", b = start === 0 ? "b" : "r";
  idx.slice(0, 9).forEach(i => key[i] = a); idx.slice(9, 17).forEach(i => key[i] = b); key[idx[17]] = "a";
  return {v:0, board:no, wins, start, turn:start, phase:"hint", words:cnWords(), key, rev:Array(25).fill(false), hint:null, tried:0, pend:null, spies, dl:0, bw:null, why:null, last:null}; }
const cnRem = (g, tm) => g.key.filter((k, i) => k === (tm === 0 ? "r" : "b") && !g.rev[i]).length;
const cnLimit = g => cnUnl(g.hint) ? null : g.hint.n + 1 - g.tried;
const cnSnap = () => { CN.hist.push(JSON.stringify(CN.g)); if(CN.hist.length > 40) CN.hist.shift(); };
function cnEndTurn(g){ g.turn = 1 - g.turn; g.phase = "hint"; g.hint = null; g.tried = 0; g.pend = null; g.dl = 0; }
function cnOver(g, winner, why){ g.bw = winner; g.why = why; g.wins[winner]++; g.pend = null; g.dl = 0; g.phase = g.wins[winner] >= Math.ceil(CN.cfg.match / 2) ? "over" : "boardover"; }
function cnReveal(i){ const g = CN.g; cnSnap(); g.rev[i] = true; g.pend = null; g.tried++; const k = g.key[i]; g.last = {i, k};
  if(k === "a"){ cnOver(g, 1 - g.turn, "assassin"); return true; }
  if(k === "r" || k === "b"){ const owner = k === "r" ? 0 : 1;
    if(cnRem(g, owner) === 0){ cnOver(g, owner, "found"); return true; }
    if(owner === g.turn){ const l = cnLimit(g); if(l !== null && l <= 0) cnEndTurn(g); return true; } }
  cnEndTurn(g); return true; }
/* who = {team, spy, name} for a phone, {host:true} for the laptop. Returns true when the board changed. */
function cnAct(who, a){ const g = CN.g; if(!g) return false; const tm = who.host ? g.turn : who.team;
  if(g.phase === "hint"){ if(a.k !== "hint" || tm !== g.turn || !(who.host || who.spy)) return false;
    const w = String(a.w || "").trim().slice(0, 24), n = a.n >= 99 ? 99 : Math.max(0, Math.min(9, a.n | 0)); if(cnHintErr(g, w)) return false;
    cnSnap(); g.hint = {w:w.toUpperCase(), n}; g.tried = 0; g.pend = null; g.phase = "guess"; g.dl = CN.cfg.timer ? Date.now() + CN.cfg.timer * 1000 : 0; return true; }
  if(g.phase !== "guess" || tm !== g.turn || who.spy) return false;
  if(a.k === "tap"){ const i = a.i | 0; if(i < 0 || i > 24 || g.rev[i]) return false;
    if(!CN.cfg.confirm) return cnReveal(i);
    g.pend = g.pend && g.pend.i === i ? null : {i, by:who.name || "Host"}; return true; }
  if(a.k === "ok") return g.pend ? cnReveal(g.pend.i) : false;
  if(a.k === "end"){ if(g.tried < 1) return false; cnSnap(); cnEndTurn(g); return true; }
  return false; }

/* ---------- teams and spymasters ---------- */
function cnTeams(){ const t = {}, n = [0, 0];
  CN.players.forEach(x => { if(x.t === 0 || x.t === 1){ t[x.p] = x.t; n[x.t]++; } });
  CN.players.forEach(x => { if(!(x.p in t)){ const k = n[0] <= n[1] ? 0 : 1; t[x.p] = k; n[k]++; } }); return t; }
const cnMembers = tm => CN.players.filter(x => CN.teams[x.p] === tm);
function cnPickSpies(first){ return [0, 1].map(tm => { const mem = cnMembers(tm); if(!mem.length) return null;
  if(first){ const v = CN.cfg.spy === "vol" ? CN.vol[tm] : null; return v && mem.some(x => x.p === v) ? v : cnShuffle(mem.slice())[0].p; }
  const i = mem.findIndex(x => x.p === CN.g.spies[tm]); return mem[(i + 1) % mem.length].p; }); }

/* ---------- talking to the phones ---------- */
function cnPub(g){
  const names = {}; CN.players.forEach(x => names[x.p] = x.n); const done = g.phase === "boardover" || g.phase === "over";
  return {v:g.v, look:CN.cfg.look, ph:g.phase, turn:g.turn, hint:g.hint, tried:g.tried, limit:g.phase === "guess" ? cnLimit(g) : null, board:g.board, of:CN.cfg.match, wins:g.wins, start:g.start, words:g.words,
    rev:g.words.map((w, i) => g.rev[i] || done ? g.key[i] : null), shown:g.words.map((w, i) => g.rev[i]), left:[cnRem(g, 0), cnRem(g, 1)], pend:g.pend, spies:g.spies, teams:CN.teams, names, bw:g.bw, why:g.why, last:g.last, confirm:CN.cfg.confirm}; }
function cnPost(){
  if(RELAY !== true) return; const g = CN.g, priv = {};
  if(!g){ const names = {}; CN.players.forEach(x => names[x.p] = x.n);
    fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:CN.room, crd:{pub:{v:++CN.vc, look:CN.cfg.look, ph:"lobby", teams:CN.teams, names, spies:CN.vol, confirm:CN.cfg.confirm}, priv}})}).catch(() => {}); return; }
  g.v = ++CN.vc; g.spies.forEach((p, tm) => { if(p) priv[p] = {key:g.key.join(""), tm}; });
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:CN.room, crd:{pub:cnPub(g), priv}})}).catch(() => {}); }
async function cnPoll(){ if($("#cno").hidden || CN.busy) return; CN.busy = true;
  try{
    if(CN.relay !== RELAY){ CN.relay = RELAY; if(CN.phase === "lobby") cnRender(); }
    if(RELAY !== true) return;
    const j = await (await fetch(`api/players?r=${encodeURIComponent(CN.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n, t:x.t})), sig = JSON.stringify(ps), changed = sig !== CN.psig;
    CN.psig = sig; CN.players = ps; CN.teams = cnTeams();
    if(changed){ CN.vol = CN.vol.map((v, tm) => v && ps.some(x => x.p === v && CN.teams[x.p] === tm) ? v : null);
      if(CN.phase === "lobby"){ cnRender(); cnPost(); } else if(CN.g && cnSync()){ cnChanged(); } }
    const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(CN.room)}&since=${CN.since}`, {cache:"no-store"})).json(); CN.since = a.n; let ch = false;
    for(const x of a.acts || []){ const pl = CN.players.find(y => y.p === x.p); if(!pl || x.v !== (CN.g ? CN.g.v : CN.vc)) continue;
      if(!CN.g){ if(x.a && x.a.k === "spy" && !CN.vol[CN.teams[x.p]]){ CN.vol[CN.teams[x.p]] = x.p; ch = true; } continue; }
      const tm = CN.teams[x.p], who = {team:tm, spy:CN.g.spies[tm] === x.p, name:pl.n}; if(cnAct(who, x.a || {})) ch = true; }
    if(ch){ if(CN.g) cnChanged(); else { cnRender(); cnPost(); } } }
  catch(e){} finally { CN.busy = false; } }
function cnSync(){ const g = CN.g; let ch = false;   // a spymaster who left is replaced by the next teammate
  g.spies.forEach((p, tm) => { if(p && CN.players.some(x => x.p === p && CN.teams[x.p] === tm)) return; const mem = cnMembers(tm); const n = mem.length ? mem[0].p : null; if(n !== p){ g.spies[tm] = n; ch = true; } }); return ch; }

/* ---------- the flow ---------- */
function cnStart(){
  const local = cnLocal();
  if(!local && (cnMembers(0).length < 2 || cnMembers(1).length < 2)) return;
  CN.sung = false; CN.hist = []; CN.g = cnBoard(1, [0, 0], CN.cfg.start === "rand" ? Math.floor(Math.random() * 2) : CN.cfg.start === "red" ? 0 : 1, local ? [null, null] : cnPickSpies(true)); CN.phase = "play"; cnChanged(); }
function cnChanged(){ const g = CN.g; cnPost(); cnRender(); if(g.phase === "over" && !CN.sung){ CN.sung = true; playWinSiu(); } }
function cnNextBoard(){ const g = CN.g; if(!g || g.phase !== "boardover") return; CN.hist = [];
  CN.g = cnBoard(g.board + 1, g.wins, 1 - g.start, cnLocal() ? [null, null] : cnPickSpies(false)); cnChanged(); }
function cnUndo(){ if(!CN.hist.length || !CN.g || CN.g.phase === "over") return; CN.g = JSON.parse(CN.hist.pop()); CN.g.dl = CN.g.phase === "guess" && CN.cfg.timer ? Date.now() + CN.cfg.timer * 1000 : 0; cnChanged(); }

/* ---------- screens ---------- */
function cnEnter(){ if(S.mode === "codenames") return; S.mode = "codenames"; document.body.classList.add("cnmode"); }
function cnLeave(){ if(S.mode !== "codenames") return; stopSiu(); clearInterval(CN.poll); clearInterval(CN.tm); CN.poll = CN.tm = null; CN.g = null; CN.phase = "lobby"; S.mode = null; document.body.classList.remove("cnmode"); $("#cno").hidden = true; }
function cnShow(){ cnEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  CN.room = newRoom(); CN.players = []; CN.teams = {}; CN.phase = "lobby"; CN.g = null; CN.since = 0; CN.relay = RELAY; CN.vol = [null, null]; CN.psig = ""; CN.hist = []; CN.sung = false;
  $("#cno").hidden = false; cnRender(); window.scrollTo(0, 0); cnPost();
  clearInterval(CN.poll); CN.poll = setInterval(cnPoll, 800); clearInterval(CN.tm); CN.tm = setInterval(cnTick, 250); cnPoll(); }
function cnTick(){ const g = CN.g; if(!g || g.phase !== "guess" || !g.dl) return;
  const f = $("#cnFill"); if(f) f.style.width = Math.max(0, Math.min(100, (g.dl - Date.now()) / (CN.cfg.timer * 10))) + "%";
  if(Date.now() >= g.dl){ cnSnap(); cnEndTurn(g); cnChanged(); } }
const cnSeg = (key, opts, cur) => `<div class="cnseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const cnWordCls = w => `style="--l:${Math.max(6, String(w).length)}"`;
function cnTile(g, i, peek){ const k = g.key[i], done = g.phase === "boardover" || g.phase === "over", rv = g.rev[i], p = g.pend && g.pend.i === i;
  return `<button class="t${rv ? " rv k-" + CN_KEYC[k] : done ? " sh k-" + CN_KEYC[k] : ""}${p ? " pend" : ""}${g.last && g.last.i === i && rv ? " last" : ""}" data-i="${i}" ${cnWordCls(g.words[i])}${peek && !rv ? ` data-k="${k}"` : ""}${rv || g.phase !== "guess" ? " disabled" : ""}><span>${esc(g.words[i])}</span>${p ? `<em>${esc(g.pend.by)}</em>` : ""}</button>`; }
function cnTeamHtml(g, tm){ const total = g.start === tm ? 9 : 8, left = cnRem(g, tm), sp = g.spies[tm], mem = cnMembers(tm), cls = tm === 0 ? "red" : "blue";
  return `<aside class="team ${cls}${g.turn === tm && (g.phase === "hint" || g.phase === "guess") ? " on" : ""}"><h3>${CN_TEAM[tm].toUpperCase()}</h3><div class="left">${left}</div><div class="lefts">agents left</div>
    <div class="pips">${Array.from({length:total}, (_, i) => `<i class="${i < total - left ? "off" : ""}"></i>`).join("")}</div>
    ${sp ? `<div class="spy">Spymaster<b>${esc(cnName(sp))}</b></div>` : ""}${mem.length ? `<ul>${mem.map(x => `<li>${esc(x.n)}</li>`).join("")}</ul>` : ""}</aside>`; }
function cnBanner(g){ const t = CN_TEAM[g.turn].toUpperCase(), cls = g.turn === 0 ? "red" : "blue";
  if(g.phase === "hint") return `<div class="cn-banner ${cls}"><span class="turn">${t}'S SPYMASTER</span><span class="hint dim">${cnLocal() ? "type the hint below" : "is thinking of a hint…"}</span></div>`;
  if(g.phase === "guess"){ const l = cnLimit(g);
    return `<div class="cn-banner ${cls}"><span class="turn">${t}'S TURN</span><span class="hint">${esc(g.hint.w)}<b>${g.hint.n >= 99 ? "∞" : g.hint.n}</b></span><span class="dots">${l === null ? "<small>no limit</small>" : Array.from({length:Math.max(0, l)}, () => "<i></i>").join("")}</span></div>`; }
  const w = CN_TEAM[g.bw], wc = g.bw === 0 ? "red" : "blue", lost = CN_TEAM[1 - g.bw];
  return `<div class="cn-banner ${wc}"><span class="turn">${g.phase === "over" ? "MATCH" : "BOARD " + g.board}</span><span class="hint">${g.why === "assassin" ? `${lost} hit the assassin` : `${w} found every agent`}</span><span class="turn">${w.toUpperCase()} WINS${g.phase === "over" ? "" : " THE BOARD"}</span></div>`; }
function cnCtl(g){ const out = [], local = cnLocal();
  if(g.phase === "hint" && local) out.push(`<form class="cnhint" id="cnHintForm" autocomplete="off"><input id="cnHintW" maxlength="24" placeholder="One-word hint" aria-label="Hint word"><select id="cnHintN" aria-label="Number">${[...Array(10).keys()].map(n => `<option>${n}</option>`).join("")}<option value="99">∞</option></select><button class="cnbtn go small">Send hint</button><span class="cnerr" id="cnErr"></span></form>`);
  if(g.phase === "guess"){ if(g.pend) out.push(`<button class="cnbtn go small" data-act="ok">Confirm ${esc(g.words[g.pend.i])}</button>`); if(g.tried >= 1) out.push(`<button class="cnbtn small" data-act="end">End turn</button>`); }
  if(g.phase === "boardover") out.push(`<button class="cnbtn go small" data-act="next">Next board</button>`);
  if(g.phase === "over") out.push(`<button class="cnbtn go small" data-act="again">Play again</button>`);
  if(local && (g.phase === "hint" || g.phase === "guess")) out.push(`<button class="cnbtn small" id="cnPeek">Hold to peek at the key</button>`);
  if(CN.hist.length && g.phase !== "over") out.push(`<button class="cnbtn ghost small" data-act="undo">Undo</button>`);
  out.push(`<span class="gap"></span><button class="cnbtn ghost small" data-act="end-game">End game</button>`); return out.join(""); }
function cnRender(){
  const el = $("#cnBody"), g = CN.g; $("#cno").dataset.look = CN.cfg.look;
  if(!g){ const ps = CN.players, c = CN.cfg, off = RELAY !== true, ok = off || (cnMembers(0).length >= 2 && cnMembers(1).length >= 2);
    el.innerHTML = `<div class="cnhead"><div class="cnbadge">Game mode</div><h1>Codenames</h1><p class="sub">Two teams, 25 words. Your spymaster sees which words are yours and gives one word and a number; find your agents and stay away from the assassin.</p></div>
      <div class="cngrid">
      <div class="cnpanel">${off
        ? `<div class="cneye">${RELAY === null ? "Checking the connection…" : "Playing on this screen"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Phones need the Cloudflare link. Here you can still play on this screen: type the hint on the laptop, click a word and Confirm, and hold Peek to show the key to the spymaster."}</p>`
        : `<div class="cneye">Scan to join</div><div id="cnQr" class="cnqr"></div><p class="note">Everyone scans once, types a name and picks Red or Blue. Keep the page open for the whole game.</p>`}</div>
      <div class="cnpanel"><div class="cneye">Teams</div>${off ? `<p class="note">The two teams are Red and Blue.</p>` : `<div class="cnteams">${[0, 1].map(tm => `<div class="cnteam ${tm ? "blue" : "red"}"><h4>${CN_TEAM[tm]} · ${cnMembers(tm).length}</h4>${cnMembers(tm).length ? `<ul>${cnMembers(tm).map(x => `<li><button data-star="${esc(x.p)}" title="Make ${esc(x.n)} the spymaster" aria-pressed="${CN.vol[tm] === x.p}">★</button><button data-kick="${esc(x.p)}" title="Remove ${esc(x.n)}">${esc(x.n)}</button></li>`).join("")}</ul>` : `<p class="note">Waiting…</p>`}</div>`).join("")}</div>
        <p class="note">Each team needs 2 or more players. A ★ marks the spymaster for the first board: players can volunteer on their phone, or tap a star. Tap a name to remove that player.</p>`}</div>
      <div class="cnpanel"><div class="cneye">Look</div>${cnSeg("look", CN_LOOKS, c.look)}
        <div class="cneye">Word packs</div><div class="cnseg">${CN_PACKS.map(([k, t]) => `<button data-pack="${k}" aria-pressed="${c.packs.includes(k)}">${t}</button>`).join("")}</div>
        <div class="cneye">Match</div>${cnSeg("match", [[1, "1 board"], [3, "Best of 3"], [5, "Best of 5"]], c.match)}
        <div class="cneye">Starting team</div>${cnSeg("start", [["rand", "Random"], ["red", "Red"], ["blue", "Blue"]], c.start)}
        <div class="cneye">Spymasters</div>${cnSeg("spy", [["vol", "Volunteer"], ["rand", "Random"]], c.spy)}
        <div class="cneye">Guess timer</div>${cnSeg("timer", [[0, "Off"], [60, "60 s"], [90, "90 s"], [120, "120 s"]], c.timer)}
        <div class="cneye">Picking a word</div>${cnSeg("confirm", [["1", "Tap, then Confirm"], ["0", "Single tap"]], c.confirm ? 1 : 0)}
        <button class="cnbtn go" id="cnGo" ${ok ? "" : "disabled"}>Start</button></div>
      </div>`;
    const q = $("#cnQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!CN.g && !$("#cno").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:cnUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const peek = cnLocal();
  el.innerHTML = `<div class="cntv"><div class="cnin">${cnBanner(g)}
    ${g.phase === "guess" && g.dl ? `<div class="cn-timer"><i id="cnFill" style="width:${Math.max(0, Math.min(100, (g.dl - Date.now()) / (CN.cfg.timer * 10)))}%"></i></div>` : `<div class="cn-timer none"></div>`}
    <div class="cn-mid">${cnTeamHtml(g, 0)}<div class="cn-grid" id="cnGrid">${g.words.map((w, i) => cnTile(g, i, peek)).join("")}</div>${cnTeamHtml(g, 1)}</div>
    <div class="cn-foot"><span class="cn-wins">Board ${g.board}${CN.cfg.match > 1 ? ` of best of ${CN.cfg.match} · Red ${g.wins[0]} – ${g.wins[1]} Blue` : ""}</span><div class="cnctl">${cnCtl(g)}</div></div></div></div>`; cnTick(); }
$("#cno").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; CN.cfg[k] = k === "confirm" ? v === "1" : (k === "look" || k === "start" || k === "spy") ? v : +v; cnSave(); cnRender(); cnPost(); return; }
  const pk = e.target.closest("[data-pack]"); if(pk){ const k = pk.dataset.pack, i = CN.cfg.packs.indexOf(k); if(i >= 0){ if(CN.cfg.packs.length > 1) CN.cfg.packs.splice(i, 1); } else CN.cfg.packs.push(k); cnSave(); cnRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:CN.room, p:kick.dataset.kick})}).catch(() => {});
    CN.players = CN.players.filter(x => x.p !== kick.dataset.kick); CN.teams = cnTeams(); cnRender(); cnPost(); return; }
  const star = e.target.closest("[data-star]"); if(star){ const p = star.dataset.star, tm = CN.teams[p]; CN.vol[tm] = CN.vol[tm] === p ? null : p; cnRender(); cnPost(); return; }
  if(e.target.closest("#cnGo")){ cnStart(); return; }
  if(e.target.closest("#cnHome")){ showHome(); return; }
  const tile = e.target.closest(".t[data-i]"); if(tile && CN.g){ if(cnAct({host:true}, {k:"tap", i:+tile.dataset.i})) cnChanged(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return; const a = act.dataset.act;
  if(a === "ok"){ if(cnAct({host:true}, {k:"ok"})) cnChanged(); }
  else if(a === "end"){ if(cnAct({host:true}, {k:"end"})) cnChanged(); }
  else if(a === "next") cnNextBoard();
  else if(a === "undo") cnUndo();
  else if(a === "again"){ stopSiu(); CN.g = null; CN.phase = "lobby"; CN.hist = []; cnRender(); cnPost(); }
  else if(a === "end-game"){ stopSiu(); CN.g = null; CN.phase = "lobby"; CN.hist = []; cnRender(); cnPost(); } });
$("#cno").addEventListener("submit", e => { if(e.target.id !== "cnHintForm") return; e.preventDefault(); const w = $("#cnHintW").value, err = cnHintErr(CN.g, w);
  if(err){ $("#cnErr").textContent = err; return; } if(cnAct({host:true}, {k:"hint", w, n:+$("#cnHintN").value})) cnChanged(); });
["mousedown", "touchstart"].forEach(t => $("#cno").addEventListener(t, e => { if(e.target.closest("#cnPeek")){ const g = $("#cnGrid"); if(g) g.classList.add("peek"); } }, {passive:true}));
["mouseup", "mouseleave", "touchend", "touchcancel"].forEach(t => $("#cno").addEventListener(t, () => { const g = $("#cnGrid"); if(g) g.classList.remove("peek"); }, {passive:true}));
$("#modeCn").onclick = cnShow;
