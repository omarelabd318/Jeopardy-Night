/* 8.53 (Omar): Riddle Me This. Opening the mode shows the list of riddles straight away, newest first (R#56 at the top); pick one and it fills the TV.
   The Swap riddle button at the top brings the list back. No answers (Omar doesn't have them), no scoring, no teams, no phones.
   Riddles: v4work/riddles/riddles.txt (RID in build.js: [{n:"R#01", b:[{p}|{pre}|{img}|{url}]}]); a new riddle goes at the end with the next number.
   Riddles already opened on this device are faded on the list (jn_rdSeen; 8.53 had a small "Read" tag). Look: "Riddler", deep purple with acid-green question marks.
   To remove: delete this file, v4work/riddles/, photos/riddles/, the 8.53 CSS block and #rdo section in head.html, the Riddle Me This button, its TT entry
   in title.js, the rdLeave() call in showHome (src/app.js), RID in build.js and 'riddles' in MODE_FILES. */
const RD = {open:-1, seen:(() => { try { return new Set(JSON.parse(localStorage.getItem("jn_rdSeen") || "[]")); } catch(e){ return new Set(); } })()};
const rdEsc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;"})[c]);
const rdBlock = b => b.img ? `<div class="rdimg"><img src="${rdEsc(b.img)}" alt="Picture for this riddle"></div>`
  : b.url ? `<p class="rdurl"><a href="${rdEsc(b.url)}" target="_blank" rel="noopener">${rdEsc(b.url)}</a></p>`
  : b.pre != null ? `<pre>${rdEsc(b.pre)}</pre>` : `<p>${rdEsc(b.p)}</p>`;
function rdEnter(){ if(S.mode === "riddles") return; S.mode = "riddles"; document.body.classList.add("rdmode"); }
function rdLeave(){ if(S.mode !== "riddles") return; S.mode = null; RD.open = -1; document.body.classList.remove("rdmode"); $("#rdo").hidden = true; }
function rdShow(){ rdEnter(); ["#titleScreen", "#setup", "#game", "#scores"].forEach(s => { const e = $(s); if(e) e.hidden = true; });
  $("#rdo").hidden = false; RD.open = -1; rdRender(); window.scrollTo(0, 0); }
function rdRender(){ const body = $("#rdBody"), sw = $("#rdSwap"); sw.hidden = RD.open < 0;
  if(RD.open < 0){
    /* 8.54 (Omar): each card has a short title; the Picture / Video link / Read tags are gone, a riddle already read is faded instead */
    const cards = RID.map((r, i) => [r, i]).reverse().map(([r, i]) => { const txt = r.b.filter(b => b.p).map(b => b.p).join(" ");
      return `<button class="rdcard${RD.seen.has(r.n) ? " seen" : ""}" data-rd="${i}"><div class="rdch"><b>${r.n}</b><em>${rdEsc(r.t || "")}</em></div><span>${rdEsc(txt)}</span></button>`; }).join("");
    body.innerHTML = `<header class="rdhead"><h1>Riddle Me This</h1><p>${RID.length} riddles · newest first · pick one to read it on the TV</p><button class="rdbtn go" id="rdRandom">Random riddle</button></header><div class="rdlist">${cards}</div>`;
    return; }
  const r = RID[RD.open];
  body.innerHTML = `<article class="rdread"><div class="rdnum">${r.n}${r.t ? `<small>${rdEsc(r.t)}</small>` : ""}</div><div class="rdtext">${r.b.map(rdBlock).join("")}</div></article>`;
  rdFit(); body.querySelectorAll(".rdimg img").forEach(im => im.addEventListener("load", rdFit)); }
/* the riddle text starts big and shrinks until the whole riddle fits on one screen (never below 17px; a very long one then scrolls) */
function rdFit(){ const t = $("#rdBody .rdtext"); if(!t) return; const room = window.innerHeight - t.getBoundingClientRect().top - 24;
  let fs = Math.min(46, Math.max(22, window.innerWidth / 38)); t.style.fontSize = fs + "px";
  while(fs > 17 && t.scrollHeight > room){ fs -= 1; t.style.fontSize = fs + "px"; } }
function rdOpen(i){ RD.open = i; const n = RID[i].n; if(!RD.seen.has(n)){ RD.seen.add(n); try { localStorage.setItem("jn_rdSeen", JSON.stringify([...RD.seen])); } catch(e){} }
  rdRender(); window.scrollTo(0, 0); }
function rdList(){ const was = RD.open; RD.open = -1; rdRender(); const c = $(`#rdBody .rdcard[data-rd="${was}"]`); if(c) c.scrollIntoView({block:"center"}); else window.scrollTo(0, 0); }
$("#rdo").addEventListener("click", e => {
  if(e.target.closest("#rdHome")){ showHome(); return; }
  if(e.target.closest("#rdSwap")){ rdList(); return; }
  if(e.target.closest("#rdRandom")){ const pool = RID.map((r, i) => i).filter(i => !RD.seen.has(RID[i].n)); const p = pool.length ? pool : RID.map((r, i) => i); rdOpen(p[Math.floor(Math.random() * p.length)]); return; }
  const c = e.target.closest(".rdcard"); if(c) rdOpen(+c.dataset.rd);
});
document.addEventListener("keydown", e => { if(S.mode === "riddles" && RD.open >= 0 && e.key === "Escape" && !document.fullscreenElement) rdList(); });
window.addEventListener("resize", () => { if(S.mode === "riddles" && RD.open >= 0) rdFit(); });
$("#modeRd").onclick = rdShow;
