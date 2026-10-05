const WORLD = { feats: null };
function decodeWorld(json){
  const scale = json.UTF8Scale == null ? 1024 : json.UTF8Scale;
  const dec = (s, off) => { const out = []; let px = off[0], py = off[1];
    for(let i=0;i<s.length;i+=2){ let x = s.charCodeAt(i)-64, y = s.charCodeAt(i+1)-64;
      x = (x>>1) ^ (-(x&1)); y = (y>>1) ^ (-(y&1)); x += px; y += py; px = x; py = y; out.push([x/scale, y/scale]); }
    return out; };
  const feats = {};
  (json.features||[]).forEach(f => {
    const g = f.geometry; if(!g) return; let polys = [];
    if(g.type === "Polygon") polys = [g.coordinates.map((r,i) => typeof r === "string" ? dec(r, g.encodeOffsets[i]) : r)];
    else if(g.type === "MultiPolygon") polys = g.coordinates.map((p,pi) => p.map((r,ri) => typeof r === "string" ? dec(r, g.encodeOffsets[pi][ri]) : r));
    const nm = f.properties && f.properties.name; if(nm) feats[nm] = polys.filter(p => p.length && p[0] && p[0].length > 2);
  });
  return feats;
}
function shapeFor(aliases){
  if(!WORLD.feats) return null;
  for(const a of aliases){ if(WORLD.feats[a]) return WORLD.feats[a]; }
  return null;
}
function shapeSVG(aliases){
  const polys = shapeFor(aliases); if(!polys || !polys.length) return "";
  const area = r => { let s = 0; for(let i=0;i<r.length;i++){ const [x1,y1] = r[i], [x2,y2] = r[(i+1)%r.length]; s += x1*y2 - x2*y1; } return Math.abs(s/2); };
  const cen = r => { let x=0,y=0; r.forEach(p => { x+=p[0]; y+=p[1]; }); return [x/r.length, y/r.length]; };
  const main = polys.reduce((a,b) => area(b[0]) > area(a[0]) ? b : a), mc = cen(main[0]);
  const ma = area(main[0]);
  const keep = polys.filter(p => { const c = cen(p[0]), d = Math.hypot(c[0]-mc[0], c[1]-mc[1]); return d < 25 && (d < 5 || area(p[0]) > ma*0.02); });
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  keep.forEach(p => p[0].forEach(([x,y]) => { minY=Math.min(minY,y); maxY=Math.max(maxY,y); }));
  const k = Math.cos(((minY+maxY)/2) * Math.PI/180);
  const pts = keep.map(p => p.map(r => r.map(([x,y]) => [x*k, -y])));
  minX=Infinity; maxX=-Infinity; minY=Infinity; maxY=-Infinity;
  pts.forEach(p => p.forEach(r => r.forEach(([x,y]) => { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); })));
  const W = 320, pad = 14, s = (W - pad*2) / Math.max(maxX-minX, maxY-minY);
  const ox = (W - (maxX-minX)*s)/2, oy = (W - (maxY-minY)*s)/2;
  const d = pts.map(p => p.map(r => "M" + r.map(([x,y]) => ((x-minX)*s+ox).toFixed(1)+","+((y-minY)*s+oy).toFixed(1)).join("L") + "Z").join("")).join("");
  return `<svg viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Country outline to identify"><path d="${d}" fill="#FFCC33" fill-rule="evenodd" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
// Map Pin: unlabelled regional map around a point, with a pin
function pinSVG(lat, lon){
  if(!WORLD.feats) return "";
  const w = 46, h = 30, lat0 = Math.max(-60, Math.min(75, lat)), k = Math.cos(lat0*Math.PI/180);
  const x0 = (lon - w/2)*k, y0 = -(lat0 + h/2), W = w*k;
  let d = "";
  Object.values(WORLD.feats).forEach(polys => { if(!Array.isArray(polys)) return; polys.forEach(p => { try{
    if(!Array.isArray(p) || !Array.isArray(p[0])) return;
    let near = false;
    for(const pt of p[0]){ if(!Array.isArray(pt)) continue; const x = +pt[0], y = +pt[1]; if(x > lon-w && x < lon+w && y > lat0-h && y < lat0+h){ near = true; break; } }
    if(!near) return;
    d += p.filter(Array.isArray).map(r => "M" + r.filter(Array.isArray).map(pt => (pt[0]*k).toFixed(3)+","+(-pt[1]).toFixed(3)).join("L") + "Z").join("");
  }catch(e){} }); });
  const px = lon*k, py = -lat, r = W/60;
  return `<svg viewBox="${x0.toFixed(3)} ${y0.toFixed(3)} ${W.toFixed(3)} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map with a pin to identify">
    <rect x="${x0}" y="${y0}" width="${W}" height="${h}" fill="#0A2A6E"/>
    <path d="${d}" fill="#E8DFC4" fill-rule="evenodd" stroke="#5A6B8C" stroke-width="0.8" vector-effect="non-scaling-stroke"/>
    <circle cx="${px}" cy="${py}" r="${r*2.4}" fill="none" stroke="#E0202C" stroke-width="3" vector-effect="non-scaling-stroke"/>
    <circle cx="${px}" cy="${py}" r="${r}" fill="#E0202C" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}
(() => {
const LV = [100,200,300,400,500];
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]));
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/\(.*?\)/g,"").replace(/[^a-z0-9]/g,"");
const store = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
};

const S = {
  cats: ["egy","arab","geo","flag","fb","car"],
  teams: [{name:"Team A",score:0},{name:"Team B",score:0}],
  done: {},
  used: new Set(store.get("jn_used", [])),
  cur: null,
  impN: store.get("jn_impN", 6),
  power: store.get("jn_power", false),
  sound: store.get("jn_sound", true),
  x2: null,
  qrAns: store.get("jn_qrans", true),   /* 5.9: QR answers on Closest Wins / Price Is Right */
  steal: store.get("jn_steal", false),  /* 5.9: Steal QR codes */
  room: null
};
const photos = {};  // norm(answer) -> blob url
const catById = id => CATS.find(c => c.id === id);
const PICK = CATS.filter(c => !c.mode);  // categories offered in setup (Football mode adds its own World Cup)
const pool = (cat,lvl) => DATA[cat][lvl];

