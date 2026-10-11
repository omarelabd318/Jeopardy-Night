/* 6.72 (Omar): Psych, a bluffing party mode (like Fibbage). Everyone joins once from their phone (psych.html at /y?r=ROOM, the same join step as Imposter). Each clue the TV
   shows a true but obscure fact with one blank; everybody types a believable fake (or taps "Lie for me" for a ready-made one, which pays half), the TV mixes the fakes
   with the real answer, and everybody votes for the one they think is true (not their own). Same fakes are merged into one answer. If too few players wrote fakes, ready-made
   "house" fakes pad the list up to the number of players (at least 4); a vote for a house fake costs the voter the fool value.
   Three rounds: round 1 (fool 100, truth 200), round 2 (fool 200, truth 400), then one final clue (fool 400, truth 800). Rounds 1 and 2 have the same number of clues (2 to 8, default 4).
   Lie Detector look (his pick of three previews): chart paper, mono type, a time-left bar with a red needle (no seconds on the TV), every player in a strip along the bottom
   with their score and a check once they have played. Clues: v4work/psych.json (embedded as PSY by build.js). The game needs the Cloudflare link (phones talk through
   worker/index.js: psy, psystate, psyget, psyfake, psylie, psyvote). The real answer never goes to a phone until the scores screen.
   It doesn't use the clue card or the team scores. app.js only calls psyLeave from showHome. The clues-per-round setting is saved on this device (jn_psyCfg), shown clues in jn_psySeen; the game is not saved.
   To remove: delete this file, psych.html, v4work/psych.json, the 6.72 CSS block and #psyo section in head.html, the Psych button, the /y and /api/psy* routes in worker/index.js,
   the PSY lines in build.js, psych.html in wrangler.jsonc and the psyLeave() call in showHome. */
const PS = {cfg:null, room:null, players:[], scores:{}, prev:{}, phase:"lobby", plan:[], idx:0, relay:null, poll:null, tm:null, seen:store.get("jn_psySeen", {r:[], f:[]}),
  clue:null, c:null, priv:null, active:[], fakes:{}, votes:{}, lies:0, opts:[], res:{}, order:[], step:0, deltas:{}, dl:0, total:60, ending:false};
PS.cfg = Object.assign({per:4}, store.get("jn_psyCfg", {}));
const psSave = () => store.set("jn_psyCfg", PS.cfg);
const PS_FOOL = [100, 200, 400], PS_WRITE = 60, PS_VOTE = 30;
const psShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const psNorm = x => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "").replace(/^(the|a|an)(?=.)/, "");
const psUrl = () => new URL(`y?r=${PS.room}`, location.href).href;
const psName = p => { const x = PS.players.find(y => y.p === p); return x ? x.n : "Someone"; };
const psLeft = () => Math.max(0, Math.round((PS.dl - Date.now()) / 1000));
const psSigned = n => (n > 0 ? "+" : n < 0 ? "−" : "") + Math.abs(n);
const psOrd = n => { const x = ["th", "st", "nd", "rd"], v = n % 100; return n + (x[(v - 20) % 10] || x[v] || x[0]); };
const psNames = list => list.length ? list.map(esc).join(", ") : "";

/* ---------- planning ---------- */
function psPickClues(key, n){   // clues not shown yet on this device, until the pool has run out
  const pool = PSY[key]; let ok = pool.map((x, i) => i).filter(i => !(PS.seen[key] || []).includes(i));
  if(ok.length < n){ PS.seen[key] = []; ok = pool.map((x, i) => i); }
  const got = psShuffle(ok).slice(0, n); PS.seen[key] = (PS.seen[key] || []).concat(got); store.set("jn_psySeen", PS.seen); return got.map(i => pool[i]); }
function psMakePlan(){ const n = PS.cfg.per, rs = psPickClues("r", n * 2), f = psPickClues("f", 1), plan = [];
  for(let i = 0; i < n; i++) plan.push({round:1, nth:i + 1, of:n, clue:rs[i]});
  for(let i = 0; i < n; i++) plan.push({round:2, nth:i + 1, of:n, clue:rs[n + i]});
  plan.push({round:3, nth:1, of:1, clue:f[0]}); return plan; }
