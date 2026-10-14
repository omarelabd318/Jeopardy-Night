/* 6.82 (Omar): Decrypto, a two-team code game. Everyone scans one code and joins from their phone (dec.html at /d?r=ROOM), choosing Team A or Team B. Each team has four secret keywords
   (numbered 1 to 4) that only its own phones show. Each round every team's Encryptor (a different player each round, in join order) gets a secret code, three different numbers from 1 to 4
   such as 3-1-4, and types one clue per number that points at that keyword. Both Encryptors write at the same time. Then Team A's clues go up on the TV: Team A's other players guess the
   code (a team's mistake is a black Miscommunication token) and Team B tries to intercept it (a white Interception token), both on their phones at once; then the same for Team B's clues.
   No interception in round 1. Every revealed clue drops into its team's log under that number, so the room can study the patterns. 2 Interceptions win, 2 Miscommunications lose. After the last
   round (6 or 8) the higher Interceptions minus Miscommunications wins; level goes to a tiebreak where each team types its guesses for the other team's four keywords. Enigma look (his pick of
   three previews): dark casing, cream code-book paper, brass discs, typewriter clues; Team A red, Team B green. Keywords: v4work/decrypto/keywords.json (embedded as DECK by build.js).
   The laptop is the referee: the rules and the whole state of a game live in DCR below (no screen code in it, so v4work/tools/decrypto-test.js can load just that region). pub() is what every
   phone may see, priv(p) is one player's own keywords and code. The phones talk through the same generic relay routes as the card games (join, players, crd, crdstate, crdact, crdacts in
   worker/index.js). Needs the Cloudflare link. It doesn't use the clue card or the Jeopardy scores; app.js only calls decLeave from showHome. Setup is saved on this device (jn_decCfg); a game is not saved.
   To remove: delete this file, dec.html, v4work/decrypto/, v4work/tools/decrypto-test.js and decrypto-e2e.js, the 6.82 CSS block and #dco section in head.html, the Decrypto button, the /d route in
   worker/index.js, dec.html in wrangler.jsonc, the DECK lines and 'decrypto' in MODE_FILES in build.js and the decLeave() call in showHome. */

