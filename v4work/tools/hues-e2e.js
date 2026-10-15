// 7.44: plays Hues and Cues games in a headless browser against a small in-memory copy of the relay (worker/index.js): one TV page and N phone pages (hues.html) that join, give clues, place markers, flag a clue and reach the winner.
//   NODE_PATH=$(npm root -g) node v4work/tools/hues-e2e.js [shotsDir] [players=4]
// It needs a built index.html (node build.js). Checks: the secret shade is never in the posted table before the reveal and only the clue giver has a private part, banned and two-word clues can't be sent, a clue
// flagged by more than half is struck and the giver is told, the host can skip a turn, scores match an independent calculation, a winner screen appears and Play again returns to the lobby. Screenshots go to shotsDir (default ./_hc-shots).
const http = require("http"), fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_hc-shots"), N = +process.argv[3] || 5; fs.mkdirSync(shots, {recursive:true});
const R = {players:{}, crd:null, crdat:0, acts:[], room:null, leaks:0, posts:0, maxPub:0, maxAct:0};
const send = (res, o, code = 200) => { res.writeHead(code, {"content-type":"application/json"}); res.end(JSON.stringify(o)); };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x"); let body = ""; req.on("data", d => body += d);
  req.on("end", () => {
    if(u.pathname.startsWith("/api/")){ const op = u.pathname.slice(5), b = body ? JSON.parse(body) : {}, q = u.searchParams;
      if(op === "ping") return send(res, {ok:true});
      if(op === "players"){ R.room = q.get("r"); return send(res, {players:Object.entries(R.players).map(([p, v]) => ({p, n:v.n, t:v.t, at:v.at})).sort((a, b) => a.at - b.at)}); }
      if(op === "join"){ R.players[b.p] = {n:b.n, t:b.t, at:R.players[b.p] ? R.players[b.p].at : Date.now()}; return send(res, {ok:true}); }
      if(op === "kick"){ delete R.players[b.p]; return send(res, {ok:true}); }
      if(op === "crd"){ R.crd = b.crd; R.crdat = Date.now(); R.posts++; const pub = b.crd.pub, s = JSON.stringify(pub); R.maxPub = Math.max(R.maxPub, s.length);
        if(pub.ph !== "reveal" && pub.ph !== "over" && (s.includes('"tgt"') || s.includes('"card"'))) R.leaks++;   // the secret shade must not be in the public table before the reveal
        const keys = Object.keys(b.crd.priv); if(keys.length > 1 || (keys.length === 1 && keys[0] !== pub.giver)) R.leaks++;   // only the clue giver has a private part
        return send(res, {ok:true}); }
      if(op === "crdstate"){ const me = R.players[q.get("p")]; if(!me) return send(res, {name:null}); if(!R.crd) return send(res, {name:me.n, pub:null, me:null}); return send(res, {name:me.n, pub:R.crd.pub, me:R.crd.priv[q.get("p")] || null, ago:Date.now() - R.crdat}); }
      if(op === "crdact"){ if(!R.players[b.p]) return send(res, {ok:false, error:"unknown"}, 409); if(!R.crd || R.crd.pub.v !== b.v) return send(res, {ok:false, error:"stale"}, 409);
        const sz = JSON.stringify(b.a).length; R.maxAct = Math.max(R.maxAct, sz); if(sz > (200)) return send(res, {ok:false, error:"bad move"}, 400); R.acts.push({p:b.p, v:b.v, a:b.a}); return send(res, {ok:true}); }
      if(op === "crdacts"){ const s = +q.get("since") || 0, e = Math.min(R.acts.length, s + 100); return send(res, {n:e, acts:R.acts.slice(s, e)}); }
      return send(res, {ok:false}, 404); }
    const f = u.pathname === "/" ? "index.html" : u.pathname.slice(1), file = path.join(root, f);
    if(!file.startsWith(root) || !fs.existsSync(file)){ res.writeHead(404); return res.end(); }
    res.writeHead(200, {"content-type":f.endsWith(".js") ? "text/javascript" : f.endsWith(".mp3") ? "audio/mpeg" : "text/html"}); res.end(fs.readFileSync(file)); }); });