/* ---------- sound: soft countdown ticks and a fading bell-like chime (C_soft_end) ---------- */
const Snd = (() => {
  let ac = null, out = null;
  /* 4.59: every sound goes through one master volume, then a limiter so loud moments don't distort.
     VOL 4 makes the ticks, chime and fanfare about 4x louder (12 dB) so they carry over a room; set VOL = 1 to go back to the 4.58 levels. */
  const VOL = 3.2, CHIME = 0.86;  /* 4.90 (Omar): everything 20% quieter (VOL was 4), and the end-of-timer chime 30% quieter in all (CHIME was 1). Measured on the output: ticks/blips ×0.80, chime ×0.70 */
  const ctx = () => { if(!ac){ try{ ac = new (window.AudioContext || window.webkitAudioContext)();
      const lim = ac.createDynamicsCompressor(); lim.threshold.value = -6; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.1;
      out = ac.createGain(); out.gain.value = VOL; out.connect(lim).connect(ac.destination);
    }catch(e){ ac = null; } } if(ac && ac.state === "suspended") ac.resume(); return ac; };
  const tone = (freq, start, dur, vol, type="sine", attack=0.005) => { const a = ctx(); if(!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + start;
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || a.destination); o.start(t); o.stop(t + dur + 0.05); };
  return {
    unlock(){ if(S.sound) ctx(); },
    tick(){ if(!S.sound) return; tone(1320, 0, 0.09, 0.05, "triangle"); tone(660, 0, 0.07, 0.03, "sine"); },
    chime(){ if(!S.sound) return; const f = 784; [[1,0.11],[2.01,0.04],[3.0,0.025],[4.16,0.012]].forEach(([m,v]) => tone(f*m, 0, 2.8/Math.sqrt(m), v*CHIME, "sine", 0.01)); tone(f*1.5, 0.12, 2.2, 0.035*CHIME, "sine", 0.02); },
    blip(){ if(!S.sound) return; tone(988, 0, 0.12, 0.04, "sine"); tone(1480, 0.06, 0.14, 0.03, "sine"); },
    fanfare(){ if(!S.sound) return; [523, 659, 784, 1047].forEach((f,i) => { tone(f, i*0.13, 0.9, 0.06, "triangle", 0.01); tone(f*2, i*0.13, 0.6, 0.015, "sine", 0.01); }); }
  };
})();
function syncSound(){
  document.querySelectorAll(".sndbtn").forEach(b => { b.setAttribute("aria-pressed", S.sound); b.textContent = S.sound ? "Sound on" : "Sound off"; b.title = S.sound ? "Tap to mute the timer sounds" : "Tap to turn the timer sounds on"; });
  $("#optSound").setAttribute("aria-pressed", S.sound);
}
function setSound(on){ S.sound = on; store.set("jn_sound", on); syncSound(); if(on){ Snd.unlock(); Snd.blip(); } else { stopSiu(); stopReview(); } }
document.querySelectorAll(".sndbtn").forEach(b => b.addEventListener("click", () => setSound(!S.sound)));
$("#optSound").onclick = () => setSound(!S.sound);
$("#optPower").onclick = () => { S.power = !S.power; store.set("jn_power", S.power); $("#optPower").setAttribute("aria-pressed", S.power); if(!$("#scores").hidden) renderScores(); };
$("#optPower").setAttribute("aria-pressed", S.power); syncSound();
$("#optQrAns").onclick = () => { S.qrAns = !S.qrAns; store.set("jn_qrans", S.qrAns); $("#optQrAns").setAttribute("aria-pressed", S.qrAns); };
$("#optSteal").onclick = () => { S.steal = !S.steal; store.set("jn_steal", S.steal); $("#optSteal").setAttribute("aria-pressed", S.steal); };
$("#optQrAns").setAttribute("aria-pressed", S.qrAns); $("#optSteal").setAttribute("aria-pressed", S.steal);
/* version label counts itself: TV Show Mix only repeats other categories' clues, so it isn't counted twice */
/* v4.40: version history, from src/changelog.json (newest first) */
/* entries are {era} headings or {v, date?, items}; undated ones (1.x to 3.x) show as one compact line each */
function newsHTML(list){
  let html = "", compact = [];
  const flush = () => { if(compact.length){ html += `<ul class="compact">${compact.join("")}</ul>`; compact = []; } };
  list.forEach(e => {
    if(e.era){ flush(); html += `<h4 class="era">${esc(e.era)}</h4>`; return; }
    if(!e.date){ compact.push(`<li><b>${esc(e.v)}</b>${e.items.map(esc).join(" ")}</li>`); return; }
    flush(); html += `<h3>v${esc(e.v)}<small>${esc(e.date)}</small></h3><ul>${e.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
  });
  flush(); return html;
}
function openNews(){
  /* 4.53 (Omar): no What's new section, just the full version history, collapsed (4.40–4.52 showed the latest two versions above it) */
  const vs = CHANGELOG.filter(e => e.v);
  $("#newsTitle").textContent = `Jeopardy Night v${vs[0].v}`;
  $("#newsHist").innerHTML = newsHTML(CHANGELOG);
  $(".newshist").open = false;
  /* 4.62 (Omar): the history only opens with the code "joga" (any capitals); it locks again on every open */
  $(".newshist").hidden = true; $("#newsLock").hidden = false; $("#newsCode").value = ""; $("#newsErr").textContent = "";
  $("#newsBox").hidden = false; $("#newsCode").focus();
}
$("#newsLock").addEventListener("submit", e => { e.preventDefault();
  if($("#newsCode").value.trim().toLowerCase() === "joga"){ $("#newsLock").hidden = true; $(".newshist").hidden = false; $(".newshist").open = true; $("#newsClose").focus(); }
  else { $("#newsErr").textContent = "Wrong code."; $("#newsCode").select(); } });
function closeNews(){ $("#newsBox").hidden = true; $("#verBtn").focus(); }
$("#verBtn").onclick = openNews;
$("#newsClose").onclick = closeNews;
$("#newsBox").addEventListener("click", e => { if(e.target.id === "newsBox") closeNews(); });
function verLabel(){ const n = PICK.filter(c => c.id !== "tvmix").reduce((a,c) => a + LV.reduce((b,l) => b + ((DATA[c.id]||{})[l]||[]).length, 0), 0);
  document.querySelectorAll(".verlabel").forEach(el => el.textContent = `${PICK.length} Categories · ${n.toLocaleString("en-US")} Clues · v5.11`); }

/* ---------- setup ---------- */
const CAT_GROUPS = [  /* 4.80 (Omar): every Egypt category now sits in Egypt & Arab World. 4.82 (Omar): Act It Out: Egypt Edition back in Party Games after "act"; Egyptian Cinema moved to after Arab World, Ramadan Series to after Egyptian Football. Before, Egyptian Football was in Football & Sports after "fb"; Egyptian Cinema, Plots: Egypt and Quotes: Egypt in Entertainment after "tv", "plot" and "quote"; the three Egypt party games in Party Games after act, emov and emsen */
  ["Egypt & Arab World", ["egy","egh","cairo","arab","ecin","prov","memeeg","ploteg","quoteeg","egfb","ramadan","emeg","emseg","ctryar"]],
  ["Football & Sports", ["fb","pl","wc","wc26","ucl","xfer","cclub","path","whoami","shirt","mgr","fyear","form","score","stad","sport"]],
  ["Entertainment", ["tv","plot","lit","got","peaky","bb","pb","gta","vgames","st","office","netflix","tvmix","friends","himym","hp","hgames","marvel","toons","romcom","pixar","quote","qblank","mus","songt","song","lyric","spot","igf"]],
  ["Maps & World", ["geo","flag","shape","pin","ctry","lang","trans"]],
  ["Knowledge", ["gk","his","islam","ww2","year","myth","sci","space","food","ffood","cal","mb","curr","brand","cars","tg","nick","books"]],
  ["Photo Rounds", ["car","actor","footy","person","foodpic","logo"]],
  ["Party Games", ["act","acteg","emov","emsen","pw","rid","link","near","price","headl"]]
];
function renderChips(){
  const chip = c => `<button class="chip" aria-pressed="${S.cats.includes(c.id)}" data-c="${c.id}"${c.desc ? ` title="${esc(c.desc)}"` : ""}>${esc(c.name)}</button>`;
  const seen = new Set();
  const groups = CAT_GROUPS.map(([name,ids]) => [name, ids.map(catById).filter(Boolean)]);
  groups.forEach(([,cs]) => cs.forEach(c => seen.add(c.id)));
  const rest = PICK.filter(c => !seen.has(c.id)); if(rest.length) groups.push(["Other", rest]);
  $("#catChips").innerHTML = groups.filter(([,cs]) => cs.length).map(([name,cs]) => {
    const n = cs.filter(c => S.cats.includes(c.id)).length;
    return `<div class="cgroup"><h4>${esc(name)}<span class="gc">${n}/${cs.length}</span></h4><div class="chips">${cs.map(chip).join("")}</div></div>`;
  }).join("");
  const cc = $("#catCount"); if(cc) cc.textContent = `· ${S.cats.length} of ${PICK.length} chosen`;
}
$("#catChips").addEventListener("click", e => {
  const b = e.target.closest("[data-c]"); if(!b) return;
  const id = b.dataset.c;
  S.cats = S.cats.includes(id) ? S.cats.filter(x => x !== id) : PICK.map(c=>c.id).filter(x => x === id || S.cats.includes(x));
  renderChips();
});
$("#pick6").onclick = () => { const ids = PICK.map(c=>c.id).sort(()=>Math.random()-.5).slice(0,6); S.cats = PICK.map(c=>c.id).filter(x=>ids.includes(x)); renderChips(); };
$("#pickNone").onclick = () => { S.cats = []; renderChips(); };

function renderTeamInputs(){
  $("#teamInputs").innerHTML = S.teams.map((t,i) =>
    `<input id="team${i}" value="${esc(t.name)}" aria-label="Team ${i+1} name" maxlength="20">`).join("");
}
$("#teamInputs").addEventListener("input", e => { const i = +e.target.id.replace("team",""); S.teams[i].name = e.target.value || `Team ${i+1}`; });
$("#addTeam").onclick = () => { if(S.teams.length < 6){ S.teams.push({name:`Team ${String.fromCharCode(65+S.teams.length)}`,score:0}); renderTeamInputs(); } };
$("#rmTeam").onclick = () => { if(S.teams.length > 1){ S.teams.pop(); renderTeamInputs(); } };

function histNote(){ $("#histNote").textContent = S.used.size ? `${S.used.size} clues already played are skipped` : ""; }
$("#resetHist").onclick = () => { S.used.clear(); store.set("jn_used", []); histNote(); };

/* photo pack */
function photoKeys(){
  const out = [];
  PHOTO_CATS.forEach(cat => LV.forEach(l => pool(cat,l).forEach(([ans]) => out.push(norm(ans)))));
  return out;
}
/* photo storage: kept in this browser (IndexedDB) so photos survive reloads */
const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    try { const rq = indexedDB.open("jeopardy-photos", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("p");
      rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
    } catch(e){ rej(e); }
  }));
  const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction("p", mode); const out = fn(t.objectStore("p")); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); }); };
  return {
    put: (k, blob) => tx("readwrite", s => s.put(blob, k)).catch(()=>{}),
    del: k => tx("readwrite", s => s.delete(k)).catch(()=>{}),
    all: async () => { try { const db = await open(); return await new Promise(res => { const out = {}; const cur = db.transaction("p").objectStore("p").openCursor(); cur.onsuccess = () => { const c = cur.result; if(c){ out[c.key] = c.value; c.continue(); } else res(out); }; cur.onerror = () => res(out); }); } catch(e){ return {}; } }
  };
})();
const focus = store.get("jn_focus", {});
function saveFocus(k, x, y){ focus[k] = {x:Math.round(x), y:Math.round(y)}; store.set("jn_focus", focus); }
let focusKey = null;
function openFocus(k, title){
  if(!photos[k]) return; focusKey = k;
  const f = focus[k];
  $("#focusTitle").textContent = title || "Tap the spot to zoom in on";
  $("#focusImg").src = photos[k];
  const m = $("#focusMark"); m.hidden = !f; if(f){ m.style.left = f.x+"%"; m.style.top = f.y+"%"; }
  $("#focusBox").hidden = false;
}
function closeFocus(){ $("#focusBox").hidden = true; focusKey = null; renderPrep(); if(S.cur) renderClue(); }
function setPhoto(key, blob){
  if(photos[key] && photos[key].startsWith("blob:")) URL.revokeObjectURL(photos[key]);
  photos[key] = URL.createObjectURL(blob); DB.put(key, blob);
}
function removePhoto(key){ if(photos[key]){ if(photos[key].startsWith("blob:")) URL.revokeObjectURL(photos[key]); delete photos[key]; } DB.del(key); if(BUILTIN[key]) photos[key] = "photos/" + key + ".jpg"; }
function packStatus(extra){
  const keys = new Set(); PHOTO_CATS.forEach(cat => LV.forEach(l => pool(cat,l).forEach(([ans]) => keys.add(norm(ans)))));
  const ks = [...keys], built = ks.filter(k => photos[k] && !photos[k].startsWith("blob:")).length, own = ks.filter(k => photos[k] && photos[k].startsWith("blob:")).length;
  const other = ["foodpic","stad","logo"].reduce((t,id) => t + (catById(id) ? LV.reduce((u,l) => u + pool(id,l).filter(e => e[2]).length, 0) : 0), 0);
  const ownTxt = own ? ` · ${own} added on this device` : "";
  const pc = $("#phCount"); if(pc) pc.textContent = built + other ? `· ${built + other} built in${ownTxt}` : "";
  $("#packStatus").innerHTML = (built ? `${built} you can replace here${ownTxt}` : own ? `${own} added on this device` : "No photos loaded") + (extra||"");
}
$("#pack").addEventListener("change", e => {
  const keys = photoKeys(); const miss = [];
  [...e.target.files].forEach(f => {
    const fn = norm(f.name.replace(/\.[^.]+$/,""));
    const k = keys.find(k => k === fn) || keys.find(k => fn.length >= 4 && (k.includes(fn) || fn.includes(k)));
    if(k) setPhoto(k, f); else miss.push(f.name);
  });
  packStatus(miss.length ? ` · <strong>${miss.length} couldn't be matched by file name</strong> (${esc(miss.slice(0,3).join(", "))}${miss.length>3?"…":""}). Use the Replace buttons in the checklist below to attach them.` : "");
  if(miss.length){ $("#photoPanel").open = true; $("#prepBox").open = true; }
  renderPrep(); e.target.value = "";
});
let assignKey = null;
$("#assign").addEventListener("change", e => {
  const f = e.target.files[0];
  const k = assignKey;
  e.target.value = ""; assignKey = null;
  if(f && k){ delete focus[k]; store.set("jn_focus", focus); setPhoto(k, f); renderPrep(); packStatus(); openFocus(k, "Tap the face (or the part to zoom in on)"); }
});
$("#prep").addEventListener("click", e => {
  const pv = e.target.closest("[data-prev]");
  if(pv){ const [pc,pl,pi] = pv.dataset.prev.split("|"); openClue(pc, +pl, undefined, +pi); return; }
  const fb = e.target.closest("[data-focus]");
  if(fb){ openFocus(fb.dataset.focus); return; }
  const add = e.target.closest("[data-add]"), rm = e.target.closest("[data-rm]");
  if(add){ assignKey = add.dataset.add; $("#assign").click(); }
  if(rm){ removePhoto(rm.dataset.rm); renderPrep(); packStatus(); }
});
const prepOpen = new Set();
function otherPhotos(){
  const el = $("#otherPhotos"); if(!el) return;
  const n = id => catById(id) ? LV.reduce((t,l) => t + pool(id,l).filter(e => e[2]).length, 0) : 0;
  const parts = [n("foodpic") ? `Guess the Food (${n("foodpic")} photos)` : "", n("logo") ? `Guess the Logo (${n("logo")} logos)` : "", n("stad") ? `the stadium photos in Football Stadiums (${n("stad")})` : ""].filter(Boolean);
  const list = parts.length > 1 ? parts.slice(0,-1).join(", ") + " and " + parts[parts.length-1] : parts[0];
  el.textContent = parts.length ? ` ${list} ${parts.length>1?"are":"is"} built in too, but can't be changed here.` : ""; el.hidden = !parts.length;
}
function renderPrep(){
  otherPhotos();
  $("#prep").innerHTML = PHOTO_CATS.map(cat => {
    let tot = 0, got = 0, spot = 0;
    const body = LV.map(l => `<b>${l}</b>` + pool(cat,l).map(([ans,wiki],i) => { const k = norm(ans), has = !!photos[k];
      tot++; if(has){ got++; if(focus[k]) spot++; }
      return `<div class="item${has?" has":""}"><span>${has ? (focus[k] ? "✓✓ " : "✓ ") : ""}<a href="https://en.wikipedia.org/wiki/${encodeURIComponent(wiki)}" target="_blank" rel="noopener">${esc(ans)}</a></span>${has
        ? `<button class="mini" data-prev="${cat}|${l}|${i}">Preview</button><button class="mini" data-focus="${k}">${focus[k]?"Zoom spot ✓":"Set zoom spot"}</button><button class="mini" data-add="${k}">Replace</button>${photos[k].startsWith("blob:") ? `<button class="mini" data-rm="${k}" aria-label="Remove photo for ${esc(ans)}">Remove</button>` : ""}`
        : `<button class="mini" data-add="${k}">Add photo</button>`}</div>`; }).join("")).join("");
    return `<details class="prepcat" data-pc="${cat}"${prepOpen.has(cat) ? " open" : ""}><summary>${esc(catById(cat).name)} <span class="pcount">${got}/${tot} photos · ${spot} zoom spots</span></summary><div class="preplist">${body}</div></details>`;
  }).join("");
  document.querySelectorAll("#prep .prepcat").forEach(d => d.addEventListener("toggle", () => { d.open ? prepOpen.add(d.dataset.pc) : prepOpen.delete(d.dataset.pc); }));
}
/* export / import */
function photoIndex(){
  const idx = {};
  PHOTO_CATS.forEach(cat => LV.forEach(l => pool(cat,l).forEach(([ans]) => { idx[norm(ans)] = {answer:ans, category:cat, value:l}; })));
  return idx;
}
async function shrink(blob){
  try{
    const bmp = await createImageBitmap(blob), max = 1400, s = Math.min(1, max/Math.max(bmp.width,bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width*s); cv.height = Math.round(bmp.height*s);
    cv.getContext("2d").drawImage(bmp,0,0,cv.width,cv.height);
    return await new Promise(r => cv.toBlob(b => r(b || blob), "image/jpeg", 0.86));
  }catch(e){ return blob; }
}
const xfer = t => { $("#xferStatus").textContent = t; };
$("#exportPhotos").onclick = async () => {
  if(!window.JSZip){ xfer("The export tool didn't load. Reload the page and try again."); return; }
  const saved = await DB.all(), keys = Object.keys(saved);
  const spotKeys = Object.keys(BUILTIN).filter(k => !saved[k] && focus[k] && (!BUILTIN[k].f || BUILTIN[k].f.x !== focus[k].x || BUILTIN[k].f.y !== focus[k].y));
  if(!keys.length && !spotKeys.length){ xfer("Nothing new to export: every photo and zoom spot on this device is already built into the game."); return; }
  const dl = await window.claude?.use?.("downloads");
  if(!dl){ xfer("Saving files isn't available here. Open the game in a browser or the Claude app and try again."); return; }
  const idx = photoIndex(), zip = new JSZip(), manifest = {};
  for(let i=0;i<keys.length;i++){
    const k = keys[i]; xfer(`Packing ${i+1} of ${keys.length}…`);
    zip.file(`photos/${k}.jpg`, await shrink(saved[k]));
    manifest[k] = Object.assign({file:`photos/${k}.jpg`}, idx[k] || {}, focus[k] ? {focus:focus[k]} : {});
  }
  const spots = {}; spotKeys.forEach(k => { spots[k] = focus[k]; });
  zip.file("manifest.json", JSON.stringify({game:"Jeopardy Night", version:1, photos:manifest, spots}, null, 1));
  const blob = await zip.generateAsync({type:"blob"});
  const what = `${keys.length} new photo${keys.length===1?"":"s"} and ${spotKeys.length} updated zoom spot${spotKeys.length===1?"":"s"} on built-in photos`;
  xfer(`Ready: ${what} (${(blob.size/1048576).toFixed(1)} MB). Confirm the save…`);
  try{ await dl.save({filename:"jeopardy-photos.zip", data:blob}); xfer(`Saved jeopardy-photos.zip with ${what}.`); }
  catch(err){ xfer(err && err.code==="declined" ? "Save cancelled." : err && err.code==="rate_limited" ? "A save prompt is already open. Finish that one first." : "Couldn't save the file here."); }
};
$("#importPhotos").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  if(!window.JSZip){ xfer("The import tool didn't load. Reload the page and try again."); return; }
  try{
    const zip = await JSZip.loadAsync(f), mf = zip.file("manifest.json");
    if(!mf) throw new Error("no manifest");
    const {photos: m, spots} = JSON.parse(await mf.async("string")), keys = Object.keys(m||{}), known = photoIndex();
    let ns = 0; Object.entries(spots||{}).forEach(([k,f]) => { if(known[k] && f){ focus[k] = f; ns++; } });
    let n = 0;
    for(const k of keys){
      const entry = m[k], zf = entry && zip.file(entry.file); if(!zf || !known[k]) continue;
      const b = await zf.async("blob"); setPhoto(k, new Blob([b], {type:"image/jpeg"}));
      if(entry.focus) focus[k] = entry.focus; n++;
    }
    store.set("jn_focus", focus); renderPrep(); packStatus(); xfer([n ? `Imported ${n} photo${n===1?"":"s"} with their zoom spots` : "", ns ? `${n ? "and " : "Imported "}${ns} updated zoom spot${ns===1?"":"s"}` : ""].filter(Boolean).join(" ") + (n||ns ? "." : "Nothing to import in that file."));
  }catch(err){ xfer("That file isn't a Jeopardy Night photo export. Use the file made by Export photos."); }
});
{ const seen = store.get("jn_builtin_batch", store.get("jn_builtin_v1", false) ? 1 : 0), fseen = store.get("jn_focus_batch", 0); let fx = false;
  /* a photo replaced in a newer batch, or a zoom spot re-picked in a newer focus batch (fb), replaces any zoom spot saved on this device */
  Object.entries(BUILTIN).forEach(([k,v]) => { photos[k] = "photos/" + k + ".jpg"; if(v.f && (!focus[k] || (v.b || 1) > seen || (v.fb || 0) > fseen)){ if(focus[k]) fx = true; focus[k] = v.f; } });
  const maxFb = Math.max(0, ...Object.values(BUILTIN).map(v => v.fb || 0));
  if(fx) store.set("jn_focus", focus); if(maxFb > fseen) store.set("jn_focus_batch", maxFb); }
DB.all().then(saved => {
  /* one-time: the photos first added on this device are now built in, so drop the duplicate local copies */
  /* drop local copies of photos that have since been built in (each batch once, so later deliberate replacements are kept) */
  const doneBatch = store.get("jn_builtin_batch", store.get("jn_builtin_v1", false) ? 1 : 0);
  const maxBatch = Math.max(1, ...Object.values(BUILTIN).map(v => v.b || 1));
  if(doneBatch < maxBatch){ Object.keys(saved).forEach(k => { if(BUILTIN[k] && (BUILTIN[k].b || 1) > doneBatch){ DB.del(k); delete saved[k]; } }); store.set("jn_builtin_batch", maxBatch); store.set("jn_builtin_v1", true); }
  Object.entries(saved).forEach(([k,b]) => { photos[k] = URL.createObjectURL(b); }); renderPrep(); packStatus(); if(S.cur) renderClue(); });