/*@rules*/
const DCR = (() => {
  const shuffle = (a, rnd = Math.random) => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = x => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "").replace(/^(the|a|an)(?=.)/, "");
  const CODES = (() => { const o = []; for(let a = 1; a <= 4; a++) for(let b = 1; b <= 4; b++) for(let c = 1; c <= 4; c++) if(a !== b && a !== c && b !== c) o.push([a, b, c]); return o; })();   // the 24 codes
  const same = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
  const validCode = c => Array.isArray(c) && c.length === 3 && c.every(n => Number.isInteger(n) && n >= 1 && n <= 4) && new Set(c).size === 3;
  const clean = (s, n) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  // 8 different keywords from the packs that are on, 4 per team, never two from the same family (Ahly and Zamalek, Paris and the Eiffel Tower...)
  function dealWords(deck, on, rnd){
    const pool = []; Object.keys(deck.packs).forEach(k => { if(!on || on[k] !== false) pool.push(...deck.packs[k]); });
    const fam = deck.fam || [], famOf = w => fam.map((f, i) => f.includes(w) ? i : -1).filter(i => i >= 0), out = [], used = new Set();
    for(const w of shuffle(pool, rnd)){ const f = famOf(w); if(f.some(i => used.has(i))) continue; out.push(w); f.forEach(i => used.add(i)); if(out.length === 8) break; }
    return out.length === 8 ? [out.slice(0, 4), out.slice(4)] : null; }
  function Game(cfg, rosters, deck, rnd = Math.random){
    const W = dealWords(deck, cfg.packs, rnd); if(!W) return null;
    const names = cfg.names || ["Team A", "Team B"];
    const g = {cfg, v:0, round:0, phase:"write", turn:0, over:null, enc:[null, null], code:[null, null], clues:[null, null], guess:[{own:null, opp:null}, {own:null, opp:null}], rev:null, tie:[null, null], tieRes:null,
      teams:[0, 1].map(t => ({name:names[t], ps:rosters[t].map(x => ({p:x.p, n:x.n})), words:W[t], used:[], log:[[], [], [], []], int:0, mis:0}))};
    const teamOf = p => g.teams.findIndex(t => t.ps.some(x => x.p === p));
    const nameOf = p => { for(const t of g.teams){ const x = t.ps.find(y => y.p === p); if(x) return x.n; } return "Someone"; };
    const score = t => g.teams[t].int - g.teams[t].mis;
    function newRound(){
      g.round++; g.turn = 0; g.phase = "write"; g.rev = null; g.clues = [null, null]; g.guess = [{own:null, opp:null}, {own:null, opp:null}];
      [0, 1].forEach(t => { const T = g.teams[t]; let free = CODES.filter(c => !T.used.some(u => same(u, c))); if(!free.length){ T.used = []; free = CODES; }
        g.code[t] = free[Math.floor(rnd() * free.length)]; T.used.push(g.code[t]); g.enc[t] = T.ps[(g.round - 1) % T.ps.length].p; }); }
    function startGuess(){ g.phase = "guess"; g.turn = 0; g.guess = [{own:null, opp:null}, {own:null, opp:null}]; }
    function revealTurn(){
      const t = g.turn, code = g.code[t], G = g.guess[t], ownOk = same(G.own && G.own.g, code), oppOk = g.round > 1 && same(G.opp && G.opp.g, code);
      if(!ownOk) g.teams[t].mis++; if(oppOk) g.teams[1 - t].int++;
      code.forEach((d, i) => g.teams[t].log[d - 1].push({r:g.round, w:g.clues[t][i]}));
      g.rev = {t, code, own:G.own, opp:G.opp, ownOk, oppOk, clues:g.clues[t]}; g.phase = "reveal"; }
    function finish(winner, why){ g.over = {winner, why}; g.phase = "over"; }
    function endRound(){
      const A = g.teams[0], B = g.teams[1], winA = A.int >= 2 || B.mis >= 2, winB = B.int >= 2 || A.mis >= 2;
      if(winA && !winB) return finish(0, "tokens"); if(winB && !winA) return finish(1, "tokens");
      if(winA || winB || g.round >= g.cfg.rounds){ const a = score(0), b = score(1); if(a !== b) return finish(a > b ? 0 : 1, "score"); g.phase = "tie"; return; }
      newRound(); }
    function resolveTie(){
      const c = [0, 1].map(t => (g.tie[t] || []).filter((w, i) => norm(w) && norm(w) === norm(g.teams[1 - t].words[i])).length);
      g.tieRes = {c, w:g.tie}; finish(c[0] === c[1] ? 2 : c[0] > c[1] ? 0 : 1, "tiebreak"); }
    const needGuess = () => g.guess[g.turn].own && (g.round === 1 || g.guess[g.turn].opp);
    Object.assign(g, {teamOf, nameOf, score,
      start(){ newRound(); },
      addPlayer(p, n, t){ if(teamOf(p) < 0) g.teams[t === 1 ? 1 : 0].ps.push({p, n}); },
      act(p, a){ const t = teamOf(p); if(t < 0 || !a) return {ok:false, err:"unknown"};
        if(a.k === "clues"){ if(g.phase !== "write" || a.r !== g.round) return {ok:false, err:"stale"}; if(g.enc[t] !== p) return {ok:false, err:"notenc"}; if(g.clues[t]) return {ok:false, err:"locked"};
          const c = (Array.isArray(a.c) ? a.c : []).slice(0, 3).map(x => clean(x, 40)); if(c.length !== 3 || c.some(x => !x)) return {ok:false, err:"blank"};
          for(let i = 0; i < 3; i++){ const w = norm(g.teams[t].words[g.code[t][i] - 1]), n = norm(c[i]); if(w.length >= 3 && n.includes(w)) return {ok:false, err:"keyword", i}; }
          g.clues[t] = c; if(g.clues[0] && g.clues[1]) startGuess(); return {ok:true}; }
        if(a.k === "guess"){ if(g.phase !== "guess" || a.r !== g.round || a.t !== g.turn) return {ok:false, err:"stale"}; if(!validCode(a.g)) return {ok:false, err:"bad"};
          const role = t === g.turn ? "own" : "opp"; if(role === "own" && g.enc[t] === p) return {ok:false, err:"enc"}; if(role === "opp" && g.round === 1) return {ok:false, err:"r1"};
          if(g.guess[g.turn][role]) return {ok:false, err:"locked"}; g.guess[g.turn][role] = {g:a.g.slice(), by:nameOf(p)}; if(needGuess()) revealTurn(); return {ok:true}; }
        if(a.k === "tie"){ if(g.phase !== "tie") return {ok:false, err:"stale"}; if(g.tie[t]) return {ok:false, err:"locked"};
          g.tie[t] = [0, 1, 2, 3].map(i => clean((a.w || [])[i], 40)); if(g.tie[0] && g.tie[1]) resolveTie(); return {ok:true}; }
        return {ok:false, err:"phase"}; },
      timeout(){   // the clock ran out (or the host skipped ahead): what's missing is filled in and the game moves on
        if(g.phase === "write"){ [0, 1].forEach(t => { if(!g.clues[t]) g.clues[t] = ["(no clue)", "(no clue)", "(no clue)"]; }); startGuess(); }
        else if(g.phase === "guess") revealTurn();
        else if(g.phase === "tie"){ [0, 1].forEach(t => { if(!g.tie[t]) g.tie[t] = ["", "", "", ""]; }); resolveTie(); } },
      advance(){ if(g.phase !== "reveal") return; if(g.turn === 0){ g.turn = 1; g.phase = "guess"; } else endRound(); },
      endGame(){ const a = score(0), b = score(1); finish(a === b ? 2 : a > b ? 0 : 1, "ended"); },
      pub(){ const rv = g.phase === "reveal" ? g.rev : null;
        return {phase:g.phase, round:g.round, of:g.cfg.rounds, turn:g.turn, names:g.teams.map(t => t.name), members:g.teams.map(t => t.ps.map(x => x.n)), tok:g.teams.map(t => [t.int, t.mis]), log:g.teams.map(t => t.log),
          enc:g.enc.map(p => p ? nameOf(p) : ""), sent:[!!g.clues[0], !!g.clues[1]], clues:g.phase === "guess" || g.phase === "reveal" ? g.clues[g.turn] : null,
          locks:g.phase === "guess" ? {own:g.guess[g.turn].own ? g.guess[g.turn].own.by : null, opp:g.guess[g.turn].opp ? g.guess[g.turn].opp.by : null} : null, rev:rv,
          tie:g.phase === "tie" ? [!!g.tie[0], !!g.tie[1]] : null,
          over:g.phase === "over" ? {winner:g.over.winner, why:g.over.why, words:g.teams.map(t => t.words), tie:g.tieRes} : null}; },
      priv(p){ const t = teamOf(p); if(t < 0) return null; const isEnc = g.enc[t] === p;
        return {team:t, words:g.teams[t].words, enc:isEnc, code:isEnc && (g.phase === "write" || (g.phase === "guess" && g.turn === t)) ? g.code[t] : null}; }});
    return g; }
  return {shuffle, norm, CODES, same, validCode, dealWords, Game};
})();
/*@end-rules*/

