// Builds index.html from src/ + base data + v4work/out overrides
const fs=require('fs'),W=require('path').resolve(__dirname,'v4work');
const base=JSON.parse(fs.readFileSync('src/base.json','utf8'));
const CATS=JSON.parse(JSON.stringify(base.CATS)).filter(c=>c.id!=='tvmix');
const DATA=base.DATA, F=base.F, ACT=base.ACT_KIND, AR=new Set(base.AR_EMOJI);
const used=[];
for(const c of CATS){const f=`${W}/out/${c.id}.json`; if(!fs.existsSync(f)) continue;
  try{const o=JSON.parse(fs.readFileSync(f,'utf8')); if(!o.data) continue; DATA[c.id]=o.data; used.push(c.id);
   Object.assign(ACT,o.act_kind||{}); (o.arabic_answers||[]).forEach(a=>AR.add(a));
   Object.entries(o.new_flags||{}).forEach(([k,v])=>F[k]=v);
   if(o.flags_fixed) Object.entries(o.flags_fixed).forEach(([k,v])=>F[k]=v);
  }catch(e){console.error('skip',c.id,e.message)}}
const extra=fs.existsSync('src/extra.js')?require('./src/extra.js'):{};
if(extra.apply) extra.apply({CATS,DATA,F,ACT,AR});
// keep only flags that are used
const J=x=>JSON.stringify(x);
const head=fs.readFileSync('src/head.html','utf8'), app=fs.readFileSync('src/app.js','utf8'), builtin=fs.readFileSync('src/builtin.js','utf8');
const data=`${builtin.trim()}
const CATS = ${J(CATS)};
const DATA = ${J(DATA)};
const F = ${J(F)};
const flagSVG = id => \`<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flag to identify">\${F[id][1]}</svg>\`;
const AR_EMOJI = new Set(${J([...AR])});
const ACT_KIND = ${J(ACT)};
const PHOTO_CATS = ${J(extra.PHOTO_CATS||base.PHOTO_CATS)};
// TV Show Mix: every clue from the 7 single-show categories, labelled by show
(() => {
const SHOWS = ["got","peaky","bb","pb","st","office","friends"];
CATS.splice(CATS.findIndex(c => c.id==="office")+1, 0, {id:"tvmix", name:"TV Show Mix", type:"text", desc:"Clues from Game of Thrones, Peaky Blinders, Breaking Bad, Prison Break, Stranger Things, The Office and Friends, all in one."});
DATA.tvmix = {};
[100,200,300,400,500].forEach(l => {
  DATA.tvmix[l] = [];
  SHOWS.forEach(id => { const c = CATS.find(x => x.id===id); (DATA[id][l]||[]).forEach(e => { if(Array.isArray(e) && typeof e[0]==="string") DATA.tvmix[l].push([\`\${c.name}: \${e[0]}\`, e[1]]); }); });
});
})();
`;
const out=`${head}\n<script>\n${data}${app}</script>\n`;
fs.writeFileSync(process.argv[2]||'index.html',out);
console.log('built',out.length,'bytes; overrides:',used.length, used.join(','));
