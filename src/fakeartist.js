/* 7.23 (Omar): Fake Artist, a drawing party game as a game mode. Everyone joins once from their phone (draw.html at /w?r=ROOM, one name). Each game the laptop picks a secret word and
   deals it to every phone, except one fake artist, who only sees the category (their card has the same layout but random letters where the word goes, plus a small "you're the fake artist"
   line). Then everyone draws the word on one shared canvas, in turn, one unbroken line each: finger down starts the line, lifting the finger ends the turn, no undo. The TV shows the canvas
   and each new line is drawn onto it as soon as the phone sends it. After 2 rounds everyone votes for the fake. If the fake gets the most votes (alone) they are caught and get one typed guess
   at the word; if not, 2 more rounds and a second vote. The fake can go first in round 1 (Omar's call, the order is a plain shuffle) and the order stays the same for the later rounds.
   Points (kept across games, first to 5 by default; 3, 5 or 7 in setup): caught and the guess is wrong, every real artist +1; caught and the guess is right, the fake +2; the fake escapes both
   votes, +3; every real artist whose last vote named the fake +1 on top. A typed guess that matches the word (or one of its listed spellings) is accepted by the game; otherwise the host taps
   Right or Wrong on the laptop. A turn waits 45 s for the finger (then it's skipped, and the host can skip sooner); a line is cut off after the turn length (10/15/20/30 s, default 15) and a
   line shorter than 3% of the canvas doesn't count (the phone asks for another). The winner screen plays the Siuuu clip.
   Look: Street Wall (his pick of three previews: Sketchbook, Gallery Opening, Street Wall; only this one is built): concrete wall, paper canvas with spray-glow lines, Bungee and marker lettering,
   yellow and magenta. The TV is one stage sized by --u (100 units = the screen's width at 16:9). draw.html (the phones) uses the same palette.
   The laptop is the referee. It posts the table with POST /api/crd (pub = what every phone may see, priv = each player's own card) and reads the phones' moves from GET /api/crdacts, the
   same generic relay Taboo and the card modes use; a stroke is sent as one move {k:"stroke", t, pts} (the move size limit in worker/index.js is larger for strokes). Lines are stored as
   up to 60 points on a 1000 x 750 grid. The real word is only in the posted table from the reveal on, and each phone's card only ever goes to that phone. Needs the Cloudflare link: there is no
   one-screen version (the card must be private and everyone needs a finger).
   Words: v4work/fakeartist/words.txt (edit this, then run python3 v4work/fakeartist/build-words.py to rewrite words.json, which build.js embeds as FAW): 10 categories, about 40 words each, easy or
   hard, with other accepted spellings for the guess. A word isn't dealt again on this device until its category runs out (jn_faSeen). Setup is saved on this device in jn_faCfg; a game is not saved.
   It doesn't use the clue card or the Jeopardy scores; app.js only calls faLeave from showHome.
   The rules and the state of a game live in FAR below (no screen code in it, so v4work/tools/fakeartist-test.js can load just that region).
   To remove: delete this file, draw.html, v4work/fakeartist/, v4work/tools/fakeartist-test.js and fakeartist-e2e.js, the 7.23 CSS block and #fao section in head.html, the Fake Artist button and the modeFa
   entry in title.js, the /w route and the stroke size line in worker/index.js, draw.html in wrangler.jsonc, the FAW line and 'fakeartist' in MODE_FILES in build.js and the faLeave() call in showHome. */