/* ---------- screens and the link to the phones ---------- */
const DC = {cfg:null, room:null, players:[], phase:"lobby", g:null, relay:null, poll:null, tm:null, since:0, busy:false, v:0, dl:null, total:0, key:"", hurried:false, pc:0};
DC.cfg = Object.assign({packs:{}, write:90, guess:60, rounds:8, hurry:true}, store.get("jn_decCfg", {}));
const decSave = () => store.set("jn_decCfg", DC.cfg);
const DC_PACKS = [["everyday", "Everyday"], ["egypt", "Egypt & Arab world"], ["football", "Football"], ["movies", "Movies & TV"], ["places", "Places"]];
const decUrl = () => new URL(`d?r=${DC.room}`, location.href).href;
const decLeft = () => DC.dl ? Math.max(0, Math.round((DC.dl - Date.now()) / 1000)) : null;
const decOn = k => DC.cfg.packs[k] !== false;
const decTeamName = t => t ? "Team B" : "Team A";

function decPost(){ if(!DC.room) return; DC.v++; const g = DC.g, priv = {}; let pub;
  if(g){ pub = Object.assign(g.pub(), {v:DC.v, secs:decLeft()}); g.teams.forEach(t => t.ps.forEach(x => priv[x.p] = g.priv(x.p))); } else pub = {v:DC.v, phase:"lobby"};
  fetch("api/crd", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:DC.room, crd:{pub, priv}})}).catch(() => {}); }
