/* 6.68 (Omar): Imposter, a social-deduction game mode. Everyone scans one code and joins from their phone (spy.html at /s?r=ROOM). Each round the
   laptop deals the same secret to every phone, except 1 or 2 imposters. A language round gives each player a language and 4 different words with
   their meanings; any other category gives one secret word (a movie, a footballer...). An imposter's card has the same layout and colours but random
   letters instead of the words, plus a small "you're the imposter" line (and, with Hints on, a vague hint). A random player speaks first. Talking
   and voting happen in real life; the game only deals. Without the Cloudflare link (no phones), the laptop is passed round instead.
   Case File look (his pick of three previews): charcoal and typewriter, paper cards, red stamp. Word data: v4work/imposter/*.json (embedded as IMP by build.js).
   It doesn't use the clue card or scores. app.js only calls impLeave from showHome. Setup is saved on this device in jn_impCfg; the game is not saved.
   To remove: delete this file, spy.html, the 6.68 CSS block and #impo section in head.html, the Imposter button, the /s and /api/imp, impcard, kick
   routes in worker/index.js, the IMP lines in build.js and the impLeave() call in showHome. */
const IM = {cfg:null, players:[], room:null, round:0, phase:"lobby", local:false, deal:null, last:null, seen:store.get("jn_impSeen", {}), langSeen:[], step:0, poll:null};
IM.cfg = Object.assign({imps:"auto", hints:false, cats:{}}, store.get("jn_impCfg", {}));
const imSave = () => store.set("jn_impCfg", IM.cfg);
const imCatIds = () => ["Languages", ...Object.keys((typeof IMP !== "undefined" && IMP.cats) || {})];
const imOn = id => IM.cfg.cats[id] !== false;
const imShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const imPick = a => a[Math.floor(Math.random() * a.length)];
function imScramble(t){ const V = "aeiou", C = "bcdfghjklmnprstvwyz"; return String(t).replace(/[A-Za-z]/g, (ch, i) => { const up = /[A-Z]/.test(ch), pool = i % 2 ? V : C, x = pool[Math.floor(Math.random() * pool.length)]; return up ? x.toUpperCase() : x; }); }
const imUrl = () => new URL(`s?r=${IM.room}`, location.href).href;

/* ---------- dealing ---------- */
function imWords(list, n){   // n players' worth of 4 different words each, never the same word twice in a round while the list lasts
  let pool = imShuffle(list.slice()), out = [];
  for(let p = 0; p < n; p++){ if(pool.length < 4) pool = imShuffle(list.slice()); out.push(pool.splice(0, 4)); }
  return out; }
function imSecret(id){   // a secret not dealt yet on this device, until the category has used them all
  const list = IMP.cats[id], used = new Set(IM.seen[id] || []); let ok = list.map((x, i) => i).filter(i => !used.has(i)); if(!ok.length){ IM.seen[id] = []; ok = list.map((x, i) => i); }
  const i = imPick(ok); IM.seen[id] = (IM.seen[id] || []).concat(i); store.set("jn_impSeen", IM.seen); return list[i]; }
function imDeal(){
  const ps = IM.players; if(ps.length < 3) return;
  const ids = imCatIds().filter(imOn); let opts = ids.filter(id => id !== IM.last); if(!opts.length) opts = ids;
  const id = imPick(opts); IM.last = id;
  const n = IM.cfg.imps === "auto" ? (ps.length >= 7 ? 2 : 1) : Math.min(+IM.cfg.imps, ps.length - 2);
  const imps = new Set(imShuffle(ps.map((p, i) => i)).slice(0, n)), cards = {}, hint = IM.cfg.hints;
  let reveal;
  if(id === "Languages"){
    const names = Object.keys(IMP.langs); let fresh = names.filter(l => !IM.langSeen.includes(l)); if(!fresh.length){ IM.langSeen = []; fresh = names; }
    const lang = imPick(fresh); IM.langSeen.push(lang); const L = IMP.langs[lang], sets = imWords(L.words, ps.length);
    ps.forEach((p, i) => { const rows = sets[i];
      cards[p.p] = imps.has(i)
        ? {fake:1, ft:1, title:imScramble(lang), rows:rows.map(w => [imScramble(w[0]), imScramble(w[1])]), sub:["you're the imposter"].concat(hint ? ["Hint: " + L.hint] : [])}
        : {title:lang, rows, sub:[]}; });
    reveal = ["Language: " + lang]; IM.deal = {title:"Languages", what:lang};
  } else {
    const [secret, h, label] = imSecret(id);
    ps.forEach((p, i) => { cards[p.p] = imps.has(i)
      ? {fake:1, title:id, big:imScramble(secret), sub:["you're the imposter"].concat(label ? [label] : [], hint && h ? ["Hint: " + h] : [])}
      : {title:id, big:secret, sub:[]}; });
    reveal = ["The word: " + secret]; IM.deal = {title:id, what:secret};
  }
  const names = [...imps].map(i => ps[i].n); reveal.push((names.length > 1 ? "The imposters: " : "The imposter: ") + names.join(" and "));
  IM.round++; IM.phase = "dealt"; Object.assign(IM.deal, {first:imPick(ps).n, imps:names, reveal, cards, nImp:n, step:0});
  imPost("deal"); renderImp(); }
