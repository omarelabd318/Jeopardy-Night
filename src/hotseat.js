/* 6.59 (Omar): Hot Seat, a push-your-luck mode. One team at a time sits in the hot seat and plays a streak of clues. The pot doubles with every right
   answer (100, 200, 400, 800, 1,600 and on, no cap) and after each one the team banks it or risks it. A wrong answer loses the unbanked pot and the
   seat passes. Every clue is a random 200-500 (never a 100), hidden until the clue opens. High Roller look (green felt, casino chips, playing cards),
   chosen by Omar from four previews. It reuses the clue card and the winner screen; app.js only calls hsBanner, hsAwards, hsDone, hsUseSwap, hsAgain,
   hsSetupAgain and hsLeave. Setup is saved on this device in jn_hsCfg (the game itself isn't saved). To remove: see the 6.59 NOTES entry. */
const HS = {cfg:null, st:null};
const HS_LVLS = [200,300,400,500];   // 6.59 (Omar): clues are random from these pools, never a 100. To bring 100s back, add 100 to this list.
const HS_BAD = new Set(["act","impostor","password","closest","mix"]), HS_HALF = new Set(["song","pin","form","car","actor","footy","person"]), HS_WINNOTE = $("#winNote").textContent;   // rounds that need other teams are left out; half answers: song or singer, country only, team or year, a partial name in the four photo rounds (8.63)
const hsNum = n => Number(n).toLocaleString("en-US");
const hsPotAt = k => 100 * 2 ** k;   // the pot after k+1 right answers
const hsShuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function hsDefaults(){ const names = S.teams.map(t => t.name).slice(0, 6); while(names.length < 2) names.push("Team " + "ABCDEF"[names.length]);
  return {teams:names, turns:5, swap:true, photos:true, steal:false, football:"normal"}; }   // 8.27: football
HS.cfg = Object.assign(hsDefaults(), store.get("jn_hsCfg", {}));
const hsSave = () => store.set("jn_hsCfg", HS.cfg);

