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
    CATS.splice(at<0?CATS.length:at+1,0,{id,name:o.name,type:"text",desc:o.desc}); DATA[id]=o.data; });
  // v4.11: Who Am I? (three clues about a footballer), after Career Path
  { const f=W+'/out/whoami.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="path")+1,0,{id:"whoami",name:o.name,type:"text",desc:o.desc}); DATA.whoami=o.data; } }
  // v4.12: Football Stadiums, after Football Transfers; photo clues join only when photos/<key>.jpg exists
  { const f=W+'/out/stad.json'; if(fs.existsSync(f)){ const o=JSON.parse(fs.readFileSync(f,'utf8'));
    CATS.splice(CATS.findIndex(c=>c.id==="xfer")+1,0,{id:"stad",name:o.name,type:"text",desc:o.desc}); DATA.stad=o.data;
    const sp=W+'/stadium-photos.json'; if(fs.existsSync(sp)) JSON.parse(fs.readFileSync(sp,'utf8')).forEach(e=>{
      if(fs.existsSync(`photos/${e.key}.jpg`)) DATA.stad[e.value].push(["Name this stadium.",e.name,`photos/${e.key}.jpg`]); }); } }
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
  [['prov','arab'],['islam','his'],['himym','friends'],['score','form'],['space','sci'],['spot','song'],['igf','spot']].forEach(([id,after])=>{ const f=W+`/out/${id}.json`; if(!fs.existsSync(f)) return;
    const o=JSON.parse(fs.readFileSync(f,'utf8')), at=CATS.findIndex(c=>c.id===after);
    CATS.splice(at<0?CATS.length:at+1,0,{id,name:o.name,type:"text",desc:o.desc}); DATA[id]=o.data; });
  // v4.39: Guess the Logo, blurred logos bundled in photos/logo-<value>.js (built by mkpacks.js logo); 4th element = starting blur (share of image width)
  { const lf=W+'/logo-photos.json'; if(fs.existsSync(lf)){ const d={100:[],200:[],300:[],400:[],500:[]}, BLUR={100:.024,200:.022,300:.02,400:.018,500:.016};  // v4.40 values: 100:.03,200:.027,300:.024,400:.021,500:.018
    JSON.parse(fs.readFileSync(lf,'utf8')).forEach(e=>{ if(fs.existsSync(`${W}/logo-photos/${e.key}.png`)) d[e.value].push(["Name this brand.",e.name,`pack:logo-${e.value}:${e.key}`,BLUR[e.value]]); });
    if(Object.values(d).every(a=>a.length)){ CATS.splice(CATS.findIndex(c=>c.id==="foodpic")+1,0,{id:"logo",name:"Guess the Logo",type:"text",desc:"A blurred logo. Name the brand or club. The host can tap Less blur if nobody gets it."}); DATA.logo=d; } } }
  // v4.10: Football mode's World Cup, every World Cup clue plus the 2026 ones (labelled), not shown in setup
  CATS.push({id:"fwc",name:"World Cup",type:"text",mode:"football",desc:"World Cup history plus the 2026 tournament in Canada, Mexico and the USA."});
  DATA.fwc={}; [100,200,300,400,500].forEach(l=>{ DATA.fwc[l]=[...(DATA.wc[l]||[]),...(DATA.wc26[l]||[]).map(([q,a])=>[`2026: ${q}`,a])]; });
}};
