/* 8.53 (Omar): Riddle Me This. Opening the mode shows the list of riddles straight away, newest first (R#56 at the top); pick one and it fills the TV.
   The Swap riddle button at the top brings the list back. No answers (Omar doesn't have them), no scoring, no teams, no phones.
   Riddles: v4work/riddles/riddles.txt (RID in build.js: [{n:"R#01", b:[{p}|{pre}|{img}|{url}]}]); a new riddle goes at the end with the next number.
   8.55 (Omar): a small timer counts up from 0:00 when a riddle opens. Bottom left: Small hint (unlocks after 10 minutes) and Big hint (after 20); bottom right: Solution
   (any time; 8.68: also after 10 minutes, and locked buttons show only a lock, no countdown). Each opens in a box over the riddle. The hints and solutions are in riddles.txt under each riddle (h1, h2, sol).
   Riddles already opened on this device are faded on the list (jn_rdSeen; 8.53 had a small "Read" tag). Look: "Riddler", deep purple with acid-green question marks.
   To remove: delete this file, v4work/riddles/, photos/riddles/, the 8.53 CSS block and #rdo section in head.html, the Riddle Me This button, its TT entry
   in title.js, the rdLeave() call in showHome (src/app.js), RID in build.js and 'riddles' in MODE_FILES. */
const RD_UNLOCK = {h1:600, h2:1200, sol:600};   // 8.55 (Omar): seconds before each button works; 8.68 (Omar): the solution also waits 10 minutes (8.55-8.67: sol:0)
const RD_NAME = {h1:"Small hint", h2:"Big hint", sol:"Solution"};
const RD_LV = [null, ["Very easy", "#3ddc84"], ["Easy", "#4fc3f7"], ["Medium", "#ffd54f"], ["Hard", "#ff8a3d"], ["Very hard", "#ff4d6a"]];   // 8.67 (Omar): level colours (the dot on each card, and the key under the title)
const rdDot = r => { const v = RD_LV[r.lv]; return v ? `<i class="rddot" style="--lv:${v[1]}" title="${v[0]}"></i>` : ""; };
const RD = {open:-1, t0:0, tmr:null, seen:(() => { try { return new Set(JSON.parse(localStorage.getItem("jn_rdSeen") || "[]")); } catch(e){ return new Set(); } })()};
const rdEsc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;"})[c]);
/* 8.69 (Omar): a YouTube link plays in the riddle screen, with a small "Open on YouTube instead" link under it (8.53-8.68: only the link, which left the game) */
const rdYT = u => { const m = String(u).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{11})/); return m ? m[1] : ""; };
const rdBlock = b => b.img ? `<div class="rdimg"><img src="${rdEsc(b.img)}" alt="Picture for this riddle"></div>`
  : b.url && rdYT(b.url) ? `<div class="rdvid"><iframe src="https://www.youtube-nocookie.com/embed/${rdYT(b.url)}?rel=0" title="Video for this riddle" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><p class="rdurl small"><a href="${rdEsc(b.url)}" target="_blank" rel="noopener">Open on YouTube instead</a></p>`
  : b.url ? `<p class="rdurl"><a href="${rdEsc(b.url)}" target="_blank" rel="noopener">${rdEsc(b.url)}</a></p>`
  : b.pre != null ? `<pre>${rdEsc(b.pre)}</pre>` : `<p>${rdEsc(b.p)}</p>`;