/* ---------- dealing clues ---------- */
const hsHas = id => HS_LVLS.some(l => ((DATA[id] || {})[l] || []).length);
/* 8.26 (Omar): NSFW only when its switch in the version panel is on (was: once unlocked in the Jeopardy setup, `|| unlocked.has(id)`) */
// 8.60 (Omar): a short line under each category name on the three cards
const HS_BLURB = {
  geo:"Countries, capitals, rivers and seas", landmark:"Famous places around the world", his:"Empires, wars and turning points", islam:"The Quran, Ramadan, Hajj and history",
  ww2:"Battles, leaders and the home front", year:"Three events, one year: name it", myth:"Gods, heroes and monsters", holi:"Feasts, festivals and customs",
  mus:"Singers, bands, albums and hits", songt:"Name the missing word in the title", song:"Name the song and the singer", oldies:"Classic hits from the 50s to the 90s",
  spot:"Order artists by Spotify listeners", igf:"Order stars by Instagram followers", lyric:"Finish the line of the song", lyricar:"Finish the Arabic song line",
  tv:"Films and shows from everywhere", ecin:"Egyptian films and Ramadan TV", plot:"A film explained badly: name it", ploteg:"An Egyptian film explained badly",
  got:"Westeros, the houses and the throne", peaky:"The Shelbys, Birmingham and the razors", bb:"Walter, Jesse and Albuquerque", pb:"Michael, Lincoln and Fox River",
  gta:"Los Santos, story mode and Online", vgames:"From Mario and PES to Elden Ring", st:"Hawkins and the Upside Down", office:"Michael, Dwight and Dunder Mifflin",
  netflix:"Money Heist, Squid Game and more", friends:"Ross, Rachel, Joey and Central Perk", himym:"Ted, Barney and MacLaren's", hp:"Hogwarts, spells and the wizarding world",
  hgames:"Katniss, Panem and the arena", marvel:"Films, shows and comics", blockbuster:"Big films and box office battles", toons:"The cartoons you grew up on",
  romcom:"Romantic comedies, near and far", pixar:"Shrek, Toy Story and friends", gk:"A bit of everything", facts:"Three facts, only one is true",
  lang:"Words, languages and where they came from", trans:"Translate the Spanish, French or Italian", flag:"Name the country from its flag", shape:"Name the country from its outline",
  pin:"Name the city on the map", ctry:"A city or a fact: name the country", sci:"Physics, chemistry, biology and more", space:"Planets, stars and missions",
  animal:"Wild facts about animals", fb:"Players, clubs and big moments", egfb:"Al Ahly, Zamalek and the Pharaohs", pl:"The Premier League since 2000",
  wc:"The World Cup, mostly since 1998", wc26:"The 48-team World Cup", ucl:"Champions League nights since 2000", xfer:"Name the player from the transfer",
  stad:"Clubs and their stadiums", cclub:"Three players, one club: name it", path:"Name the player from his clubs", whoami:"Three clues: name the footballer",
  shirt:"Name the shirt number", mgr:"Name the manager", fyear:"Three football events, one year", form:"Name the team from the lineup",
  score:"Name the final score", sport:"Every sport except football", tennis:"Grand Slams, legends and new stars", food:"Dishes, drinks and ingredients",
  ffood:"Chains, menus and street food", cal:"Pick the one with the most calories", cocktail:"Cocktails, spirits, beer and wine", foodpic:"Name the food from the photo",
  logo:"A blurred logo: name the brand", car:"A zoomed-in car: name it", actor:"A zoomed-in actor: name them", footy:"A zoomed-in footballer: name him",
  person:"A zoomed-in famous face: name them", egy:"All about Egypt", egyph:"Photos from all over Egypt", egh:"Egypt from 1900 to now",
  cairo:"Neighbourhoods, bridges and squares", arab:"Countries, cities and culture", prov:"Finish the Egyptian proverb", ramadan:"Ramadan TV, old and new",
  memeeg:"Meme faces and viral moments", emov:"Name the film or show from emojis", emeg:"Name the Egyptian title from emojis", emsen:"Decode the saying from emojis",
  emseg:"Decode the Egyptian phrase", ctryar:"Name the Arab country", rid:"Think before you answer", link:"Four clues: what links them?",
  mb:"Money, companies and the rich", curr:"Currencies and where they're used", brand:"Brand origins, logos and slogans", cars:"Makes, models and motorsport",
  tg:"Gadgets, apps and games", nick:"Who goes by this nickname?", books:"The books from school", quote:"Name where the line is from",
  quoteeg:"Name the Egyptian film or show", qblank:"Say the missing word in the quote", headl:"Three headlines, only one is real", order:"Put three events in order",
  gctry:"Name the country from the photo", x18:"Name the star from the photo"};
const hsOkCat = id => { const c = catById(id); return !!c && !c.mode && !HS_BAD.has(c.type) && !HIDDEN_IDS.has(id) && (!LOCKED_IDS.has(id) || nsfwOn()) && (HS.cfg.football !== "off" || !FB_IDS.has(id)) && (HS.cfg.photos || c.type !== "photo") && hsHas(id); };
function hsIdx(cat, lvl){   // an unplayed clue; with photo rounds off, never one that shows a photo
  const n = ((DATA[cat] || {})[lvl] || []).length; if(!n) return null;
  if(catById(cat).type === "photo") return HS.cfg.photos ? pickIdx(cat, lvl) : null;
  const ok = [...Array(n).keys()].filter(i => HS.cfg.photos || !imgRefFor(cat, lvl, i)); if(!ok.length) return null;
  const fresh = ok.filter(i => !S.used.has(`${cat}-${lvl}-${i}`)), from = fresh.length ? fresh : ok;
  return from[Math.floor(Math.random() * from.length)]; }