function imPost(phase){ if(IM.local) return; const d = IM.deal;
  fetch("api/imp", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({r:IM.room, imp:{round:IM.round, phase:phase === "reveal" ? "reveal" : "deal", first:d.first, cards:d.cards, reveal:phase === "reveal" ? {lines:d.reveal} : null}})}).catch(() => {}); }

/* ---------- screens ---------- */
function imEnter(){ if(S.mode === "imposter") return; S.mode = "imposter"; document.body.classList.add("impmode"); }
function impLeave(){ if(S.mode !== "imposter") return; clearInterval(IM.poll); IM.poll = null; S.mode = null; document.body.classList.remove("impmode"); $("#impo").hidden = true; }
function impShow(){ imEnter();
  ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#survival","#survSetup","#hotseat","#hsSetup","#lobby"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  IM.room = newRoom(); IM.players = []; IM.round = 0; IM.phase = "lobby"; IM.deal = null; IM.last = null; IM.local = RELAY !== true;
  $("#impo").hidden = false; renderImp(); window.scrollTo(0, 0);
  clearInterval(IM.poll); IM.poll = setInterval(imPoll, 2000); imPoll(); }
async function imPoll(){ if(IM.local || $("#impo").hidden || IM.phase !== "lobby") return;
  try{ const j = await (await fetch(`api/players?r=${encodeURIComponent(IM.room)}`, {cache:"no-store"})).json(), ps = (j.players || []).map(x => ({p:x.p, n:x.n}));
    if(JSON.stringify(ps) !== JSON.stringify(IM.players)){ IM.players = ps; if(IM.phase === "lobby") renderImp(); } }catch(e){} }