function rdEnter(){ if(S.mode === "riddles") return; S.mode = "riddles"; document.body.classList.add("rdmode"); }
function rdLeave(){ if(S.mode !== "riddles") return; S.mode = null; RD.open = -1; rdStop(); document.body.classList.remove("rdmode"); $("#rdo").hidden = true; }
function rdShow(){ rdEnter(); ["#titleScreen", "#setup", "#game", "#scores"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  $("#rdo").hidden = false; RD.open = -1; rdRender(); window.scrollTo(0, 0); }
function rdRender(){ const body = $("#rdBody"), sw = $("#rdSwap"); sw.hidden = RD.open < 0; $("#rdTimer").hidden = RD.open < 0;
  if(RD.open < 0){
    /* 8.54 (Omar): each card has a short title; the Picture / Video link / Read tags are gone, a riddle already read is faded instead */
    /* 8.59 (Omar): rows of oldest-first groups (R#01-04, R#05-08 ...), newest row at the top, each row counting up left to right (8.53-8.58: plain newest-first reading order, RID...reverse()) */
    const cols = rdCols(), rows = []; for(let i = 0; i < RID.length; i += cols) rows.push(RID.slice(i, i + cols).map((r, j) => [r, i + j]));
    const cards = rows.reverse().flat().map(([r, i]) => { const txt = r.b.filter(b => b.p).map(b => b.p).join(" ");
      return `<button class="rdcard${RD.seen.has(r.n) ? " seen" : ""}" data-rd="${i}"><div class="rdch"><b>${r.n}</b><em>${rdEsc(r.t || "")}</em>${rdDot(r)}</div><span>${rdEsc(txt)}</span></button>`; }).join("");
    body.innerHTML = `<header class="rdhead"><h1>Riddle Me This</h1><p>${RID.length} riddles · newest at the top · pick one to read it on the TV</p><div class="rdlegend">${RD_LV.slice(1).map(v => `<i class="rdlv" style="--lv:${v[1]}">${v[0]}</i>`).join("")}</div><button class="rdbtn go" id="rdRandom">Random riddle</button></header><div class="rdlist">${cards}</div>`;
    return; }
  const r = RID[RD.open];
  body.innerHTML = `<article class="rdread"><div class="rdnum">${r.n}${r.t ? `<small>${rdEsc(r.t)}</small>` : ""}</div><div class="rdtext">${r.b.map(rdBlock).join("")}</div></article><div class="rdbar"><div class="rdbarl">${["h1", "h2"].map(k => `<button class="rdbtn rdhint" data-rdh="${k}"></button>`).join("")}</div><button class="rdbtn rdhint rdsol" data-rdh="sol"></button></div>`;
  rdTick(); rdFit(); body.querySelectorAll(".rdimg img").forEach(im => im.addEventListener("load", rdFit)); }
/* the riddle text starts big and shrinks until the whole riddle fits on one screen (never below 17px; a very long one then scrolls) */
function rdFit(){ const t = $("#rdBody .rdtext"), bar = $("#rdBody .rdbar"); if(!t) return; const room = window.innerHeight - t.getBoundingClientRect().top - 24 - (bar ? bar.offsetHeight : 0);
  let fs = Math.min(46, Math.max(22, window.innerWidth / 38)); t.style.fontSize = fs + "px";
  while(fs > 17 && t.scrollHeight > room){ fs -= 1; t.style.fontSize = fs + "px"; } }
const rdClock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/* 8.55: the timer and the hint buttons, updated every second while a riddle is open */
function rdTick(){ if(RD.open < 0) return; const s = Math.floor((Date.now() - RD.t0) / 1000); $("#rdTimer").textContent = "⏱ " + rdClock(s);
  document.querySelectorAll("#rdBody [data-rdh]").forEach(b => { const k = b.dataset.rdh, left = RD_UNLOCK[k] - s, lock = left > 0;
    b.disabled = lock; b.classList.toggle("locked", lock); b.textContent = lock ? `🔒 ${RD_NAME[k]}` : RD_NAME[k]; }); }   // 8.68 (Omar): no countdown on a locked button (8.55-8.67: `🔒 ${RD_NAME[k]} ${rdClock(left)}`)
function rdStop(){ clearInterval(RD.tmr); RD.tmr = null; rdPopClose(); }
function rdPop(k){ const r = RID[RD.open], lines = r && r[k]; if(!lines) return; rdPopClose();
  const d = document.createElement("div"); d.className = "rdpop" + (k === "sol" ? " sol" : ""); d.id = "rdPop";
  d.innerHTML = `<div class="rdpopbox"><h2>${RD_NAME[k]}</h2>${lines.map(l => `<p>${rdEsc(l)}</p>`).join("")}<button class="rdbtn small" id="rdPopX">Close</button></div>`;
  $("#rdo").appendChild(d); }
function rdPopClose(){ const d = $("#rdPop"); if(d) d.remove(); }
function rdOpen(i){ RD.open = i; RD.t0 = Date.now(); clearInterval(RD.tmr); RD.tmr = setInterval(rdTick, 1000); const n = RID[i].n; if(!RD.seen.has(n)){ RD.seen.add(n); try { localStorage.setItem("jn_rdSeen", JSON.stringify([...RD.seen])); } catch(e){} }
  rdRender(); window.scrollTo(0, 0); }
function rdList(){ const was = RD.open; RD.open = -1; rdStop(); rdRender(); const c = $(`#rdBody .rdcard[data-rd="${was}"]`); if(c) c.scrollIntoView({block:"center"}); else window.scrollTo(0, 0); }
$("#rdo").addEventListener("click", e => {
  if(e.target.closest("#rdHome")){ showHome(); return; }
  if(e.target.closest("#rdSwap")){ rdList(); return; }
  if(e.target.closest("#rdPopX") || e.target.id === "rdPop"){ rdPopClose(); return; }
  { const h = e.target.closest("[data-rdh]"); if(h){ if(!h.disabled) rdPop(h.dataset.rdh); return; } }
  if(e.target.closest("#rdRandom")){ const pool = RID.map((r, i) => i).filter(i => !RD.seen.has(RID[i].n)); const p = pool.length ? pool : RID.map((r, i) => i); rdOpen(p[Math.floor(Math.random() * p.length)]); return; }
  const c = e.target.closest(".rdcard"); if(c) rdOpen(+c.dataset.rd);
});
document.addEventListener("keydown", e => { if(S.mode === "riddles" && RD.open >= 0 && e.key === "Escape" && !document.fullscreenElement){ if($("#rdPop")) rdPopClose(); else rdList(); } });
const rdCols = () => innerWidth > 1100 ? 4 : innerWidth > 600 ? 2 : 1;   // the list's columns (the .rdlist rules in head.html)
RD.cols = rdCols();
window.addEventListener("resize", () => { if(S.mode !== "riddles") return; if(RD.open >= 0) rdFit(); else if(rdCols() !== RD.cols){ RD.cols = rdCols(); rdRender(); } });
$("#modeRd").onclick = rdShow;