/*@rules*/
const FAR = (() => {
  const IDLE = 45, VOTE = 30, GUESS = 30, MIN_LEN = 30, MAXPTS = 60;
  const norm = x => String(x == null ? "" : x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9]+/g, "").replace(/s$/, "");
  function cleanPts(pts){   // a flat [x0,y0,x1,y1,...] list on the 1000 x 750 grid, or null if it isn't a real line
    if(!Array.isArray(pts) || pts.length % 2 || pts.length < 4 || pts.length > MAXPTS * 2) return null;
    const out = []; for(let i = 0; i < pts.length; i++){ const v = Math.round(Number(pts[i])); if(!Number.isFinite(v)) return null; out.push(Math.max(0, Math.min(i % 2 ? 750 : 1000, v))); }
    let len = 0; for(let i = 2; i < out.length; i += 2) len += Math.hypot(out[i] - out[i - 2], out[i + 1] - out[i - 1]);
    return len >= MIN_LEN ? out : null; }
  /* o = {players:[ids] (3 or more), word:{w, alt:[...]}, idle:seconds a turn waits for the finger, rand:() => 0..1} */
  function Game(o){
    const ids = o.players.slice(), n = ids.length; if(n < 3) return null;
    const rnd = o.rand || Math.random, idle = (o.idle || IDLE) * 1000;
    const sh = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const g = {ids, n, order:sh(ids.slice()), fake:ids[Math.floor(rnd() * n)], word:o.word, ph:"card", round:1, ti:0, strokes:[], votes:{}, vn:0, tally:{}, tid:1, dl:0, vdl:0, gdl:0, guess:"", outcome:null, deltas:null, caught:false, last:{}};
    const wanted = [norm(o.word.w)].concat((o.word.alt || []).map(norm));
    const match = t => { const k = norm(t); return !!k && wanted.includes(k); };
    const openVote = now => { g.ph = "vote"; g.vn++; g.votes = {}; g.vdl = now + VOTE * 1000; g.tid++; };
    const nextTurn = now => { g.ti++; if(g.ti >= n){ g.ti = 0; g.round++; if(g.round === 3 || g.round === 5){ openVote(now); return; } } g.tid++; g.dl = now + idle; };
    function finish(kind){   // kind: "escape" (the fake was never caught), "right" or "wrong" (the caught fake's guess)
      g.outcome = kind; g.ph = "reveal"; g.tid++; const d = {}; ids.forEach(p => d[p] = 0);
      if(kind === "escape") d[g.fake] += 3; else if(kind === "right") d[g.fake] += 2; else ids.forEach(p => { if(p !== g.fake) d[p] += 1; });
      ids.forEach(p => { if(p !== g.fake && g.last[p] === g.fake) d[p] += 1; }); g.deltas = d; }
    g.cur = () => g.ph === "draw" ? g.order[g.ti] : null;
    g.start = now => { if(g.ph !== "card") return false; g.ph = "draw"; g.tid++; g.dl = now + idle; return true; };
    g.stroke = (p, pts, now) => { if(g.ph !== "draw" || p !== g.cur()) return false; const c = cleanPts(pts); if(!c) return false; g.strokes.push({p, r:g.round, pts:c}); nextTurn(now); return true; };
    g.skip = now => { if(g.ph !== "draw") return false; nextTurn(now); return true; };
    g.vote = (p, o2) => { if(g.ph !== "vote" || !ids.includes(p) || !ids.includes(o2) || p === o2) return false; g.votes[p] = o2; return true; };
    g.allVoted = () => g.ph === "vote" && ids.every(p => g.votes[p]);
    g.endVote = now => { if(g.ph !== "vote") return false; const t = {}; ids.forEach(p => t[p] = 0); Object.values(g.votes).forEach(x => t[x]++);
      const mx = Math.max(...Object.values(t)), top = ids.filter(p => t[p] === mx); g.tally = t; g.last = Object.assign({}, g.votes);
      g.caught = mx > 0 && top.length === 1 && top[0] === g.fake;
      if(g.caught){ g.ph = "guess"; g.gdl = now + GUESS * 1000; g.tid++; } else if(g.vn === 1){ g.ph = "between"; g.tid++; } else finish("escape");
      return true; };
    g.cont = now => { if(g.ph !== "between") return false; g.ph = "draw"; g.tid++; g.dl = now + idle; return true; };
    g.sendGuess = t => { if(g.ph !== "guess") return false; g.guess = String(t || "").trim().slice(0, 40); if(match(g.guess)) finish("right"); else { g.ph = "judge"; g.tid++; } return true; };
    g.judge = ok => { if(g.ph !== "judge") return false; finish(ok ? "right" : "wrong"); return true; };
    g.tick = now => { if(g.ph === "draw" && now >= g.dl) return g.skip(now); if(g.ph === "vote" && now >= g.vdl) return g.endVote(now); if(g.ph === "guess" && now >= g.gdl){ finish("wrong"); return true; } return false; };
    return g; }
  return {Game, norm, cleanPts, IDLE, VOTE, GUESS};
})();
/*@end-rules*/