function hsCard(cat, lvl){ const idx = hsIdx(cat, lvl); if(idx == null) return null; warmRef(imgRefFor(cat, lvl, idx)); return {cat, lvl, idx}; }
function hsDeal(again){   // three category cards, each with a random hidden value; no category twice in one turn
  const st = HS.st, ids = hsShuffle(CATS.map(c => c.id).filter(id => hsOkCat(id) && !st.usedCats.includes(id) && fbKeep(id, HS.cfg.football))), out = [];   // 8.27: fbKeep thins football out on Fewer
  for(const cat of ids){ if(out.length >= 3) break;
    for(let t = 0; t < 8; t++){ const card = hsCard(cat, HS_LVLS[Math.floor(Math.random() * HS_LVLS.length)]); if(card){ out.push(card); break; } } }
  if(out.length < 3 && st.usedCats.length && !again){ st.usedCats = []; return hsDeal(true); }
  st.cards = out; }
const hsInit = () => { HS.st = {v:1, teams:HS.cfg.teams.map(n => ({name:n, score:0, swap:HS.cfg.swap, cswap:true})), turnNo:0, pot:0, streak:0, usedCats:[], cards:[], phase:"pick", cur:null, res:null, over:false, tb:null, tbWin:null}; hsDeal(); return HS.st; };
const hsTotal = () => HS.cfg.teams.length * HS.cfg.turns;
const hsSeat = () => { const st = HS.st; if(st.stl) return st.stl.by; return st.tb ? st.tb.ids[st.tb.i] : st.turnNo % st.teams.length; };
const hsNext = () => HS.st.streak ? HS.st.pot * 2 : 100;   // what the pot becomes on the next right answer

/* ---------- screens ---------- */
function hsEnter(){ if(S.mode === "hotseat") return; bingoLeave(); bidLeave(); S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, qrAns:S.qrAns, skipPhones:S.skipPhones};
  S.power = S.wager = S.steal = S.ffa = false; S.mode = "hotseat"; document.body.classList.add("hsmode"); }
function hsLeave(){ if(S.mode !== "hotseat") return;
  closeCard(); Object.assign(S, S.preMode || {}); S.mode = null; S.preMode = null; document.body.classList.remove("hsmode");
  $("#hotSeat").hidden = true; $("#hsSetup").hidden = true; $("#winEyebrow").textContent = "Final scores"; $("#playAgain").textContent = "Play again"; $("#winNote").textContent = HS_WINNOTE;
  try{ syncFfaOpt(); }catch(e){} }