const psFool = () => PS_FOOL[PS.plan[PS.idx].round - 1];

/* ---------- talking to the phones ---------- */
function psPub(){ const e = PS.plan[PS.idx], fool = psFool(), live = PS.phase === "write" || PS.phase === "vote";
  const pub = {c:PS.c, phase:PS.phase, round:e.round, nth:e.nth, of:e.of, fool, truth:fool * 2, q:e.clue.q, secs:live ? psLeft() : null, scores:PS.scores};
  if(PS.phase === "vote") pub.options = PS.opts.map(o => ({id:o.id, t:o.t, by:o.by.map(b => b.p)}));
  if(PS.phase === "scores"){ pub.deltas = PS.deltas; pub.answer = e.clue.a; }
  return pub; }
function psPost(){ if(!PS.c) return; const body = {r:PS.room, psy:{pub:psPub(), priv:PS.priv}};
  fetch("api/psy", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)}).catch(() => {}); }
async function psFetch(){ const j = await (await fetch(`api/psyget?r=${encodeURIComponent(PS.room)}&c=${encodeURIComponent(PS.c)}`, {cache:"no-store"})).json();
  PS.fakes = j.fakes || {}; PS.votes = j.votes || {}; PS.lies = j.lies || 0;
  (j.players || []).forEach(x => { const m = PS.players.find(y => y.p === x.p); if(!m) PS.players.push({p:x.p, n:x.n}); else m.n = x.n; });
  PS.players.forEach(x => { if(!(x.p in PS.scores)) PS.scores[x.p] = 0; }); }

/* ---------- the flow ---------- */
function psStart(){
  if(PS.players.length < 3 || RELAY !== true) return;
  PS.scores = {}; PS.players.forEach(x => PS.scores[x.p] = 0); PS.plan = psMakePlan(); PS.idx = 0; psClue(); }
function psClue(){
  const e = PS.plan[PS.idx], a = e.clue;
  PS.c = "g" + Date.now().toString(36) + PS.idx; PS.active = PS.players.slice(); PS.fakes = {}; PS.votes = {}; PS.lies = 0; PS.opts = []; PS.res = {}; PS.deltas = {}; PS.step = 0; PS.ending = false;
  PS.priv = {ans:[a.a].concat(a.alt || []).map(psNorm).filter(Boolean), lies:psShuffle(a.lies.slice())};
  PS.phase = "write"; PS.total = PS_WRITE; PS.dl = Date.now() + PS_WRITE * 1000; psPost(); psRender(); }
function psBuildOptions(){
  const a = PS.plan[PS.idx].clue, truthN = psNorm(a.a), accepted = new Set(PS.priv.ans), groups = new Map();
  Object.entries(PS.fakes).forEach(([p, f]) => { const n = psNorm(f.v); if(!n || accepted.has(n) || n === truthN) return;
    const g = groups.get(n) || {t:f.v, by:[], typed:false, house:false}; groups.set(n, g); g.by.push({p, lie:!!f.lie}); if(!g.typed && !f.lie){ g.t = f.v; g.typed = true; } });
  const opts = [...groups.values()], seen = new Set(groups.keys()); seen.add(truthN);
  const need = Math.min(3, Math.max(4, PS.active.length) - (opts.length + 1));   // pad up to the number of players (at least 4) with ready-made fakes nobody used
  PS.priv.lies.slice(PS.lies).forEach(t => { const n = psNorm(t); if(opts.filter(o => o.house).length < need && !seen.has(n)){ seen.add(n); opts.push({t, by:[], house:true}); } });
  opts.push({t:a.a, by:[], truth:true});
  psShuffle(opts).forEach((o, i) => o.id = "o" + i); PS.opts = opts; }
async function psEndWrite(){ if(PS.phase !== "write" || PS.ending) return; PS.ending = true;
  try{ await psFetch(); }catch(e){}
  if(PS.phase !== "write") return;
  psBuildOptions(); PS.phase = "vote"; PS.total = PS_VOTE; PS.dl = Date.now() + PS_VOTE * 1000; PS.ending = false; psPost(); psRender(); }