const FA = {cfg:null, room:null, players:[], col:{}, scores:{}, phase:"lobby", g:null, word:null, scr:"", vc:0, since:0, busy:false, poll:null, tmr:null, psig:"", relay:null, sung:false, n:0,
  seenCard:{}, anim:null, raf:0, auto:0, lastCat:null, scored:false, over:false, seen:store.get("jn_faSeen", {})};
FA.cfg = Object.assign({target:5, secs:15, diff:"mix", cats:{}}, store.get("jn_faCfg", {}));
const faSave = () => store.set("jn_faCfg", FA.cfg);
const FA_COL = ["#ff2e4c", "#1e90ff", "#1fcf5a", "#ffb300", "#a64dff", "#ff4fb8", "#00d4d4", "#ff7a1a", "#c6ff3d", "#f2f2f2"];
const faCats = () => Object.keys((typeof FAW !== "undefined" && FAW.cats) || {});
const faOn = id => FA.cfg.cats[id] !== false;
const faPick = a => a[Math.floor(Math.random() * a.length)];
const faUrl = () => new URL(`w?r=${FA.room}`, location.href).href;
const faName = p => { const x = FA.players.find(y => y.p === p); return x ? x.n : ""; };
const faCol = p => FA_COL[(FA.col[p] || 0) % FA_COL.length];
const faScr = t => { const V = "aeiou", C = "bcdfghjklmnprstvwyz"; return String(t).replace(/[A-Za-z]/g, (ch, i) => { const up = /[A-Z]/.test(ch), pool = i % 2 ? V : C, x = pool[Math.floor(Math.random() * pool.length)]; return up ? x.toUpperCase() : x; }); };

/* ---------- words ---------- */
function faWord(){
  const ids = faCats().filter(faOn); let opts = ids.filter(id => id !== FA.lastCat); if(!opts.length) opts = ids;
  const cat = faPick(opts), all = FAW.cats[cat].map((w, i) => [w, i]), lv = FA.cfg.diff === "easy" ? "e" : FA.cfg.diff === "hard" ? "h" : null;
  let pool = lv ? all.filter(x => x[0][1] === lv) : all; if(!pool.length) pool = all;
  const used = new Set(FA.seen[cat] || []); let ok = pool.filter(x => !used.has(x[1])); if(!ok.length){ FA.seen[cat] = (FA.seen[cat] || []).filter(i => !pool.some(x => x[1] === i)); ok = pool; }
  const [w, i] = faPick(ok); (FA.seen[cat] = FA.seen[cat] || []).push(i); store.set("jn_faSeen", FA.seen); FA.lastCat = cat;
  return {cat, w:w[0], alt:w[2] || []}; }

/* ---------- players ---------- */
function faSync(){   // every player keeps one colour for the whole night; a colour frees up when its player leaves
  const ids = new Set(FA.players.map(x => x.p)); Object.keys(FA.col).forEach(p => { if(!ids.has(p)) delete FA.col[p]; }); Object.keys(FA.scores).forEach(p => { if(!ids.has(p) && !FA.g) delete FA.scores[p]; });
  FA.players.forEach(x => { if(FA.col[x.p] != null) return; const used = new Set(Object.values(FA.col)); let k = 0; while(used.has(k)) k++; FA.col[x.p] = k; }); }