process.on("unhandledRejection", e => { console.log("ERR", e.message.split("\n")[0], (e.stack.match(/hues-e2e.js:\d+/) || [])[0]); process.exit(1); });
(async () => {
  await new Promise(r => srv.listen(0, r)); const base = "http://localhost:" + srv.address().port, errs = [], fails = [];
  const b = await chromium.launch(), tv = await (await b.newContext({viewport:{width:+process.env.TVW || 1920, height:+process.env.TVH || 1080}})).newPage();
  const watch = (p, n) => { p.on("pageerror", e => errs.push(n + " " + e.message)); p.on("console", m => { if(m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + " " + m.text()); }); };
  watch(tv, "TV"); await tv.addInitScript(() => { try{ localStorage.setItem("jn_hcCfg", JSON.stringify({turns:1, t1:60, t2:45, tg:30})); }catch(e){} });
  await tv.route(/^(?!http:\/\/localhost)/, r => r.abort());
  await tv.goto(base + "/index.html"); await tv.waitForTimeout(600); await tv.click("#modeHc"); await tv.waitForTimeout(400); await tv.screenshot({path:path.join(shots, "tv-title.png")});
  await tv.click("#modeGo"); await tv.waitForTimeout(1200); await tv.screenshot({path:path.join(shots, "tv-lobby-empty.png")});
  const names = ["Omar", "Nour", "Karim", "Salma", "Youssef", "Mariam", "Hana", "Tarek"].slice(0, N), phones = [];
  for(const n of names){
    const c = await b.newContext({viewport:{width:390, height:800}, isMobile:true, hasTouch:true}), p = await c.newPage(); watch(p, n);
    await p.route(/^(?!http:\/\/localhost)/, r => r.abort()); await p.goto(`${base}/hues.html?r=${R.room}`);
    if(!phones.length) await p.screenshot({path:path.join(shots, "phone-join.png")});
    await p.fill("#nm", n); await p.click("#jb"); await p.waitForTimeout(250); p.nm = n; phones.push(p); }
  await tv.waitForTimeout(1800); await tv.screenshot({path:path.join(shots, "tv-lobby.png")}); await phones[0].screenshot({path:path.join(shots, "phone-lobby.png")});
  await tv.click("#hcGo"); await tv.waitForTimeout(1200);
  const pOf = n => Object.keys(R.players).find(k => R.players[k].n === n), phone = p => phones.find(x => pOf(x.nm) === p), nmOf = p => R.players[p].n;
  const snap = async (name, ph) => { await tv.screenshot({path:path.join(shots, "tv-" + name + ".png")}); if(ph) await ph.screenshot({path:path.join(shots, "phone-" + name + ".png")}); };
  const waitFor = async (f, what, ms = 8000) => { for(let k = 0; k < ms / 100; k++){ if(f()) return true; await tv.waitForTimeout(100); } fails.push("timed out: " + what); return false; };
  const phaseIs = ph => () => R.crd && R.crd.pub.ph === ph;
  const clickCell = async (p, c, r) => { for(let k = 0; k < 4; k++){ await p.waitForSelector("#mini", {timeout:5000}); let box = null, prev = ""; for(let q = 0; q < 20; q++){ box = await p.locator("#mini").boundingBox(); const key = box ? [box.x, box.y, box.width, box.height].join() : ""; if(key && key === prev) break; prev = key; await p.waitForTimeout(120); } if(!box) continue; await p.mouse.click(box.x + (c + .5) / 30 * box.width, box.y + (r + .5) / 22 * box.height); await p.waitForTimeout(100); const t = await p.locator("#selline").textContent().catch(() => ""); if(t.includes("Your pick: " + "ABCDEFGHIJKLMNOPQRSTUV"[r] + (c + 1))) return; } };
  const guess = async (p, c, r, viaMag) => { await p.waitForSelector("#lock", {timeout:5000}).catch(() => fails.push(p.nm + ": no Lock in button")); const cc = Math.max(0, Math.min(29, c)), rr = Math.max(0, Math.min(21, r));
    if(viaMag){ await clickCell(p, Math.max(0, Math.min(29, cc + 2)), rr); const box = await p.locator("#mag").boundingBox(), c0 = Math.max(0, Math.min(23, cc + 2 - 3)), r0 = Math.max(0, Math.min(19, rr - 1));
      if(cc - c0 < 0 || cc - c0 > 6){ await clickCell(p, cc, rr); } else await p.mouse.click(box.x + (cc - c0 + .5) / 7 * box.width, box.y + (rr - r0 + .5) / 3 * box.height); }
    else await clickCell(p, cc, rr);
    const line = await p.locator("#selline").innerText(); if(!line.includes("Your pick: " + "ABCDEFGHIJKLMNOPQRSTUV"[rr] + (cc + 1))) fails.push(`${p.nm}: wrong pick line "${line}" for ${cc},${rr}`);
    await p.click("#lock"); await p.waitForTimeout(150); };
  const expect = pub => { const d = {}, ids = Object.keys(pub.names); ids.forEach(p => d[p] = 0); let inside = 0; [pub.m1, pub.m2].forEach(m => Object.keys(m || {}).forEach(p => { const k = Math.max(Math.abs(m[p][0] - pub.tgt[0]), Math.abs(m[p][1] - pub.tgt[1])); d[p] += k === 0 ? 300 : k === 1 ? 200 : k === 2 ? 100 : 0; if(k <= 1) inside++; })); d[pub.giver] = Math.min(900, inside * 100); return d; };
  const tvLit = async () => tv.evaluate(() => { const c = document.getElementById("hcCv"); if(!c) return -1; const x = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 3; i < x.length; i += 4) if(x[i]) n++; return n; });
  const send1 = async (gv, word, shots1) => { const gp = phone(gv); await gp.waitForSelector("#cl", {timeout:5000}); await gp.fill("#cl", word); await gp.waitForTimeout(100); return gp; };
  const turns = [];
  for(let t = 0; t < N && !R.over; t++){
    await waitFor(() => R.crd && R.crd.pub.ph === "pick" && R.crd.pub.turn === t + 1, "turn " + (t + 1) + " pick"); const pub0 = R.crd.pub, gv = pub0.giver, gp = phone(gv), others = phones.filter(x => x !== gp), tgt = R.crd.priv[gv].tgt, card = R.crd.priv[gv].card;
    if(!card || card.length !== 4) fails.push("the giver has no 4-shade card"); if(tgt) fails.push("target set before the pick");
    if(t === 0){ await snap("pick", gp); await others[0].screenshot({path:path.join(shots, "phone-waiting.png")}); }
    if(t === 2){ await tv.click('[data-act="skip"]'); await waitFor(phaseIs("reveal"), "host skip"); if(R.crd.pub.kind !== "skip") fails.push("skip didn't skip"); await snap("skipped", gp); await tv.click('[data-act="next"]'); continue; }
    // a banned clue can't be sent
    await gp.locator(".sw button").nth(1).click(); await gp.fill("#cl", "Blue"); await gp.waitForTimeout(150); if(!(await gp.locator("#send").isDisabled())) fails.push("Send is enabled for a colour name");
    if(t === 0) await gp.screenshot({path:path.join(shots, "phone-banned.png")});
    await gp.fill("#cl", "two words"); await gp.waitForTimeout(100); if(!(await gp.locator("#send").isDisabled())) fails.push("Send is enabled for two words in clue 1");
    await gp.fill("#cl", "Pool"); await gp.waitForTimeout(100); if(t === 0) await gp.screenshot({path:path.join(shots, "phone-pick-ready.png")}); await gp.click("#send"); await waitFor(phaseIs("g1"), "g1");
    const T = R.crd.priv[gv].tgt; if(!T || T.join() !== card[1].join()) fails.push("the target isn't the shade the giver tapped"); if(R.crd.pub.c1 !== "Pool") fails.push("clue 1 not shown: " + R.crd.pub.c1);
    if(t === 1){   // more than half of the guessers flag the clue: it is struck and the giver sends a new one
      const need = Math.floor(others.length / 2) + 1; await others[0].waitForSelector("#flag"); for(let i = 0; i < need; i++) await others[i].click("#flag"); await waitFor(phaseIs("pick"), "struck back to pick"); if(R.crd.pub.c1) fails.push("struck clue still shown");
      await gp.waitForSelector("#cl", {timeout:5000}); const msg = await gp.locator(".msg.bad").innerText().catch(() => ""); if(!/flagged/i.test(msg)) fails.push("the giver isn't told the clue was flagged: " + msg); await snap("struck", gp);
      await gp.fill("#cl", "Lagoon"); await gp.click("#send"); await waitFor(phaseIs("g1"), "g1 again"); }
    await tv.waitForTimeout(500); if(t === 0){ await snap("guess1", others[0]); if(await others[0].locator("#flag").count() !== 1) fails.push("no Flag button during the window"); }
    const pos = [[0, 0, false], [1, 0, false], [2, 0, false], [9, 3, false]];
    for(let i = 0; i < others.length; i++){ if(t === 0 && i === 0){ await guess(others[0], T[0] + pos[0][0], T[1] + pos[0][1], true); await snap("locked", others[0]); } else await guess(others[i], T[0] + pos[i % 4][0] * (T[0] > 20 ? -1 : 1), T[1] + pos[i % 4][1] * (T[1] > 8 ? -1 : 1), false); }
    await waitFor(phaseIs("pick2"), "pick2"); if(!R.crd.pub.m1) fails.push("first markers not shown after round 1"); if(Object.keys(R.crd.pub.m1).length !== others.length) fails.push("not every first marker is shown");
    await tv.waitForTimeout(500); if(t === 0){ await snap("pick2", gp); if((await tvLit()) < 1000) fails.push("the TV board is empty"); }
    await gp.waitForSelector("#cl", {timeout:5000}); await gp.fill("#cl", "red sea"); await gp.waitForTimeout(100); if(!(await gp.locator("#send").isDisabled())) fails.push("Send is enabled for a colour name in clue 2");
    await gp.fill("#cl", "sea breeze"); await gp.click("#send"); await waitFor(phaseIs("g2"), "g2"); if(R.crd.pub.c2 !== "sea breeze") fails.push("clue 2 not shown");
    await tv.waitForTimeout(400); if(t === 0) await snap("guess2", others[1]);
    for(let i = 0; i < others.length; i++) await guess(others[i], T[0] + (i === 1 ? 1 : 0) * (T[0] > 20 ? -1 : 1), T[1] + (i === 2 ? 3 : 0) * (T[1] > 8 ? -1 : 1), false);
    await waitFor(phaseIs("reveal"), "reveal"); await tv.waitForTimeout(700); const rp = R.crd.pub; if(rp.tgt.join() !== T.join()) fails.push("revealed shade differs");
    const d = expect(rp); if(JSON.stringify(d) !== JSON.stringify(rp.deltas)) fails.push(`scores differ: ${JSON.stringify(rp.deltas)} vs ${JSON.stringify(d)}`);
    if(t === 0){ await snap("reveal", others[0]); await gp.screenshot({path:path.join(shots, "phone-reveal-giver.png")}); const lit = await tvLit(); if(lit < 1000) fails.push("TV board empty at the reveal"); }
    turns.push(rp.deltas);
    const last = rp.last; await tv.click('[data-act="next"]'); if(last){ await waitFor(() => R.crd.pub.ph === "over", "over"); R.over = true; } }
  await tv.waitForTimeout(900); const over = R.crd.pub; if(over.ph !== "over") fails.push("no winner screen: " + over.ph); else { await snap("winner", phones[0]); const mx = Math.max(...Object.values(over.scores)); if(JSON.stringify(over.winners.sort()) !== JSON.stringify(Object.keys(over.scores).filter(p => over.scores[p] === mx).sort())) fails.push("wrong winners"); }
  const total = {}; turns.forEach(d => Object.keys(d).forEach(p => total[p] = (total[p] || 0) + d[p])); if(JSON.stringify(Object.keys(total).sort().map(p => total[p])) !== JSON.stringify(Object.keys(over.scores).sort().map(p => over.scores[p] || 0))) fails.push("running scores differ from the sum of the turns");
  if(R.leaks) fails.push("the secret leaked " + R.leaks + " times"); if(errs.length) fails.push("page errors: " + errs.slice(0, 5).join(" | "));
  await tv.click('[data-act="again"]'); await tv.waitForTimeout(600); if(!(await tv.locator("#hcGo").count())) fails.push("Play again doesn't return to the lobby");
  console.log(`posts ${R.posts}, largest table ${R.maxPub} chars, largest move ${R.maxAct}`); console.log(fails.length ? "FAILS:\n - " + fails.join("\n - ") : "all checks passed"); await b.close(); srv.close(); process.exit(fails.length ? 1 : 0);
})();
