// 7.4: plays a whole Taboo game in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages (taboo.html) that join, pick teams, describe, skip and buzz.
//   NODE_PATH=$(npm root -g) node v4work/tools/taboo-e2e.js [shotsDir] [players=5]
// It needs a built index.html (node build.js). Checks: the card only ever reaches the describer and the opposing phones (never a teammate), a buzz ends the card and costs the team, the host's End turn and Undo work,
// a game reaches the winner screen, play again returns to the lobby. Screenshots go to shotsDir (default ./_tb-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_tb-shots"), N = +process.argv[3] || 5; fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, crdat:0, acts:[], room:null, leaks:0, posts:0};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, t:v.t, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, t:b.t, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; R.crdat = Date.now(); R.posts++; const pub = b.crd.pub;
        if(pub.ph === "run"){ const tm = pub.tm; for(const p of Object.keys(b.crd.priv)) if(tm[p] === pub.team && p !== pub.desc) R.leaks++; if(!b.crd.priv[pub.desc]) R.leaks++; }
        else if(Object.keys(b.crd.priv).length) R.leaks++;
        if(JSON.stringify(pub).includes('"ban"')) R.leaks++;
        return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null, ago:Date.now() - R.crdat}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : f.endsWith(".mp3") ? "audio/mpeg" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/taboo-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [], fails = [];
  const b = await chromium.launch(), tv = await (await b.newContext({viewport:{width:1920, height:1080}})).newPage();
  const watch = (p, n) => { p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); }); };
  watch(tv, "TV"); await tv.addInitScript(() => { try{ localStorage.setItem("jn_tbCfg", JSON.stringify({tpr:1, secs:45, lsecs:20, skips:2})); }catch(e){} });
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(600); await tv.click("#modeTb"); await tv.waitForTimeout(400); await tv.screenshot({path:path.join(shots, "tv-title.png")});
  await tv.click("#modeGo"); await tv.waitForTimeout(1200); await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const names = ["Omar", "Nour", "Karim", "Salma", "Youssef", "Mariam", "Hana", "Tarek"].slice(0, N), phones = [];
  for(const n of names){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage(); watch(p, n);
    await p.route(/^(?!http:\/\/localhost)/, r => r.abort()); await p.goto(`${base}/taboo.html?r=${R.room}`);
    if(!phones.length) await p.screenshot({path:path.join(shots, "phone-join.png")});
    await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(250); p.nm = n; phones.push(p); }
  await tv.waitForTimeout(1800); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  // one phone switches team on its own screen, then back: the laptop follows
  const id0 = Object.keys(R.players).find(k => R.players[k].n === phones[0].nm), t0 = R.crd.pub.tm[id0]; await phones[0].click(`.pick[data-t="${1 - t0}"]`); await tv.waitForTimeout(1800);
  if(R.crd.pub.tm[id0] !== 1 - t0) fails.push("team switch from the phone not applied");
  await phones[0].click(`.pick[data-t="${t0}"]`); await tv.waitForTimeout(1800);
  await tv.click("#tbShuffle"); await tv.waitForTimeout(600);
  const sizes = R.crd.pub.teams.map(t => t.m.length); if(sizes[0] < 2 || sizes[1] < 2) fails.push("teams too small after shuffle " + sizes);
  await tv.click("#tbGo"); await tv.waitForTimeout(1200);
  const byP = {}; const pOf = n => Object.keys(R.players).find(k => R.players[k].n === n), phone = p => phones.find(x => pOf(x.nm) === p);
  const seen = new Set(); let turns = 0, over = false;
  for(let tick = 0; tick < 1200 && !over; tick++){
    if(await tv.locator('[data-act="again"]').count()){ over = true; break; }
    const pub = R.crd && R.crd.pub; if(!pub){ await tv.waitForTimeout(150); continue; }
    if(pub.ph === "recap"){ if(!seen.has("recap" + turns)){ seen.add("recap" + turns); if(turns === 1){ await tv.screenshot({path:path.join(shots, "tv-recap.png")}); await phone(pub.desc).screenshot({path:path.join(shots, "phone-recap.png")});
        if(await tv.locator("[data-undo]").count()){ const n0 = R.crd.pub.scores.join(); await tv.locator("[data-undo]").first().click(); await tv.waitForTimeout(300); const n1 = R.crd.pub.scores.join(); if(n0 === n1) fails.push("undo changed nothing"); } } }
      await tv.locator('[data-act="next"]').click(); await tv.waitForTimeout(300); continue; }
    if(pub.ph === "ready"){ const d = phone(pub.desc); await d.waitForSelector('[data-a="start"]', {timeout:5000}).catch(() => fails.push("no Start for the describer"));
      if(!seen.has("ready")){ seen.add("ready"); await tv.screenshot({path:path.join(shots, "tv-ready.png")}); await d.screenshot({path:path.join(shots, "phone-ready.png")}); }
      await d.click('[data-a="start"]'); await tv.waitForTimeout(500); continue; }
    if(pub.ph !== "run"){ await tv.waitForTimeout(200); continue; }
    turns++; const d = phone(pub.desc), mates = phones.filter(p => pOf(p.nm) !== pub.desc && pub.tm[pOf(p.nm)] === pub.team), opps = phones.filter(p => pub.tm[pOf(p.nm)] !== pub.team);
    await d.waitForSelector('.word', {timeout:5000}).catch(() => fails.push("describer has no card"));
    for(const m of mates){ if(await m.locator('.word').count() || await m.locator('.ban').count()) fails.push("a teammate can see the card"); }
    for(const o of opps){ await o.waitForSelector('.bz button', {timeout:5000}).catch(() => fails.push("an opponent has no buzzers")); }
    if(!seen.has("run")){ seen.add("run"); await tv.screenshot({path:path.join(shots, "tv-run.png")}); await d.screenshot({path:path.join(shots, "phone-describer.png")}); if(opps[0]) await opps[0].screenshot({path:path.join(shots, "phone-buzzer.png")}); if(mates[0]) await mates[0].screenshot({path:path.join(shots, "phone-guesser.png")}); }
    const before = R.crd.pub.scores.slice();
    await d.click('[data-a="got"]'); await tv.waitForTimeout(1300);
    const after = R.crd.pub.scores.slice(); if(after[pub.team] !== before[pub.team] + pub.val) fails.push(`Got it did not score ${pub.val}: ${before} -> ${after}`);
    const w = await d.locator(".word").innerText();
    await d.click('[data-a="skip"]'); let moved = false; for(let k = 0; k < 20 && !moved; k++){ await tv.waitForTimeout(200); moved = (await d.locator(".word").innerText()) !== w; }
    if(!moved) fails.push("skip did not draw a new card");
    if(opps[0]){ await tv.waitForTimeout(1200); const s0 = R.crd.pub.scores.slice(); await opps[0].click('.bz button >> nth=1'); await tv.waitForTimeout(1300);
      const s1 = R.crd.pub.scores.slice(); if(s1[pub.team] !== s0[pub.team] - pub.val / 2) fails.push(`buzz did not cost ${pub.val / 2}: ${s0} -> ${s1}`);
      if(!seen.has("buzz")){ seen.add("buzz"); await tv.screenshot({path:path.join(shots, "tv-buzz.png")}); } }
    if(R.crd.pub.skipsLeft === 1){ await d.click('[data-a="skip"]'); await tv.waitForTimeout(1200); }
    if(!await d.locator('[data-a="skip"]:disabled').count()) fails.push("Skip not greyed out after the cap");
    await tv.click('[data-act="end"]'); await tv.waitForTimeout(500); }
  if(!over) fails.push("the game never reached the winner screen");
  else { await tv.waitForTimeout(500); await tv.screenshot({path:path.join(shots, "tv-over.png")}); await phones[0].screenshot({path:path.join(shots, "phone-over.png")}); await tv.click('[data-act="again"]'); await tv.waitForTimeout(800);
    if(!await tv.locator("#tbGo").count()) fails.push("Play again did not return to the lobby"); }
  if(R.leaks) fails.push("the relay saw " + R.leaks + " card leak(s)");
  console.log("turns played:", turns, "· posts:", R.posts); if(errs.length) console.log("PAGE ERRORS:\n" + [...new Set(errs)].join("\n")); if(fails.length) console.log("FAILS:\n" + [...new Set(fails)].join("\n")); else console.log("all checks passed");
  await b.close(); srv.close(); process.exit(fails.length || errs.length ? 1 : 0); })();
