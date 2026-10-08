/* 6.49 (Omar): Bidding Wars, mode 2 of his rulebook. Teams bid on lots they only know by a title (with the categories it includes listed under it)
   and a tier; the buyer answers and wins or loses exactly the bid. Entry $200–$300 (max bid $600), Medium $300–$400 ($1,200), Expert $400–$500
   ($1,500). Bidding opens at the bottom of the range and goes up $50 at a time. 10–15 lots, each with a random tier. Trading Floor look (black,
   amber LED numbers, green bid buttons, a score ticker), chosen by Omar from three previews. It reuses the clue card and the winner screen; app.js
   only calls bidBanner, bidAwards, bidDone, bidAgain, bidSetupAgain and bidLeave. Setup is saved on this device in jn_bidCfg (the game itself is not saved since 6.50).
   To remove: see the 6.49 NOTES entry. */
const BW = {cfg:null, st:null, timer:null, left:0};
const BW_TIERS = [{k:"Entry", lv:[200,300], cap:600}, {k:"Medium", lv:[300,400], cap:1200}, {k:"Expert", lv:[400,500], cap:1500}];
const BW_WINNOTE = $("#winNote").textContent, BW_STEP = 50, BW_RAISES = [50,100,200], BW_HALF = new Set(["song","pin"]);   // the two categories that give half points (song or singer; country only); half the bid there
/* the titles shown while bidding; each groups related categories from one setup section. photo: needs the photo rounds on. off: off by default */
const BW_TITLES = [
  ["egfilm", "Egyptian Film, TV & Music", ["ecin","ramadan","ploteg","quoteeg","emeg","lyricar"]],
  ["egplace", "Egypt: Places & History", ["egy","egh","cairo","egyph"]],
  ["egcult", "Egyptian Culture & Sayings", ["prov","memeeg","emseg"]],
  ["arab", "Arab World", ["arab","ctryar"]],
  ["fbplay", "Football: Players & Careers", ["whoami","cclub","path","xfer","shirt"]],
  ["fbcups", "Football: Leagues & Cups", ["pl","ucl","wc","wc26","score","fyear","egfb"]],
  ["fbcoach", "Football: Coaches, Tactics & Grounds", ["mgr","form","stad","fb"]],
  ["sports", "Other Sports", ["sport","tennis"]],
  ["movies", "Movies & Cartoons", ["tv","blockbuster","romcom","pixar","toons"]],
  ["franch", "Franchises", ["marvel","hp","hgames"]],
  ["series", "TV Series", ["got","peaky","bb","pb","st","office","friends","himym","netflix"]],
  ["words", "Quotes, Plots & Emoji", ["plot","lit","emov","quote","qblank"]],
  ["songs", "Songs & Lyrics", ["songt","song","oldies","lyric"]],
  ["artists", "Music Artists & Charts", ["mus","spot","igf"]],
  ["games", "Video Games", ["gta","vgames"]],
  ["geo", "World Geography", ["geo","ctry","landmark"]],
  ["flags", "Flags & Maps", ["flag","shape","pin"]],
  ["lang", "Languages", ["lang","trans"]],
  ["hist", "History & Myth", ["his","ww2","year","myth"]],
  ["islam", "Islam & Traditions", ["islam","holi"]],
  ["sci", "Science, Space & Nature", ["sci","space","animal","facts"]],
  ["food", "Food & Drink", ["food","ffood","cal","cocktail"]],
  ["biz", "Business & Tech", ["mb","curr","brand","tg"]],
  ["gk", "General Knowledge", ["gk","nick","books","cars"]],
  ["faces", "Guess the Face", ["actor","person","footy"], "photo"],
  ["pics", "Guess the Picture", ["car","foodpic","logo","gctry"], "photo"],
  ["puzz", "Puzzles", ["rid","link","headl","order","emsen"], "off"]];
