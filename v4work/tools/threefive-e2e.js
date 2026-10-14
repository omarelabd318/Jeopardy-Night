// 6.80 (adapted from threefive-e2e.js [players] [shotsDir]): plays a whole 3-5-8 game in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and four phone pages that click their buttons.
//   NODE_PATH=$(npm root -g) node v4work/tools/threefive-e2e.js [players] [shotsDir] [shotsDir]
// It needs a built index.html (node build.js). Screenshots of the TV and one phone go to shotsDir (default: ./_tf-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[3] || "_tf-shots"); fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, acts:[], room:null, kicks:0};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n").slice(0,6).join(" | "), (e.stack||"").split("\n").slice(1,3).join(" ")); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [];
  const fast = () => { const si = window.setInterval, st = window.setTimeout; window.setInterval = (f, t, ...a) => si(f, t > 500 ? t / 5 : t, ...a); window.setTimeout = (f, t, ...a) => st(f, t > 1000 ? t / 5 : t, ...a); };   // the real waits are seconds long; a test doesn't need them
  const b = await chromium.launch(), tvc = await b.newContext({viewport:{width:1920, height:1080}}), tv = await tvc.newPage();
  tv.on("pageerror", e => errs.push("TV " + e.message)); tv.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push("TV " + m.text()); });
  await tv.addInitScript(fast); await tv.addInitScript(() => { try{ localStorage.setItem("jn_tfCfg", JSON.stringify({len:1,targets:"853",nt:true,swapMax:0})); }catch(e){} });   // a short game: one turn of the targets (3 or 4 hands)
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());   // no outside network: the fonts and the QR script just don't load
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(500); await tv.click("#modeTf"); await tv.click("#modeGo"); await tv.waitForTimeout(1200);
  await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const phones = [];
  for(const n of ["Mona", "Karim", "Youssef", "Nour"].slice(0, +process.argv[2] || 3)){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage();
    p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); });
    await p.addInitScript(fast); await p.route(/^(?!http:\/\/localhost)/, r => r.abort());
    await p.goto(`${base}/cards.html?r=${R.room}&g=tf`); await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(300); phones.push(p); }
  await tv.waitForTimeout(1500); await tv.screenshot({path:path.join(shots, "tv-lobby.png")});
  await phones[0].screenshot({path:path.join(shots, "phone-waiting.png")});
  await tv.click("#tfGo"); await tv.waitForTimeout(1500);
  let moves = 0, gives = 0, buries = 0, shotAt = new Set(), done = false;
  for(let tick = 0; tick < 6000 && !done; tick++){
    if(await tv.locator(".tfpod").count()){ done = true; break; }
    if(await tv.locator('[data-act="next"]').count()){ if(!shotAt.has("scored")){ shotAt.add("scored"); await tv.screenshot({path:path.join(shots, "tv-scored.png")}); } await tv.click('[data-act="next"]'); await tv.waitForTimeout(300); continue; }
    let acted = false;
    for(const p of phones){
      const k = await p.evaluate(() => st && st.me && st.me.act ? st.me.act.k : null); if(!k) continue;
      const shot = async name => { if(!shotAt.has(name)){ shotAt.add(name); await p.screenshot({path:path.join(shots, "phone-" + name + ".png")}); await tv.screenshot({path:path.join(shots, "tv-" + name + ".png")}); } };
      try{
        if(k === "trump"){ await shot("trump"); const l = p.locator('[data-tf="trump"]'); await l.nth(Math.floor(Math.random() * await l.count())).click(); }
        else if(k === "give" || k === "bury"){ await shot(k); const need = await p.evaluate(() => st.me.act.n), cards = p.locator("#hand .ck[data-c]");
          for(let i = 0; i < need; i++) await cards.nth(i * 3).click({position:{x:8, y:30}}); await shot(k + "-picked"); await p.click(`[data-tf="${k}"]`); k === "give" ? gives++ : buries++; }
        else { const l = p.locator("#hand .ck[data-c]:not(.off)"), c = l.nth(Math.floor(Math.random() * await l.count())); await c.click({position:{x:8, y:30}}); await shot("play"); await p.locator(".ck.up").click({position:{x:8, y:30}}); moves++; if(!shotAt.has("trick") && await tv.locator(".cktrick .ck").count() >= 2){ shotAt.add("trick"); await tv.screenshot({path:path.join(shots, "tv-trick.png")}); } }
      }catch(e){ await p.screenshot({path:path.join(shots, "stuck.png")}); console.log("STUCK on", k, e.message.split("\n")[0], await p.evaluate(() => JSON.stringify({act:st.me.act, pick, html:document.getElementById("view").innerText.slice(0, 300)}))); process.exit(1); }
      acted = true; await p.waitForTimeout(80); break; }
    if(!acted) await tv.waitForTimeout(150);
    if(tick === 80 && !shotAt.has("mid")){ shotAt.add("mid"); await tv.screenshot({path:path.join(shots, "tv-mid.png")}); await phones[1].screenshot({path:path.join(shots, "phone-mid.png")}); } }
  await tv.waitForTimeout(800); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")});
  console.log(done ? "game finished" : "GAME DID NOT FINISH", "| cards played by phones:", moves, "gives:", gives, "buries:", buries, "| errors:", errs.length); errs.slice(0, 8).forEach(e => console.log(" ", e));
  await b.close(); srv.close(); process.exit(done && !errs.length ? 0 : 1);
})();