async function psEndVote(){ if(PS.phase !== "vote" || PS.ending) return; PS.ending = true;
  try{ await psFetch(); }catch(e){}
  if(PS.phase !== "vote") return;
  const fool = psFool(), deltas = {}, add = (p, n) => { deltas[p] = (deltas[p] || 0) + n; };
  PS.opts.forEach(o => PS.res[o.id] = {voters:[], pts:0});
  Object.entries(PS.votes).forEach(([p, id]) => { const o = PS.opts.find(x => x.id === id); if(!o) return; PS.res[id].voters.push(p);
    if(o.truth) add(p, fool * 2); else if(o.house) add(p, -fool); else o.by.forEach(b => add(b.p, b.lie ? fool / 2 : fool)); });
  PS.opts.forEach(o => { PS.res[o.id].pts = o.truth ? fool * 2 : o.house ? -fool : fool; });
  PS.prev = Object.assign({}, PS.scores); Object.entries(deltas).forEach(([p, n]) => PS.scores[p] = (PS.scores[p] || 0) + n); PS.deltas = deltas;
  PS.order = PS.opts.map((o, i) => i).filter(i => !PS.opts[i].truth).concat(PS.opts.findIndex(o => o.truth)); PS.step = 0;
  PS.phase = "reveal"; PS.ending = false; psPost(); psRender(); }
function psNext(){
  if(PS.phase === "reveal"){ if(++PS.step >= PS.order.length){ PS.phase = "scores"; psPost(); } psRender(); return; }
  if(PS.phase === "scores"){ if(PS.idx + 1 >= PS.plan.length){ PS.phase = "over"; psPostOver(); psRender(); return; } PS.idx++; psClue(); } }
function psPostOver(){ PS.deltas = {}; fetch("api/psy", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:PS.room, psy:{pub:{c:PS.c, phase:"over", round:3, nth:1, of:1, fool:0, truth:0, q:"", scores:PS.scores}, priv:{ans:[], lies:[]}}})}).catch(() => {}); }
function psCheck(){ if(PS.ending) return; const done = o => PS.active.length && PS.active.every(x => o[x.p]);
  if(PS.phase === "write" && done(PS.fakes)) setTimeout(psEndWrite, 900);
  else if(PS.phase === "vote" && done(PS.votes)) setTimeout(psEndVote, 900); }

/* ---------- screens ---------- */
function psEnter(){ if(S.mode === "psych") return; S.mode = "psych"; document.body.classList.add("psymode"); }
function psyLeave(){ if(S.mode !== "psych") return; clearInterval(PS.poll); clearInterval(PS.tm); PS.poll = PS.tm = null; PS.c = null; S.mode = null; document.body.classList.remove("psymode"); $("#psyo").hidden = true; }
function psyShow(){ psEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  PS.room = newRoom(); PS.players = []; PS.scores = {}; PS.phase = "lobby"; PS.c = null; PS.relay = RELAY;
  $("#psyo").hidden = false; psRender(); window.scrollTo(0, 0);
  clearInterval(PS.poll); PS.poll = setInterval(psPoll, 1500); clearInterval(PS.tm); PS.tm = setInterval(psTick, 250); psPoll(); }
