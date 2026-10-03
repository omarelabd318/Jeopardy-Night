// Bundles photo clues into photos/<set>-<value>.js (one file per value), because the live artifact holds at most 511 files.
//   node mkpacks.js [food|logo] [outDir=photos]
// food (default): re-encodes v4work/food-photos/<key>.jpg to 1280px q78 with ImageMagick first.
// logo: puts v4work/logo-photos/<key>.png on a white 800x500 card (logo fitted to 600x340) as q85 jpg.
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process'), os=require('os');
const set=process.argv[2]||'food', out=process.argv[3]||'photos', tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fp-'));
const SETS={
  food:{list:'v4work/food-photos.json', src:k=>`v4work/food-photos/${k}.jpg`, args:(f,t)=>[f,'-resize','1280x1280>','-strip','-quality','78',t]},
  logo:{list:'v4work/logo-photos.json', src:k=>`v4work/logo-photos/${k}.png`, args:(f,t)=>[f,'-background','white','-alpha','remove','-alpha','off','-resize','600x340','-gravity','center','-extent','800x500','-strip','-quality','85',t]}
};
const S=SETS[set]; if(!S) throw new Error('unknown set '+set);
const list=JSON.parse(fs.readFileSync(path.resolve(__dirname,S.list),'utf8'));
for(const v of [100,200,300,400,500]){ const o={};
  for(const e of list.filter(e=>e.value===v)){ const f=path.resolve(__dirname,S.src(e.key)); if(!fs.existsSync(f)) continue;
    const t=`${tmp}/${e.key}.jpg`; execFileSync('convert',S.args(f,t));
    o[e.key]='data:image/jpeg;base64,'+fs.readFileSync(t).toString('base64'); }
  fs.writeFileSync(`${out}/${set}-${v}.js`,'window.__fp=Object.assign(window.__fp||{},'+JSON.stringify(o)+');\n');
  console.log(v,Object.keys(o).length,(fs.statSync(`${out}/${set}-${v}.js`).size/1e6).toFixed(1)+'MB'); }