/* ---------- talking to the phones ---------- */
function faPub(){
  const g = FA.g, names = {}; FA.players.forEach(x => names[x.p] = x.n);
  const pub = {ph:FA.over ? "over" : g ? g.ph : "lobby", names, col:FA.col, scores:FA.scores, target:FA.cfg.target, secs:FA.cfg.secs};
  if(!g) return pub;
  const now = Date.now(); Object.assign(pub, {order:g.order, round:g.round, ti:g.ti, tid:g.tid, cat:FA.word.cat, strokes:g.strokes, cur:g.cur(), vn:g.vn});
  if(g.ph === "draw") pub.left = Math.max(0, (g.dl - now) / 1000);
  if(g.ph === "vote") pub.left = Math.max(0, (g.vdl - now) / 1000);
  if(g.ph === "guess"){ pub.left = Math.max(0, (g.gdl - now) / 1000); pub.fake = g.fake; pub.tally = g.tally; }
  if(g.ph === "judge" || g.ph === "reveal"){ pub.fake = g.fake; pub.guess = g.guess; pub.tally = g.tally; }
  if(g.ph === "reveal"){ Object.assign(pub, {word:FA.word.w, outcome:g.outcome, deltas:g.deltas}); }
  if(FA.over) pub.winners = faWinners();
  return pub; }
