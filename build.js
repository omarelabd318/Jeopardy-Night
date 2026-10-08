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
const MODE_FILES=['bidding','bingo'].filter(m=>fs.existsSync(`src/${m}.js`));   // 6.48: each game mode lives in src/<mode>.js and is spliced into app.js at /*@modes*/
const head=fs.readFileSync('src/head.html','utf8'), app=fs.readFileSync('src/app.js','utf8').replace('/*@modes*/',()=>MODE_FILES.map(m=>fs.readFileSync(`src/${m}.js`,'utf8')).join('\n')), builtin=fs.readFileSync('src/builtin.js','utf8');
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
/* 6.38 (Omar): TV Show Mix is a real mix now (see MIXES below), so its shows can be changed from Edit mixes. 5.x-6.37: built here
   as a copy of every clue from the eight show categories, each prefixed "Show: ", in its own text category (DATA.tvmix). */
/* 6.20 (Omar): mix categories. A mix holds no clues of its own: each tile picks one of its sources (each source equally likely) and opens
   a clue from it exactly as that category would, headed "Mix · Source" (6.21 showed the mix's name only; 6.23 put the source back, see mixPick and openClue in src/app.js). */
const MIXES = [
  ["mixeg1", "Egypt Mix 1", ["ecin","ramadan","ploteg","quoteeg","emeg","lyricar"]],
  ["mixeg2", "Egypt Mix 2", ["egy","egh","cairo","egyph"]],
  ["mixguess", "Guess the ____ Mix", ["car","actor","footy","person","foodpic","logo","gctry"]],   /* 6.40 (Omar): a blank line instead of the ellipsis (6.26-6.39: "Guess the … Mix"; before 6.26: "Guess the… Mix") */ // 6.21 (Omar): the photo rounds only (6.20 also had Guess the Year, Song, Year: Football and Score)
  ["mixmap", "Maps & World Mix", ["geo","flag","shape","pin","ctry","lang","trans"]],
  ["mixparty", "Party Games Mix", ["link","near","price","headl","order"]],   // 6.40: Emoji Movies & TV moved to Entertainment Mix 2 with its category (was first here)
  ["mixkn1", "Knowledge Mix 1", ["his","islam","year","sci","cal","brand"]],
  ["mixkn2", "Knowledge Mix 2", ["ww2","space","food","ffood","mb","curr","tg"]],
  ["mixent1", "Entertainment Mix 1", ["blockbuster","tvmix","plot","igf","lyric","song"]],
  ["tvmix", "TV Show Mix", ["got","peaky","bb","pb","st","office","friends","himym"]],   // 6.38: the eight show categories
  ["mixent2", "Entertainment Mix 2", ["tv","netflix","toons","mus","songt","spot","pixar","marvel","emov"]],
  ["mixfb", "Football Mix", ${J(FOOTBALL_IDS)}],
  /* 6.40 (Omar): Everything Mix, last: every category except Act It Out (both), One Word Clues, the locked NSFW one and the hidden ones */
  ["mixall", "Everything Mix", CATS.filter(c => !c.mode && !["act","acteg","pw","x18","ptrap"].includes(c.id)).map(c => c.id)]];
MIXES.forEach(([id,name]) => { CATS.push({id, name, type:"mix"}); DATA[id] = {100:[],200:[],300:[],400:[],500:[]}; });
MIXES.forEach(([id,name,src]) => { const c = CATS.find(x => x.id===id); c.src = src.filter(s => CATS.some(x => x.id===s));   // 6.38: after all are added, so a mix can include another (TV Show Mix)
  c.desc = "A mix of " + c.src.map(s => CATS.find(x => x.id===s).name).join(", ") + ". Each tile picks one of them."; });
`;
const out=`${head}\n<script>\n${data}${app}</script>\n`;
fs.writeFileSync(process.argv[2]||'index.html',out);
console.log('built',out.length,'bytes; overrides:',used.length, used.join(','));