$("#start").onclick = () => {
  if(!S.cats.length){ $("#histNote").textContent = "Pick at least one category to start."; return; }
  newGame();
  $("#setup").hidden = true; $("#game").hidden = false; $("#scores").hidden = false;
  renderBoard(); renderScores(); window.scrollTo(0,0);
};
/* Football mode: a fixed football board on a green pitch theme; setup and title go back to blue and the usual picks */
const FOOTBALL = ["cclub","path","whoami","shirt","mgr","xfer","stad","footy","egfb","fyear","form","score","pl","ucl","fwc"];  /* 4.81 (Omar): added "shirt" and "mgr" (Shirt Numbers, Managers) */
function setFootball(on){ if(on && !S.football) S.prevCats = S.cats; if(!on && S.football && S.prevCats){ S.cats = S.prevCats; S.prevCats = null; renderChips(); }
  S.football = on; document.body.classList.toggle("football", on);
  /* 4.65 (Omar): the Football mode board is titled "Joga Bonito" (4.64: "Joga Night"); normal mode keeps "Jeopardy Night" */
  const t1 = document.querySelector("#game .topbar h1 .t1"), t2 = document.querySelector("#game .topbar h1 .t2");
  if(t1) t1.textContent = on ? "Joga" : "Jeopardy"; if(t2) t2.textContent = on ? "Bonito" : "Night"; }
/* 4.43: retro poster collage of football phrases behind the Football mode board.
   4.48: packed into exactly the whole rows and columns that fit, and each phrase shrunk to fit its block, so nothing is cut off. */
const FB_PHRASES = ["SIIIIIUUUUUU!","BAR-CO-LA","NO FAIR","ظالم ظلم","It's a fucking disgrace","After review… #10 Paraguay","AGUEROOOOO","Qué mirás, bobo?","Running down the wing","Ankara Messi","الكورة أجوان","يا نهار أبيض","لفها لفة جاتوه","يخرب بيتك يا مجرم","الله عليك يا حبيب والديك","نادي القرن","الفراعنة","Hand of God","If I speak, I am in big trouble","Good ebening","Cold rainy night in Stoke","Fergie time","Tiki-taka","What do we think of shit?"];
const FB_FILL = ["Calma","VAR","90+7'","OLÉ","1–0","Full time","!","⚽","Yalla","Hat-trick"];
/* 4.76 (Omar): phrases drawn with a different font for each part between the dashes (Alfa Slab One, Lobster, Bebas Neue) */
const FB_MIXED = {"BAR-CO-LA": [2, 3, 1]};
const fbTxt = t => FB_MIXED[t] ? t.split("-").map((p, i) => `<i class="mx f${FB_MIXED[t][i % FB_MIXED[t].length]}">${esc(p)}</i>`).join("-") : esc(t);
const FB_CELL = {w:96, h:56, gap:5};
const fbWant = t => { const ar = /[\u0600-\u06FF]/.test(t), n = t.length; return n > 8 ? Math.min(5, Math.ceil(n / (ar ? 5 : 5.5))) : ar ? 2 : 1; };
/* 4.47: the collage starts just under the category row.
   4.48: no repeats. Cells grow when there's more room than phrases, so each phrase and filler appears at most once. */
function placeFbBg(){
  const bg = $("#fbBg"), h = $("#board .head"), b = $("#board"); if(!bg || !h || !S.football) return;
  bg.style.top = (b.offsetTop + h.offsetTop + h.offsetHeight) + "px";
  const W = bg.clientWidth - FB_CELL.gap, H = bg.clientHeight - FB_CELL.gap;
  const need = [...FB_PHRASES, ...FB_FILL].reduce((a, t) => a + fbWant(t), 0) * 1.1;  // cells all the phrases would take
  const fit = (w, h) => [Math.max(2, Math.floor(W / (w + FB_CELL.gap))), Math.max(1, Math.round(H / (h + FB_CELL.gap)))];
  let [cols, rows] = fit(FB_CELL.w, FB_CELL.h);
  if(cols * rows > need){ const k = Math.sqrt(cols * rows / need); [cols, rows] = fit(FB_CELL.w * k, FB_CELL.h * k); }
  if(FB_LAYOUT === "poster"){ const key = "p" + Math.round(W) + "x" + Math.round(H); if(bg.dataset.grid !== key){ bg.dataset.grid = key; footballPoster(); } return; }
  bg.classList.remove("poster");
  if(bg.dataset.grid !== cols + "x" + rows) footballBg(cols, rows);
}
/* 4.73 try (Omar): blocks of uneven sizes, like the poster in v4work/football-theme-ref.avif, instead of the even grid of 4.43-4.72.
   The space is cut into random rectangles (big, small, wide, tall) and each phrase goes where it can be drawn biggest:
   one line, two lines or vertical. To go back to the even grid: set FB_LAYOUT to "grid" (footballBg() below is unchanged). */
const FB_LAYOUT = "poster";
function footballPoster(){
  const el = $("#fbBg"); if(!el) return; el.classList.add("poster"); el.style.gridTemplateColumns = el.style.gridTemplateRows = "";
  const G = FB_CELL.gap, W = el.clientWidth - G, H = el.clientHeight - G, MIN = Math.max(30, Math.min(W, H) / 9);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const order = FB_PHRASES.map((_, j) => j).sort((a, b) => ((a * 7919) % 13) - ((b * 7919) % 13) || a - b).map(j => FB_PHRASES[j]);
  const items = [...order, ...FB_FILL];
  // cut the space: keep splitting a big rectangle (with some luck in which one) across its longer side, off-centre
  const rects = [{x: 0, y: 0, w: W, h: H}];
  while(rects.length < items.length){
    let best = -1, bs = 0;
    rects.forEach((r, i) => { const s = r.w * r.h * (0.45 + rnd()); if(Math.max(r.w, r.h) >= 2 * MIN && s > bs){ bs = s; best = i; } });
    if(best < 0) break;
    const r = rects[best], across = r.w / r.h > 1.15 ? true : r.h / r.w > 1.15 ? false : rnd() < .5, len = across ? r.w : r.h;
    const cut = Math.max(MIN, Math.min(len - MIN, Math.round(len * (0.28 + 0.44 * rnd()))));
    rects.splice(best, 1, across ? {x: r.x, y: r.y, w: cut, h: r.h} : {x: r.x, y: r.y, w: r.w, h: cut},
                          across ? {x: r.x + cut, y: r.y, w: r.w - cut, h: r.h} : {x: r.x, y: r.y + cut, w: r.w, h: r.h - cut});
  }
  // how big a phrase could be drawn in a rectangle (rough: a letter is about half as wide as it is tall)
  const two = t => { const sp = [...t.matchAll(/ /g)].map(m => m.index); if(!sp.length || t.length < 10) return null;
    const i = sp.reduce((a, b) => Math.abs(b - t.length/2) < Math.abs(a - t.length/2) ? b : a); return [t.slice(0, i), t.slice(i + 1)]; };
  const fits = (r, t) => { const n = Math.max(2, t.length * (/[\u0600-\u06FF]/.test(t) ? .8 : 1)) * .55, w = r.w - G - 8, h = r.h - G, o = [];
    o.push({m: "h", s: Math.min(h * .8, w / n)});
    const tw = two(t); if(tw) o.push({m: "2", s: Math.min(h * .8 / 2, w / (Math.max(tw[0].length, tw[1].length) * .55)), tw});
    if(!FB_MIXED[t] && /^[A-Za-zÀ-ÿ!'-]{3,13}$/.test(t)) o.push({m: "v", s: Math.min(w * .8, h / n)});
    return o.reduce((a, b) => b.s > a.s ? b : a); };
  const left = rects.slice(), blocks = [];
  const todo = items.slice(0, rects.length);
  while(todo.length){  // place the phrase that would come out smallest first, in its best block, so none ends up tiny
    let pick = null;
    todo.forEach((t, ti) => { let bi = 0, bf = null; left.forEach((r, i) => { const f = fits(r, t); if(!bf || f.s > bf.s){ bf = f; bi = i; } });
      if(!pick || bf.s < pick.f.s) pick = {ti, bi, f: bf}; });
    blocks.push({t: todo.splice(pick.ti, 1)[0], r: left.splice(pick.bi, 1)[0], f: pick.f});
  }
  el.innerHTML = blocks.map(({t, r, f}) => {
    const txt = f.m === "2" ? esc(f.tw[0]) + "<br>" + esc(f.tw[1]) : fbTxt(t);
    return `<div class="b f${1 + Math.floor(rnd() * 6)} c${1 + Math.floor(rnd() * 5)}${f.m === "v" ? " v" : ""}" style="left:${(r.x + G).toFixed(1)}px;top:${(r.y + G).toFixed(1)}px;width:${(r.w - G).toFixed(1)}px;height:${(r.h - G).toFixed(1)}px"><span dir="auto">${txt}</span></div>`;
  }).join("");
  fitPoster(); if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitPoster);
}
function fitPoster(){  // size each phrase to fill its block
  document.querySelectorAll("#fbBg.poster .b span").forEach(sp => {
    const b = sp.parentElement, v = b.classList.contains("v"); sp.style.fontSize = "100px";
    const len = v ? sp.offsetHeight : sp.offsetWidth, thick = v ? sp.offsetWidth : sp.offsetHeight;
    const k = Math.min(((v ? b.clientHeight : b.clientWidth) - 8) * .92 / Math.max(1, len), (v ? b.clientWidth : b.clientHeight) * .84 / Math.max(1, thick));
    sp.style.fontSize = (100 * k).toFixed(1) + "px";
  });
}
window.addEventListener("resize", placeFbBg);
/* 5.2: the font stylesheet now loads in the background; once its fonts are in, re-fit anything that was sized with the fallback font. */
window.addEventListener("jn-fonts", () => { const go = () => { const bg = $("#fbBg"); if(bg && bg.classList.contains("poster")) fitPoster(); else fitFbBg(); window.dispatchEvent(new Event("resize")); };
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go(); });
function footballBg(cols, rows){
  const el = $("#fbBg"); if(!el || !cols) return;
  el.dataset.grid = cols + "x" + rows;
  el.style.gridTemplateColumns = `repeat(${cols},1fr)`; el.style.gridTemplateRows = `repeat(${rows},1fr)`;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const used = Array.from({length: rows}, () => Array(cols).fill(null)), blocks = [];
  // one queue, each phrase and filler once: two phrases (fixed shuffle, mixes English and Arabic), then a filler
  const order = FB_PHRASES.map((_, j) => j).sort((a, b) => ((a * 7919) % 13) - ((b * 7919) % 13) || a - b).map(j => FB_PHRASES[j]);
  const queue = []; let fi = 0;
  const roomy = cols * rows >= [...FB_PHRASES, ...FB_FILL].reduce((a, t) => a + fbWant(t), 0);  // tight on space: phrases first, fillers only plug gaps
  order.forEach((t, j) => { queue.push(t); if(roomy && j % 2 === 1 && fi < FB_FILL.length) queue.push(FB_FILL[fi++]); });
  while(fi < FB_FILL.length) queue.push(FB_FILL[fi++]);
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++){
    if(used[r][c]) continue;
    let free = 0; while(c + free < cols && !used[r][c + free]) free++;
    const qi = queue.findIndex(t => fbWant(t) <= free);
    if(qi < 0){  // nothing left that fits: widen the block to the left instead of repeating a phrase
      const left = c > 0 && used[r][c - 1];
      if(left && left.rs === 1){ left.cs++; used[r][c] = left; }
      continue;
    }
    const t = queue.splice(qi, 1)[0], ar = /[\u0600-\u06FF]/.test(t), n = t.length;
    const vert = /^[A-Za-zÀ-ÿ!]{3,8}$/.test(t) && r + 1 < rows && !used[r + 1][c] && rnd() < .35;
    const spare = cols * rows - blocks.reduce((a, x) => a + x.cs * x.rs, 0) > queue.reduce((a, x) => a + fbWant(x), 0) + fbWant(t) + 2;
    let cs = vert ? 1 : Math.max(fbWant(t), spare && n > 3 && !ar && n <= 8 && rnd() < .5 ? 2 : 1);
    cs = Math.max(1, Math.min(cs, free));
    let rs = vert ? 2 : (spare && n <= 12 && rnd() < .35) ? 2 : 1;
    if(rs === 2 && (r + 1 >= rows || used[r + 1].slice(c, c + cs).some(Boolean))) rs = 1;
    const blk = {t, r, c, rs, cs, vert: vert && rs === 2, ar, n, f: 1 + Math.floor(rnd() * 6), k: 1 + Math.floor(rnd() * 5)};
    for(let y = r; y < r + rs; y++) for(let x = c; x < c + cs; x++) used[y][x] = blk;
    blocks.push(blk);
  }
  el.innerHTML = blocks.map(b => `<div class="b f${b.f} c${b.k}${b.vert ? " v" : ""}" style="grid-area:${b.r + 1}/${b.c + 1}/span ${b.rs}/span ${b.cs}"><span dir="auto" style="--n:${Math.max(3, b.n * (b.ar ? .75 : 1))}">${fbTxt(b.t)}</span></div>`).join("");
  fitFbBg(); if(document.fonts && document.fonts.ready) document.fonts.ready.then(fitFbBg);
}
function fitFbBg(){  // shrink any phrase that is wider (or taller, if vertical) than its block
  document.querySelectorAll("#fbBg .b span").forEach(sp => {
    sp.style.fontSize = ""; const b = sp.parentElement, v = b.classList.contains("v");
    const room = (v ? b.clientHeight : b.clientWidth - 8) * .94, need = v ? sp.scrollHeight : sp.scrollWidth;
    const across = (v ? b.clientWidth : b.clientHeight) * .9, thick = v ? sp.scrollWidth : sp.scrollHeight;
    const r = Math.min(1, room / Math.max(1, need), across / Math.max(1, thick));
    if(r < 1) sp.style.fontSize = (parseFloat(getComputedStyle(sp).fontSize) * r).toFixed(1) + "px";
  });
}
const footballPick = () => { const ids = FOOTBALL.slice().sort(() => Math.random() - .5).slice(0, 6); return FOOTBALL.filter(x => ids.includes(x)); };  // random 6 of the 15, in pool order
$("#football").onclick = () => {
  setFootball(true); S.cats = footballPick(); newGame();
  $("#setup").hidden = true; $("#game").hidden = false; $("#scores").hidden = false;
  renderBoard(); renderScores(); window.scrollTo(0,0);
};
/* 4.52: Football mode title shows one of the classic match balls in v4work/balls/ (Aerow, Jabulani, Ordem 3, Seitiro, Teamgeist), a different one each new board */
let lastBall = -1;
function pickBall(){ if(typeof BALLS === "undefined" || !BALLS.length) return; let i; do { i = Math.floor(Math.random() * BALLS.length); } while(BALLS.length > 1 && i === lastBall); lastBall = i; document.body.style.setProperty("--ball", `url(${BALLS[i]})`); }

/* 4.70 (Omar): Football mode kickers. Two stick figures stand on the line above the team names (the top edge of #scores),
   one bottom left and one bottom right, and kick this board's match ball to each other forever. It only shows on the
   Football mode board (not on a clue, the winner screen or other screens) and only animates while it's showing. */
