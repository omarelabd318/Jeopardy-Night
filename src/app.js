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
  x2: null
};
const photos = {};  // norm(answer) -> blob url
const catById = id => CATS.find(c => c.id === id);
const PICK = CATS.filter(c => !c.mode);  // categories offered in setup (Football mode adds its own World Cup)
const pool = (cat,lvl) => DATA[cat][lvl];

/* ---------- sound: soft countdown ticks and a fading bell-like chime (C_soft_end) ---------- */
const Snd = (() => {
  let ac = null;
  const ctx = () => { if(!ac){ try{ ac = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ ac = null; } } if(ac && ac.state === "suspended") ac.resume(); return ac; };
  const tone = (freq, start, dur, vol, type="sine", attack=0.005) => { const a = ctx(); if(!a) return;
    const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + start;
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05); };
  return {
    unlock(){ if(S.sound) ctx(); },
    tick(){ if(!S.sound) return; tone(1320, 0, 0.09, 0.05, "triangle"); tone(660, 0, 0.07, 0.03, "sine"); },
    chime(){ if(!S.sound) return; const f = 784; [[1,0.11],[2.01,0.04],[3.0,0.025],[4.16,0.012]].forEach(([m,v]) => tone(f*m, 0, 2.8/Math.sqrt(m), v, "sine", 0.01)); tone(f*1.5, 0.12, 2.2, 0.035, "sine", 0.02); },
    blip(){ if(!S.sound) return; tone(988, 0, 0.12, 0.04, "sine"); tone(1480, 0.06, 0.14, 0.03, "sine"); },
    fanfare(){ if(!S.sound) return; [523, 659, 784, 1047].forEach((f,i) => { tone(f, i*0.13, 0.9, 0.06, "triangle", 0.01); tone(f*2, i*0.13, 0.6, 0.015, "sine", 0.01); }); }
  };
})();
function syncSound(){
  document.querySelectorAll(".sndbtn").forEach(b => { b.setAttribute("aria-pressed", S.sound); b.textContent = S.sound ? "Sound on" : "Sound off"; b.title = S.sound ? "Tap to mute the timer sounds" : "Tap to turn the timer sounds on"; });
  $("#optSound").setAttribute("aria-pressed", S.sound);
}
function setSound(on){ S.sound = on; store.set("jn_sound", on); syncSound(); if(on){ Snd.unlock(); Snd.blip(); } else stopSiu(); }
document.querySelectorAll(".sndbtn").forEach(b => b.addEventListener("click", () => setSound(!S.sound)));
$("#optSound").onclick = () => setSound(!S.sound);
$("#optPower").onclick = () => { S.power = !S.power; store.set("jn_power", S.power); $("#optPower").setAttribute("aria-pressed", S.power); if(!$("#scores").hidden) renderScores(); };
$("#optPower").setAttribute("aria-pressed", S.power); syncSound();
/* version label counts itself: TV Show Mix only repeats other categories' clues, so it isn't counted twice */
function verLabel(){ const n = PICK.filter(c => c.id !== "tvmix").reduce((a,c) => a + LV.reduce((b,l) => b + ((DATA[c.id]||{})[l]||[]).length, 0), 0);
  document.querySelectorAll(".verlabel").forEach(el => el.textContent = `${PICK.length} categories · ${n.toLocaleString("en-US")} clues · v4.38`); }

