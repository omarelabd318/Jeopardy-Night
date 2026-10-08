// Street scene frames at exact times, with a fake clock (Math.random fixed at 0.4, so act order and gaps are repeatable).
//   python3 v4work/tools/mktest.py [--flip]; node v4work/tools/scene.js '[[312.5,"sweep1"],[316,"sweep2"]]' [width=1400] [scale=2] [outdir=/tmp/frames]
// Saves the 84 px strip above the scores. At 1400 px (v6.46): bus + microbus 2-19 s, ful cart 23-62, cat 66-95, dog walk 99-125, bread + wedding 129-179
// (she stops about 159-165 s), sheep + hantour 182-230, sweeper 234-263 (pleading about 249-253); then the same seven mirrored from 266 s.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const shots = JSON.parse(process.argv[2]), W = +(process.argv[3] || 1400), SC = +(process.argv[4] || 2), OUT = process.argv[5] || '/tmp/frames';
fs.mkdirSync(OUT, {recursive: true});
(async()=>{const b=await chromium.launch();const errs=[];
const p=await b.newPage({viewport:{width:W,height:900},deviceScaleFactor:SC});p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{window.__now=0;performance.now=()=>window.__now;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>raf(()=>cb(window.__now));Math.random=()=>0.4;});
await p.goto('file://'+path.resolve(__dirname,'../../_test.html'));await p.waitForTimeout(800);await p.click('#play');await p.waitForTimeout(300);
await p.evaluate(()=>document.querySelector('#pick6').click());await p.click('#start');await p.waitForTimeout(800);
let T=0;
for(const [t,name] of shots.sort((a,b)=>a[0]-b[0])){
  while(T<t-1e-9){T=Math.min(t,T+0.25);await p.evaluate(v=>{window.__now=v*1000;},T);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r())));}
  await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
  const bb=await p.evaluate(()=>{const r=document.getElementById('street').getBoundingClientRect();return {y:r.y};});
  await p.screenshot({path:`${OUT}/${name}.png`,clip:{x:0,y:bb.y,width:W,height:84}});
}
console.log('errors',errs);await b.close()})();
