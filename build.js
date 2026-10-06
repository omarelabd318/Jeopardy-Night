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
const FLAGCODE=Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(W+'/flag-codes.json','utf8'))).filter(([id,c])=>fs.existsSync(`photos/flags/${c}.svg`)));   // 6.19
const J=x=>JSON.stringify(x);
const FOOTBALL_IDS=JSON.parse(fs.readFileSync('src/app.js','utf8').match(/const FOOTBALL = (\[[^\]]*\])/)[1]);   // 6.20: Football Mix = the Football mode pool
const head=fs.readFileSync('src/head.html','utf8'), app=fs.readFileSync('src/app.js','utf8'), builtin=fs.readFileSync('src/builtin.js','utf8');
const data=`${builtin.trim()}
const CATS = ${J(CATS)};
const DATA = ${J(DATA)};
const F = ${J(F)};
const flagInline = id => \`<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flag to identify">\${F[id][1]}</svg>\`;
/* 6.19 (Omar): flags are the accurate flag-icons drawings (photos/flags/<code>.svg, MIT), loaded only when shown. If one can't load,
   the old hand-drawn flag (F) is shown instead. (4.x-6.18: const flagSVG = flagInline) */
const FLAGCODE = ${J(FLAGCODE)};
const flagSVG = id => FLAGCODE[id] ? \`<img src="photos/flags/\${FLAGCODE[id]}.svg" alt="Flag to identify" onerror="this.outerHTML=flagInline('\${id}')">\` : flagInline(id);
const AR_EMOJI = new Set(${J([...AR])});
const ACT_KIND = ${J(ACT)};
const PHOTO_CATS = ${J(extra.PHOTO_CATS||base.PHOTO_CATS)};
const CHANGELOG = ${J(JSON.parse(fs.readFileSync('src/changelog.json','utf8')))};
const BALLS = ${J(fs.existsSync(W+'/balls') ? fs.readdirSync(W+'/balls').filter(f=>f.endsWith('.webp')).sort().map(f=>'data:image/webp;base64,'+fs.readFileSync(W+'/balls/'+f).toString('base64')) : [])};
// TV Show Mix: every clue from the 7 single-show categories, labelled by show
(() => {
const SHOWS = ["got","peaky","bb","pb","st","office","friends","himym"];
CATS.splice(CATS.findIndex(c => c.id==="office")+1, 0, {id:"tvmix", name:"TV Show Mix", type:"text", desc:"Clues from Game of Thrones, Peaky Blinders, Breaking Bad, Prison Break, Stranger Things, The Office, Friends and How I Met Your Mother, all in one."});
DATA.tvmix = {};
[100,200,300,400,500].forEach(l => {
  DATA.tvmix[l] = [];
  SHOWS.forEach(id => { const c = CATS.find(x => x.id===id); (DATA[id][l]||[]).forEach(e => { if(Array.isArray(e) && typeof e[0]==="string") DATA.tvmix[l].push([\`\${c.name}: \${e[0]}\`, e[1]]); }); });
});
})();
/* 6.20 (Omar): mix categories. A mix holds no clues of its own: each tile picks one of its sources (each source equally likely) and opens
   a clue from it exactly as that category would, labelled "Mix · Source" (see mixPick and openClue in src/app.js). */
const MIXES = [
  ["mixeg1", "Egypt Mix 1", ["ecin","ramadan","ploteg","quoteeg","emeg","lyricar"]],
  ["mixeg2", "Egypt Mix 2", ["egy","egh","cairo","egyph"]],
  ["mixguess", "Guess the… Mix", ["year","song","fyear","score","foodpic","logo","car","actor","footy","person","gctry"]],
  ["mixmap", "Maps & World Mix", ["geo","flag","shape","pin","ctry","lang","trans"]],
  ["mixparty", "Party Games Mix", ["emov","link","near","price","headl","order"]],
  ["mixkn1", "Knowledge Mix 1", ["his","islam","year","sci","cal","brand"]],
  ["mixkn2", "Knowledge Mix 2", ["ww2","space","food","ffood","mb","curr","tg"]],
  ["mixent1", "Entertainment Mix 1", ["blockbuster","tvmix","plot","igf","lyric","song"]],
  ["mixent2", "Entertainment Mix 2", ["tv","netflix","toons","mus","songt","spot","pixar","marvel"]],
  ["mixfb", "Football Mix", ${J(FOOTBALL_IDS)}]];
MIXES.forEach(([id,name,src]) => { src = src.filter(s => CATS.some(c => c.id===s));
  CATS.push({id, name, type:"mix", src, desc:"A mix of " + src.map(s => CATS.find(c => c.id===s).name).join(", ") + ". Each tile picks one of them."});
  DATA[id] = {100:[],200:[],300:[],400:[],500:[]}; });
`;
const out=`${head}\n<script>\n${data}${app}</script>\n`;
fs.writeFileSync(process.argv[2]||'index.html',out);
console.log('built',out.length,'bytes; overrides:',used.length, used.join(','));
