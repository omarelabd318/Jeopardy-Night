// v4 additions applied at build time: Guess the Person, Guess the Song, and v4.04 photo-round additions
const fs=require('fs'),W=require('path').resolve(__dirname,'..','v4work');
module.exports={PHOTO_CATS:["car","actor","footy","person"],apply({CATS,DATA}){
  const f=W+'/out/person.json';
  const data=fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')).data:{100:[],200:[],300:[],400:[],500:[]};
  const at=CATS.findIndex(c=>c.id==="footy")+1;
  CATS.splice(at,0,{id:"person",name:"Guess the Person",type:"photo",desc:"A zoomed-in photo of someone famous: singers, athletes, actors, leaders, internet stars. Half of them are Egyptian. Name them. Zoom out if nobody gets it. Half points for a partial answer."});
  DATA.person=data;
  // v4.04: new photo-round clues, only those whose photo made it into photos/
  const np=W+'/new-photos.json';
  if(fs.existsSync(np)) JSON.parse(fs.readFileSync(np,'utf8')).forEach(e=>{
    if(fs.existsSync(`photos/${e.key}.jpg`)) DATA[e.round][e.value].push([e.name,e.wiki]); });
  // v4.04: Guess the Song
  const sf=W+'/out/song.json';
  if(fs.existsSync(sf)){ const s=JSON.parse(fs.readFileSync(sf,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="songt")+1,0,{id:"song",name:s.name,type:"text",desc:s.desc});
    DATA.song=s.data; }
  // v4.08: Fast Food and Most Calories (inserted after Food & Drink)
  [['ffood','food'],['cal','ffood']].forEach(([id,after])=>{ const f=W+`/out/${id}.json`; if(!fs.existsSync(f)) return;
    const o=JSON.parse(fs.readFileSync(f,'utf8')); const at=CATS.findIndex(c=>c.id===after);
    CATS.splice(at<0?CATS.length:at+1,0,{id,name:o.name,type:o.type||"text",desc:o.desc}); DATA[id]=o.data; });
  // v4.11: Who Am I? (three clues about a footballer), after Career Path
  { const f=W+'/out/whoami.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="path")+1,0,{id:"whoami",name:o.name,type:"text",desc:o.desc}); DATA.whoami=o.data; } }
  // v4.12: Football Stadiums, after Football Transfers; photo clues join only when photos/<key>.jpg exists
  { const f=W+'/out/stad.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="xfer")+1,0,{id:"stad",name:o.name,type:"text",desc:o.desc}); DATA.stad=o.data;
    const sp=W+'/stadium-photos.json'; if(fs.existsSync(sp)) JSON.parse(fs.readFileSync(sp,'utf8')).forEach(e=>{
      if(fs.existsSync(`photos/${e.key}.jpg`)) DATA.stad[e.value].push(["Name this stadium.",e.name,`photos/${e.key}.jpg`]); }); } }
  // 6.22: the category-photos step (5.20) moved below, after every category is added, so later categories such as The Parent Trap can have photo clues
  // 5.23 (Omar): whole photo categories (Guess the Country, Egypt: Photo Edition), listed in v4work/photo-cats.json as
  // [{id, name, desc, after, q, items:[{key, value, a, q?}]}]; a clue is included only when photos/<key>.jpg exists, and the
  // category only when every value has at least one. Plain photos (no zoom or blur), so steal codes work on them.
  { const pc=W+'/photo-cats.json'; if(fs.existsSync(pc)) JSON.parse(fs.readFileSync(pc,'utf8')).forEach(c=>{ const d={100:[],200:[],300:[],400:[],500:[]};
      c.items.forEach(e=>{ if(fs.existsSync(`photos/${e.key}.jpg`)) d[e.value].push([e.q||c.q,e.a,`photos/${e.key}.jpg`]); });
      if(Object.values(d).every(a=>a.length)){ const at=CATS.findIndex(x=>x.id===c.after); CATS.splice(at<0?CATS.length:at+1,0,{id:c.id,name:c.name,type:"text",desc:c.desc}); DATA[c.id]=d; } }); }
  { const fp=W+'/food-photos.json'; if(fs.existsSync(fp)){ const d={100:[],200:[],300:[],400:[],500:[]};
    JSON.parse(fs.readFileSync(fp,'utf8')).forEach(e=>{ if(fs.existsSync(`photos/${e.key}.jpg`)) d[e.value].push(["Name this food.",e.name,`pack:food-${e.value}:${e.key}`]); });
    if(!Object.values(d).every(a=>a.length)){ const all=[100,200,300,400,500].flatMap(v=>d[v]); if(all.length>=10){  // photos still arriving: spread what exists across the five values in difficulty order
      [100,200,300,400,500].forEach((v,i)=>{ d[v]=all.slice(Math.round(i*all.length/5),Math.round((i+1)*all.length/5)); }); } }
    if(Object.values(d).every(a=>a.length)){ CATS.splice(CATS.findIndex(c=>c.id==="cal")+1,0,{id:"foodpic",name:"Guess the Food",type:"text",desc:"A photo of a dish, snack, fruit or vegetable. Name it."}); DATA.foodpic=d; } } }
  // v4.13: Egyptian Football, after Football
  { const f=W+'/out/egfb.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="fb")+1,0,{id:"egfb",name:o.name,type:"text",desc:o.desc}); DATA.egfb=o.data; } }
  // v4.14: Guess the Year: Football, after Who Am I?
  { const f=W+'/out/fyear.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="whoami")+1,0,{id:"fyear",name:o.name,type:"text",desc:o.desc}); DATA.fyear=o.data; } }
  { const f=W+'/out/form.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="fyear")+1,0,{id:"form",name:o.name,type:"text",desc:o.desc}); DATA.form=o.data; } }
  // v4.39: Egyptian Proverbs, How I Met Your Mother, Guess the Score, Space & Planets, Most Spotify Listeners, Most Instagram Followers
  [['prov','arab'],['islam','his'],['romcom','toons'],['lyric','song'],['hgames','hp'],['himym','friends'],['score','form'],['space','sci'],['spot','song'],['igf','spot'],
   /* 4.79 */ ['ramadan','prov'],['memeeg','ramadan'],['shirt','whoami'],['mgr','shirt'],['vgames','gta'],['pixar','romcom'],['headl','near'],
   /* 4.83 */ ['ctry','pin'],['ctryar','emseg'],
   /* 4.91 */ ['price','near'],
   /* 4.92 */ ['curr','mb'],
   /* 5.8 */ ['netflix','office'],
   /* 5.22 */ ['order','headl'],
   /* 5.50 */ ['blockbuster','marvel'], /* 5.81 */ ['lyricar','lyric'], /* 6.20 */ ['ptrap','romcom'],
   /* 6.42 */ ['tennis','sport'], ['oldies','song'], ['facts','gk'], ['holi','myth'], ['animal','space'], ['cocktail','cal'], ['landmark','geo']].forEach(([id,after])=>{ const f=W+`/out/${id}.json`; if(!fs.existsSync(f)) return;
    const o=JSON.parse(fs.readFileSync(f,'utf8')), at=CATS.findIndex(c=>c.id===after);
    CATS.splice(at<0?CATS.length:at+1,0,{id,name:o.name,type:o.type||"text",desc:o.desc}); DATA[id]=o.data; });
  // v4.39: Guess the Logo, blurred logos bundled in photos/logo-<value>.js (built by mkpacks.js logo); 4th element = starting blur (share of image width)
  { const lf=W+'/logo-photos.json'; if(fs.existsSync(lf)){ const d={100:[],200:[],300:[],400:[],500:[]}, BLUR={100:.024,200:.022,300:.02,400:.018,500:.016};  // v4.40 values: 100:.03,200:.027,300:.024,400:.021,500:.018
    JSON.parse(fs.readFileSync(lf,'utf8')).forEach(e=>{ if(fs.existsSync(`${W}/logo-photos/${e.key}.png`)) d[e.value].push(["Name this brand.",e.name,`pack:logo-${e.value}:${e.key}`,BLUR[e.value]]); });
    if(Object.values(d).every(a=>a.length)){ CATS.splice(CATS.findIndex(c=>c.id==="foodpic")+1,0,{id:"logo",name:"Guess the Logo",type:"text",desc:"A blurred logo. Name the brand or club. The host can tap Less blur if nobody gets it."}); DATA.logo=d; } } }
  // 5.20 (Omar): photo clues inside normal categories (Egypt History, Cairo Streets & Places), listed in v4work/category-photos.json (6.22: also The Parent Trap)
  // as {cat, value, key, q, a}; each joins its category only when photos/<key>.jpg exists.
  { const cp=W+'/category-photos.json'; if(fs.existsSync(cp)) JSON.parse(fs.readFileSync(cp,'utf8')).forEach(e=>{
      if(DATA[e.cat] && DATA[e.cat][e.value] && fs.existsSync(`photos/${e.key}.jpg`)) DATA[e.cat][e.value].push([e.q,e.a,`photos/${e.key}.jpg`]); }); }
  // v4.10: Football mode's World Cup, every World Cup clue plus the 2026 ones (labelled), not shown in setup
  CATS.push({id:"fwc",name:"World Cup",type:"text",mode:"football",desc:"World Cup history plus the 2026 tournament in Canada, Mexico and the USA."});
  DATA.fwc={}; [100,200,300,400,500].forEach(l=>{ DATA.fwc[l]=[...(DATA.wc[l]||[]),...(DATA.wc26[l]||[]).map(([q,a])=>[`2026: ${q}`,a])]; });
}};