(() => {
  const cv = document.getElementById("kick"); if(!cv) return; const g = cv.getContext("2d");
  let ballImg = null, ballSrc = "", W = 0, H = 84, t0 = performance.now();
  const FLIGHT = 8, KICK = 0.32;  /* 4.71 (Omar): 8 s per crossing (was 2.2) */ // seconds the ball is in the air, and the kick swing
  const slow = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.5 : 1;
  const fit = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); W = innerWidth;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; g.setTransform(dpr,0,0,dpr,0,0); };
  addEventListener("resize", fit); fit();
  const showing = () => S.football && !$("#game").hidden && !S.cur && $("#winBox").hidden && !$("#scores").hidden;
  /* 4.75 (Omar): a six-touch rotation. Each player controls the ball, it pops up, and he volleys it across on the way down:
     left knee, right foot, left head, right knee, left foot, right head, then again. Each crossing takes FLIGHT seconds.
     The ball spins about a third as much as before (SPIN). 4.72 was knee (left) and a foot cushion (right) only: see NOTES 4.75. */
  const ROT = [["L","knee"],["R","foot"],["L","head"],["R","heel"],["L","foot"],["R","knee"],["L","heel"],["R","head"]], POP = 1.1, SPIN = 0.35;
  /* 4.77 (Omar): a fourth touch, the heel: he turns his back to the ball, flicks it up with his heel, turns round and volleys it.
     The rotation is now eight touches so each player does all four (4.75-4.76: [L knee, R foot, L head, R knee, L foot, R head]). */
  const UP = {knee: 18, foot: 16, head: 14, heel: 20};             // how far the ball pops up above the touch
  const CYCLE = ROT.length * (FLIGHT + POP);
  const sm = v => { v = Math.max(0, Math.min(1, v)); return v*v*(3 - 2*v); };
  const swing = dt => Math.abs(dt) < KICK ? Math.sin((dt/KICK + 1)/2 * Math.PI) * 1.1 : 0;   // volley swing, strongest at contact (dt = 0)
  const kneeUp = dt => dt < -0.35 || dt > 0.3 ? 0 : dt < 0 ? sm((dt + 0.35) / 0.35) : 1 - sm(dt / 0.3);
  const footUp = dt => dt < -0.3 || dt > 0.42 ? 0 : dt < 0 ? 0.25 * sm((dt + .3) / .3) : dt < .12 ? .25 + .3 * sm(dt / .12) : .55 * (1 - sm((dt - .12) / .3));
  const heelUp = dt => dt < -0.3 || dt > 0.35 ? 0 : dt < 0 ? sm((dt + 0.3) / 0.3) : 1 - sm(dt / 0.35);
  const turned = dt => dt > -0.5 && dt < 0.45;                                          // back to the ball for a heel flick
  const hop = dt => Math.abs(dt) < 0.3 ? 4 * Math.cos(dt / 0.3 * Math.PI / 2) : 0;          // a little jump for the header
  function man(x, dir, ang, knee, jump, heel, turn){                   // dir 1 faces right, -1 faces left; ang = front leg angle, knee 0..1 lifts the knee
    if(turn){ dir = -dir; ang = 0.35; }                      // facing away for the heel flick
    const y = H - 1 - jump, hip = y - 16, sh = y - 29;
    g.lineWidth = 2.6; g.lineCap = "round"; g.strokeStyle = "#0b2a0b"; g.fillStyle = "#0b2a0b";
    g.beginPath(); g.arc(x, y - 35, 5, 0, Math.PI*2); g.fill();                  // head
    g.beginPath(); g.moveTo(x, sh + 1); g.lineTo(x, hip); g.stroke();            // body
    const arm = jump / 4 * 6;                                                     // arms come up a little on a header
    g.beginPath(); g.moveTo(x, sh + 4); g.lineTo(x - 7*dir, sh + 13 - arm); g.moveTo(x, sh + 4); g.lineTo(x + 8*dir, sh + 11 - arm); g.stroke();  // arms
    const bk = x - Math.sin(0.35) * 8 * dir, bky = hip + Math.cos(0.35) * 8, bs = 0.35 + heel * 2.3;   // back leg, bending up behind for a heel flick
    g.beginPath(); g.moveTo(x, hip); g.lineTo(bk, bky); g.lineTo(bk - Math.sin(bs) * 8 * dir, bky + Math.cos(bs) * 8); g.stroke();
    const th = ang + knee * (Math.PI/2 - ang), kx = x + Math.sin(th) * 8 * dir, ky = hip + Math.cos(th) * 8, sa = ang * (1 - knee);
    g.beginPath(); g.moveTo(x, hip); g.lineTo(kx, ky); g.lineTo(kx + Math.sin(sa) * 8 * dir, ky + Math.cos(sa) * 8); g.stroke();  // front leg
  }
  function frame(now){
    requestAnimationFrame(frame);
    const on = showing(); cv.classList.toggle("on", on); if(!on){ t0 = now; return; }
    const sc = $("#scores").getBoundingClientRect(); cv.style.top = (sc.top - H + 1) + "px";
    const src = (typeof BALLS !== "undefined" && BALLS.length && typeof lastBall === "number" && BALLS[lastBall]) || "";
    if(src !== ballSrc){ ballSrc = src; ballImg = null; if(src){ const im = new Image(); im.onload = () => { ballImg = im; }; im.src = src; } }
    g.clearRect(0, 0, W, H);
    const L = 26, R = W - 26, r = 7, hip = H - 17, X = {L, R}, D = {L: 1, R: -1};
    const touch = (side, how) => { const x = X[side], d = D[side];       // where the ball meets him
      return how === "knee" ? [x + 9*d, hip - r - 1] : how === "foot" ? [x + 14*d, H - 1 - r - 3] : how === "heel" ? [x + 15*d, hip - 3] : [x + 2*d, H - 1 - 4 - 35 - 5 - r + 1]; };
    const volley = side => [X[side] + 20 * D[side], hip - 3];
    const seg = (A, B, s, h) => [A[0] + (B[0] - A[0]) * s, A[1] + (B[1] - A[1]) * s - 4 * h * s * (1 - s)];  // a lob from A to B, h px above the line
    const t = (((now - t0) / 1000) * slow) % CYCLE;       // t = 0: the right player has just volleyed it towards the left one's knee
    const k = Math.min(ROT.length - 1, Math.floor(t / (FLIGHT + POP))), u = t - k * (FLIGHT + POP), [side, how] = ROT[k], from = side === "L" ? "R" : "L";
    const C = touch(side, how), V = volley(side);
    let pos;
    if(u < FLIGHT){ const A = volley(from); pos = seg(A, C, u / FLIGHT, (A[1] + C[1]) / 2 - (H - 76)); }            // the long volley across, peaking near the top
    else { const top = Math.min(C[1], V[1]) - UP[how]; pos = seg(C, V, (u - FLIGHT) / POP, (C[1] + V[1]) / 2 - top); }  // popped up off the touch
    const pose = s => { let ang = 0.35, knee = 0, jump = 0, heel = 0, turn = false;
      ROT.forEach(([sd, hw], i) => { if(sd !== s) return;
        for(const sh of [-CYCLE, 0, CYCLE]){ const tc = i * (FLIGHT + POP) + FLIGHT + sh, dt = t - tc;
          if(hw === "knee") knee += kneeUp(dt); else if(hw === "foot") ang += footUp(dt); else if(hw === "heel"){ heel += heelUp(dt); turn = turn || turned(dt); } else jump += hop(dt);
          ang += swing(dt - POP); } });
      return [ang, Math.min(1, knee), jump, Math.min(1, heel), turn]; };
    man(L, 1, ...pose("L")); man(R, -1, ...pose("R"));
    g.save(); g.translate(pos[0], pos[1]); g.rotate((pos[0] - L) / r * SPIN);   // spins a little as it travels (4.70-4.74: (pos[0] - L) / r)
    if(ballImg) g.drawImage(ballImg, -r, -r, r*2, r*2);
    else { g.fillStyle = "#fff"; g.beginPath(); g.arc(0,0,r,0,Math.PI*2); g.fill(); g.lineWidth = 1.2; g.strokeStyle = "#111"; g.stroke(); }
    g.restore();
  }
  requestAnimationFrame(frame);
})();
function newGame(){ S.room = newRoom(); pickBall(); S.done = {}; S.turn = 0; S.x2 = null; S.ended = false; S.teams.forEach(t => { t.score = 0; t.x2used = false; t.twoUsed = false; }); }
const midgame = () => Object.keys(S.done).length > 0 || S.teams.some(t => t.score !== 0);
let confirmYes = null;
function askConfirm(title, text, yesLabel, onYes){
  if(!midgame()){ onYes(); return; }
  $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yesLabel;
  confirmYes = onYes; $("#confirmBox").hidden = false; $("#confirmNo").focus();
}
$("#confirmNo").onclick = () => { $("#confirmBox").hidden = true; confirmYes = null; };
$("#confirmYes").onclick = () => { $("#confirmBox").hidden = true; const f = confirmYes; confirmYes = null; if(f) f(); };
$("#toSetup").onclick = () => askConfirm("Leave this game?", "Going to setup ends the current game. Scores and the board reset when you start again.", "Go to setup", () => { clearGame(); goSetup(); });
function goSetup(){ setFootball(false); $("#setup").hidden = false; $("#game").hidden = true; $("#scores").hidden = true; renderTeamInputs(); histNote(); }
/* 4.84 (Omar): in Football mode, opening Edit scores plays the first 6.65 seconds of the "After review... number 10 Paraguay covered his mouth" VAR call
   (sounds/after-review.mp3, cut from v4work/sounds-src/after-review-original.mp3). Only when sound is on, and not on "Done editing". To remove: delete this block and the playReview() call below. */
/* 4.89 (Omar): normal mode gets just the first 1.9 s ("After review…"), sounds/after-review-short.mp3. */
const reviewA = {};
/* 4.95: a fresh Audio on every click, because some browsers (iPhone Safari) wouldn't replay the same element after it had ended.
   Was: const a = reviewA[src] || (reviewA[src] = new Audio(src)); a.currentTime = 0; */
function playReview(src){ stopReview(); try{ const a = reviewA[src] = new Audio(src); const pr = a.play(); if(pr) pr.catch(() => {}); }catch(e){} }
function stopReview(){ Object.values(reviewA).forEach(a => { a.pause(); a.currentTime = 0; }); }
$("#editScores").onclick = e => { S.editing = !S.editing; if(S.editing && S.sound) playReview(S.football ? "sounds/after-review.mp3" : "sounds/after-review-short.mp3"); e.currentTarget.setAttribute("aria-pressed", S.editing); e.currentTarget.textContent = S.editing ? "Done editing" : "Edit scores"; renderScores(); };
$("#newBoard").onclick = () => askConfirm("Start a new board?", "Every tile comes back with new clues. Scores stay as they are.", "New board", () => { pickBall(); S.done = {}; S.ended = false; renderBoard(); });

/* ---------- board ---------- */
function renderBoard(){
  const b = $("#board"); prefetchPacks(); setTimeout(saveGame, 0);
  b.style.gridTemplateColumns = `repeat(${S.cats.length}, minmax(var(--colmin,118px), 1fr))`;
  b.classList.toggle("many", S.cats.length >= 8);
  b.style.setProperty("--hvw", `${(12/Math.max(8,S.cats.length)).toFixed(2)}vw`);
  let html = S.cats.map(id => `<div class="head">${esc(catById(id).name)}</div>`).join("");
  LV.forEach(l => S.cats.forEach(id => {
    const d = S.done[`${id}-${l}`];
    html += `<button class="tile${d?" done":""}" data-cat="${id}" data-l="${l}" ${d?'disabled aria-label="Played"':`aria-label="${esc(catById(id).name)} for ${l}"`}>${l}</button>`;
  }));
  b.innerHTML = html; placeFbBg();
  const left = S.cats.length*5 - Object.keys(S.done).length;
  if(!left && !S.ended) setTimeout(showWinner, 350);
}
$("#board").addEventListener("click", e => {
  const t = e.target.closest(".tile:not(.done)"); if(!t) return;
  openClue(t.dataset.cat, +t.dataset.l);
});
function showWinner(){
  closeCard(); S.ended = true; clearGame();
  const ranked = S.teams.map((t,i) => ({...t, i})).sort((a,b) => b.score - a.score);
  const max = ranked[0].score, top = ranked.filter(t => t.score === max);
  $("#winTitle").innerHTML = S.teams.length === 1 ? `Final score<br><span>${max}</span>`
    : top.length > 1 ? `It's a tie!<br><span>${esc(top.map(t=>t.name).join(" & "))}</span>` : `${esc(top[0].name)}<br><span>win!</span>`;
  // podium by rank (ties share a step), shown 1-2-3 from the left
  const rankOf = t => 1 + ranked.filter(x => x.score > t.score).length;
  const order = ranked.slice(0, 3);
  $("#podium").innerHTML = order.map(t => { const r = rankOf(t);
    return `<div class="pod p${Math.min(r,3)}"><div class="who">${esc(t.name)}</div><div class="pts">${t.score}</div><div class="step">${r}${["th","st","nd","rd"][(r%100>10&&r%100<14)||r%10>3?0:r%10]}</div></div>`; }).join("");
  $("#podium").hidden = S.teams.length === 1;
  $("#standings").innerHTML = ranked.length > 3 ? ranked.slice(3).map(t => `<li><span>${rankOf(t)}. ${esc(t.name)}</span><b class="${t.score<0?"neg":""}">${t.score}</b></li>`).join("") : "";
  $("#winBoard").hidden = S.cats.length*5 - Object.keys(S.done).length === 0;
  $("#winBox").hidden = false; $("#playAgain").focus();
  confetti(); ledStart(); if(S.sound) playEnd(S.football ? nextIntro() : NORMAL_INTRO);  /* 4.87 (Omar): normal mode plays "no fair" then Siuuu; Football mode alternates the two intros. 4.86: normal mode was Siuuu alone (playSiu()) */  /* 4.63 (Omar): the Siuuu clip in both modes (was: Football mode only, normal mode played Snd.fanfare()) */
}
/* Football mode winner sound: the last 9 seconds of Ronaldo's "Siuuu" clip, in place of the fanfare */
let siuA = null;
const SIU_VOL = 1;  /* 4.63 (Omar): the clip is half as loud, done in sounds/siuuu.mp3 itself because iPhones ignore this volume setting */
/* 4.85 (Omar): before the Siuuu clip, the winner screen plays one of two intros: Messi's "¿Qué mirás, bobo?" (sounds/que-miras.mp3, 3.8–9.8 s of
   v4work/sounds-src/que-miras-original.mp3) or "Referee, no fair" (sounds/no-fair.mp3). The very first one is random; after that they take turns,
   remembered on this device (jn_endIntro). To go back to Siuuu alone: in showWinner() call playSiu() instead of playEnd(). */
