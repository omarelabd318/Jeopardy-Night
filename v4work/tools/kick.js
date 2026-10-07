// Football mode kickers at exact times since the board appeared (the opening routine is the first 3.5 s).
//   python3 v4work/tools/mktest.py; node v4work/tools/kick.js '[[0.5,"open","L"],[11.5,"wedge","R"]]' [outdir=/tmp/frames]
// Each shot is a 90 px crop around the left (L) or right (R) player at 3x.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const shots = JSON.parse(process.argv[2]), OUT = process.argv[3] || '/tmp/frames'; fs.mkdirSync(OUT, {recursive: true});
(async()=>{const b=await chromium.launch();const errs=[];
const p=await b.newPage({viewport:{width:1400,height:900},deviceScaleFactor:3});p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{window.__now=0;performance.now=()=>window.__now;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>cb(window.__now));Math.random=()=>0.4;});
await p.goto('file://'+path.resolve(__dirname,'../../_test.html'));await p.waitForTimeout(800);await p.click('#play');await p.waitForTimeout(300);
await p.click('#football');await p.waitForTimeout(600);
if(await p.evaluate(()=>!document.getElementById('lobby').hidden)){ await p.click('#lobbySkip').catch(()=>{}); await p.waitForTimeout(300);}
await p.evaluate(()=>{window.__now=100;});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
const base=await p.evaluate(()=>window.__now);let T=0;
for(const [t,name,side] of shots){ while(T<t-1e-9){T=Math.min(t,T+0.05);await p.evaluate(v=>{window.__now=v;},base+T*1000);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r())));}
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
  const bb=await p.evaluate(()=>{const r=document.getElementById('kick').getBoundingClientRect();return {y:r.y};});
  await p.screenshot({path:`${OUT}/${name}.png`,clip:{x:side==='R'?1310:0,y:bb.y+20,width:90,height:64}});
}
console.log('errors',errs);await b.close()})();