function faPost(){
  if(RELAY !== true) return; const g = FA.g, priv = {}, pub = faPub(); pub.v = ++FA.vc;
  if(g && g.ph !== "reveal") FA.players.forEach(x => { if(g.ids.includes(x.p)) priv[x.p] = {card:{cat:FA.word.cat, w:x.p === g.fake ? FA.scr : FA.word.w, f:x.p === g.fake ? 1 : 0}}; });
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:FA.room, crd:{pub, priv}})}).catch(() => {}); }
async function faPoll(){ if($("#fao").hidden || FA.busy) return; FA.busy = true;
  try{
    if(FA.relay !== RELAY){ FA.relay = RELAY; if(!FA.g) faRender(); }
    if(RELAY !== true) return;
    if(!FA.g || ++FA.n % 5 === 0){   // the player list changes rarely: every poll in the lobby, every fifth one in a game (the moves are read on every poll)
      const j = await (await fetch(`api/players?r=${encodeURIComponent(FA.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n})), sig = JSON.stringify(ps);
      if(sig !== FA.psig){ FA.psig = sig; FA.players = ps; faSync(); if(!FA.g){ faRender(); faPost(); } else faRender(); } }
    const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(FA.room)}&since=${FA.since}`, {cache:"no-store"})).json(); FA.since = a.n; let r = 0;
    for(const x of a.acts || []){ if(!FA.g || !FA.players.some(y => y.p === x.p)) continue; r = Math.max(r, faAct(x.p, x.a || {})); }
    if(r === 2) faChanged(); else if(r === 1) faRender(); }
  catch(e){} finally { FA.busy = false; } }
function faAct(p, a){   // 0 = nothing happened, 1 = redraw the TV only, 2 = the table changed (redraw and post it)
  const g = FA.g; if(!g) return 0; const now = Date.now();
  if(a.k === "seen"){ if(g.ph !== "card" || FA.seenCard[p]) return 0; FA.seenCard[p] = 1; return 1; }
  if(a.t !== g.tid) return 0;
  if(a.k === "stroke"){ if(!g.stroke(p, a.pts, now)) return 0; faAnimLast(); return 2; }
  if(a.k === "vote"){ if(!g.vote(p, String(a.o || ""))) return 0; FA.auto = g.allVoted() ? now + 4000 : 0; return 1; }
  if(a.k === "guess") return g.sendGuess(a.g) ? 2 : 0;
  return 0; }
function faAnimLast(){ const g = FA.g, i = g.strokes.length - 1, s = g.strokes[i]; let len = 0; for(let k = 2; k < s.pts.length; k += 2) len += Math.hypot(s.pts[k] - s.pts[k - 2], s.pts[k + 1] - s.pts[k - 1]);
  FA.anim = {i, t0:performance.now(), dur:Math.max(500, Math.min(2200, len * 2.2))}; }

/* ---------- the flow ---------- */
function faStart(){
  if(RELAY !== true || FA.players.length < 4 || FA.players.length > 10 || !faCats().some(faOn)) return; stopSiu(); faSync();
  FA.word = faWord(); FA.scr = faScr(FA.word.w);
  FA.g = FAR.Game({players:FA.players.map(x => x.p), word:{w:FA.word.w, alt:FA.word.alt}, idle:FAR.IDLE});
  FA.seenCard = {}; FA.scored = false; FA.over = false; FA.anim = null; FA.auto = 0; FA.sung = false; FA.vc = FA.vc || 0; faChanged(); }
function faWinners(){ const mx = Math.max(...Object.values(FA.scores), 0); return Object.keys(FA.scores).filter(p => FA.scores[p] === mx && FA.players.some(x => x.p === p)); }
function faChanged(){ const g = FA.g;
  if(g && g.ph === "reveal" && !FA.scored){ FA.scored = true; Object.entries(g.deltas).forEach(([p, d]) => { FA.scores[p] = (FA.scores[p] || 0) + d; }); }
  if(FA.over && !FA.sung){ FA.sung = true; playWinSiu(); }
  faPost(); faRender(); }
function faAgain(){ stopSiu(); FA.g = null; FA.over = false; FA.scores = {}; FA.scored = false; FA.anim = null; FA.auto = 0; faRender(); faPost(); }
function faTick(){ const g = FA.g; if(!g) return; const now = Date.now();
  if(FA.auto && now >= FA.auto && g.ph === "vote"){ FA.auto = 0; if(g.endVote(now)){ faChanged(); return; } }
  if(g.tick(now)){ faChanged(); return; }
  const bar = $("#faBar"); if(bar){ const left = g.ph === "draw" ? g.dl - now : g.ph === "vote" ? g.vdl - now : g.ph === "guess" ? g.gdl - now : 0, tot = (g.ph === "draw" ? FAR.IDLE : g.ph === "vote" ? FAR.VOTE : FAR.GUESS) * 1000;
    bar.style.width = Math.max(0, Math.min(100, left / tot * 100)) + "%"; } }

/* ---------- the canvas on the TV ---------- */
function faTrace(c, pts, sc, upto){   // a smooth line through the points; upto (0..1) draws only that share of it
  const n = pts.length / 2; let last = n; if(upto < 1){ last = Math.max(2, Math.floor(n * upto)); }
  c.beginPath(); c.moveTo(pts[0] * sc, pts[1] * sc);
  for(let i = 1; i < last - 1; i++){ const mx = (pts[i * 2] + pts[i * 2 + 2]) / 2, my = (pts[i * 2 + 1] + pts[i * 2 + 3]) / 2; c.quadraticCurveTo(pts[i * 2] * sc, pts[i * 2 + 1] * sc, mx * sc, my * sc); }
  c.lineTo(pts[(last - 1) * 2] * sc, pts[(last - 1) * 2 + 1] * sc); c.stroke(); }
function faPaint(){
  const cv = $("#faCv"), g = FA.g; if(!cv || !g) return; const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1); if(!W) return;
  if(cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const c = cv.getContext("2d"), sc = W * dpr / 1000, reveal = g.ph === "reveal", now = performance.now(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, cv.width, cv.height);
  c.lineCap = "round"; c.lineJoin = "round"; c.lineWidth = 17 * sc; let busy = false;
  g.strokes.forEach((s, i) => { let up = 1;
    if(FA.anim && FA.anim.i === i){ up = Math.min(1, (now - FA.anim.t0) / FA.anim.dur); if(up < 1) busy = true; }
    const col = faCol(s.p), fake = reveal && s.p === g.fake;
    c.save(); c.strokeStyle = col; c.globalAlpha = reveal && !fake ? .35 : 1; c.shadowColor = col; c.shadowBlur = (fake ? 34 : 7) * sc; if(fake) c.lineWidth = 22 * sc; faTrace(c, s.pts, sc, up); c.restore(); });
  if(busy){ cancelAnimationFrame(FA.raf); FA.raf = requestAnimationFrame(faPaint); } else FA.anim = null; }

/* ---------- screens ---------- */
function faEnter(){ if(S.mode === "fakeartist") return; S.mode = "fakeartist"; document.body.classList.add("famode"); }
function faLeave(){ if(S.mode !== "fakeartist") return; stopSiu(); clearInterval(FA.poll); clearInterval(FA.tmr); cancelAnimationFrame(FA.raf); FA.poll = FA.tmr = null; FA.g = null; FA.over = false; S.mode = null; document.body.classList.remove("famode"); $("#fao").hidden = true; }
function faShow(){ faEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno","#cno","#dco","#lbo","#slo","#hdo","#tbo"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  FA.room = newRoom(); FA.players = []; FA.col = {}; FA.scores = {}; FA.g = null; FA.over = false; FA.since = 0; FA.relay = RELAY; FA.psig = ""; FA.sung = false; FA.vc = 0; FA.anim = null; FA.auto = 0;
  $("#fao").hidden = false; faRender(); window.scrollTo(0, 0); faPost();
  clearInterval(FA.poll); FA.poll = setInterval(faPoll, 400); clearInterval(FA.tmr); FA.tmr = setInterval(faTick, 250); faPoll(); }
const faSeg = (key, opts, cur) => `<div class="faseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const faDot = p => `<i style="background:${faCol(p)}"></i>`;
function faScoreList(g, deltas){ const ps = FA.players.slice().sort((a, b) => (FA.scores[b.p] || 0) - (FA.scores[a.p] || 0));
  return `<ul class="fascores">${ps.map(x => `<li style="--c:${faCol(x.p)}">${faDot(x.p)}<span>${esc(x.n)}</span>${deltas && deltas[x.p] ? `<em>+${deltas[x.p]}</em>` : ""}<b>${FA.scores[x.p] || 0}</b></li>`).join("")}</ul><div class="fafoot">First to ${FA.cfg.target} wins the night</div>`; }
function faStrip(g){ return `<div class="fastrip">${g.order.map((p, i) => `<span class="fachip${g.ph === "draw" && i === g.ti ? " now" : g.ph === "draw" && i < g.ti ? " done" : ""}" style="--c:${faCol(p)}">${faDot(p)}${esc(faName(p))}</span>`).join("")}</div>`; }
function faOver(){ const ws = faWinners(), order = FA.players.slice().sort((a, b) => (FA.scores[b.p] || 0) - (FA.scores[a.p] || 0));
  return `<div class="faover"><div class="fawin">${ws.map(p => esc(faName(p))).join(" and ")}<span>${ws.length > 1 ? "share the wall" : "owns the wall"}</span></div>
    <ol class="faplace">${order.map((x, i) => `<li style="--c:${faCol(x.p)}"><b>${i + 1}</b>${faDot(x.p)}<span>${esc(x.n)}</span><em>${FA.scores[x.p] || 0}</em></li>`).join("")}</ol></div>`; }
function faRender(){
  const el = $("#faBody"), g = FA.g;
  if(!g){ const off = RELAY !== true, ps = FA.players, c = FA.cfg, ids = faCats(), ok = !off && ps.length >= 4 && ps.length <= 10 && ids.some(faOn);
    el.innerHTML = `<div class="fahead"><div class="fabadge">Game mode</div><h1>Fake Artist</h1><p class="sub">Everyone draws the secret word one line at a time on their phone, except the fake artist, who has no idea what it is. Spot the fake before the drawing is done.</p></div>
      <div class="fagrid">
      <div class="fapanel">${off
        ? `<div class="faeye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Every player draws on their own phone and the card has to stay private, so Fake Artist only runs where everyone can join with a code."}</p>`
        : `<div class="faeye">Scan to join</div><div id="faQr" class="faqr"></div><p class="note">Everyone scans once and types a name. You get a colour that stays yours all night. Keep the page open for the whole game.</p>`}</div>
      <div class="fapanel"><div class="faeye">Players · ${ps.length}</div>${ps.length ? `<ul class="fanames">${ps.map(x => `<li style="--c:${faCol(x.p)}"><button data-kick="${esc(x.p)}" title="Remove ${esc(x.n)}">${faDot(x.p)}${esc(x.n)}</button></li>`).join("")}</ul><p class="note">Tap a name to remove that player.</p>` : `<p class="note">Waiting for players… you need 4 to 10.</p>`}
        ${ps.length > 10 ? `<p class="note warn">Ten players at most. Remove ${ps.length - 10}.</p>` : ""}</div>
      <div class="fapanel"><div class="faeye">First to</div>${faSeg("target", [[3, "3 points"], [5, "5 points"], [7, "7 points"]], c.target)}
        <div class="faeye">Turn length</div>${faSeg("secs", [[10, "10 s"], [15, "15 s"], [20, "20 s"], [30, "30 s"]], c.secs)}<p class="note">How long a line can go on once the finger is down.</p>
        <div class="faeye">Words</div>${faSeg("diff", [["mix", "Mixed"], ["easy", "Easy only"], ["hard", "Hard only"]], c.diff)}
        <div class="faeye">Categories</div><div class="faseg">${ids.map(id => `<button data-cat="${esc(id)}" aria-pressed="${faOn(id)}">${esc(id)}</button>`).join("")}</div>
        <p class="note">Two rounds of lines, then a vote. If the fake isn't caught, two more rounds and a second vote.</p>
        ${ps.length && ps.length < 4 && !off ? `<p class="note warn">You need at least 4 players to start.</p>` : ""}
        <button class="fabtn go" id="faGo" ${ok ? "" : "disabled"}>Start</button></div></div>`;
    const q = $("#faQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(!FA.g && !$("#fao").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:faUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const ph = FA.over ? "over" : g.ph, fk = g.fake, rn = g.round, showCv = ph !== "card" && ph !== "over";
  const rlabel = ph === "card" ? "Check your cards" : ph === "vote" ? `Vote ${g.vn}` : ph === "reveal" || ph === "over" ? "The reveal" : `Round ${rn}`;
  let left = "", mid = "", ctl = "", hint = "";
  if(ph === "card"){
    const seen = Object.keys(FA.seenCard).length, n = g.n;
    mid = `<div class="facard"><div class="fatag">${esc(FA.word.cat)}</div><div class="fabig">Check your phone</div><p>Hold your card to see the word, then let go. One of you gets random letters instead.</p>
      <div class="faseen">${g.order.map(p => `<span class="fachip${FA.seenCard[p] ? " now" : ""}" style="--c:${faCol(p)}">${faDot(p)}${esc(faName(p))}${FA.seenCard[p] ? " ✓" : ""}</span>`).join("")}</div><p class="fasmall">${seen} of ${n} have looked</p></div>`;
    ctl = `<button class="fabtn go small" data-act="start">Start drawing</button>`;
  } else if(ph === "draw"){
    const p = g.cur(), turn = g.ti + 1;
    left = `<div class="fatag">${esc(FA.word.cat)}</div><div class="falab">Now drawing</div><div class="faname" style="color:${faCol(p)}">${esc(faName(p))}</div><div class="fasmall">Line ${turn} of ${g.n} · round ${rn}</div><div class="fabar"><i id="faBar"></i></div>
      <div class="fasmall">${rn <= 2 ? "Vote after round 2" : "Vote after round 4"}</div>`;
    hint = "One line each. Lift your finger and your turn is over.";
    ctl = `<button class="fabtn small" data-act="skip">Skip turn</button>`;
  } else if(ph === "vote"){
    const voted = Object.keys(g.votes).length;
    left = `<div class="fatag">${esc(FA.word.cat)}</div><div class="falab">Vote ${g.vn}</div><div class="faname">Who is the fake?</div><div class="fasmall">${voted} of ${g.n} have voted</div><div class="fabar"><i id="faBar"></i></div>
      <div class="faseen col">${g.order.map(p => `<span class="fachip${g.votes[p] ? " now" : ""}" style="--c:${faCol(p)}">${faDot(p)}${esc(faName(p))}${g.votes[p] ? " ✓" : ""}</span>`).join("")}</div>`;
    hint = "Votes stay secret until everyone is done. You can change your pick.";
    ctl = `<button class="fabtn go small" data-act="result">Show the result</button>`;
  } else if(ph === "between"){
    left = `<div class="falab">Not caught</div><div class="faname">The fake artist is still among you</div><div class="fasmall">Two more rounds, then another vote.</div>`;
    ctl = `<button class="fabtn go small" data-act="cont">Keep drawing</button>`;
  } else if(ph === "guess"){
    left = `<div class="falab">Caught!</div><div class="faname" style="color:${faCol(fk)}">${esc(faName(fk))}</div><div class="fasmall">was the fake artist. One guess at the word:</div><div class="fabar"><i id="faBar"></i></div>`;
  } else if(ph === "judge"){
    left = `<div class="falab">${esc(faName(fk))} guessed</div><div class="faname">“${esc(g.guess) || "…"}”</div><div class="fasmall">Is that the word?</div>`;
    ctl = `<button class="fabtn go small" data-act="right">Right</button><button class="fabtn small" data-act="wrong">Wrong</button>`;
  } else if(ph === "reveal"){
    const kind = g.outcome, line = kind === "escape" ? "The fake got away with it" : kind === "right" ? "Caught, but guessed the word" : "Caught, and guessed wrong";
    left = `<div class="falab">The word was</div><div class="faname">${esc(FA.word.w.charAt(0).toUpperCase() + FA.word.w.slice(1))}</div><div class="falab">The fake artist</div><div class="faname" style="color:${faCol(fk)}">${esc(faName(fk))}</div><div class="fasmall">${line}</div>`;
    const top = Math.max(...Object.values(FA.scores), 0);
    ctl = `<button class="fabtn go small" data-act="${top >= FA.cfg.target ? "winner" : "next"}">${top >= FA.cfg.target ? "See the winner" : "Next game"}</button>`;
  } else if(ph === "over"){
    mid = faOver(); ctl = `<button class="fabtn go small" data-act="again">Play again</button>`;
  }
  ctl += `<span class="gap"></span><button class="fabtn ghost small" data-act="end-game">End game</button>`;
  el.innerHTML = `<div class="fatv"><div class="fain">
    <div class="fatop"><span class="fatitle">Fake Artist</span><span class="farnd">${esc(rlabel)}</span></div>
    ${showCv ? `<div class="facvw"><canvas id="faCv"></canvas></div><div class="faL">${left}</div><div class="faR">${faScoreList(g, ph === "reveal" ? g.deltas : null)}</div>` : mid}
    ${ph === "draw" ? faStrip(g) : ""}${hint ? `<p class="fahint">${esc(hint)}</p>` : ""}
    <div class="factl">${ctl}</div></div></div>`;
  if(showCv) faPaint(); faTick(); }
$("#fao").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set, v = set.dataset.v; FA.cfg[k] = k === "diff" ? v : +v; faSave(); faRender(); return; }
  const cat = e.target.closest("[data-cat]"); if(cat){ const id = cat.dataset.cat; FA.cfg.cats[id] = !faOn(id); if(!faCats().some(faOn)) FA.cfg.cats[id] = true; faSave(); faRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const p = kick.dataset.kick; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:FA.room, p})}).catch(() => {});
    FA.players = FA.players.filter(x => x.p !== p); faSync(); faRender(); faPost(); return; }
  if(e.target.closest("#faGo")){ faStart(); return; }
  if(e.target.closest("#faHome")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act || !FA.g) return; const a = act.dataset.act, g = FA.g, now = Date.now();
  if(a === "start"){ if(g.start(now)) faChanged(); }
  else if(a === "skip"){ if(g.skip(now)) faChanged(); }
  else if(a === "result"){ if(g.endVote(now)){ FA.auto = 0; faChanged(); } }
  else if(a === "cont"){ if(g.cont(now)) faChanged(); }
  else if(a === "right"){ if(g.judge(true)) faChanged(); }
  else if(a === "wrong"){ if(g.judge(false)) faChanged(); }
  else if(a === "next"){ faStart(); }
  else if(a === "winner"){ FA.over = true; faChanged(); }
  else if(a === "again" || a === "end-game") faAgain(); });
window.addEventListener("resize", () => { if(FA.g && !$("#fao").hidden) faPaint(); });
$("#modeFa").onclick = faShow;