const END_INTROS = ["sounds/que-miras.mp3", "sounds/no-fair.mp3"], NORMAL_INTRO = "sounds/no-fair.mp3";
const introA = {};
let introPlaying = null;
function nextIntro(){ const last = store.get("jn_endIntro", null); const i = last === null ? Math.floor(Math.random() * END_INTROS.length) : (last + 1) % END_INTROS.length; store.set("jn_endIntro", i); return END_INTROS[i]; }
/* 4.86 (Omar): smoother hand-over. Siuuu starts END_OVERLAP seconds before the intro ends, so the intro's fade-out (baked into the file) runs under
   Siuuu's fade-in (also baked in: iPhones ignore volume changes from code). 4.85 waited for the intro to end completely: set END_OVERLAP to 0 for that. */
const END_OVERLAP = 0.5;
const INTRO_LEN = {"sounds/que-miras.mp3": 6.03, "sounds/no-fair.mp3": 9.64};  // seconds; update if a clip is re-cut
function playEnd(src){ stopIntro();
  try{ const a = introA[src] || (introA[src] = new Audio(src)); a.muted = false; a.currentTime = 0; introPlaying = a;
    const go = () => { if(introPlaying !== a) return; introPlaying = null; a.ontimeupdate = null; if(S.sound && !$("#winBox").hidden) playSiu(); };
    a.onended = go;
    /* 4.88: hand over by watching how far the intro has actually played, against its known length. 4.86–4.87 set a timer from a.duration when playback
       started; a browser still loading the file can report a wrong length then (or an old position on a replay), which started Siuuu right away and cut the intro. */
    const len = INTRO_LEN[src] || 0; let fromStart = false;   // only count it once it has really (re)started near 0
    a.ontimeupdate = () => { const t = a.currentTime, L = len || (isFinite(a.duration) ? a.duration : 0); if(t < 1) fromStart = true;
      if(fromStart && L && t >= L - END_OVERLAP) go(); };
    const pr = a.play(); if(pr) pr.catch(() => { if(introPlaying === a){ introPlaying = null; playSiu(); } }); }catch(e){ playSiu(); } }
function stopIntro(){ const a = introPlaying; introPlaying = null; if(a){ a.onended = a.ontimeupdate = null; a.pause(); a.currentTime = 0; } }
function playSiu(){ try{ if(!siuA) siuA = new Audio("sounds/siuuu.mp3"); siuA.muted = false; siuA.volume = SIU_VOL; siuA.currentTime = 0; const pr = siuA.play(); if(pr) pr.catch(() => Snd.fanfare()); }catch(e){ Snd.fanfare(); } }
/* 4.59: browsers (Safari, iPhone) block audio that starts without a tap (the timer sounds' AudioContext too), and the winner screen can open on a timer after the last tile.
   So on the first tap, load the clip and play it muted for an instant; after that it's allowed to play at any time. */
function primeSiu(){ Snd.unlock(); primeIntros(); try{ if(siuA) return; siuA = new Audio("sounds/siuuu.mp3"); siuA.preload = "auto"; siuA.muted = true;
  const pr = siuA.play(); const done = () => { if(siuA.muted){ siuA.pause(); siuA.currentTime = 0; } };
  if(pr) pr.then(done).catch(() => {}); else done(); }catch(e){} }
document.addEventListener("pointerdown", primeSiu, {once:true, capture:true});
document.addEventListener("keydown", primeSiu, {once:true, capture:true});
function primeIntros(){ END_INTROS.forEach(src => { try{ if(introA[src]) return; const a = introA[src] = new Audio(src); a.preload = "auto"; a.muted = true;
  const pr = a.play(), done = () => { if(a.muted){ a.pause(); a.currentTime = 0; } }; if(pr) pr.then(done).catch(() => {}); else done(); }catch(e){} }); }
function stopSiu(){ stopIntro(); if(siuA){ siuA.pause(); siuA.currentTime = 0; } }
function hideWinner(){ $("#winBox").hidden = true; stopConfetti(); stopSiu(); ledStop(); }
/* 4.51: the winner LED strip reads SSSIIIIIIII once, then U's that never end, at 65 px/s (32 with reduced motion; 4.50 was 130) */
let ledRaf = null;
function ledStop(){ if(ledRaf) cancelAnimationFrame(ledRaf); ledRaf = null; }
function ledStart(){
  ledStop(); const tr = $("#ledTrack"), strip = tr && tr.parentElement; if(!tr || !S.football) return;
  tr.innerHTML = `<span id="ledHead">SSSIIIIIIII</span><span id="ledUs">${"U".repeat(20)}</span>`;
  const us = $("#ledUs"), uW = us.getBoundingClientRect().width / 20;  // width of one U, letter spacing included
  us.textContent = "U".repeat(Math.ceil(strip.clientWidth / uW) + 4);  // enough U's to fill the strip, plus a spare to wrap
  const speed = (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) ? 32 : 65;
  let x = strip.clientWidth, head = $("#ledHead"), last = performance.now();
  const step = now => {
    x -= speed * Math.min(.1, (now - last) / 1000); last = now;
    if(head && x + head.getBoundingClientRect().width < 0){ x += head.getBoundingClientRect().width; head.remove(); head = null; }  // the SSSIII has gone by
    if(!head) while(x <= -uW) x += uW;  // after that, U's forever: shift back by one U, which looks identical
    tr.style.transform = `translateX(${x.toFixed(1)}px)`;
    ledRaf = requestAnimationFrame(step);
  };
  ledRaf = requestAnimationFrame(step);
}
$("#playAgain").onclick = () => { hideWinner(); if(S.football) S.cats = footballPick(); newGame(); renderBoard(); renderScores(); window.scrollTo(0,0); };
$("#winBoard").onclick = () => { hideWinner(); };
$("#winSetup").onclick = () => { hideWinner(); goSetup(); };
$("#endGame").onclick = () => askConfirm("End the game now?", "This shows the winner screen with the current scores. You can go back to the board afterwards.", "End game", showWinner);
/* confetti: a light canvas burst, skipped when reduced motion is on */
let confRaf = null;
function stopConfetti(){ if(confRaf) cancelAnimationFrame(confRaf); confRaf = null; const cv = $("#confetti"); cv.getContext("2d").clearRect(0,0,cv.width,cv.height); }
function confetti(){
  stopConfetti();
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if(S.football) return fireworks();  // 4.50 (Omar): Football mode gets fireworks instead of confetti. To undo, delete this line
  const cv = $("#confetti"), ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.width = innerWidth*dpr, H = cv.height = innerHeight*dpr;
  const cols = [S.football ? "#0F2557" : "#FFCC33","#FFFFFF","#7FD38F","#EE7A63","#2A33FF","#B9C0FF"];  // navy instead of gold in Football mode
  const ps = Array.from({length:180}, () => ({x:Math.random()*W, y:-Math.random()*H*0.8, vx:(Math.random()-.5)*2*dpr, vy:(2+Math.random()*3)*dpr, r:(4+Math.random()*5)*dpr, a:Math.random()*6.3, va:(Math.random()-.5)*.25, c:cols[Math.floor(Math.random()*cols.length)]}));
  const t0 = performance.now();
  const step = now => {
    ctx.clearRect(0,0,W,H); let alive = 0;
    ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .03*dpr; p.a += p.va; if(p.y < H + 20){ alive++;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); ctx.restore(); }
      else if(now - t0 < 3500){ p.y = -20; p.x = Math.random()*W; p.vy = (2+Math.random()*3)*dpr; alive++; } });
    confRaf = alive ? requestAnimationFrame(step) : null;
  };
  confRaf = requestAnimationFrame(step);
}

/* 4.50: fireworks for the Football mode winner screen. Rockets rise from the bottom and burst into sparks that fall and fade, for about six seconds */
function fireworks(){
  const cv = $("#confetti"), ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = cv.width = innerWidth*dpr, H = cv.height = innerHeight*dpr, floor = H - 64*dpr;
  const cols = ["#FFFFFF","#FFD21A","#E8202A","#0F2557","#7A2BD9","#FF7A00","#FF3FA4"];  // strong colours that read on the bright green
  const rockets = [], sparks = [], t0 = performance.now(); let next = 0, fired = 0;
  const launch = () => { const x = W*(.15 + Math.random()*.7);
    rockets.push({x, y:floor, vx:(Math.random()-.5)*1.2*dpr, vy:-(9 + Math.random()*4)*dpr, top:H*(.12 + Math.random()*.3), c:cols[Math.floor(Math.random()*cols.length)]}); fired++; };
  const burst = r => { const n = 60 + Math.floor(Math.random()*30), c2 = Math.random() < .4 ? cols[Math.floor(Math.random()*cols.length)] : r.c;
    for(let i = 0; i < n; i++){ const a = Math.random()*6.283, v = (2 + Math.random()*5.5)*dpr;
      sparks.push({x:r.x, y:r.y, px:r.x, py:r.y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:1, fade:.008 + Math.random()*.012, c:i % 3 ? r.c : c2}); } };
  const step = now => {
    ctx.clearRect(0,0,W,H);
    if(now - t0 < 6000 && now >= next){ launch(); if(fired < 3 || Math.random() < .35) launch(); next = now + 380 + Math.random()*420; }
    ctx.lineCap = "round";
    for(let i = rockets.length - 1; i >= 0; i--){ const r = rockets[i];
      r.x += r.vx; r.y += r.vy; r.vy += .12*dpr;
      ctx.strokeStyle = "#FFF6D0"; ctx.lineWidth = 4*dpr; ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 4*dpr; ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - r.vx*3, r.y - r.vy*3); ctx.stroke();
      if(r.y <= r.top || r.vy >= 0){ burst(r); rockets.splice(i, 1); } }
    for(let i = sparks.length - 1; i >= 0; i--){ const p = sparks[i];
      p.px = p.x; p.py = p.y; p.x += p.vx; p.y += p.vy; p.vx *= .985; p.vy = p.vy*.985 + .06*dpr; p.life -= p.fade;
      if(p.life <= 0 || p.y > floor){ sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life*1.4)); ctx.strokeStyle = p.c; ctx.fillStyle = p.c; ctx.lineWidth = 4*dpr;
      ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 4*dpr;
      ctx.beginPath(); ctx.moveTo(p.px - p.vx*3, p.py - p.vy*3); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, 3*dpr, 0, 6.283); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    confRaf = (now - t0 < 6000 || rockets.length || sparks.length) ? requestAnimationFrame(step) : null;
  };
  confRaf = requestAnimationFrame(step);
}

/* 5.8 (Omar): resume after a refresh. The game in progress (teams, scores, whose turn, which tiles are done, the board's
   categories, Football mode and its ball) is saved in the browser after every change, and the title screen offers to
   resume it. Leaving through Setup or Title (and confirming), or finishing the game, clears it. To remove: delete this
   block, the saveGame() calls in renderScores()/renderBoard(), clearGame() in the leave handlers, and #resumeBox in head.html. */
/* 5.9 (Omar): phones send answers. A QR code on the clue opens answer.html on a team's phone, which posts to /api (worker/index.js
   on Cloudflare). Closest Wins and Price Is Right get one for every team's number ("Answer QR codes" in setup, on by default);
   with "Steal QR codes" on, other clues get one for the teams that aren't playing to send a steal (worth half, awarded with
   the ½ button). Only works on the Cloudflare link: GitHub Pages and file:// have no /api, so the codes simply don't show.
   STEAL_SKIP lists categories that never get a steal code (Omar to choose). To remove: delete this block, ansPanel(c) in
   renderClue, the #ansQr drawing, closeAns() on reveal, the two setup switches, worker/index.js and answer.html. */
const STEAL_TYPES = new Set(["text","photo","flag","pin","shape","emoji"]);
const STEAL_SKIP = new Set(["spot","igf","cal","headl"]);  // 5.11 (Omar): no steal on three-option (A/B/C) rounds: Most Spotify Listeners, Most Instagram Followers, Most Calories, Real Headline
/* 5.11 (Omar): no steal on the Photo Rounds group either (Car, Actor, Footballer, Person, Food, Logo); checked against CAT_GROUPS when a clue opens */
const noStealGroup = id => { const g = (typeof CAT_GROUPS !== "undefined" ? CAT_GROUPS : []).find(([name]) => name === "Photo Rounds"); return !!(g && g[1].includes(id)); };
let RELAY = null;  // null = still checking, true = /api works here
fetch("api/ping", {cache:"no-store"}).then(r => r.ok ? r.json() : null).then(j => { RELAY = !!(j && j.ok); }).catch(() => { RELAY = false; });
function newRoom(){ const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; let s = ""; for(let i=0;i<10;i++) s += a[Math.floor(Math.random()*a.length)]; return s; }
function ansMode(c){ if(!c || c.preview || !RELAY) return null;
  if(c.type === "closest") return S.qrAns ? "num" : null;
  if(S.steal && S.teams.length > 1 && STEAL_TYPES.has(c.type) && !STEAL_SKIP.has(c.cat) && !noStealGroup(c.cat)) return "steal";
  return null; }
function ansKey(c){ return `${c.cat}-${c.lvl}-${c.cid}`; }
function ansUrl(c, m){ if(!S.room) S.room = newRoom(); const u = new URL("answer", location.href);  // Cloudflare serves answer.html at /answer
  const q = {r:S.room, c:ansKey(c), k:m, n:S.teams.map(t => t.name.replace(/\|/g,"/")).join("|"), cat:catById(c.cat).name, val:String(c.lvl)};
  if(m === "num"){ const p = clueParts(); if(p.unit) q.u = p.unit; } else q.x = String(S.turn || 0);
  u.search = new URLSearchParams(q).toString(); return u.href; }
function ansPanel(c){ const m = ansMode(c); if(!m) return "";
  const steal = m === "steal", playing = S.turn || 0, got = c.phoneAns || {};
  const rows = !steal ? "" : S.teams.map((t,i) => { if(steal && i === playing) return ""; const a = got[i];
    if(!a) return c.revealed ? `<li class="wait">${esc(t.name)}: no steal</li>` : `<li class="wait">${esc(t.name)}: waiting…</li>`;
    if(steal && c.revealed) return `<li class="in"><b>${esc(t.name)}</b> steals with: <span class="sv">${esc(a.v)}</span></li>`;
    return `<li class="in">${esc(t.name)} ✓ ${steal ? "sent a steal" : "locked in"}</li>`; }).join("");
  if(c.revealed && !steal) return "";
  return `<div class="ansqr${c.revealed ? " done" : ""}">${c.revealed ? "" : `<div class="aq" id="ansQr"></div>`}<div class="ansinfo"><div class="eyebrow">${steal
      ? (c.revealed ? "Steals (½ points if right)" : `Steal: teams not playing (${esc(S.teams[playing] ? S.teams[playing].name : "")} is), scan to answer`)
      : "Scan with your phone to send your team's guess"}</div>${rows ? `<ul>${rows}</ul>` : ""}</div></div>`; }