async function psPoll(){ if($("#psyo").hidden) return;
  if(PS.relay !== RELAY){ PS.relay = RELAY; if(PS.phase === "lobby") psRender(); }
  try{
    if(PS.phase === "lobby"){ if(RELAY !== true) return;
      const j = await (await fetch(`api/players?r=${encodeURIComponent(PS.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
      if(PS.phase === "lobby" && JSON.stringify(ps) !== JSON.stringify(PS.players)){ PS.players = ps; psRender(); } }
    else if((PS.phase === "write" || PS.phase === "vote") && !PS.ending){ const ph = PS.phase; await psFetch(); if(PS.phase === ph){ psStrip(); psCheck(); } } }
  catch(e){} }
function psTick(){ if(PS.phase !== "write" && PS.phase !== "vote") return;
  const f = $("#psFill"), n = $("#psNeedle"); if(f && n){ const pct = Math.max(0, Math.min(100, (PS.dl - Date.now()) / (PS.total * 10))); f.style.width = pct + "%"; n.style.left = pct + "%"; }
  if(Date.now() >= PS.dl && !PS.ending) (PS.phase === "write" ? psEndWrite : psEndVote)(); }
function psStrip(){ const el = $("#psStrip"); if(el) el.innerHTML = psStripHtml(); }
function psStripHtml(){ const ph = PS.phase, act = new Set(PS.active.map(x => x.p));
  return PS.players.map(x => { const sc = (ph === "reveal" ? PS.prev : PS.scores)[x.p] ?? 0;
    let done, c;
    if(ph === "write"){ done = !!PS.fakes[x.p]; c = done ? "✓" : "…"; }
    else if(ph === "vote"){ done = !!PS.votes[x.p]; c = done ? "✓" : "…"; }
    else if(ph === "scores"){ const d = PS.deltas[x.p] || 0; done = act.has(x.p); c = psSigned(d); }
    else { done = act.has(x.p); c = "·"; }
    return `<div class="pl ${done ? "done" : "wait"}${ph === "scores" ? " dl" : ph === "reveal" ? " nc" : ""}"><span class="c">${esc(c)}</span><span class="n">${esc(x.n)}</span><span class="s${sc < 0 ? " neg" : ""}">${sc}</span></div>`; }).join(""); }
const psSeg = (key, opts, cur) => `<div class="psseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
function psAnsHtml(){ const ph = PS.phase;
  return `<ul class="ans">${PS.opts.map((o, i) => { let cls = "", extra = "";
    if(ph === "reveal" || ph === "scores"){ const k = PS.order.indexOf(i), shown = ph === "scores" || k < PS.step;
      if(shown){ const r = PS.res[o.id], who = o.truth ? "The truth" : o.house ? "House fake" : "by " + psNames(o.by.map(b => psName(b.p) + (b.lie ? " (Lie for me)" : ""))),
          vt = r.voters.length ? "voted: " + psNames(r.voters.map(psName)) : "no votes", pts = r.voters.length ? ` · ${psSigned(r.pts)} each` : "";
        cls = o.truth ? " truth" : o.house ? " house" : " rev"; extra = `<small>${who}</small><small>${vt}${pts}</small>`; }
      else cls = " hid"; }
    return `<li class="${cls.trim()}"><span class="t">${esc(o.t)}</span>${extra}</li>`; }).join("")}</ul>`; }
function psRender(){
  const el = $("#psBody"), ph = PS.phase;
  if(ph === "lobby"){ const ps = PS.players, c = PS.cfg, off = RELAY !== true;
    el.innerHTML = `<div class="pshead"><div class="psbadge">Party game</div><h1>Psych</h1>
      <p class="sub">Everyone gets the same clue with a word missing. Type a fake answer on your phone, then vote for the one you think is real. Fool your friends to score, and find the truth to score more.</p></div>
      <div class="psgrid">
      <div class="pspanel">${off
        ? `<div class="pseye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Psych runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="pseye">Scan to join</div><div id="psQr" class="psqr"></div><div class="psurl">${esc(psUrl().replace(/^https?:\/\//, ""))}</div><p class="note">Everyone scans once and types their name. Keep the page open for the whole game.</p>`}</div>
      <div class="pspanel"><div class="pseye">Players · ${ps.length}</div>${ps.length ? `<ul class="psnames">${ps.map((p, i) => `<li><button data-kick="${i}" title="Remove ${esc(p.n)}">${esc(p.n)}</button></li>`).join("")}</ul><p class="note">Tap a name to remove that player.</p>` : `<p class="note">Waiting for players… you need at least 3. Five or more is best.</p>`}</div>
      <div class="pspanel"><div class="pseye">Clues per round</div>${psSeg("per", [2, 3, 4, 5, 6, 7, 8].map(n => [n, n]), c.per)}
        <p class="note">Round 1 pays 100 for each vote on your fake and 200 for finding the truth. Round 2 doubles that, with the same number of clues. The final is one clue at 400 and 800. ${c.per * 2 + 1} clues in all.</p>
        <p class="note">Voting for a house fake (one the game wrote) costs you what a fool would have earned that round.</p>
        <button class="psbtn go" id="psGo" ${ps.length < 3 || off ? "disabled" : ""}>Start</button></div>
      </div>`;
    const q = $("#psQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(PS.phase === "lobby" && !$("#psyo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:psUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  if(ph === "over"){ const rows = PS.players.map(x => ({n:x.n, s:PS.scores[x.p] ?? 0})).sort((a, b) => b.s - a.s); let rank = 0;
    rows.forEach((r, i) => { if(i === 0 || r.s !== rows[i - 1].s) rank = i + 1; r.rank = rank; });
    const winners = rows.filter(r => r.rank === 1).map(r => r.n);
    el.innerHTML = `<div class="pshead"><div class="psbadge">Case closed</div><h1>${esc(winners.join(" and "))} ${winners.length > 1 ? "win" : "wins"}</h1></div>
      <ol class="pspod">${rows.map(r => `<li class="r${Math.min(r.rank, 4)}"><b>${psOrd(r.rank)}</b><span>${esc(r.n)}</span><em class="${r.s < 0 ? "neg" : ""}">${r.s}</em></li>`).join("")}</ol>
      <div class="row"><button class="psbtn go" id="psAgain">Play again</button><button class="psbtn ghost" id="psHome2">Title screen</button></div>`; return; }
  const e = PS.plan[PS.idx], fool = psFool(), live = ph === "write" || ph === "vote", last = PS.idx + 1 >= PS.plan.length;
  const ctl = ph === "write" || ph === "vote" ? `<button class="psbtn small" data-act="skip">Skip ahead</button><button class="psbtn small" data-act="more">+30 s</button>`
    : `<button class="psbtn go small" data-act="next">${ph === "reveal" ? (PS.step + 1 >= PS.order.length ? "Reveal the truth" : "Reveal next") : last ? "See the winner" : e.nth === e.of && e.round < 3 ? "Next round" : "Next clue"}</button>`;
  const blank = ph === "scores" ? `<b class="fill">${esc(e.clue.a)}</b>` : `<b></b>`;
  el.innerHTML = `<div class="pstv"><div class="psin">
    <div class="pstop"><span>${e.round === 3 ? "Final clue" : `Round ${e.round} · clue ${e.nth} of ${e.of}`}</span><span>Fool ${fool} · Truth ${fool * 2}</span></div>
    <div class="psq">${esc(e.clue.q).replace("____", blank)}</div>
    ${live ? `<div class="pstimer"><div class="track"><div class="fill" id="psFill"></div><div class="needle" id="psNeedle"></div></div></div>` : ""}
    ${ph === "write" ? `<div class="pshint">Everyone is typing a believable fake on their phone.</div>` : PS.opts.length ? psAnsHtml() : ""}
    <div class="psctl">${ctl}<span class="gap"></span><button class="psbtn ghost small" data-act="end">End game</button></div>
    <div class="psstrip" id="psStrip">${psStripHtml()}</div></div></div>`;
  psTick(); }
$("#psyo").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ PS.cfg[set.dataset.set] = +set.dataset.v; psSave(); psRender(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const p = PS.players[+kick.dataset.kick]; fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:PS.room, p:p.p})}).catch(() => {});
    PS.players.splice(+kick.dataset.kick, 1); psRender(); return; }
  if(e.target.closest("#psGo")){ psStart(); return; }
  if(e.target.closest("#psAgain")){ PS.phase = "lobby"; PS.c = null; psRender(); psPoll(); return; }
  if(e.target.closest("#psHome") || e.target.closest("#psHome2")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "next") psNext();
  else if(act.dataset.act === "skip") (PS.phase === "write" ? psEndWrite : psEndVote)();
  else if(act.dataset.act === "more"){ PS.dl += 30000; PS.total += 30; psPost(); }
  else if(act.dataset.act === "end"){ PS.phase = "over"; psPostOver(); psRender(); } });
$("#modePsy").onclick = psyShow;