const BW_PHOTO_CATS = new Set(["egyph", ...BW_TITLES.filter(t => t[3] === "photo").flatMap(t => t[2])]);
const bwCats = t => t[2].filter(id => catById(id) && !HIDDEN_IDS.has(id) && (BW.cfg.photos || !BW_PHOTO_CATS.has(id)));
const bwTitleOn = t => BW.cfg.titles[t[0]] !== undefined ? BW.cfg.titles[t[0]] : t[3] !== "off";
const bwMoney = v => (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US");
function bwDefaults(){ const names = S.teams.map(t => t.name).slice(0, 6); while(names.length < 2) names.push("Team " + "ABCDEF"[names.length]);
  return {teams:names, lots:12, secs:6, photos:true, titles:{}}; }
BW.cfg = Object.assign(bwDefaults(), store.get("jn_bidCfg", {}));
const bwSave = () => store.set("jn_bidCfg", BW.cfg);
const bwPersist = () => {};   // 6.50: Bidding Wars games aren't saved (was: if(BW.st) store.set("jn_bid", BW.st))

/* ---------- dealing lots ---------- */
function bwIdx(cat, lvl){   // an unplayed clue; with photo rounds off, never one that shows a photo
  const n = (pool(cat, lvl) || []).length; if(!n) return null;
  if(catById(cat).type === "photo") return BW.cfg.photos ? pickIdx(cat, lvl) : null;
  const ok = [...Array(n).keys()].filter(i => BW.cfg.photos || !imgRefFor(cat, lvl, i)); if(!ok.length) return null;
  const fresh = ok.filter(i => !S.used.has(`${cat}-${lvl}-${i}`)), from = fresh.length ? fresh : ok;
  return from[Math.floor(Math.random() * from.length)]; }
function bwTiers(n){ const t = []; if(n >= 9) [0,1,2].forEach(k => t.push(k, k, k)); while(t.length < n) t.push(Math.floor(Math.random() * 3)); return bgShuffle(t); }
function bwLot(tier, prev, seen){
  const titles = BW_TITLES.filter(t => bwTitleOn(t) && bwCats(t).length);
  let opts = titles.filter(t => t[0] !== prev && !seen.has(t[0])); if(!opts.length) opts = titles.filter(t => t[0] !== prev); if(!opts.length) opts = titles;
  for(let tries = 0; tries < 30; tries++){ const t = opts[Math.floor(Math.random() * opts.length)], cats = bwCats(t);
    const cat = cats[Math.floor(Math.random() * cats.length)], lvl = BW_TIERS[tier].lv[Math.floor(Math.random() * 2)], idx = bwIdx(cat, lvl);
    if(idx == null) continue;
    seen.add(t[0]); warmRef(imgRefFor(cat, lvl, idx)); return {title:t[0], tier, cat, lvl, idx, buyer:null, price:0, res:null}; }
  return null; }
function bwDeal(n){ const lots = [], seen = new Set(); let prev = null;
  for(const tier of bwTiers(n)){ if(seen.size >= BW_TITLES.length - 2) seen.clear(); const l = bwLot(tier, prev, seen); if(l){ lots.push(l); prev = l.title; } }
  return lots; }
const bwInit = () => ({v:1, lots:bwDeal(BW.cfg.lots), i:0, teams:BW.cfg.teams.map(n => ({name:n, score:0})), bid:0, leader:-1, phase:"lot", extra:0, over:false});

/* ---------- screens ---------- */
function bidEnter(){ if(S.mode === "bidding") return; bingoLeave(); S.preMode = {power:S.power, wager:S.wager, steal:S.steal, ffa:S.ffa, skipPhones:S.skipPhones};
  S.power = S.wager = S.steal = S.ffa = false; S.mode = "bidding"; document.body.classList.add("bidmode"); }
/* 6.50 (Omar): no resuming a Bidding Wars game. It isn't saved any more, and an old save is cleared. To undo: restore this function,
   bwPersist and the #bidResume click handler from 6.49, the #bidResume button in head.html, and the plain bwHome handler. */
function bidResumeBtn(){ try{ localStorage.removeItem("jn_bid"); }catch(e){} }
function bidLeave(){ bidResumeBtn(); if(S.mode !== "bidding") return; bwStop();
  closeCard(); Object.assign(S, S.preMode || {}); S.mode = null; S.preMode = null; document.body.classList.remove("bidmode");
  $("#bidding").hidden = true; $("#bidSetup").hidden = true; $("#winEyebrow").textContent = "Final scores"; $("#playAgain").textContent = "Play again"; $("#winNote").textContent = BW_WINNOTE;
  try{ syncFfaOpt(); }catch(e){} }
function bwHideAll(){ ["#titleScreen","#setup","#game","#scores","#bingo","#bingoSetup","#bidding","#bidSetup"].forEach(s => { const e = $(s); if(e) e.hidden = true; }); }
function bidSetupShow(){ bidEnter(); bwStop(); bwHideAll(); $("#bidSetup").hidden = false; renderBidSetup(); window.scrollTo(0, 0); }
function bidShow(){ bidEnter(); bwHideAll(); $("#bidding").hidden = false; renderBid(); window.scrollTo(0, 0); }
function renderBidSetup(){
  const c = BW.cfg, seg = (key, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${t}</button>`).join("")}</div>`;
  $("#bidSetup").innerHTML = `
    <div><div class="bweye">Game mode</div><h1>Bidding <span>Wars</span></h1>
      <p class="sub">Every lot shows a title, the categories it includes and a difficulty range. Teams bid for the right to answer; the highest bid buys it and only the buyer answers. Right wins the bid, wrong loses it. Scores can go negative and any team can still bid up to the max.</p>
      <div class="bwtiers">${BW_TIERS.map(t => `<div><b>${t.k}</b><span>$${t.lv[0]}–$${t.lv[1]}</span><small>Opens at $${t.lv[0]} · raise $${BW_RAISES.join("/$")} · max ${bwMoney(t.cap)}</small></div>`).join("")}</div></div>
    <div class="bwpanel"><div class="bweye">Teams</div><div class="bwteams">${c.teams.map((n, i) => `<div class="bwteam"><input type="text" id="bwTeam${i}" data-bn="${i}" value="${esc(n)}" maxlength="24" aria-label="Team ${i + 1} name">${c.teams.length > 2 ? `<button class="bwbtn ghost" data-rm="${i}" aria-label="Remove ${esc(n)}">Remove</button>` : ""}</div>`).join("")}</div>
      ${c.teams.length < 6 ? `<div><button class="bwbtn ghost" id="bwAddTeam">Add team</button></div>` : ""}</div>
    <div class="bwpanel"><div class="bweye">Number of lots</div>${seg("lots", [10, 11, 12, 13, 14, 15].map(n => [n, n]), c.lots)}<p class="note">Each lot gets a random tier. With 10 or more, every tier comes up at least three times.</p></div>
    <div class="bwpanel"><div class="bweye">Sold timer</div>
      <div class="bwslide"><input type="range" id="bwSecs" min="3" max="20" step="1" value="${c.secs || 6}" ${c.secs ? "" : "disabled"} aria-label="Seconds until sold"><output id="bwSecsOut">${c.secs ? c.secs + " seconds" : "Off"}</output>
      <button class="bwbtn ghost" data-set="secs" data-v="${c.secs ? 0 : 6}">${c.secs ? "Turn off (host taps SOLD)" : "Turn on"}</button></div>
      <p class="note">After each bid the lot is sold when this many seconds pass with no higher bid. The host can always tap SOLD early.</p></div>
    <div class="bwpanel"><div class="bweye">Photo rounds</div>${seg("photos", [["true", "On"], ["false", "Off"]], c.photos)}<p class="note">Off leaves out Guess the Face, Guess the Picture, Egypt: Photo Edition and every clue that shows a photo.</p></div>
    <div class="bwpanel"><div class="bweye">Titles in the auction</div><div class="bwtitles">${BW_TITLES.map(t => { const off = t[3] === "photo" && !c.photos;
      return `<button data-title="${t[0]}" aria-pressed="${bwTitleOn(t) && !off}" ${off ? "disabled" : ""}><b>${esc(t[1])}</b><small>${esc(t[2].filter(id => catById(id)).map(id => catById(id).name).join(", "))}</small></button>`; }).join("")}</div></div>
    <div class="row"><button class="bwbtn ghost" id="bwBack">Back to title</button><button class="bwbtn go" id="bwStart">Start the auction</button></div>`;
}
$("#bidSetup").addEventListener("click", e => {
  const c = BW.cfg, set = e.target.closest("[data-set]");
  if(set){ const k = set.dataset.set; let v = set.dataset.v; if(k === "lots" || k === "secs") v = +v; if(k === "photos") v = v === "true"; c[k] = v; bwSave(); renderBidSetup(); return; }
  const tt = e.target.closest("[data-title]"); if(tt){ const t = BW_TITLES.find(x => x[0] === tt.dataset.title); c.titles[t[0]] = !bwTitleOn(t);
    if(!BW_TITLES.some(x => bwTitleOn(x) && bwCats(x).length)) c.titles[t[0]] = true; bwSave(); renderBidSetup(); return; }
  const rm = e.target.closest("[data-rm]"); if(rm){ c.teams.splice(+rm.dataset.rm, 1); bwSave(); renderBidSetup(); return; }
  if(e.target.closest("#bwAddTeam")){ c.teams.push("Team " + "ABCDEF"[c.teams.length]); bwSave(); renderBidSetup(); return; }
  if(e.target.closest("#bwBack")){ showHome(); return; }
  if(e.target.closest("#bwStart")){ c.teams = c.teams.map((n, i) => n.trim() || "Team " + "ABCDEF"[i]); bwSave(); BW.st = bwInit(); bwPersist(); Snd.unlock(); bidShow(); }
});
$("#bidSetup").addEventListener("input", e => { const i = e.target.dataset && e.target.dataset.bn;
  if(i !== undefined){ BW.cfg.teams[+i] = e.target.value; bwSave(); return; }
  if(e.target.id === "bwSecs"){ BW.cfg.secs = +e.target.value; $("#bwSecsOut").textContent = BW.cfg.secs + " seconds"; bwSave(); } });
$("#modeBid").onclick = bidSetupShow;

/* ---------- the auction ---------- */
const bwLotNow = () => BW.st && BW.st.lots[BW.st.i];
const bwTitle = id => BW_TITLES.find(t => t[0] === id);
function bwStop(){ clearInterval(BW.timer); BW.timer = null; }
function bwCountText(){ const s = BW.cfg.secs; if(!BW.timer) return ""; return BW.left > s*2/3 ? `Bidding open · ${BW.left}s` : BW.left > s/3 ? `Going once… ${BW.left}s` : `Going twice… ${BW.left}s`; }
function bwCount(){ bwStop(); if(!BW.cfg.secs) return; BW.left = BW.cfg.secs; const el = () => $("#bwCount");
  BW.timer = setInterval(() => { BW.left--; if(BW.left <= 0){ bwStop(); bwSold(); return; } if(BW.left <= 3) Snd.tick(); const e = el(); if(e) e.textContent = bwCountText(); }, 1000); }
function renderBid(){
  const st = BW.st, root = $("#bidBody"); if(!st) return;
  if(st.over){ root.innerHTML = ""; return; }
  const lot = bwLotNow(), tier = BW_TIERS[lot.tier], t = bwTitle(lot.title);
  const cats = bwCats(t).map(id => catById(id).name);
  const lead = Math.max(...st.teams.map(m => m.score));
  const ticker = st.teams.map(m => `${esc(m.name.toUpperCase())} ${m.score >= 0 ? "▲" : "▼"} ${bwMoney(m.score)}`).join("  ·  ") + `  ·  LOT ${st.i + 1} OF ${st.lots.length}  ·  ${esc(t[1].toUpperCase())}  ·  ${tier.k.toUpperCase()} $${tier.lv[0]}–$${tier.lv[1]}  ·  MAX BID ${bwMoney(tier.cap)}  ·  `;
  root.innerHTML = `
    <div class="bwtop"><div class="bwbrand">Bidding Wars</div><div class="bwlotno">Lot ${st.i + 1} of ${st.lots.length}</div></div>
    <div class="bwmid">
      <div class="bwlot">
        <span class="bwtier">${tier.k} · $${tier.lv[0]}–$${tier.lv[1]}</span>
        <div class="bwtitle">${esc(t[1])}</div>
        <div class="bwinc"><b>Includes</b>${esc(cats.join(", "))}</div>
      </div>
      <div class="bwbidbox">
        <div class="bwlab">${st.bid ? "Current bid" : "Opening bid"}</div>
        <div class="bwbid" id="bwBid">${bwMoney(st.bid || tier.lv[0])}</div>
        <div class="bwleader">${st.leader < 0 ? "No bids yet" : esc(st.teams[st.leader].name) + " leads"}</div>
        <div class="bwcap"><div class="bwcapbar"><i style="width:${st.bid ? (st.bid - tier.lv[0]) / (tier.cap - tier.lv[0]) * 100 : 0}%"></i></div><div class="bwcaplab"><span>$${tier.lv[0]}</span><span>Max ${bwMoney(tier.cap)}</span></div></div>
        <div class="bwcount" id="bwCount" aria-live="polite">${BW.timer ? bwCountText() : st.bid ? (BW.cfg.secs ? "" : "Tap SOLD when bidding stops") : "Any team can open"}</div>
      </div>
    </div>
    <div class="bwbottom">
      <div class="bwteamsrow" style="--n:${st.teams.length}">${st.teams.map((m, i) => { const next = bwNext(i), can = i !== st.leader && next > 0, r = bwRaise(i);
        return `<div class="bwt${i === st.leader ? " lead" : ""}${m.score === lead && lead !== 0 ? " top" : ""}"><div class="bwtn"><span>${esc(m.name)}</span><span class="bwts${m.score < 0 ? " neg" : ""}">${bwMoney(m.score)}</span></div>
          <div class="bwraise" role="group" aria-label="${esc(m.name)} raises by">${BW_RAISES.map(v => `<button data-raise="${i}" data-v="${v}" class="${v === r ? "on" : ""}" aria-pressed="${v === r}">+${v}</button>`).join("")}</div>
          <button data-bid="${i}" ${can ? "" : "disabled"}>${i === st.leader ? "Leading" : !next ? "At max" : "Bid " + bwMoney(next)}</button></div>`; }).join("")}</div>
      <div class="bwhost"><button class="sold" data-bw="sold" ${st.leader < 0 ? "disabled" : ""}>SOLD</button><button data-bw="unsold" ${st.leader < 0 ? "" : "disabled"}>Unsold</button></div>
    </div>
    <div class="bwticker" aria-hidden="true"><span>${ticker}${ticker}</span></div>
    <div class="bwsoldv" id="bwSoldV" hidden></div>`;
  if(st.phase !== "lot") bwShowSold(true);
}
/* 6.52: each team picks how much its next bid raises by (+$50/$100/$200, kept for the whole game); a raise past the max stops at the max. The first bid still opens at the range minimum */
function bwRaise(i){ const r = BW.st.teams[i].raise; return BW_RAISES.includes(r) ? r : BW_STEP; }
function bwNext(i){ const st = BW.st, tier = BW_TIERS[bwLotNow().tier]; if(!st.bid) return tier.lv[0]; return st.bid >= tier.cap ? 0 : Math.min(st.bid + bwRaise(i), tier.cap); }
function bwPlace(i){ const st = BW.st, lot = bwLotNow(), tier = BW_TIERS[lot.tier]; if(st.phase !== "lot" || i === st.leader) return;
  const next = bwNext(i); if(!next) return;
  st.bid = next; st.leader = i; Snd.unlock(); Snd.blip(); bwCount(); renderBid(); const b = $("#bwBid"); if(b){ b.classList.add("pop"); setTimeout(() => b.classList.remove("pop"), 160); }
  if(next === tier.cap) setTimeout(() => { if(BW.st === st && st.phase === "lot" && st.bid === tier.cap) bwSold(); }, 900); }   // nobody can go higher
function bwSold(){ const st = BW.st, lot = bwLotNow(); bwStop(); if(st.phase !== "lot" || st.leader < 0) return;
  st.phase = "sold"; lot.buyer = st.leader; lot.price = st.bid; bwPersist(); Snd.chime(); bwShowSold(false); }
function bwShowSold(again){ const st = BW.st, lot = bwLotNow(), v = $("#bwSoldV"); if(!v || !lot || lot.buyer == null) return;
  v.innerHTML = `<h2>SOLD!</h2><div class="who">to ${esc(st.teams[lot.buyer].name)} for ${bwMoney(lot.price)}</div>
    <div class="real"${again ? ' style="opacity:1;animation:none"' : ""}><small>The category</small>${esc(catById(lot.cat).name)} · $${lot.lvl}</div>${again ? `<p class="note">No result was saved.</p>` : ""}<button class="bwbtn go" data-bw="open"${again ? ' style="opacity:1;animation:none"' : ""}>${again ? "Open the clue again" : "Open the clue"}</button>`; v.hidden = false; }
function bwUnsold(){ const st = BW.st, lot = bwLotNow(); bwStop(); if(st.phase !== "lot" || st.leader >= 0) return;
  /* an unsold lot doesn't count: it's swapped for a fresh one of the same tier (up to 5 times a game), otherwise the game just moves on */
  const fresh = st.extra < 5 ? bwLot(lot.tier, lot.title, new Set(st.lots.map(l => l.title))) : null;
  if(fresh){ st.lots[st.i] = fresh; st.extra++; } else { lot.res = "unsold"; st.i++; }
  st.bid = 0; st.leader = -1; bwPersist(); if(st.i >= st.lots.length) return bwEnd();
  const v = $("#bwSoldV"); v.innerHTML = `<h2 class="uns">Unsold</h2><div class="who">Nobody opened. ${fresh ? "Here's a different lot." : "On to the next one."}</div><button class="bwbtn go" data-bw="next">Next lot</button>`; v.hidden = false; }
function bwOpen(){ const st = BW.st, lot = bwLotNow(); st.phase = "clue"; bwPersist();
  S.turn = lot.buyer; PICKS[`${lot.cat}-${lot.lvl}`] = lot.idx; openClue(lot.cat, lot.lvl); }
$("#bidBody").addEventListener("click", e => {
  const r = e.target.closest("[data-raise]"); if(r){ if(BW.st.phase === "lot"){ BW.st.teams[+r.dataset.raise].raise = +r.dataset.v; bwPersist(); renderBid(); } return; }
  const b = e.target.closest("[data-bid]"); if(b){ bwPlace(+b.dataset.bid); return; }
  const a = e.target.closest("[data-bw]"); if(!a) return; const k = a.dataset.bw;
  if(k === "sold") bwSold(); else if(k === "unsold") bwUnsold(); else if(k === "open") bwOpen(); else if(k === "next") renderBid();
});
$("#bwHome").onclick = () => { const st = BW.st; if(st && !st.over && (st.i > 0 || st.leader >= 0)) askConfirm("Leave this game?", "Going to the title screen ends this Bidding Wars game. It can't be resumed.", "Go to title", () => { bwStop(); showHome(); }, true); else { bwStop(); showHome(); } };   // 6.50: confirm, since there's no Resume Bidding any more

/* ---------- the clue card (called from renderClue and the Done button in app.js) ---------- */
function bidBanner(c){ const st = BW.st, lot = bwLotNow(); if(!st || !lot || lot.buyer == null) return "";
  return `<p class="note bwbanner">${esc(st.teams[lot.buyer].name)} bought this for ${bwMoney(lot.price)}. Only they answer.</p>`; }
function bidAwards(c){ const st = BW.st, lot = bwLotNow(); if(!lot || lot.buyer == null) return ""; const i = lot.buyer, p = lot.price;
  return `<div class="award"><div class="grp"><span>${esc(st.teams[i].name)}</span><button class="y${c.awards[i] === 1 ? " on" : ""}" data-aw="${i}" data-v="1">Right +${bwMoney(p)}</button>${BW_HALF.has(c.cat) ? `<button class="h${c.awards[i] === 0.5 ? " on" : ""}" data-aw="${i}" data-v="0.5">Half +${bwMoney(Math.round(p / 2))}</button>` : ""}<button class="n${c.awards[i] === -1 ? " on" : ""}" data-aw="${i}" data-v="-1">Wrong −${bwMoney(p).slice(1)}</button></div></div>`; }
function bidDone(c){
  const st = BW.st, lot = bwLotNow(), v = c.awards[lot ? lot.buyer : -1];
  S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
  closeCard(); if(!lot) return;
  if(v === undefined){ st.phase = "sold"; bwPersist(); bidShow(); return; }   // closed with no result: back to the SOLD card to open it again
  const pts = v === 0.5 ? Math.round(lot.price / 2) : v * lot.price;
  st.teams[lot.buyer].score += pts; lot.res = v; st.i++; st.bid = 0; st.leader = -1; st.phase = "lot"; bwPersist();
  if(st.i >= st.lots.length){ bwEnd(); return; }
  bidShow();
}
function bwEnd(){ const st = BW.st; st.over = true; bwStop(); bwPersist(); bidShow();
  const ranked = st.teams.map((t, i) => ({...t, i})).sort((a, b) => b.score - a.score), max = ranked[0].score, top = ranked.filter(t => t.score === max);
  const rankOf = t => 1 + ranked.filter(x => x.score > t.score).length;
  $("#winEyebrow").textContent = "Bidding Wars";
  $("#winTitle").innerHTML = top.length > 1 ? `It's a tie!<br><span>${esc(top.map(t => t.name).join(" & "))}</span>` : `${esc(top[0].name)}<br><span>win!</span>`;
  $("#podium").innerHTML = ranked.slice(0, 3).map(t => { const r = rankOf(t); return `<div class="pod p${Math.min(r, 3)}"><div class="who">${esc(t.name)}</div><div class="pts">${bwMoney(t.score)}</div><div class="step">${r}${["th","st","nd","rd"][(r % 100 > 10 && r % 100 < 14) || r % 10 > 3 ? 0 : r % 10]}</div></div>`; }).join("");
  $("#podium").hidden = false;
  $("#standings").innerHTML = ranked.length > 3 ? ranked.slice(3).map(t => `<li><span>${rankOf(t)}. ${esc(t.name)}</span><b class="${t.score < 0 ? "neg" : ""}">${bwMoney(t.score)}</b></li>`).join("") : "";
  $("#winBoard").hidden = true; $("#winBox").hidden = false; $("#playAgain").textContent = "New auction"; $("#winNote").textContent = "New auction keeps the same teams and settings, resets the scores and deals fresh lots."; $("#playAgain").focus();
  confetti(); ledStart(); if(S.sound) playEnd(NORMAL_INTRO); }
function bidAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; BW.st = bwInit(); bwPersist(); bidShow(); }
function bidSetupAgain(){ hideWinner(); $("#playAgain").textContent = "Play again"; bidSetupShow(); }