async function pollAns(force){ const c = S.cur; if(!c || (c.revealed && !force)) return; const m = ansMode(c); if(!m || (c.polling && !force)) return;
  c.polling = true;
  try{ const r = await fetch(`api/answers?r=${encodeURIComponent(S.room)}&c=${encodeURIComponent(ansKey(c))}`, {cache:"no-store"}); const j = await r.json();
    if(S.cur !== c) return; const prev = JSON.stringify(c.phoneAns || {}); c.phoneAns = j.answers || {};
    if(m === "num"){ c.guesses = c.guesses || {}; c.phone = c.phone || {};
      Object.entries(c.phoneAns).forEach(([i,a]) => { const n = parseFloat(a.v); if(!isNaN(n) && S.teams[+i]){ c.guesses[+i] = n; c.phone[+i] = true; } }); }
    if(JSON.stringify(c.phoneAns) !== prev){ const ae = document.activeElement;
      if(ae && ae.closest && ae.closest("#clue") && ae.tagName === "INPUT"){ c.redraw = true;
        document.querySelectorAll("#clue .guess.status").forEach(box => { const i = +box.querySelector("[data-typein]").dataset.typein;
          if(c.phone && c.phone[i]){ box.classList.remove("wait"); box.classList.add("in"); box.querySelector("b").textContent = "Locked in ✓"; } }); const ul = $("#clue .ansqr ul"); if(ul){ const tmp = document.createElement("div"); tmp.innerHTML = ansPanel(c); const nu = tmp.querySelector("ul"); if(nu) ul.replaceWith(nu); } }
      else renderClue(); }
    /* 5.10 (Omar): once every team has a number in, reveal by itself after a short pause (not while the host is typing) */
    if(m === "num" && !c.revealed && !c.autoRev && S.teams.every((t,i) => c.guesses && c.guesses[i] != null)){ const ae = document.activeElement;
      if(!(ae && ae.closest && ae.closest("#clue") && ae.tagName === "INPUT")){ c.autoRev = true;
        setTimeout(() => { if(S.cur !== c || c.revealed) return; const rb = $('#clue [data-act="reveal"]'); if(rb) rb.click(); }, 1500); } }
    if(c.redraw){ const ae = document.activeElement; if(!(ae && ae.closest && ae.closest("#clue") && ae.tagName === "INPUT")){ c.redraw = false; renderClue(); } }
  }catch(e){} finally{ c.polling = false; } }
function closeAns(c){ return fetch("api/close", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({r:S.room, c:ansKey(c)})}).catch(() => {}); }
setInterval(pollAns, 1500);
const GAME_KEY = "jn_game";
function saveGame(){ if($("#game").hidden || !S.teams.length) return;
  store.set(GAME_KEY, {v:1, at:Date.now(), football:!!S.football, cats:S.cats, teams:S.teams, done:S.done, turn:S.turn||0, x2:S.x2, ended:!!S.ended, ball:lastBall, power:!!S.power, room:S.room}); }
function clearGame(){ try{ localStorage.removeItem(GAME_KEY); }catch(e){} }
function savedGame(){ const g = store.get(GAME_KEY, null);
  if(!g || g.v !== 1 || g.ended || !Array.isArray(g.teams) || !Array.isArray(g.cats) || !g.cats.length) return null;
  if(Date.now() - (g.at || 0) > 2 * 24 * 3600e3) return null;  // older than two days: start fresh
  if(!g.cats.every(id => catById(id))) return null;
  const played = Object.keys(g.done || {}).length, pts = g.teams.some(t => t.score);
  return played || pts ? g : null; }
function ago(t){ const m = Math.round((Date.now() - t) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m/60)} h ago`; }
function showResume(){ const box = $("#resumeBox"); if(!box) return; const g = savedGame(); box.hidden = !g; if(!g) return;
  const played = Object.keys(g.done || {}).length, total = g.cats.length * LV.length;
  $("#resumeInfo").textContent = `${g.football ? "Football mode · " : ""}${g.teams.map(t => `${t.name} ${t.score}`).join(" · ")} · ${played} of ${total} tiles played · ${ago(g.at)}`; }
function resumeGame(){ const g = savedGame(); if(!g) return;
  setFootball(!!g.football); S.cats = g.cats.slice(); S.teams = g.teams; S.done = g.done || {}; S.turn = g.turn || 0; S.x2 = g.x2 ?? null; S.ended = false; S.power = !!g.power; S.room = g.room || newRoom();
  if(typeof BALLS !== "undefined" && BALLS.length){ const i = g.ball >= 0 && g.ball < BALLS.length ? g.ball : 0; lastBall = i; document.body.style.setProperty("--ball", `url(${BALLS[i]})`); }
  $("#titleScreen").hidden = true; $("#setup").hidden = true; $("#game").hidden = false; $("#scores").hidden = false;
  renderChips(); renderTeamInputs(); renderBoard(); renderScores(); window.scrollTo(0,0); }
function renderScores(){
  const max = Math.max(...S.teams.map(t=>t.score));
  $("#scores").innerHTML = S.teams.map((t,i) =>
    `<div class="team${t.score===max&&max>0?" lead":""}${i===(S.turn||0)?" turn":""}" data-team="${i}" role="button" tabindex="0" aria-label="${esc(t.name)}${i===(S.turn||0)?", picking now":""}. Tap to give them the pick"><div class="nm">${i===(S.turn||0)?'<span class="pick">Picking</span>':""}${esc(t.name)}</div><div class="sc${t.score<0?" neg":""}">${t.score}</div>
     ${S.power ? `<div class="pw"><button class="pwb${S.x2===i?" ready":""}${t.x2used?" used":""}" data-x2="${i}" ${t.x2used || (i!==(S.turn||0) && S.x2!==i) ? "disabled" : ""} aria-label="${esc(t.name)}: double points${t.x2used?" (used)":S.x2===i?" (ready, tap to cancel)":""}" title="${t.x2used ? "Used" : "Tap on your turn, before picking a tile"}">${S.x2===i ? `×2 <span class="lg">ready</span><span class="sm">✓</span>` : "×2"}</button><span class="pwb${t.twoUsed?" used":""}" aria-label="${esc(t.name)}: 2 answers${t.twoUsed?" (used)":" (use it on an open clue)"}" title="${t.twoUsed ? "Used" : "Use it on an open clue"}"><span class="lg">2 answers</span><span class="sm">2 ans</span></span></div>` : ""}
     ${S.editing ? `<div class="adj"><button data-i="${i}" data-d="-100" aria-label="Take 100 from ${esc(t.name)}">−100</button><button data-i="${i}" data-d="100" aria-label="Give 100 to ${esc(t.name)}">+100</button></div>` : ""}</div>`).join("");
  saveGame();
}
$("#scores").addEventListener("click", e => {
  const xb = e.target.closest("[data-x2]");
  if(xb){ const i = +xb.dataset.x2; if(!S.teams[i].x2used){ S.x2 = S.x2===i ? null : i; Snd.blip(); renderScores(); } return; }
  const b = e.target.closest("[data-d]");
  if(!b){ const tm = e.target.closest("[data-team]"); if(tm){ S.turn = +tm.dataset.team; if(S.x2!==null && S.x2!==S.turn) S.x2 = null; renderScores(); } return; }
  if(!S.editing) return;
  S.teams[+b.dataset.i].score += +b.dataset.d; renderScores();
});

/* ---------- clue card ---------- */
let timer = null;
function pickIdx(cat,lvl,exclude){
  const n = pool(cat,lvl).length;
  let avail = [...Array(n).keys()].filter(i => !S.used.has(`${cat}-${lvl}-${i}`) && i !== exclude);
  if(!avail.length){ for(let i=0;i<n;i++) S.used.delete(`${cat}-${lvl}-${i}`); avail = [...Array(n).keys()].filter(i=>i!==exclude); }
  if(catById(cat).type==="photo"){
    const withPhoto = [...Array(n).keys()].filter(i => i !== exclude && photos[norm(pool(cat,lvl)[i][0])]);
    const fresh = withPhoto.filter(i => !S.used.has(`${cat}-${lvl}-${i}`));
    if(fresh.length) avail = fresh; else if(withPhoto.length) avail = withPhoto;
  }
  return avail[Math.floor(Math.random()*avail.length)];
}
function openClue(cat,lvl,exclude,forceIdx){
  const preview = forceIdx !== undefined;
  const idx = preview ? forceIdx : takePick(cat,lvl,exclude);
  const type = catById(cat).type;
  const zoomStart = {100:3.5,200:4.2,300:4.8,400:5.4,500:6}[lvl];
  S.cur = {cat,lvl,idx,type,revealed:false,awards:{},zoom:zoomStart,ox:45+Math.random()*10,oy:(cat==="actor"||cat==="person"?28:48)+Math.random()*10,shown:false,
           secs: type==="act"?60:type==="impostor"?120:45, left: type==="act"?60:type==="impostor"?120:45, running:false, cid: Date.now().toString(36) + Math.random().toString(36).slice(2,6), stage:"count", player:1, show:false, imp:0, qrText:null, preview, x2: preview ? null : S.x2, two:{}};
  stopTimer();
  try{ renderClue(); }catch(err){ $("#clue").innerHTML = `<div class="eyebrow">${esc(catById(cat).name)} · ${lvl}</div><p class="note">This clue couldn't be shown (${esc(err && err.message || err)}). Tell Claude this message. Tap Back to board.</p><div class="row"><button class="btn small" data-act="cancel">Back to board</button></div>`; }
  $("#card").hidden = false;
  $("#clue").focus?.();
}
function clueParts(){
  const {cat,lvl,idx,type} = S.cur;
  if(type==="text"){ const [q,a,img,blur] = pool(cat,lvl)[idx]; return {q, a, img, blur}; }
  if(type==="flag"){ const id = pool(cat,lvl)[idx]; return {q:"Name the country this flag belongs to.", a:F[id][0], flag:id}; }
  if(type==="impostor"){ const [ic,w] = pool(cat,lvl)[idx]; return {q:"Who's the Impostor? Everyone plays. Each player scans their own code; one of you is secretly the impostor.", a:w, icat:ic}; }
  if(type==="password"){ const w = pool(cat,lvl)[idx]; return {q:"Each team picks one clue-giver. Both scan the same code. Take turns giving ONE-word clues; after each clue, that team gets one guess.", a:w}; }
  if(type==="closest"){ const [q,v,u] = pool(cat,lvl)[idx]; return {q, a:`${v.toLocaleString("en-US")} ${u}`.trim(), num:v, unit:u}; }
  if(type==="pin"){ const [city,country,lat,lon] = pool(cat,lvl)[idx]; return {q:"Name the city at the pin. Just the country gets half points.", a:`${city}, ${country}`, pin:[lat,lon]}; }
  if(type==="shape"){ const [n,al] = pool(cat,lvl)[idx]; return {q:"Name the country from its outline.", a:n, shape:al}; }
  if(type==="emoji"){ const [e,ans] = pool(cat,lvl)[idx]; const ar = typeof AR_EMOJI !== "undefined" && AR_EMOJI.has(ans) ? " (Arabic)" : ""; return {q: (cat==="emov" ? "Name the film or TV show." : cat==="emeg" ? "Name the Egyptian film, series or play." : cat==="emseg" ? "Decode the Egyptian phrase or saying." : "Decode the phrase or proverb.") + ar, a:ans, emoji:e}; }
  if(type==="act"){ const t = pool(cat,lvl)[idx], kind = (typeof ACT_KIND !== "undefined" && ACT_KIND[t]) || "film";
    return {q: cat==="acteg" ? "One player acts out this Egyptian film, series or play. No talking, no sounds, no pointing at letters." : "One player acts out this film or TV show. No talking, no sounds, no pointing at letters.", a:`${t} (${kind})`}; }
  const [a,wiki] = pool(cat,lvl)[idx];
  return {q: cat==="car" ? (lvl>=300 ? "Name the make AND model." : "Name the make and model.") : cat==="footy" ? "Who is this footballer?" : cat==="person" ? "Who is this famous person?" : "Who is this actor?", a, wiki};
}
/* Photo packs: some photo clues live in photos/<pack>.js bundles (one file per value) to stay under the artifact's file limit.
   A clue image "pack:<pack>:<key>" is filled in once its bundle has loaded. */
const PACKS = {}, BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
function loadPack(pack){ return PACKS[pack] || (PACKS[pack] = new Promise(r => { const s = document.createElement("script"); s.src = `photos/${pack}.js`; s.onload = r; s.onerror = r; document.head.appendChild(s); })); }
function packSrc(ref, cur){
  if(!ref.startsWith("pack:")) return ref;
  const [, , key] = ref.split(":"), got = (window.__fp || {})[key];
  if(got) return got;
  if(DIRECT[key] === undefined || DIRECT[key] === "queued"){ if(DIRECT[key] === "queued") delete DIRECT[key]; warmRef(ref, true); }
  const d = DIRECT[key]; if(d && d.complete && d.naturalWidth) return d.src;
  return BLANK;  // showPack() swaps it in when the single photo or its bundle arrives
}
function showPack(key, src){ const c = S.cur; if(!c || !src) return; const r = imgRefFor(c.cat,c.lvl,c.idx);
  if(r && r.endsWith(":" + key)){ const im = $("#clue .zoom img"); if(im && im.src !== src) im.src = src; } }
/* 5.3 (Omar: photos took a long time to appear). Each tile's clue is picked as soon as the board is drawn and its photo starts
   downloading in the background, so it's usually there before the tile is opened. Pack photos (Guess the Food) are fetched
   one by one from photos/<key>.jpg when that file exists (GitHub Pages); a pack bundle is only downloaded if the single
   file isn't there (e.g. Guess the Logo, or the artifact). Was: prefetchPacks() loaded every bundle for the chosen categories
   at once (about 22 MB for Guess the Food), and photos only started loading when a tile was opened. */
const PICKS = {}, WARM = {}, DIRECT = {};
function imgRefFor(cat,lvl,idx){ const c = catById(cat); if(!c) return null; const e = pool(cat,lvl)[idx]; if(!e) return null;
  if(c.type === "photo") return photos[norm(e[0])] || null;
  if(c.type === "text" && typeof e[2] === "string") return e[2]; return null; }
/* 5.4: background downloads go one or two at a time, at low priority, and pause while a clue is open, so the photo you
   are looking at never has to share the connection with 29 others (5.3 started them all at once). */
const WQ = []; let wBusy = 0;
function wPump(){ const max = $("#game").hidden ? 4 : 2; while(wBusy < max && WQ.length && !S.cur){ const job = WQ.shift(); wBusy++; job(() => { wBusy--; wPump(); }); } }
function wLoad(src, onload, onerror){ const im = new Image(); im.decoding = "async"; try{ im.fetchPriority = "low"; }catch(e){}
  return new Promise(done => { im.onload = () => { done(); onload && onload(im); }; im.onerror = () => { done(); onerror && onerror(im); }; im.src = src; }).then(() => im); }
function warmImg(src){ if(!src || WARM[src] || src.startsWith("blob:") || src.startsWith("data:")) return; WARM[src] = true;
  WQ.push(next => wLoad(src).then(im => { WARM[src] = im; next(); })); wPump(); }
