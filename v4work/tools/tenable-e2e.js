// 7.82: plays Tenable in a headless browser: Normal with two players (right, wrong, near spellings, a host give, stop, the reveal), TenaBall, and TenaBall Formations,
// through to the winner screen. NODE_PATH=$(npm root -g) node v4work/tools/tenable-e2e.js [shotsDir]. Needs a built index.html. Screenshots go to shotsDir (default ./_te-shots).
const fs = require("fs"), path = require("path"), {chromium} = require("playwright");
const root = path.resolve(__dirname, "../.."), shots = path.resolve(process.argv[2] || "_te-shots"); fs.mkdirSync(shots, {recursive:true});
const errs = [], fail = m => { console.error("FAIL: " + m); process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport:{width:1600, height:900}});
  p.on("pageerror", e => errs.push(e.message)); p.on("console", m => { if(m.type() === "error" && !/net::|Failed to load|favicon|api\/ping/.test(m.text())) errs.push(m.text()); });
  const html = fs.readFileSync(root + "/index.html", "utf8"), at = html.lastIndexOf("})();");   // app.js is one closure: a throwaway copy hands TE to the test
  fs.writeFileSync(root + "/_te-test.html", html.slice(0, at) + "window.TE = TE;\n" + html.slice(at));
  await p.goto("file://" + root + "/_te-test.html"); await p.waitForTimeout(800);
  await p.evaluate(() => { localStorage.removeItem("jn_teCfg"); localStorage.removeItem("jn_teSeen"); });
  await p.click("#modeTen"); await p.waitForTimeout(400); await p.screenshot({path:shots + "/0-title.png"});
  await p.click("#modeGo"); await p.waitForTimeout(300);
  await p.click('#teo [data-add]'); await p.fill('#teo [data-pl="0"]', "Omar"); await p.fill('#teo [data-pl="1"]', "Sara");
  await p.click('#teo [data-set="per"][data-v="1"]'); await p.screenshot({path:shots + "/1-setup.png"});
  await p.click("#teGo"); await p.waitForTimeout(200); await p.screenshot({path:shots + "/2-ready.png"});
  await p.click('#teo [data-act="go"]'); await p.waitForTimeout(200);
  const list = await p.evaluate(() => TE.turns[TE.ti].list); const ans = list.items.map(i => i.a);
  const type = async t => { await p.fill("#teIn", t); await p.press("#teIn", "Enter"); await p.waitForTimeout(120); };
  // a slightly misspelt right answer, two right, a wrong, a duplicate
  const near = ans[3].length > 6 ? ans[3].slice(0, -2) + ans[3].slice(-1) : ans[3];
  await type(near); await type(ans[0]); await type(ans[6]); await type("Zzqxv"); await type(ans[0]);
  let st = await p.evaluate(() => ({n:TE.t.n(), left:TE.t.left})); if(st.n !== 3 || st.left !== 2) fail(`after 3 right and 1 wrong: ${JSON.stringify(st)} (near: ${near})`);
  await p.click('#teo [data-give="8"]'); await p.waitForTimeout(150); await p.screenshot({path:shots + "/3-normal-play.png"});
  await p.click('#teo [data-act="stop"]'); await p.waitForTimeout(4500); await p.screenshot({path:shots + "/4-normal-reveal.png"});
  if(await p.locator("#teo .teslot.miss").count() !== 6) fail("6 missed slots should be revealed");
  await p.click('#teo [data-act="next"]'); await p.click('#teo [data-act="go"]');
  const ans2 = await p.evaluate(() => TE.turns[TE.ti].list.items.map(i => i.a)); for(const a of ans2) await type(a);
  await p.waitForTimeout(600); await p.screenshot({path:shots + "/5-normal-all.png"});
  if(!(await p.locator("#teo .teflash.ok").textContent()).includes("All 10")) fail("all ten should say so");
  await p.click('#teo [data-act="next"]'); await p.waitForTimeout(400); await p.screenshot({path:shots + "/6-winner.png"});
  const w = await p.locator("#teo .tewin").textContent(); if(!/Sara/.test(w)) fail("Sara should win: " + w);
  // TenaBall, one player (solo is endless: Next list keeps dealing until Finish)
  await p.click('#teo [data-act="setup"]'); await p.click('#teo [data-set="sub"][data-v="f"]'); await p.click('#teo [data-rm="1"]'); await p.waitForTimeout(200);
  await p.screenshot({path:shots + "/7-teaball-setup.png"});
  await p.click("#teGo"); await p.click('#teo [data-act="go"]'); await p.waitForTimeout(200);
  const fa = await p.evaluate(() => TE.turns[TE.ti].list.items.map(i => i.a)); await type(fa[1].split(" ").pop()); await type(fa[4]); await type("Pelé"); await p.waitForTimeout(300);
  await p.screenshot({path:shots + "/8-tenaball-play.png"});
  const ln = await p.locator("#teo .telistno").textContent(); if(!/^(NM|FM)#\d\d$/.test(ln)) fail("solo shows only the list ID, like FM#07");
  await p.click('#teo [data-act="stop"]'); await p.waitForTimeout(200); await p.click('#teo [data-act="next"]'); await p.click('#teo [data-act="go"]'); await p.waitForTimeout(100);
  if(await p.locator("#teo .telistno").textContent() === ln) fail("solo should keep dealing lists");
  await p.click('#teo [data-act="stop"]'); await p.waitForTimeout(200); await p.screenshot({path:shots + "/8b-solo-next.png"}); await p.click('#teo [data-act="finish"]'); await p.waitForTimeout(300);
  if(!/found by Omar/.test(await p.locator("#teo .tewin").textContent())) fail("Finish should show the solo result");
  await p.click('#teo [data-act="again"]'); await p.click('#teo [data-act="go"]'); await p.waitForTimeout(100);
  // Formations
  await p.click('#teo [data-act="end"]'); await p.click('#teo [data-set="form"][data-v="1"]'); await p.evaluate(() => TE.formShare = 1); await p.click("#teGo"); await p.click('#teo [data-act="go"]'); await p.waitForTimeout(200);
  const fm = await p.evaluate(() => TE.turns[TE.ti].list.items.map(i => i.a)); for(const a of fm.slice(0, 5)) await type(a); await type("Zidane2");
  await p.waitForTimeout(400); await p.screenshot({path:shots + "/9-formations-play.png"});
  await p.click('#teo [data-act="stop"]'); await p.waitForTimeout(3000); await p.screenshot({path:shots + "/10-formations-reveal.png"});
  await p.setViewportSize({width:390, height:844}); await p.waitForTimeout(300); await p.screenshot({path:shots + "/11-phone-width.png", fullPage:true});
  await p.setViewportSize({width:1600, height:900}); await p.click("#teHome"); await p.waitForTimeout(300);
  if(await p.locator("#confirmBox").isVisible()){ await p.screenshot({path:shots + "/12-leave.png"}); await p.click("#confirmYes"); }
  if(!(await p.locator("#titleScreen").isVisible())) fail("back to the title screen");
  if(errs.length) fail("page errors: " + errs.join(" | "));
  console.log(process.exitCode ? "tenable-e2e: FAILED" : "tenable-e2e: all good"); await b.close(); fs.unlinkSync(root + "/_te-test.html");
})();