const imSeg = (key, opts, cur) => `<div class="imseg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
function imCardHtml(c, who){ const sc = (f, t) => f ? imScramble(t) : t;   // the local (pass-the-laptop) card: same markup as spy.html
  return `<div class="who">${esc(who)}</div>${c.title ? `<div class="lang">${esc(c.ft ? imScramble(c.title) : c.title)}</div>` : ""}${(c.rows || []).map(w => `<div class="w"><b>${esc(sc(c.fake, w[0]))}</b><span>${esc(sc(c.fake, w[1]))}</span></div>`).join("")}${c.big ? `<div class="big">${esc(sc(c.fake, c.big))}</div>` : ""}<div class="sub">${(c.sub || []).map(esc).join("<br>")}</div>`; }
function renderImp(){
  const el = $("#impo"), ps = IM.players, c = IM.cfg, d = IM.deal;
  if(IM.phase === "lobby"){
    const ids = imCatIds();
    el.innerHTML = `<div class="imhead"><div class="imbadge">Game mode</div><h1>Imposter</h1>
      <p class="sub">Everyone gets the same secret except 1 or 2 imposters, whose card is full of random letters. Take turns saying a clue out loud, find the imposter, and vote them out. The game only deals the cards and picks who starts.</p></div>
      <div class="imgrid">
      <div class="impanel imjoin">${IM.local
        ? `<div class="imeye">No phones on this link</div><p class="note">Imposter works best on the Cloudflare link, where everyone scans a code. Here you can add the players below and pass this laptop round: each player holds their card to see it, then lets go.</p>
           <form id="imAddForm" class="imadd"><input id="imAdd" maxlength="24" placeholder="Player name" autocomplete="off"><button class="imbtn" type="submit">Add</button></form>`
        : `<div class="imeye">Scan to join</div><div id="imQr" class="imqr"></div><p class="note">Everyone scans once and types their name. Same players every round, no rescanning.</p>`}</div>
      <div class="impanel"><div class="imeye">Players · ${ps.length}</div>${ps.length ? `<ul class="imnames">${ps.map((p, i) => `<li><button data-kick="${i}" title="Remove ${esc(p.n)}">${esc(p.n)}</button></li>`).join("")}</ul><p class="note">Tap a name to remove that player.</p>` : `<p class="note">Waiting for players… you need at least 3.</p>`}
        <button class="imbtn go" id="imDeal" ${ps.length < 3 ? "disabled" : ""}>${IM.round ? "Deal round " + (IM.round + 1) : "Deal"}</button></div>
      <div class="impanel"><div class="imeye">Imposters</div>${imSeg("imps", [["auto", "Auto"], [1, "1"], [2, "2"]], c.imps)}<p class="note">Auto: 1 imposter for 3 to 6 players, 2 for 7 or more.</p>
        <div class="imeye">Hints</div>${imSeg("hints", [["true", "On"], ["false", "Off"]], c.hints)}<p class="note">On: the imposter's card also shows a vague hint, like the continent for a language or country.</p>
        <div class="imeye">Categories</div><div class="imcats">${ids.map(id => `<button data-cat="${esc(id)}" aria-pressed="${imOn(id)}">${esc(id)}</button>`).join("")}</div></div>
      </div><div class="row"><button class="imbtn ghost" id="imBack">Back to title</button></div>`;
    const q = $("#imQr"); if(q){ const draw = () => { if(!window.QRCode){ q.textContent = "The code maker didn't load yet."; setTimeout(() => { if(IM.phase === "lobby" && !$("#impo").hidden && !q.querySelector("img,canvas")) draw(); }, 1000); return; }
      q.innerHTML = ""; try{ new QRCode(q, {text:imUrl(), width:230, height:230, correctLevel:QRCode.CorrectLevel.L}); }catch(e){ q.textContent = "Couldn't draw the code."; } }; draw(); }
    return; }
  if(IM.local && IM.phase === "dealt" && d.step < ps.length){   // pass-the-laptop: one card at a time
    const p = ps[d.step], card = d.cards[p.p];
    el.innerHTML = `<div class="imhead"><div class="imbadge">Round ${IM.round} · ${esc(d.title)}</div><h1>Pass to ${esc(p.n)}</h1><p class="sub">Everyone else, look away. ${esc(p.n)}: hold the card to see it, let go to hide it, then tap Next.</p></div>
      <div class="imcard" id="imCard"><div class="imcover" id="imCover"><div class="imstamp">CLASSIFIED</div><div class="imtap">Hold to see your card.<br>Let go to hide it.</div></div><div id="imFace" hidden></div></div>
      <div class="row"><button class="imbtn go" id="imNext">${d.step + 1 < ps.length ? "Next player" : "Everyone has a card"}</button></div>`;
    const card$ = $("#imCard"), face = $("#imFace"), cover = $("#imCover");
    card$.onpointerdown = e => { e.preventDefault(); face.innerHTML = imCardHtml(card, p.n); face.hidden = false; cover.hidden = true; };
    ["pointerup", "pointercancel", "pointerleave"].forEach(ev => card$.addEventListener(ev, () => { face.hidden = true; face.innerHTML = ""; cover.hidden = false; }));
    card$.oncontextmenu = e => e.preventDefault(); return; }
  const rev = IM.phase === "reveal";
  el.innerHTML = `<div class="imhead"><div class="imbadge">Round ${IM.round} · ${esc(d.title)}</div>
    <h1>${rev ? "Case closed" : IM.local ? "Cards dealt" : "Check your phone"}</h1>
    <p class="sub">${ps.length} players, ${d.nImp} imposter${d.nImp > 1 ? "s" : ""}. ${rev ? "Here is the truth." : "Take turns saying one thing about your card, then vote out who you think is the imposter."}</p></div>
    <div class="imfirst"><div class="imeye">Goes first</div><div class="imwho">${esc(d.first)}</div></div>
    ${rev ? `<div class="impanel imrev">${d.reveal.map(l => `<div>${esc(l)}</div>`).join("")}</div>` : ""}
    <div class="row">${rev ? "" : `<button class="imbtn go" id="imReveal">Reveal</button>`}<button class="imbtn ${rev ? "go" : ""}" id="imNew">New round</button><button class="imbtn ghost" id="imLobby">Players and setup</button><button class="imbtn ghost" id="imBack">Title screen</button></div>`; }
$("#impo").addEventListener("click", e => {
  const c = IM.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "hints") v = v === "true"; else if(v !== "auto") v = +v; c[k] = v; imSave(); renderImp(); return; }
  const cat = e.target.closest("[data-cat]"); if(cat){ const id = cat.dataset.cat; c.cats[id] = !imOn(id); if(!imCatIds().some(imOn)) c.cats[id] = true; imSave(); renderImp(); return; }
  const kick = e.target.closest("[data-kick]"); if(kick){ const p = IM.players[+kick.dataset.kick]; if(!IM.local) fetch("api/kick", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({r:IM.room, p:p.p})}).catch(() => {});
    IM.players.splice(+kick.dataset.kick, 1); renderImp(); return; }
  if(e.target.closest("#imDeal") || e.target.closest("#imNew")){ imDeal(); return; }
  if(e.target.closest("#imReveal")){ IM.phase = "reveal"; imPost("reveal"); renderImp(); return; }
  if(e.target.closest("#imLobby")){ IM.phase = "lobby"; renderImp(); imPoll(); return; }
  if(e.target.closest("#imNext")){ IM.deal.step++; renderImp(); return; }
  if(e.target.closest("#imBack")){ showHome(); return; } });
$("#impo").addEventListener("submit", e => { if(e.target.id !== "imAddForm") return; e.preventDefault(); const i = $("#imAdd"), n = i.value.trim().slice(0, 24); if(!n) return;
  IM.players.push({p:"L" + IM.players.length + Math.floor(Math.random() * 1e6), n}); renderImp(); const f = $("#imAdd"); if(f) f.focus(); });
$("#modeImp").onclick = impShow;