function warmRef(ref, now){ if(!ref) return;
  if(!ref.startsWith("pack:")){ warmImg(ref); return; }
  const [, pack, key] = ref.split(":"); if((window.__fp || {})[key] || DIRECT[key] !== undefined) return;
  DIRECT[key] = "queued";
  const go = next => { if(!now && DIRECT[key] !== "queued"){ next(); return; } const im = new Image(); DIRECT[key] = im; if(now) try{ im.fetchPriority = "high"; }catch(e){}
    im.onload = () => { showPack(key, im.src); next(); };
    im.onerror = () => { DIRECT[key] = null; next(); loadPack(pack).then(() => showPack(key, (window.__fp || {})[key])); }; im.src = `photos/${key}.jpg`; };
  if(now) go(() => {}); else { WQ.push(go); wPump(); } }
function prepick(cat,lvl){ const k = `${cat}-${lvl}`; if(PICKS[k] !== undefined && !S.used.has(`${k}-${PICKS[k]}`)) return;
  const n = pool(cat,lvl).length; if(!n) return; PICKS[k] = pickIdx(cat,lvl); warmRef(imgRefFor(cat,lvl,PICKS[k])); }
function takePick(cat,lvl,exclude){ const k = `${cat}-${lvl}`, i = PICKS[k]; delete PICKS[k];
  if(exclude === undefined && i !== undefined && i < pool(cat,lvl).length && !S.used.has(`${k}-${i}`)) return i;
  return pickIdx(cat,lvl,exclude); }
/* 5.5 (Omar): Photo rounds panel lists every photo category with how many of its photos are downloaded, and can fetch them all. */
const LOADED = new Set();
function refUrl(ref){ return ref.startsWith("pack:") ? null : ref; }
function refLoaded(ref){ if(LOADED.has(ref)) return true;
  if(ref.startsWith("pack:")){ const key = ref.split(":")[2], d = DIRECT[key]; return !!((window.__fp || {})[key] || (d && d.complete && d.naturalWidth)); }
  const w = WARM[ref]; return !!(w && w.complete && w.naturalWidth); }
function photoRefs(cat){ const out = new Set(); LV.forEach(l => pool(cat,l).forEach((e,i) => { const r = imgRefFor(cat,l,i); if(r && !r.startsWith("blob:") && !r.startsWith("data:")) out.add(r); })); return [...out]; }
function dlCats(){ return CATS.filter(c => c.type === "photo" || (c.type === "text" && LV.some(l => pool(c.id,l).some(e => typeof e[2] === "string")))).map(c => c.id); }
let dlTimer = null;
function renderDl(){ const box = $("#dlStatus"); if(!box) return; let all = 0, got = 0;
  box.innerHTML = dlCats().map(id => { const refs = photoRefs(id), n = refs.filter(refLoaded).length; all += refs.length; got += n;
    const pct = refs.length ? Math.round(100 * n / refs.length) : 0;
    return `<div class="dlrow${n === refs.length ? " full" : ""}"><div>${esc(catById(id).name)}<div class="bar"><i style="width:${pct}%"></i></div></div><span class="num">${n} / ${refs.length}</span><button class="mini" data-dl="${id}">${n === refs.length ? "Done" : "Download"}</button></div>`; }).join("");
  $("#dlAll").textContent = got === all ? "All photos downloaded" : `Download everything (${all - got} photos to go)`; renderTools();
  if(dlTimer === null && WQ.length + wBusy > 0) dlTimer = setInterval(() => { renderDl(); if(!WQ.length && !wBusy){ clearInterval(dlTimer); dlTimer = null; renderDl(); } }, 700); }
function dlCat(id){ photoRefs(id).forEach(r => { if(!refLoaded(r)) warmRef(r); }); renderDl(); }
$("#dlStatus").addEventListener("click", e => { const b = e.target.closest("[data-dl]"); if(b) dlCat(b.dataset.dl); });
$("#dlAll").onclick = () => { dlCats().forEach(dlCat); SOUNDS.forEach(warmSound); renderDl(); };
$("#statusPanel").addEventListener("toggle", () => { if($("#statusPanel").open){ SOUNDS.forEach(warmSound); renderDl(); if(!stTimer) stTimer = setInterval(() => { if(!$("#statusPanel").open || $("#setup").hidden){ clearInterval(stTimer); stTimer = null; return; } renderTools(); }, 1000); } });
/* tools, fonts and sounds */
const SOUNDS = ["sounds/siuuu.mp3","sounds/no-fair.mp3","sounds/que-miras.mp3","sounds/after-review.mp3","sounds/after-review-short.mp3"], SND = {};
let stTimer = null;
/* 5.7: sounds are fetched as plain files (into the browser cache) instead of preloading <audio>, which Safari won't do before
   a click, so the count stayed at 0. They start downloading as soon as Status is opened (about 0.5 MB in all).
   Was: new Audio() with preload="auto", counted ready at readyState 4. */
function warmSound(src){ if(SND[src]) return; SND[src] = "loading";
  fetch(src).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status)).then(() => { SND[src] = "ok"; }, () => { SND[src] = "err"; }).then(renderTools); }
function fontsState(){ if(!document.fonts) return [true, "ready"]; const fs = [...document.fonts]; if(!fs.length) return [false, "waiting for Google Fonts"];
  const ok = fs.filter(f => f.status === "loaded").length; return [document.fonts.status === "loaded" && ok > 0, ok ? `${ok} font files in` : "list in, files load as text needs them"]; }
function renderTools(){ const box = $("#stTools"); if(!box) return;
  const snd = SOUNDS.filter(s => SND[s] === "ok").length, sndErr = SOUNDS.some(s => SND[s] === "err");
  const [fOk, fTxt] = fontsState(), err = window.__cdnErr || {};
  const rows = [
    ["Fonts (Google Fonts)", fOk, err.fonts ? "couldn't load" : fTxt],
    ["World map (Country Outlines, Map Pin)", !!WORLD.feats, WORLD.feats ? "ready" : err.map ? "couldn't load" : "still loading"],
    ["QR codes (Act It Out, Impostor, One Word)", !!window.QRCode, window.QRCode ? "ready" : err.qr ? "couldn't load" : "still loading"],
    ["Photo export and import", !!window.JSZip, window.JSZip ? "ready" : err.zip ? "couldn't load" : "still loading"],
    ["Phone answers (QR codes on clues)", RELAY === true, RELAY === true ? "ready" : RELAY === false ? "only on the Cloudflare link" : "checking"],
    ["Sounds (winner clips, VAR clip)", snd === SOUNDS.length, sndErr && snd < SOUNDS.length ? "couldn't load" : `${snd} / ${SOUNDS.length}`]];
  box.innerHTML = rows.map(([n, ok, t]) => `<div class="dlrow${ok ? " full" : ""}"><div>${esc(n)}</div><span class="num">${esc(t)}</span><span>${ok ? "✓" : t === "couldn't load" ? "✕" : "…"}</span></div>`).join("");
  const toolsOk = rows.filter(r => r[1]).length; $("#stCount").textContent = `${toolsOk}/${rows.length} tools ready`; }
document.addEventListener("load", e => { const im = e.target; if(im && im.tagName === "IMG" && im.closest && im.closest("#clue")){ const c = S.cur; const r = c && imgRefFor(c.cat,c.lvl,c.idx); if(r) LOADED.add(r); } }, true);
function prefetchPacks(){ for(const id of S.cats || []){ if(!catById(id)) continue; for(const v of [100,200,300,400,500]) if(!(S.done && S.done[`${id}-${v}`])) prepick(id,v); } }
/* 4.60: three-option answers ("B) Name: 381M followers\n(others: A) 68M, C) 67M)") show the winner big and bold
   and the other figures on a smaller, lighter line underneath. Every other answer is shown as before. */
function fmtAns(a){ const m = String(a).match(/^([\s\S]*?)\s*\n\s*(\(others:[\s\S]*\))\s*$/);
  return m ? `<span class="ans-main">${esc(m[1])}</span><span class="ans-rest">${esc(m[2])}</span>` : esc(a); }
