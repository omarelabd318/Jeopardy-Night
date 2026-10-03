// Bundles the Guess the Food photos into photos/food-<value>.js (one file per value), because the live artifact
// holds at most 511 files. Re-encodes v4work/food-photos/<key>.jpg to 1280px q78 with ImageMagick first.
// Usage (from this folder): node mkpacks.js [outDir=photos]
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process'), os=require('os');
const out=process.argv[2]||'photos', src=path.resolve(__dirname,'v4work/food-photos'), tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fp-'));
const list=JSON.parse(fs.readFileSync(path.resolve(__dirname,'v4work/food-photos.json'),'utf8'));
for(const v of [100,200,300,400,500]){ const o={};
  for(const e of list.filter(e=>e.value===v)){ const f=`${src}/${e.key}.jpg`; if(!fs.existsSync(f)) continue;
    const t=`${tmp}/${e.key}.jpg`; execFileSync('convert',[f,'-resize','1280x1280>','-strip','-quality','78',t]);
    o[e.key]='data:image/jpeg;base64,'+fs.readFileSync(t).toString('base64'); }
  fs.writeFileSync(`${out}/food-${v}.js`,'window.__fp=Object.assign(window.__fp||{},'+JSON.stringify(o)+');\n');
  console.log(v,Object.keys(o).length,(fs.statSync(`${out}/food-${v}.js`).size/1e6).toFixed(1)+'MB'); }