async function decPoll(){ if($("#dco").hidden || DC.busy) return; DC.busy = true;
  try{
    if(DC.relay !== RELAY){ DC.relay = RELAY; if(DC.phase === "lobby") decRender(); }
    if(RELAY !== true) return;
    const j = await (await fetch(`api/players?r=${encodeURIComponent(DC.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n, t:x.t === 1 ? 1 : x.t === 0 ? 0 : null}));
    if(DC.phase === "lobby"){
      ps.forEach(x => { if(x.t == null){ const c = [0, 1].map(t => ps.filter(y => y.t === t).length); x.t = c[0] <= c[1] ? 0 : 1; decMove(x, x.t); } });   // a phone with no team yet: the smaller team
      if(JSON.stringify(ps) !== JSON.stringify(DC.players)){ DC.players = ps; decRender(); } }
    else if(DC.g){
      let late = false; ps.forEach(x => { if(DC.g.teamOf(x.p) < 0){ DC.g.addPlayer(x.p, x.n, x.t); late = true; } });   // someone joined mid-game: they get their team's keywords at once
      const a = await (await fetch(`api/crdacts?r=${encodeURIComponent(DC.room)}&since=${DC.since}`, {cache:"no-store"})).json(); DC.since = a.n; let changed = late;
      for(const x of a.acts || []){ if(!DC.g || DC.g.phase === "over") break; const before = DC.g.phase + DC.g.turn; if(DC.g.act(x.p, x.a).ok) changed = true; if(before !== DC.g.phase + DC.g.turn) break; }
      if(changed) decChanged(); } }
  catch(e){} finally { DC.busy = false; } }
function decMove(x, t){ x.t = t; fetch("api/join", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({r:DC.room, p:x.p, n:x.n, t})}).catch(() => {}); }   // tells the phone its new team

/* ---------- the flow ---------- */
function decStart(){
  const rs = [0, 1].map(t => DC.players.filter(x => x.t === t)); if(rs[0].length < 2 || rs[1].length < 2 || RELAY !== true) return;
  const g = DCR.Game({packs:DC.cfg.packs, rounds:DC.cfg.rounds}, rs, DECK); if(!g){ alert("Turn on at least one keyword pack."); return; }
  DC.g = g; DC.since = 0; DC.key = ""; g.start(); DC.phase = "play"; decChanged(); }
function decChanged(){ const g = DC.g, key = g.phase + g.round + g.turn;
  if(key !== DC.key){ DC.key = key; DC.hurried = false;
    const secs = g.phase === "write" ? DC.cfg.write : g.phase === "guess" ? DC.cfg.guess : g.phase === "tie" ? 60 : 0;
    DC.total = secs; DC.dl = secs ? Date.now() + secs * 1000 : null; if(g.phase === "over") DC.dl = null; }
  if(g.phase === "write" && DC.cfg.hurry && !DC.hurried && g.clues[0] !== g.clues[1] && (g.clues[0] || g.clues[1])){   // the first Encryptor is done: the other gets 30 seconds
    DC.hurried = true; if(!DC.dl || DC.dl - Date.now() > 30000){ DC.dl = Date.now() + 30000; DC.total = 30; } }
  decPost(); decRender();
  if(g.phase === "over") playWinSiu(); }

/* ---------- screens ---------- */
function decEnter(){ if(S.mode === "decrypto") return; S.mode = "decrypto"; document.body.classList.add("dcmode"); }
function decLeave(){ if(S.mode !== "decrypto") return; stopSiu(); clearInterval(DC.poll); clearInterval(DC.tm); DC.poll = DC.tm = null; DC.g = null; DC.phase = "lobby"; S.mode = null; document.body.classList.remove("dcmode"); $("#dco").hidden = true; }
function decShow(){ decEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotSeat","#hotseat","#hsSetup","#lobby","#impo","#psyo","#esto","#tno"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  DC.room = newRoom(); DC.players = []; DC.phase = "lobby"; DC.g = null; DC.since = 0; DC.relay = RELAY; DC.v = 0;
  $("#dco").hidden = false; decRender(); window.scrollTo(0, 0);
  clearInterval(DC.poll); DC.poll = setInterval(decPoll, 1000); clearInterval(DC.tm); DC.tm = setInterval(decTick, 250); decPoll(); }
function decTick(){ const g = DC.g; if(!g || !DC.dl) return;
  const f = $("#dcFill"); if(f) f.style.width = Math.max(0, Math.min(100, (DC.dl - Date.now()) / (DC.total * 10))) + "%";
  if(Date.now() >= DC.dl && g.phase !== "reveal" && g.phase !== "over"){ DC.dl = null; g.timeout(); decChanged(); } }
const decSeg = (key, opts, cur) => `<div class="dcseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
const decTok = (t, p) => `<div class="tok" title="Interceptions (white) and Miscommunications (black)">${[0, 1].map(i => `<i class="${p.tok[t][0] > i ? "w" : ""}"></i>`).join("")}<span class="gap"></span>${[0, 1].map(i => `<i class="${p.tok[t][1] > i ? "b" : ""}"></i>`).join("")}</div>`;
function decPanel(t, p, words){   // a team's name, tokens and clue log (the keywords stay hidden until the game is over)
  return `<div class="dcpn t${t}"><div class="ph"><div class="tname">${esc(p.names[t])}</div>${decTok(t, p)}</div><div class="dcwho">${p.members[t].map(esc).join(", ")}</div>
    <div class="log">${[0, 1, 2, 3].map(i => `<div class="col"><h4>${i + 1}</h4>${words ? `<div class="kw">${esc(words[i])}</div>` : ""}${p.log[t][i].map(c => `<div class="dcl"><sup>R${c.r}</sup>${esc(c.w)}</div>`).join("")}</div>`).join("")}</div></div>`; }
function decMid(g, p){
  const sec = decLeft(), timer = DC.dl ? `<div class="dctimer"><b id="dcFill" style="width:${Math.max(0, Math.min(100, (DC.dl - Date.now()) / (DC.total * 10)))}%"></b></div>` : "";
  if(p.phase === "write") return `<div class="round">Round ${p.round} of ${p.of} · Writing clues</div>
    ${[0, 1].map(t => `<div class="state t${t}"><b>${esc(p.names[t])}</b> ${p.sent[t] ? `<span class="ok">clues sent ✓</span>` : `${esc(p.enc[t])} is writing…`}</div>`).join("")}${timer}
    <div class="note">${p.sent[0] !== p.sent[1] ? "The other Encryptor has 30 seconds left." : "Each Encryptor types three clues on their phone, one for each number in their secret code."}</div>`;
  if(p.phase === "guess" || p.phase === "reveal"){ const t = p.turn, rv = p.rev, code = rv ? rv.code : null, L = p.locks || {};
    const cards = `<div class="bigclues">${p.clues.map((w, i) => `<div class="bc"><span class="n">${code ? code[i] : "?"}</span><span class="w">${esc(w)}</span></div>`).join("")}</div>`;
    const res = (x, ok, label) => `<div class="res ${ok ? "ok" : "no"}">${label}: ${x ? esc(x.g.join("-")) + (x.by ? ` <small>by ${esc(x.by)}</small>` : "") : "no guess"} ${ok ? "✓" : "✗"}</div>`;
    const head = `<div class="round">Round ${p.round} of ${p.of} · ${esc(p.names[t])}'s clues</div><div class="enc t${t}">Encryptor: ${esc(p.enc[t])}</div>`;
    if(p.phase === "reveal") return `${head}${cards}<div class="code">The code was <b>${rv.code.join("-")}</b></div>
      ${res(rv.own, rv.ownOk, esc(p.names[t]) + " decoded")}${p.round > 1 ? res(rv.opp, rv.oppOk, esc(p.names[1 - t]) + " intercepted") : `<div class="res">No interception in round 1</div>`}
      ${!rv.ownOk ? `<div class="flag bad">Miscommunication for ${esc(p.names[t])}</div>` : ""}${rv.oppOk ? `<div class="flag good">Interception for ${esc(p.names[1 - t])}!</div>` : ""}`;
    return `${head}${cards}${timer}<div class="state t${t}"><b>${esc(p.names[t])}</b> ${L.own ? `<span class="ok">locked ✓</span>` : "is decoding…"}</div>
      <div class="state t${1 - t}"><b>${esc(p.names[1 - t])}</b> ${p.round === 1 ? "sits this one out (no interception in round 1)" : L.opp ? `<span class="ok">locked ✓</span>` : "is trying to intercept…"}</div>`; }
  if(p.phase === "tie") return `<div class="round">Tiebreak</div><div class="dcwho">Level on points. Each team types its guess for the other team's four keywords.</div>${timer}
    ${[0, 1].map(t => `<div class="state t${t}"><b>${esc(p.names[t])}</b> ${p.tie[t] ? `<span class="ok">locked ✓</span>` : "is guessing…"}</div>`).join("")}`;
  return ""; }
function decRender(){
  const el = $("#dcBody"), ph = DC.phase, g = DC.g;
  if(ph === "lobby"){ const ps = DC.players, c = DC.cfg, off = RELAY !== true, team = t => ps.filter(x => x.t === t), ok = team(0).length >= 2 && team(1).length >= 2 && !off;
    el.innerHTML = `<div class="dchead"><div class="dcbadge">Game mode</div><h1>Decrypto</h1>
      <p class="sub">Two teams, four secret words each. Give clues your team can decode and the other team can't crack. Two interceptions win, two miscommunications lose.</p></div>
      <div class="dcgrid">
      <div class="dcpanel">${off
        ? `<div class="dceye">${RELAY === null ? "Checking the connection…" : "Needs the Cloudflare link"}</div><p class="note">${RELAY === null ? "Hold on a second." : "Decrypto runs on phones, which talk to the game through the Cloudflare link. Open the game from there to play it."}</p>`
        : `<div class="dceye">Scan to join</div><div id="dcQr" class="dcqr"></div><p class="note">Everyone scans once, types a name and picks a team. Keep the page open for the whole game.</p>`}</div>
      ${[0, 1].map(t => `<div class="dcpanel t${t}"><div class="dceye">${decTeamName(t)} · ${team(t).length}</div>${team(t).length ? `<ul class="dcnames">${team(t).map(x => `<li><button data-move="${esc(x.p)}" title="Tap to move ${esc(x.n)} to the other team">${esc(x.n)}</button></li>`).join("")}</ul>` : `<p class="note">Waiting for players…</p>`}${t === 0 ? `<p class="note">Tap a name to move that player to the other team.</p><button class="dcbtn small" data-act="balance">Auto-balance</button>` : `<p class="note">Each team needs at least 2 players.</p>`}</div>`).join("")}
      <div class="dcpanel"><div class="dceye">Keyword packs</div><div class="dcseg">${DC_PACKS.map(([k, n]) => `<button data-pack="${k}" aria-pressed="${decOn(k)}">${n}</button>`).join("")}</div>
        <div class="dceye">Rounds (at most)</div>${decSeg("rounds", [[6, "6"], [8, "8"]], c.rounds)}
        <div class="dceye">Time to write clues</div>${decSeg("write", [[60, "60 s"], [90, "90 s"], [120, "2 min"], [0, "Off"]], c.write)}
        <div class="dceye">Time to guess the code</div>${decSeg("guess", [[45, "45 s"], [60, "60 s"], [90, "90 s"], [0, "Off"]], c.guess)}
        <div class="dceye">Hurry timer</div>${decSeg("hurry", [[1, "On"], [0, "Off"]], c.hurry ? 1 : 0)}<p class="note">Once one Encryptor has sent their clues, the other has 30 seconds.</p>
        <button class="dcbtn go" id="dcGo" ${ok ? "" : "disabled"}>Start</button></div>
      </div>`;
    const q = $("#dcQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(DC.phase === "lobby" && !$("#dco").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:decUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  const p = g.pub();
  if(p.phase === "over"){ const o = p.over, w = o.winner, draw = w === 2, why = {tokens:"on tokens", score:"on points", tiebreak:"in the tiebreak", ended:"when the host ended the game"}[o.why];
    el.innerHTML = `<div class="dchead"><div class="dcbadge">Decoded</div><h1>${draw ? "It's a draw" : esc(p.names[w]) + " wins"}</h1>
      <p class="sub">${draw ? "Both teams guessed the same number of keywords." : `${esc(p.names[w])} won ${why}.`}${o.tie ? ` Tiebreak: ${esc(p.names[0])} guessed ${o.tie.c[0]} of 4, ${esc(p.names[1])} guessed ${o.tie.c[1]} of 4.` : ""}</p></div>
      <div class="dcwrap over"><div class="dcin two">${decPanel(0, p, o.words[0])}${decPanel(1, p, o.words[1])}</div></div>
      <div class="dcrow"><button class="dcbtn go" id="dcAgain">Play again</button><button class="dcbtn ghost" id="dcHome2">Title screen</button></div>`; return; }
  const live = p.phase === "write" || p.phase === "guess" || p.phase === "tie";
  const ctl = (live ? `<button class="dcbtn small" data-act="skip">Skip ahead</button><button class="dcbtn small" data-act="more">+30 s</button>` : p.phase === "reveal" ? `<button class="dcbtn go small" data-act="next">${p.turn === 0 ? `${esc(p.names[1])}'s clues` : "Next round"}</button>` : "") +
    `<span class="gap"></span><button class="dcbtn ghost small" data-act="end">End game</button>`;
  el.innerHTML = `<div class="dcwrap"><div class="dcin">${decPanel(0, p)}<div class="mid">${decMid(g, p)}</div>${decPanel(1, p)}</div><div class="dcctl">${ctl}</div></div>`; }
$("#dco").addEventListener("click", e => {
  const set = e.target.closest("[data-set]"); if(set){ const k = set.dataset.set; DC.cfg[k] = k === "hurry" ? set.dataset.v === "1" : +set.dataset.v; decSave(); decRender(); return; }
  const pk = e.target.closest("[data-pack]"); if(pk){ const k = pk.dataset.pack, on = DC_PACKS.filter(([x]) => decOn(x)).length; if(decOn(k) && on === 1) return; DC.cfg.packs[k] = !decOn(k); decSave(); decRender(); return; }
  const mv = e.target.closest("[data-move]"); if(mv){ const x = DC.players.find(y => y.p === mv.dataset.move); if(x){ decMove(x, 1 - x.t); decRender(); } return; }
  if(e.target.closest("#dcGo")){ decStart(); return; }
  if(e.target.closest("#dcAgain")){ stopSiu(); DC.phase = "lobby"; DC.g = null; DC.dl = null; DC.v++; decPost(); decRender(); decPoll(); return; }
  if(e.target.closest("#dcHome") || e.target.closest("#dcHome2")){ showHome(); return; }
  const act = e.target.closest("[data-act]"); if(!act) return;
  if(act.dataset.act === "balance"){ const ps = DC.players.slice(); DCR.shuffle(ps); ps.forEach((x, i) => decMove(x, i % 2)); decRender(); }
  else if(act.dataset.act === "skip" && DC.g){ DC.dl = null; DC.g.timeout(); decChanged(); }
  else if(act.dataset.act === "more" && DC.g){ DC.dl = (DC.dl || Date.now()) + 30000; DC.total += 30; decPost(); decRender(); }
  else if(act.dataset.act === "next" && DC.g){ DC.g.advance(); decChanged(); }
  else if(act.dataset.act === "end") askConfirm("End the game now?", "This shows the winner screen with the current tokens.", "End game", () => { if(DC.g){ DC.g.endGame(); decChanged(); } }); });
$("#modeDec").onclick = decShow;