function renderClue(){
  const c = S.cur, p = clueParts(), cat = catById(c.cat);
  let media = "";
  if(p.flag) media = `<div class="flagbox">${flagSVG(p.flag)}</div>`;
  if(p.pin){ let svg = ""; try{ svg = pinSVG(p.pin[0], p.pin[1]); }catch(e){ svg = ""; } media = svg ? `<div class="pinbox">${svg}</div>` : `<div class="note">The world map didn't load, so this map can't be drawn. Close the tile and pick another, or reload.</div>`; }
  if(p.shape){ let svg = ""; try{ svg = shapeSVG(p.shape); }catch(e){ svg = ""; } media = svg ? `<div class="shapebox">${svg}</div>` : `<div class="note">The world map didn't load, so this outline can't be drawn. Close the tile and pick another, or check your connection and reload.</div>`; }
  if(p.img){
    /* Guess the Logo: the image starts blurred (p.blur = blur radius as a share of the image width) and the host can step it down */
    if(p.blur && c.blurIdx !== c.idx){ c.blurIdx = c.idx; c.blur = p.blur; }
    const b = p.blur && !c.revealed ? c.blur : 0;
    media = `<div class="zoom${p.blur ? " logo" : ""}"><img fetchpriority="high" src="${esc(packSrc(p.img, c))}" alt="${p.blur ? "Blurred logo" : "Photo clue"}" style="object-fit:contain${b ? `;filter:blur(${(b*100).toFixed(2)}cqw)` : ""}"></div>${b ? `<div class="row"><button class="btn small" data-act="unblur">Less blur</button></div>` : ""}`;
  }
  if(p.emoji) media = `<div class="emoji" role="img" aria-label="Emoji clue">${esc(p.emoji)}</div>`;
  if(c.type==="photo"){
    const url = photos[norm(p.a)];
    media = `<div class="zoom">${url
      ? (() => { const f = focus[norm(p.a)] || {x:c.ox, y:c.oy}; const full = c.revealed || c.zoom <= 1.01;
          return `<img fetchpriority="high" src="${url}" alt="Zoomed photo to identify" style="object-fit:${full?"contain":"cover"};object-position:${full ? "50% 50%" : f.x+"% "+f.y+"%"};transform-origin:${f.x}% ${f.y}%;transform:scale(${full?1:c.zoom})">`; })()
      : `<div class="empty"><div>No photo loaded for this clue.</div><div class="row" style="justify-content:center"><label class="btn small" for="one">Add photo</label><a class="btn small" href="https://en.wikipedia.org/wiki/${encodeURIComponent(p.wiki)}" target="_blank" rel="noopener">Find one on Wikipedia</a></div><div class="note">Host only: answer is hidden until you tap Reveal.</div></div>`}
      </div><input id="one" type="file" accept="image/*" hidden>
      <div class="row">${url && !c.revealed ? `<button class="btn small" data-act="zoomout">Zoom out</button>` : ""}</div>`;
  }
  if(c.type==="impostor"){
    const n = S.impN;
    if(c.stage==="count") media = `<div class="secret"><div class="eyebrow">How many players?</div>
        <div class="row" style="justify-content:center"><button class="btn small" data-act="impdec" aria-label="Fewer players">−</button><span class="title" style="min-width:2ch">${n}</span><button class="btn small" data-act="impinc" aria-label="More players">+</button></div>
        <div class="note">Sit in a circle and number yourselves 1 to ${n}. Each player scans their own code in turn.</div>
        <div><button class="btn small" data-act="impstart">Start handing out codes</button></div></div>`;
    else if(c.stage==="scan") media = `<div class="secret">${c.show
        ? `<div class="eyebrow">Player ${c.player}: scan now</div><div class="qr" id="qrbox"></div><div><button class="btn small" data-act="impnext">${c.player<n ? `Hide and pass to Player ${c.player+1}` : "Hide code, everyone's in"}</button></div>`
        : `<div class="eyebrow">Pass to Player ${c.player} of ${n}</div><div class="note">Everyone else, look away.</div><div><button class="btn small" data-act="impshow">Show Player ${c.player}'s code</button></div>`}</div>`;
    else media = `<div class="secret"><div class="eyebrow">Everyone has their word</div>
        <div class="note" style="text-align:left;max-width:52ch;margin:0 auto">1. Go round the circle: each player says one word linked to the secret word.<br>2. Do one or two rounds, then everyone points at the suspect on the count of three.<br>3. Tap Reveal.<br><br><strong>Who wins:</strong> impostor caught = the team that picked the tile gets the points. Impostor escapes = the impostor's team gets them. A caught impostor can still steal the points by guessing the secret word.</div></div>`;
  }
  if(c.type==="password"){
    const turn = c.turn||0;
    media = `<div class="secret">${c.qr
      ? `<div class="eyebrow">Clue-givers: scan with your phones</div><div class="qr" id="qrbox"></div><div class="note">Everyone else, look away.</div><div><button class="btn small" data-act="hide">Hide code</button></div>`
      : `<div><button class="btn small" data-act="qr">Show code for clue-givers</button></div>`}
      <div class="eyebrow">Clue ${ (c.clue||1) } · whose turn</div>
      <div class="row" style="justify-content:center">${S.teams.map((t,i)=>`<button class="chip" aria-pressed="${i===turn}" data-turn="${i}">${esc(t.name)}</button>`).join("")}</div>
      <div><button class="btn small" data-act="nextturn">Wrong guess: next team</button></div>
      <div class="note">One word per clue. No gestures, no part of the word, no rhymes or 'sounds like'. Break a rule and the turn passes.</div></div>`;
  }
  if(c.type==="closest"){
    c.guesses = c.guesses || {};
    media = `<div class="guesses">${S.teams.map((t,i) => { const g = c.guesses[i], d = c.revealed && g!=null ? Math.abs(g - p.num) : null;
      /* 5.10 (Omar): with phone answers on, each box is a status (Waiting… / Locked in ✓) with a small Type button for the host, instead of an input */
      if(ansMode(c) && !c.revealed && !(c.typing && c.typing[i])){ const st = c.phone && c.phone[i] ? "Locked in ✓" : g!=null ? "Typed in ✓" : "Waiting…";
        return `<div class="guess status${st==="Waiting…" ? " wait" : " in"}"><span>${esc(t.name)}</span><b>${st}</b><button class="mini" data-typein="${i}">Type</button></div>`; }
      return `<label class="guess${c.revealed && c.winners && c.winners.includes(i) ? " win" : ""}"><span>${esc(t.name)}</span>
        <input id="guess${i}" data-g="${i}" inputmode="decimal" autocomplete="off" placeholder="${"Guess" + (p.unit ? " ("+esc(p.unit)+")" : "")}" value="${g!=null && !(!c.revealed && c.phone && c.phone[i]) ? g : ""}" ${c.revealed ? "disabled" : ""}>
        ${d!=null ? `<em>${d===0 ? "Exact!" : "off by " + d.toLocaleString("en-US")}</em>` : ""}</label>`; }).join("")}</div>
      ${!c.revealed ? `<div class="note">${ansMode(c) ? "Each team scans the code and sends one number (or tap Type to enter it for them)." : "Each team agrees on one number and types it in."} Closest wins; a tie means both score.</div>` : ""}`;
  }
  if(c.type==="act"){
    media = `<div class="secret">${c.qr
      ? `<div class="eyebrow">Actor: scan this with your phone camera</div><div class="qr" id="qrbox"></div><div class="note">The film title pops up as text on the actor's phone. Everyone else, look away. Tap Start when the actor is ready.</div><div><button class="btn small" data-act="hide">Hide code</button></div>`
      : `<div class="eyebrow">Keep the title secret</div>
         <div><button class="btn small" data-act="qr">Show code for actor's phone</button></div>
         <div class="note">The actor scans the code with their phone camera to see the film title.</div>`}</div>`;
  }
  const pct = 100*c.left/c.secs;
  const badges = [c.x2!=null && S.teams[c.x2] ? `<span class="badge">×2 · ${esc(S.teams[c.x2].name)}</span>` : "", ...Object.keys(c.two).map(i => S.teams[i] ? `<span class="badge">2 answers allowed · ${esc(S.teams[i].name)}</span>` : "")].filter(Boolean).join("");
  const canTwo = S.power && !c.preview && !c.revealed ? /* only the team whose turn it is can use 2 answers */ S.teams.map((t,i) => (i===(S.turn||0) && !t.twoUsed && !c.two[i]) ? `<button class="pwb" data-two="${i}">${esc(t.name)}: 2 answers</button>` : "").filter(Boolean).join("") : "";
  $("#clue").innerHTML = `
    <div class="cluehead"><div class="eyebrow">${c.preview ? "Preview · " : ""}${esc(cat.name)}</div><div class="val">${c.lvl}</div></div>
    ${badges ? `<div class="badges">${badges}</div>` : ""}
    <p class="qtext${(p.q||"").length > 150 ? " long" : ""}${S.cur.cat==="form" ? " lineup" : ""}">${esc(p.q)}</p>
    ${media}
    ${ansPanel(c)}
    <div class="timer${c.left<=0?" out":""}"><button class="btn small" data-act="timer">${c.running?"Pause":c.left<c.secs?"Resume":"Start "+c.secs+"s"}</button><div class="bar"><i style="width:${pct}%"></i></div><div class="t">${c.left<=0 ? "Time's up" : Math.max(0,Math.ceil(c.left))}</div></div>
    ${c.revealed ? `<div class="answer${c.fresh ? " fresh" : ""}">${c.type==="impostor" ? `Impostor: Player ${c.imp} · Word: ${esc(p.a)} <span class="note">(category: ${esc(p.icat)})</span>` : fmtAns(p.a)}</div>` : ""}
    ${c.revealed && !c.preview ? `<div class="award">${S.teams.map((t,i)=>`<div class="grp"><span>${esc(t.name)}</span><button class="y${c.awards[i]===1?" on":""}" data-aw="${i}" data-v="1" aria-label="${esc(t.name)} correct">+${c.lvl*(c.x2===i?2:1)}</button><button class="h${c.awards[i]===0.5?" on":""}" data-aw="${i}" data-v="0.5" aria-label="${esc(t.name)} half points">+${c.lvl/2*(c.x2===i?2:1)}</button><button class="n${c.awards[i]===-1?" on":""}" data-aw="${i}" data-v="-1" aria-label="${esc(t.name)} wrong">−${c.lvl}</button></div>`).join("")}</div>` : ""}
    ${canTwo ? `<div class="pwrow"><span class="lbl">Power-up:</span>${canTwo}</div>` : ""}
    <div class="row">
      ${c.revealed || (c.type==="impostor" && c.stage!=="play") ? "" : `<button class="btn primary" data-act="reveal">${c.type==="impostor" ? "Reveal impostor" : "Reveal answer"}</button>`}
      <button class="btn" data-act="done">${c.preview ? "Close preview" : Object.keys(c.awards).length ? "Save scores and close" : "Close tile"}</button>
      ${c.preview || c.revealed ? "" : `<button class="btn small" data-act="swap" title="Already played this one? Get a different clue from the same category and value">Swap clue</button>`}
      ${c.preview ? "" : `<button class="btn small" data-act="cancel">Back to board</button>`}
    </div>`;
  const zimg = $("#clue .zoom img");
  if(zimg && c.type==="photo" && !focus[norm(p.a)] && "FaceDetector" in window && (c.cat==="actor"||c.cat==="footy"||c.cat==="person")){
    const k = norm(p.a);
    const run = async () => { try{ const fs = await new window.FaceDetector({fastMode:true,maxDetectedFaces:1}).detect(zimg); if(fs[0] && S.cur===c){ const b = fs[0].boundingBox; saveFocus(k, 100*(b.x+b.width/2)/zimg.naturalWidth, 100*(b.y+b.height/2)/zimg.naturalHeight); renderClue(); } }catch(err){} };
    zimg.complete ? run() : zimg.addEventListener("load", run, {once:true});
  }
  const aq = $("#ansQr"); if(aq){ const m = ansMode(c);
    if(window.QRCode){ try{ new QRCode(aq, {text: ansUrl(c, m), width: 180, height: 180, correctLevel: QRCode.CorrectLevel.L}); }catch(err){ aq.textContent = "Couldn't draw the code."; } }
    else aq.textContent = "The code maker didn't load yet."; }
  const qb = $("#qrbox");
  if(qb){
    const txt = (c.qrText || p.a).normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    if(window.QRCode){ try{ new QRCode(qb, {text: txt, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M}); }catch(err){ qb.textContent = "Couldn't draw the code. Reveal the answer privately instead."; } }
    else qb.textContent = "The code maker didn't load. Reveal the answer privately instead.";
  }
  const one = $("#one");
  if(one) one.onchange = e => { const f = e.target.files[0]; if(f){ const k = norm(p.a); delete focus[k]; store.set("jn_focus", focus); setPhoto(k, f); renderClue(); renderPrep(); packStatus(); openFocus(k, "Host only: tap the face or the part to zoom in on"); } };
}
function tick(){
  const c = S.cur; if(!c) return;
  c.left -= .25;
  if(c.left <= 0){ c.left = 0; stopTimer(); c.running = false; Snd.chime(); renderClue(); return; }
  if(c.left <= 5 && c.left % 1 === 0) Snd.tick();
  const i = $("#clue .bar i"), t = $("#clue .timer .t");
  if(i) i.style.width = (100*c.left/c.secs)+"%"; if(t) t.textContent = Math.ceil(c.left);
}
function stopTimer(){ if(timer){ clearInterval(timer); timer = null; } }
function closeCard(){ stopTimer(); $("#card").hidden = true; S.cur = null; wPump(); }

$("#clue").addEventListener("click", e => {
  const c = S.cur; if(!c) return;
  const ti = e.target.closest("[data-typein]");
  if(ti){ const i = +ti.dataset.typein; c.typing = c.typing || {}; c.typing[i] = true; renderClue(); const inp = $("#guess" + i); if(inp) inp.focus(); return; }
  const tw = e.target.closest("[data-two]");
  if(tw){ c.two[+tw.dataset.two] = true; Snd.blip(); renderClue(); return; }
  const tb = e.target.closest("[data-turn]");
  if(tb){ c.turn = +tb.dataset.turn; renderClue(); return; }
  const aw = e.target.closest("[data-aw]");
  if(aw && c.revealed){ const i = +aw.dataset.aw, v = +aw.dataset.v; c.awards[i] = c.awards[i]===v ? undefined : v; if(c.awards[i]===undefined) delete c.awards[i]; renderClue(); return; }
  const b = e.target.closest("[data-act]"); if(!b) return;
  const a = b.dataset.act;
  if(a==="reveal" && c.type==="closest"){
    const p = clueParts(), diffs = Object.entries(c.guesses||{}).filter(([,g]) => g!=null).map(([i,g]) => [+i, Math.abs(g - p.num)]);
    if(diffs.length){ const best = Math.min(...diffs.map(d => d[1])); c.winners = diffs.filter(d => d[1]===best).map(d => d[0]); c.awards = {}; c.winners.forEach(i => c.awards[i] = 1); }
  }
  /* 5.9: before revealing, stop phone answers and fetch the last ones, then reveal */
  if(a==="reveal" && ansMode(c) && !c.finalPolled){ c.finalPolled = true; b.disabled = true;
    closeAns(c).then(() => pollAns(true)).then(() => { const rb = $('#clue [data-act="reveal"]'); if(rb && S.cur === c){ rb.disabled = false; rb.click(); } }); return; }
  if(a==="reveal"){ c.revealed = true; c.fresh = true; stopTimer(); c.running = false; renderClue(); c.fresh = false; }
  if(a==="setspot"){ openFocus(norm(clueParts().a), "Host only: tap the face or the part to zoom in on"); return; }
  if(a==="unblur"){ c.blur = c.blur < 0.005 ? 0 : c.blur * 0.72; renderClue(); }  // v4.40: c.blur < 0.006 ? 0 : c.blur * 0.55
  if(a==="zoomout"){ c.zoom = c.zoom < 1.4 ? 1 : 1 + (c.zoom-1)*0.55; renderClue(); }
  if(a==="qr"){ c.qr = true; renderClue(); }
  if(a==="nextturn"){ c.turn = ((c.turn||0)+1) % S.teams.length; c.clue = (c.clue||1)+1; renderClue(); }
  if(a==="impdec"){ S.impN = Math.max(3, S.impN-1); store.set("jn_impN", S.impN); renderClue(); }
  if(a==="impinc"){ S.impN = Math.min(20, S.impN+1); store.set("jn_impN", S.impN); renderClue(); }
  if(a==="impstart"){ c.imp = 1 + Math.floor(Math.random()*S.impN); c.stage = "scan"; c.player = 1; c.show = false; renderClue(); }
  if(a==="impshow"){ const p = clueParts();
    const real = "Your word: " + p.a, fake = "You are the IMPOSTOR. Category: " + p.icat, L = Math.max(real.length, fake.length);
    c.qrText = (c.player===c.imp ? fake : real).padEnd(L, " "); c.show = true; renderClue(); }
  if(a==="impnext"){ c.show = false; c.qrText = null; if(c.player < S.impN) c.player++; else c.stage = "play"; renderClue(); }
  if(a==="hide"){ c.qr = false; renderClue(); }
  if(a==="timer"){
    if(c.running){ stopTimer(); c.running = false; }
    else { if(c.left<=0) c.left = c.secs; c.running = true; Snd.unlock(); timer = setInterval(tick,250); }
    renderClue();
  }
  if(a==="swap"){ const turn = c.turn; S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]); histNote();
    const two = c.two; openClue(c.cat, c.lvl, c.idx); S.cur.two = two; if(turn !== undefined) S.cur.turn = turn; renderClue(); return; }
  if(a==="cancel"){ closeCard(); }
  if(a==="done" && c.preview){ closeCard(); return; }
  if(a==="done"){
    Object.entries(c.awards).forEach(([i,v]) => S.teams[+i].score += v*c.lvl*(+i===c.x2 && v>0 ? 2 : 1));
    if(c.x2!=null && S.teams[c.x2]){ S.teams[c.x2].x2used = true; } S.x2 = null;
    Object.keys(c.two).forEach(i => { if(S.teams[i]) S.teams[i].twoUsed = true; });
    S.done[`${c.cat}-${c.lvl}`] = true;
    S.used.add(`${c.cat}-${c.lvl}-${c.idx}`); store.set("jn_used", [...S.used]);
    S.turn = ((S.turn||0) + 1) % S.teams.length;
    closeCard(); renderBoard(); renderScores();
  }
});
$("#focusImg").addEventListener("click", e => {
  const r = e.currentTarget.getBoundingClientRect(), x = 100*(e.clientX-r.left)/r.width, y = 100*(e.clientY-r.top)/r.height;
  if(focusKey){ saveFocus(focusKey, x, y); const m = $("#focusMark"); m.hidden = false; m.style.left = x+"%"; m.style.top = y+"%"; }
});
$("#focusDone").onclick = closeFocus;
$("#clue").addEventListener("input", e => {
  const inp = e.target.closest("[data-g]"); if(!inp || !S.cur) return;
  const v = parseFloat(inp.value.replace(/[, ]/g, "")); S.cur.guesses = S.cur.guesses || {};
  if(isNaN(v)) delete S.cur.guesses[+inp.dataset.g]; else S.cur.guesses[+inp.dataset.g] = v;
  if(S.cur.phone) delete S.cur.phone[+inp.dataset.g];  // 5.9: the host typing a number replaces a phone answer
});
document.addEventListener("keydown", e => { if(e.key!=="Escape") return; if(!$("#newsBox").hidden){ closeNews(); return; } if(S.cur) closeCard(); else if(!$("#winBox").hidden && !$("#winBoard").hidden) hideWinner(); });

/* 5.1: world.js now loads async, so this runs whenever it arrives (at once if it is already here). */
function initWorld(){ try{ if(window.__WORLD_JSON && !WORLD.feats){ WORLD.feats = decodeWorld(window.__WORLD_JSON);
  LV.forEach(l => { const ok = DATA.shape[l].filter(([,al]) => shapeFor(al)); if(ok.length) DATA.shape[l] = ok; }); } }catch(e){ WORLD.feats = null; } }
if(window.__WORLD_JSON) initWorld(); else window.__worldReady = initWorld;
S.cats = S.cats.filter(id => catById(id));
renderChips(); renderTeamInputs(); renderPrep(); histNote(); verLabel();
$("#titleScreen .ghost").innerHTML = Array.from({length:30},(_,i)=>`<i>${[100,200,300,400,500][Math.floor(i/6)]}</i>`).join("");
function showHome(){ setFootball(false); closeCard(); hideWinner(); showResume(); $("#titleScreen").hidden = false; $("#setup").hidden = true; $("#game").hidden = true; $("#scores").hidden = true; const t=$("#titleScreen .bigtitle"); if(t){ t.style.animation="none"; void t.offsetWidth; t.style.animation=""; } window.scrollTo(0,0); }
$("#resumeBtn").onclick = resumeGame;
$("#resumeNo").onclick = () => { clearGame(); showResume(); };
$("#toHome").onclick = () => askConfirm("Leave this game?", "Going to the title screen ends the current game.", "Go to title", () => { clearGame(); showHome(); }); $("#setupHome").onclick = showHome;
showHome();
/* full screen */
const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
function fsLabel(){ document.querySelectorAll(".fsbtn").forEach(b => b.textContent = fsEl() ? "Exit full screen" : "Full screen"); }
async function toggleFs(){
  const n = $("#fsNote");
  try{
    if(fsEl()){ await (document.exitFullscreen || document.webkitExitFullscreen).call(document); }
    else{ const r = document.documentElement, fn = r.requestFullscreen || r.webkitRequestFullscreen; if(!fn) throw 0; await fn.call(r); }
    if(n) n.hidden = true;
  }catch(e){ if(n){ n.hidden = false; n.textContent = "Full screen isn't available here. On a laptop, open the game in a browser tab and press F11 (Windows) or Ctrl+Cmd+F (Mac). On a phone, turn it sideways or add the page to your home screen."; } }
  fsLabel();
}
document.querySelectorAll(".fsbtn").forEach(b => b.onclick = toggleFs);
document.addEventListener("fullscreenchange", fsLabel); document.addEventListener("webkitfullscreenchange", fsLabel);
$("#play").onclick = () => { $("#titleScreen").hidden = true; $("#setup").hidden = false; window.scrollTo(0,0); };
})();