function hsHideAll(){ ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup","#hotSeat","#hsSetup"].forEach(s => { const e = $(s); if(e) e.hidden = true; }); }
function hsSetupShow(){ hsEnter(); hsHideAll(); $("#hsSetup").hidden = false; renderHsSetup(); window.scrollTo(0, 0); }
function hsShow(){ hsEnter(); hsHideAll(); $("#hotSeat").hidden = false; renderHs(); window.scrollTo(0, 0); }
function renderHsSetup(){
  const c = HS.cfg, seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  $("#hsSetup").innerHTML = `
    <div><div class="hseye">Game mode</div><h1>Hot <span>Seat</span></h1>
      <p class="sub">One team sits in the hot seat and plays a streak of clues. Every right answer doubles the pot (100, 200, 400, 800, 1,600 and on), and after each one the team banks it or risks it on the next clue. A wrong answer loses the pot that isn't banked yet, and the seat passes to the next team. Clues are random from 200 to 500 and their value stays hidden until they open.</p></div>
    <div class="hspanel"><div class="hseye">Teams</div><div class="hsteams">${c.teams.map((n, i) => `<div class="hsteam"><input type="text" id="hsTeam${i}" data-hn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="hsb ghost" data-rm="${i}" aria-label="Remove ${esc(n)}">Remove</button>` : ""}</div>`).join("")}</div>
      ${c.teams.length < 6 ? `<div><button class="hsb ghost" id="hsAddTeam">Add team</button></div>` : ""}</div>
    <div class="hspanel"><div class="hseye">Turns per team</div>${seg("turns", [3, 4, 5, 6, 7, 8].map(n => [n, n]), c.turns)}<p class="note">Every team gets the same number of turns in the hot seat.</p></div>
    <div class="hspanel"><div class="hseye">One swap per team</div>${seg("swap", [["true", "On"], ["false", "Off"]], c.swap)}<p class="note">On: each team can swap one clue it doesn't like for another from the same category and value, once per game.</p></div>
    <div class="hspanel"><div class="hseye">Football clues</div>${seg("football", FB_OPTS, c.football)}<p class="note">${FB_NOTE}</p></div>
    <div class="hspanel"><div class="hseye">Photo rounds</div>${seg("photos", [["true", "On"], ["false", "Off"]], c.photos)}<p class="note">Off leaves out Guess the Face, Guess the Picture and every clue that shows a photo.</p></div>
    <div class="hspanel"><div class="hseye">Pass the pot</div>${seg("steal", [["true", "On"], ["false", "Off"]], c.steal)}<p class="note">On: a team that isn't sure can press Pass before the answer is revealed. It keeps 25% of the pot, and the next team gets the same clue (answer still hidden) for half the pot, with nothing lost if it is wrong. Passing has no limit across a game. Off: no Pass button.</p></div>
    <div class="row"><button class="hsb ghost" id="hsBack">Back to title</button><button class="hsb go" id="hsStart">Take a seat</button></div>`;
}
$("#hsSetup").addEventListener("click", e => {
  const c = HS.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "turns") v = +v; if(k === "swap" || k === "photos" || k === "steal") v = v === "true"; c[k] = v; hsSave(); renderHsSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); hsSave(); renderHsSetup(); return; }
  if(e.target.closest("#hsAddTeam")){ c.teams.push("Team " + "ABCDEF"[c.teams.length]); hsSave(); renderHsSetup(); return; }
  if(e.target.closest("#hsBack")){ showHome(); return; }
  if(e.target.closest("#hsStart")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCDEF"[i]); hsSave(); hsInit(); Snd.unlock(); hsShow(); }
});
$("#hsSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.hn; if(i !== undefined){ HS.cfg.teams[+i] = e.target.value; hsSave(); } });
$("#modeHot").onclick = hsSetupShow;

/* ---------- the table ---------- */
function renderHs(){
  const st = HS.st, root = $("#hsBody"); if(!st) return;
  if(st.over){ root.innerHTML = ""; return; }
  const seat = hsSeat(), t = st.teams[seat], n = st.streak, start = Math.max(0, n - 3), round = Math.floor(st.turnNo / st.teams.length) + 1;
  const hist = st.hist || [], at = k => k < n && hist[k] != null ? hist[k] : (n ? st.pot : 50) * 2 ** (k - n + 1);   // 8.63: the ladder shows the real pots so far, then doubles on from the pot
  const chips = [0,1,2,3,4].map(j => { const k = start + j, cls = k < n - 1 ? "done" : k === n - 1 ? "cur" : k === n ? "nxt" : ""; return `<div class="hschip ${cls}">${hsNum(at(k))}</div>`; }).join("");
  const sub = st.stl ? `PASSED ON · HALF THE POT · ${hsNum(st.stl.amt)}` : st.tb ? "TIE-BREAK · ONE 500 CLUE EACH" : `ROUND ${round} OF ${HS.cfg.turns} · ${n ? n + " RIGHT IN A ROW" : "FIRST CLUE OF THE TURN"}`;
  const lead = Math.max(...st.teams.map(m => m.score));
  const mid = st.tb ? "" : `<div class="hsstack"><b>${hsNum(st.pot)}</b><small>${st.pot ? "IN THE POT" : "NOTHING AT RISK YET"}</small></div>
    <button class="hscp bank" data-hs="bank" ${st.pot && st.phase === "pick" ? "" : "disabled"}><div>Bank<small>${hsNum(st.pot)}</small></div></button><div class="hscp risk"><div>Risk<small>${hsNum(hsNext())}</small></div></div>`;
  let low = "", ov = "";
  if(st.phase === "pick") low = `<div class="hshint">Tap a card to risk it${st.pot ? ", or bank the pot" : ""}${hsCanCswap() ? ` <button class="hsb cswap" data-hs="cswap" title="Don't like any of these? Swap all three for new categories. Once per team per game.">Swap categories (1 left)</button>` : ""}</div><div class="hscards">${st.cards.map((c, i) => `<button class="hspc${catById(c.cat).name.length > 28 ? " long" : ""}" data-card="${i}"><b>${esc(catById(c.cat).name).replace(/\//g, "/<wbr>")}</b>${HS_BLURB[c.cat] ? `<i class="hsd">${esc(HS_BLURB[c.cat])}</i>` : ""}</button>`).join("")}</div>`;
  else if(st.phase === "clue" || st.phase === "tbclue") low = `<div class="hscards one"><button class="hsb go" data-hs="reopen">Open the clue again</button></div>`;
  if(st.phase === "result"){ const r = st.res, last = st.turnNo + 1 >= hsTotal();
    ov = `<div class="hsov"><h2 class="${r.kind === "miss" && r.pts ? "lose" : ""}">${r.kind === "pass" ? "Passed" : r.kind === "bank" ? "Banked!" : r.kind === "half" ? "Half answer" : r.pts ? "Busted!" : "Missed it"}</h2>
      <div class="who">${r.kind === "pass" ? r.passed.map(x => `${esc(x.name)} passes and keeps ${hsNum(x.amt)}`).join("<br>") + (r.stole ? `<br>${esc(r.stole.name)} answers it and takes ${hsNum(r.stole.amt)}!` : r.stl ? `<br>${esc(r.stl)} missed it` : "") : r.kind === "miss" ? (r.pts ? `${esc(r.name)} loses ${hsNum(r.pts)}` : `${esc(r.name)} had nothing at risk`) + (r.stole ? `<br>${esc(r.stole.name)} steals ${hsNum(r.stole.amt)}!` : r.stl ? `<br>${esc(r.stl)} missed the steal` : "") : r.pts ? `${esc(r.name)} keeps ${hsNum(r.pts)}` : `${esc(r.name)} had nothing to keep`}</div>
      <button class="hsb go" data-hs="next">${last ? "Final scores" : "Next team"}</button></div>`; }
  if(st.phase === "tb"){ const names = st.tb.ids.map(i => esc(st.teams[i].name));
    ov = `<div class="hsov"><h2>Tie-break</h2><div class="who">${st.tb.msg || `${names.join(" and ")} are tied.`}</div><p class="note">${esc(t.name)} gets one 500 clue. Right wins it.</p><button class="hsb go" data-hs="tbopen">Open the clue</button></div>`; }
  root.innerHTML = `
    <div class="hssco">${st.teams.map((m, i) => `<div class="${i === seat ? "on" : ""}"><span>${esc(m.name)}${m.swap && HS.cfg.swap ? " ↻" : ""}</span><span class="${m.score < 0 ? "neg" : ""}">${hsNum(m.score)}</span></div>`).join("")}</div>
    <div class="hsttl">${st.stl ? `${esc(t.name)} got the pass` : `${esc(t.name)} is in the Hot Seat`}<small>${sub}</small></div>
    <div class="hsladder">${st.tb ? "" : chips}</div>${mid}${low}${ov}`;
}
function hsOpen(){ const st = HS.st, c = st.cur; renderHs();   // 6.62: redraw the table first, so "Back to the table" shows "Open the clue again" (it used to show the old, dead cards)
  S.turn = hsSeat(); PICKS[`${c.cat}-${c.lvl}`] = c.idx; openClue(c.cat, c.lvl); }
function hsResult(kind, pts){ const st = HS.st, t = st.teams[hsSeat()]; if(kind !== "miss") t.score += pts;
  st.res = {kind, pts, name:t.name}; st.phase = "result"; st.cur = null; if(kind === "miss") Snd.tick(); else Snd.chime(); renderHs(); }
function hsNextTeam(){ const st = HS.st; st.turnNo++; if(st.turnNo >= hsTotal()) return hsFinish();
  st.pot = 0; st.streak = 0; st.hist = []; st.usedCats = []; st.phase = "pick"; st.res = null; hsDeal(); renderHs(); }
function hsFinish(){ const st = HS.st, max = Math.max(...st.teams.map(t => t.score)), top = st.teams.map((t, i) => i).filter(i => st.teams[i].score === max);
  if(top.length < 2) return hsEnd();
  st.tb = {ids:top, i:0, res:{}, msg:""}; st.phase = "tb"; st.res = null; renderHs(); }
function hsTbOpen(){ const st = HS.st, ids = hsShuffle(CATS.map(c => c.id).filter(hsOkCat));
  for(const cat of ids){ const card = hsCard(cat, 500); if(card){ st.cur = card; st.phase = "tbclue"; hsOpen(); return; } } }
function hsTbDone(c, v){ const st = HS.st, tb = st.tb; if(v === undefined){ renderHs(); return; }
  tb.res[tb.ids[tb.i]] = v === 1; tb.i++;
  if(tb.i < tb.ids.length){ st.phase = "tb"; st.cur = null; tb.msg = ""; renderHs(); return; }
  const rights = tb.ids.filter(i => tb.res[i]);
  if(rights.length === 1){ st.tbWin = rights[0]; return hsEnd(); }
  const same = rights.length === 0 || rights.length === tb.ids.length;
  st.tb = {ids: same ? tb.ids : rights, i:0, res:{}, msg: same ? "Everyone " + (rights.length ? "got it" : "missed") + ", so go again." : "Still tied, go again."}; st.phase = "tb"; st.cur = null; renderHs(); }
// 8.61 (Omar): one category swap per team per game: trade all three cards for three new categories
function hsCanCswap(){ const st = HS.st, t = st && st.teams[hsSeat()]; return !!t && st.phase === "pick" && !st.tb && !st.stl && t.cswap !== false; }
function hsCswap(){ const st = HS.st; if(!hsCanCswap()) return; st.teams[hsSeat()].cswap = false;
  const old = st.cards.map(c => c.cat); st.usedCats.push(...old); hsDeal(); st.usedCats = st.usedCats.filter(id => !old.includes(id));   // old three only skipped for this deal
  Snd.blip(); renderHs(); }
function hsUseSwap(){ const st = HS.st, t = st && st.teams[hsSeat()]; if(!HS.cfg.swap || st.tb || st.stl || !t || !t.swap) return false; t.swap = false; return true; }
$("#hsBody").addEventListener("click", e => {
  const st = HS.st; if(!st) return;
  const card = e.target.closest("[data-card]");
  if(card && st.phase === "pick"){ st.cur = st.cards[+card.dataset.card]; st.usedCats.push(st.cur.cat); st.phase = "clue"; Snd.unlock(); Snd.blip(); hsOpen(); return; }
  const b = e.target.closest("[data-hs]"); if(!b) return; const k = b.dataset.hs;
  if(k === "bank" && st.pot && st.phase === "pick") hsResult("bank", st.pot);
  else if(k === "cswap") hsCswap();
  else if(k === "reopen" && st.cur) hsOpen();
  else if(k === "next") hsNextTeam();
  else if(k === "tbopen") hsTbOpen();
});
$("#hsHome").onclick = () => { const st = HS.st; if(st && !st.over && (st.turnNo > 0 || st.streak > 0)) askConfirm("Leave this game?", "Going to the title screen ends this Hot Seat game. It can't be resumed.", "Go to title", () => showHome(), true); else showHome(); };

/* ---------- the clue card (called from renderClue and the Done button in app.js) ---------- */
function hsBanner(c){ const st = HS.st; if(!st || !st.cur) return ""; st.cur.idx = c.idx;   // keeps "Open the clue again" on the same clue after a swap
  const nm = esc(st.teams[hsSeat()].name);
  if(st.stl) return `<p class="note hsbanner">${nm}: gets the pass. Right earns ${hsNum(st.stl.amt)} (half the pot), wrong costs nothing.</p>`;
  return st.tb ? `<p class="note hsbanner">Tie-break: ${nm} gets this 500 clue. Right wins it.</p>`
    : `<p class="note hsbanner">${nm} is in the Hot Seat. ${st.pot ? `Pot ${hsNum(st.pot)}: right makes it ${hsNum(hsNext())}, wrong loses ${hsNum(st.pot)}.` : "First clue of the turn: right starts the pot at 100, wrong loses nothing."}</p>`; }
function hsAwards(c){ const st = HS.st, i = hsSeat(), tb = !!st.tb;
  return `<div class="award"><div class="grp"><span>${esc(st.teams[i].name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">Right${tb ? "" : st.stl ? " · steal " + hsNum(st.stl.amt) : " · pot " + hsNum(hsNext())}</button>${!tb && !st.stl && HS_HALF.has(c.cat) ? `<button class="h${c.awards[i] === 0.5 ? " on" : ""}" data-aw="${i}" data-v="0.5">Half · pot ${hsNum(hsNext() / 2)}</button>` : ""}<button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong${tb || st.stl ? "" : " · lose " + hsNum(st.pot)}</button></div></div>`; }
function hsSwapBtn(c){ const st = HS.st, t = st && st.teams[hsSeat()]; if(c.preview || c.revealed) return "";
  /* 7.51 (Omar): "Clue played already" is a free swap that doesn't use the team's one swap. Without it Hot Seat only had the limited swap. */
  const played = `<button class="btn small" data-act="played" title="The group has already had this clue. Get another from the same category and value, and it doesn't use your swap.">Clue played already</button>`;
  const pass = HS.cfg.steal && st.pot && !st.tb && !st.stl ? `<button class="btn small" data-act="hspass" title="Not sure? Skip the clue and keep 25% of the pot. The next team gets one go at it for half the pot.">Pass: keep ${hsNum(Math.round(st.pot / 4))}</button>` : "";
  return played + pass + (HS.cfg.swap && t && t.swap && !st.tb && !st.stl ? `<button class="btn small" data-act="swap" title="Swap this clue for another from the same category and value. Once per team per game.">Swap clue (1 left)</button>` : ""); }
function hsDone(c){
  const st = HS.st, i = hsSeat(), v = c.awards[i];
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard(); if(!st) return;
  if(st.tb) return hsTbDone(c, v);
  if(st.stl){ if(v === undefined){ renderHs(); return; } return hsStealDone(v === 1); }
  if(v === undefined){ renderHs(); return; }   // closed with no result: back to the table, where the clue can be opened again
  if(v === 1){ st.pot = hsNext(); (st.hist = st.hist || [])[st.streak] = st.pot; st.streak++; st.phase = "pick"; st.cur = null; hsDeal(); Snd.blip(); renderHs(); return; }   // 8.63: from the pot itself, not hsPotAt(streak), so a half answer carries on
  /* 8.63 (Omar): a half answer no longer banks. The pot becomes half of what a right answer would make it and the turn goes on,
     doubling from there (pot 400: right makes 800, half keeps 400; first clue: half starts the pot at 50).
     8.62 and before: if(v === 0.5) return hsResult("half", st.pot);  a safe stop that banked the pot from before this clue. */
  if(v === 0.5){ st.pot = hsNext() / 2; (st.hist = st.hist || [])[st.streak] = st.pot; st.streak++; st.phase = "pick"; st.cur = null; hsDeal(); Snd.blip(); renderHs(); return; }
  hsResult("miss", st.pot); }
/* 7.76 (Omar): Pass (before Reveal answer, so the answer isn't on the TV). The team in the seat takes 25% of the unbanked pot and the next team gets one go at the same clue for half the pot, wrong costs nothing. Passing has no limit per game. */
function hsPass(){ const st = HS.st; if(!st || !st.cur || st.tb || st.stl || !st.pot || !HS.cfg.steal) return; const i = hsSeat(), t = st.teams[i], gain = Math.round(st.pot / 4);
  t.score += gain; const stl = st.stl || (st.stl = {by:i, amt:st.pot / 2, passed:[]}); stl.passed.push({name:t.name, amt:gain});
  if(st.teams.length < 2){ st.stl = null; st.res = {kind:"pass", name:t.name, passed:stl.passed}; S.used.add(`${st.cur.cat}-${st.cur.lvl}-${st.cur.idx}`); store.set("jn_used", [...S.used]); histNote();
    closeCard(); st.phase = "result"; st.cur = null; Snd.chime(); renderHs(); return; }
  stl.by = (i + 1) % st.teams.length; Snd.tick(); hsOpen(); }
function hsStealDone(right){ const st = HS.st, stl = st.stl, by = st.teams[stl.by]; st.stl = null;   /* right earns half the pot; wrong costs nothing */
  if(right) by.score += stl.amt;
  st.res = {kind:"pass", name:st.teams[hsSeat()].name, passed:stl.passed, stole:right ? {name:by.name, amt:stl.amt} : null, stl:right ? null : by.name}; st.phase = "result"; st.cur = null; if(right) Snd.chime(); else Snd.tick(); renderHs(); }
function hsEnd(){ const st = HS.st; st.over = true; st.tb = null; hsShow();
  const ranked = st.teams.map((t, i) => ({...t, i})).sort((a, b) => b.score - a.score || (b.i === st.tbWin) - (a.i === st.tbWin)), max = ranked[0].score;
  const top = st.tbWin != null ? [ranked[0]] : ranked.filter(t => t.score === max);
  const rankOf = (t, k) => st.tbWin != null ? k + 1 : 1 + ranked.filter(x => x.score > t.score).length;
  $("#winEyebrow").textContent = "Hot Seat"; winTheme("hotseat");
  $("#winTitle").innerHTML = top.length > 1 ? `It's a tie!<br><span>${esc(top.map(t => t.name).join(" & "))}</span>` : `${esc(top[0].name)}<br><span>win!</span>`;
  $("#podium").innerHTML = ranked.slice(0, 3).map((t, k) => { const r = rankOf(t, k); return `<div class="pod p${Math.min(r, 3)}"><div class="who">${esc(t.name)}</div><div class="pts">${hsNum(t.score)}</div><div class="step">${r}${["th","st","nd","rd"][(r % 100 > 10 && r % 100 < 14) || r % 10 > 3 ? 0 : r % 10]}</div></div>`; }).join("");
  $("#podium").hidden = false;
  $("#standings").innerHTML = ranked.length > 3 ? ranked.slice(3).map((t, k) => `<li><span>${rankOf(t, k + 3)}. ${esc(t.name)}</span><b>${hsNum(t.score)}</b></li>`).join("") : "";
  $("#winBoard").hidden = true; $("#winBox").hidden = false; $("#playAgain").textContent = "New game"; $("#winNote").textContent = "New game keeps the same teams and settings and resets the scores."; $("#playAgain").focus();
  confetti(); ledStart(); playWinSiu(); }
function hsAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; hsInit(); hsShow(); }
function hsSetupAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; hsSetupShow(); }