/* ---------- setup ---------- */
const CAT_GROUPS = [
  ["Egypt & Arab World", ["egy","egh","cairo","arab"]],
  ["Football & Sports", ["fb","egfb","pl","wc","wc26","ucl","xfer","cclub","path","whoami","fyear","form","stad","sport"]],
  ["Entertainment", ["tv","ecin","plot","ploteg","lit","got","peaky","bb","pb","gta","st","office","tvmix","friends","hp","marvel","toons","quote","quoteeg","qblank","mus","songt","song"]],
  ["Maps & World", ["geo","flag","shape","pin","lang","trans"]],
  ["Knowledge", ["gk","his","ww2","year","myth","sci","food","ffood","cal","mb","brand","cars","tg","nick","books"]],
  ["Photo Rounds", ["car","actor","footy","person","foodpic"]],
  ["Party Games", ["act","acteg","emov","emeg","emsen","emseg","pw","rid","link","near"]]
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
  const other = ["foodpic","stad"].reduce((t,id) => t + (catById(id) ? LV.reduce((u,l) => u + pool(id,l).filter(e => e[2]).length, 0) : 0), 0);
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
  const parts = [n("foodpic") ? `Guess the Food (${n("foodpic")} photos)` : "", n("stad") ? `the stadium photos in Football Stadiums (${n("stad")})` : ""].filter(Boolean);
  el.textContent = parts.length ? ` ${parts.join(" and ")} ${parts.length>1?"are":"is"} built in too, but can't be changed here.` : ""; el.hidden = !parts.length;
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
const FOOTBALL = ["cclub","path","whoami","xfer","stad","footy","egfb","fyear","form","pl","ucl","fwc"];
function setFootball(on){ if(on && !S.football) S.prevCats = S.cats; if(!on && S.football && S.prevCats){ S.cats = S.prevCats; S.prevCats = null; renderChips(); }
  S.football = on; document.body.classList.toggle("football", on); }
const footballPick = () => { const ids = FOOTBALL.slice().sort(() => Math.random() - .5).slice(0, 6); return FOOTBALL.filter(x => ids.includes(x)); };  // random 6 of the 12, in pool order
$("#football").onclick = () => {
  setFootball(true); S.cats = footballPick(); newGame();
  $("#setup").hidden = true; $("#game").hidden = false; $("#scores").hidden = false;
  renderBoard(); renderScores(); window.scrollTo(0,0);
};
function newGame(){ S.done = {}; S.turn = 0; S.x2 = null; S.ended = false; S.teams.forEach(t => { t.score = 0; t.x2used = false; t.twoUsed = false; }); }
const midgame = () => Object.keys(S.done).length > 0 || S.teams.some(t => t.score !== 0);
let confirmYes = null;
function askConfirm(title, text, yesLabel, onYes){
  if(!midgame()){ onYes(); return; }
  $("#confirmTitle").textContent = title; $("#confirmText").textContent = text; $("#confirmYes").textContent = yesLabel;
  confirmYes = onYes; $("#confirmBox").hidden = false; $("#confirmNo").focus();
}
$("#confirmNo").onclick = () => { $("#confirmBox").hidden = true; confirmYes = null; };
$("#confirmYes").onclick = () => { $("#confirmBox").hidden = true; const f = confirmYes; confirmYes = null; if(f) f(); };
$("#toSetup").onclick = () => askConfirm("Leave this game?", "Going to setup ends the current game. Scores and the board reset when you start again.", "Go to setup", goSetup);
function goSetup(){ setFootball(false); $("#setup").hidden = false; $("#game").hidden = true; $("#scores").hidden = true; renderTeamInputs(); histNote(); }
$("#editScores").onclick = e => { S.editing = !S.editing; e.currentTarget.setAttribute("aria-pressed", S.editing); e.currentTarget.textContent = S.editing ? "Done editing" : "Edit scores"; renderScores(); };
$("#newBoard").onclick = () => askConfirm("Start a new board?", "Every tile comes back with new clues. Scores stay as they are.", "New board", () => { S.done = {}; S.ended = false; renderBoard(); });

/* ---------- board ---------- */
function renderBoard(){
  const b = $("#board"); prefetchPacks();
  b.style.gridTemplateColumns = `repeat(${S.cats.length}, minmax(var(--colmin,118px), 1fr))`;
  b.classList.toggle("many", S.cats.length >= 8);
  b.style.setProperty("--hvw", `${(12/Math.max(8,S.cats.length)).toFixed(2)}vw`);
  let html = S.cats.map(id => `<div class="head">${esc(catById(id).name)}</div>`).join("");
  LV.forEach(l => S.cats.forEach(id => {
    const d = S.done[`${id}-${l}`];
    html += `<button class="tile${d?" done":""}" data-cat="${id}" data-l="${l}" ${d?'disabled aria-label="Played"':`aria-label="${esc(catById(id).name)} for ${l}"`}>${l}</button>`;
  }));
  b.innerHTML = html;
  const left = S.cats.length*5 - Object.keys(S.done).length;
  if(!left && !S.ended) setTimeout(showWinner, 350);
}
$("#board").addEventListener("click", e => {
  const t = e.target.closest(".tile:not(.done)"); if(!t) return;
  openClue(t.dataset.cat, +t.dataset.l);
});
function showWinner(){
  closeCard(); S.ended = true;
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
  confetti(); if(S.football && S.sound) playSiu(); else Snd.fanfare();
}
/* Football mode winner sound: the last 9 seconds of Ronaldo's "Siuuu" clip, in place of the fanfare */
let siuA = null;
function playSiu(){ try{ if(!siuA) siuA = new Audio("sounds/siuuu.mp3"); siuA.currentTime = 0; const pr = siuA.play(); if(pr) pr.catch(() => Snd.fanfare()); }catch(e){ Snd.fanfare(); } }
function stopSiu(){ if(siuA){ siuA.pause(); siuA.currentTime = 0; } }
function hideWinner(){ $("#winBox").hidden = true; stopConfetti(); stopSiu(); }
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

function renderScores(){
  const max = Math.max(...S.teams.map(t=>t.score));
  $("#scores").innerHTML = S.teams.map((t,i) =>
    `<div class="team${t.score===max&&max>0?" lead":""}${i===(S.turn||0)?" turn":""}" data-team="${i}" role="button" tabindex="0" aria-label="${esc(t.name)}${i===(S.turn||0)?", picking now":""}. Tap to give them the pick"><div class="nm">${i===(S.turn||0)?'<span class="pick">Picking</span>':""}${esc(t.name)}</div><div class="sc${t.score<0?" neg":""}">${t.score}</div>
     ${S.power ? `<div class="pw"><button class="pwb${S.x2===i?" ready":""}${t.x2used?" used":""}" data-x2="${i}" ${t.x2used || (i!==(S.turn||0) && S.x2!==i) ? "disabled" : ""} aria-label="${esc(t.name)}: double points${t.x2used?" (used)":S.x2===i?" (ready, tap to cancel)":""}" title="${t.x2used ? "Used" : "Tap on your turn, before picking a tile"}">${S.x2===i ? `×2 <span class="lg">ready</span><span class="sm">✓</span>` : "×2"}</button><span class="pwb${t.twoUsed?" used":""}" aria-label="${esc(t.name)}: 2 answers${t.twoUsed?" (used)":" (use it on an open clue)"}" title="${t.twoUsed ? "Used" : "Use it on an open clue"}"><span class="lg">2 answers</span><span class="sm">2 ans</span></span></div>` : ""}
     ${S.editing ? `<div class="adj"><button data-i="${i}" data-d="-100" aria-label="Take 100 from ${esc(t.name)}">−100</button><button data-i="${i}" data-d="100" aria-label="Give 100 to ${esc(t.name)}">+100</button></div>` : ""}</div>`).join("");
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
  const idx = preview ? forceIdx : pickIdx(cat,lvl,exclude);
  const type = catById(cat).type;
  const zoomStart = {100:3.5,200:4.2,300:4.8,400:5.4,500:6}[lvl];
  S.cur = {cat,lvl,idx,type,revealed:false,awards:{},zoom:zoomStart,ox:45+Math.random()*10,oy:(cat==="actor"||cat==="person"?28:48)+Math.random()*10,shown:false,
           secs: type==="act"?60:type==="impostor"?120:45, left: type==="act"?60:type==="impostor"?120:45, running:false, stage:"count", player:1, show:false, imp:0, qrText:null, preview, x2: preview ? null : S.x2, two:{}};
  stopTimer();
  try{ renderClue(); }catch(err){ $("#clue").innerHTML = `<div class="eyebrow">${esc(catById(cat).name)} · ${lvl}</div><p class="note">This clue couldn't be shown (${esc(err && err.message || err)}). Tell Claude this message. Tap Back to board.</p><div class="row"><button class="btn small" data-act="cancel">Back to board</button></div>`; }
  $("#card").hidden = false;
  $("#clue").focus?.();
}
function clueParts(){
  const {cat,lvl,idx,type} = S.cur;
  if(type==="text"){ const [q,a,img] = pool(cat,lvl)[idx]; return {q, a, img}; }
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
  const [, pack, key] = ref.split(":"), got = () => (window.__fp || {})[key];
  if(got()) return got();
  loadPack(pack).then(() => { const im = $("#clue .zoom img"); if(im && S.cur === cur && got()) im.src = got(); });
  return BLANK;
}
function prefetchPacks(){ for(const id of S.cats || []) for(const v of [100,200,300,400,500]) for(const e of (DATA[id] && DATA[id][v]) || []) if(typeof e[2] === "string" && e[2].startsWith("pack:")) loadPack(e[2].split(":")[1]); }
function renderClue(){
  const c = S.cur, p = clueParts(), cat = catById(c.cat);
  let media = "";
  if(p.flag) media = `<div class="flagbox">${flagSVG(p.flag)}</div>`;
  if(p.pin){ let svg = ""; try{ svg = pinSVG(p.pin[0], p.pin[1]); }catch(e){ svg = ""; } media = svg ? `<div class="pinbox">${svg}</div>` : `<div class="note">The world map didn't load, so this map can't be drawn. Close the tile and pick another, or reload.</div>`; }
  if(p.shape){ let svg = ""; try{ svg = shapeSVG(p.shape); }catch(e){ svg = ""; } media = svg ? `<div class="shapebox">${svg}</div>` : `<div class="note">The world map didn't load, so this outline can't be drawn. Close the tile and pick another, or check your connection and reload.</div>`; }
  if(p.img) media = `<div class="zoom"><img src="${esc(packSrc(p.img, c))}" alt="Photo clue" style="object-fit:contain"></div>`;
  if(p.emoji) media = `<div class="emoji" role="img" aria-label="Emoji clue">${esc(p.emoji)}</div>`;
  if(c.type==="photo"){
    const url = photos[norm(p.a)];
    media = `<div class="zoom">${url
      ? (() => { const f = focus[norm(p.a)] || {x:c.ox, y:c.oy}; const full = c.revealed || c.zoom <= 1.01;
          return `<img src="${url}" alt="Zoomed photo to identify" style="object-fit:${full?"contain":"cover"};object-position:${full ? "50% 50%" : f.x+"% "+f.y+"%"};transform-origin:${f.x}% ${f.y}%;transform:scale(${full?1:c.zoom})">`; })()
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
      return `<label class="guess${c.revealed && c.winners && c.winners.includes(i) ? " win" : ""}"><span>${esc(t.name)}</span>
        <input id="guess${i}" data-g="${i}" inputmode="decimal" autocomplete="off" placeholder="Guess${p.unit ? " ("+esc(p.unit)+")" : ""}" value="${g!=null ? g : ""}" ${c.revealed ? "disabled" : ""}>
        ${d!=null ? `<em>${d===0 ? "Exact!" : "off by " + d.toLocaleString("en-US")}</em>` : ""}</label>`; }).join("")}</div>
      ${!c.revealed ? `<div class="note">Each team agrees on one number and types it in. Closest wins; a tie means both score.</div>` : ""}`;
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
    <div class="timer${c.left<=0?" out":""}"><button class="btn small" data-act="timer">${c.running?"Pause":c.left<c.secs?"Resume":"Start "+c.secs+"s"}</button><div class="bar"><i style="width:${pct}%"></i></div><div class="t">${c.left<=0 ? "Time's up" : Math.max(0,Math.ceil(c.left))}</div></div>
    ${c.revealed ? `<div class="answer${c.fresh ? " fresh" : ""}">${c.type==="impostor" ? `Impostor: Player ${c.imp} · Word: ${esc(p.a)} <span class="note">(category: ${esc(p.icat)})</span>` : esc(p.a)}</div>` : ""}
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
function closeCard(){ stopTimer(); $("#card").hidden = true; S.cur = null; }

$("#clue").addEventListener("click", e => {
  const c = S.cur; if(!c) return;
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
  if(a==="reveal"){ c.revealed = true; c.fresh = true; stopTimer(); c.running = false; renderClue(); c.fresh = false; }
  if(a==="setspot"){ openFocus(norm(clueParts().a), "Host only: tap the face or the part to zoom in on"); return; }
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
});
document.addEventListener("keydown", e => { if(e.key!=="Escape") return; if(S.cur) closeCard(); else if(!$("#winBox").hidden && !$("#winBoard").hidden) hideWinner(); });

try{ if(window.__WORLD_JSON){ WORLD.feats = decodeWorld(window.__WORLD_JSON);
  LV.forEach(l => { const ok = DATA.shape[l].filter(([,al]) => shapeFor(al)); if(ok.length) DATA.shape[l] = ok; }); } }catch(e){ WORLD.feats = null; }
S.cats = S.cats.filter(id => catById(id));
renderChips(); renderTeamInputs(); renderPrep(); histNote(); verLabel();
$("#titleScreen .ghost").innerHTML = Array.from({length:30},(_,i)=>`<i>${[100,200,300,400,500][Math.floor(i/6)]}</i>`).join("");
function showHome(){ setFootball(false); closeCard(); hideWinner(); $("#titleScreen").hidden = false; $("#setup").hidden = true; $("#game").hidden = true; $("#scores").hidden = true; const t=$("#titleScreen .bigtitle"); if(t){ t.style.animation="none"; void t.offsetWidth; t.style.animation=""; } window.scrollTo(0,0); }
$("#toHome").onclick = () => askConfirm("Leave this game?", "Going to the title screen ends the current game.", "Go to title", showHome); $("#setupHome").onclick = showHome;
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
