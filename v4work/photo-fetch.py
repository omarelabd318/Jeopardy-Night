# v4.56: downloads photo-round pictures for v4work/new-photos.json entries into v4work/photo-dl/<key>.jpg,
# taking the main infobox image from each Wikipedia page (action=raw, since the API is rate-limited here)
# or the entry's "file". Then: convert to photos/<key>.jpg after checking it (see NOTES 4.56).
# Usage: python3 v4work/photo-fetch.py key [key ...]
import json,re,urllib.request,urllib.parse,urllib.error,os,sys,time,hashlib
H={'User-Agent':'JeopardyNight/1.0 (private party game photo fetch)'}
def fetch(u):
    time.sleep(1); return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60).read()
here=os.path.dirname(os.path.abspath(__file__)); L=json.load(open(here+'/new-photos.json'))
only=set(sys.argv[1:]); os.makedirs(here+"/photo-dl",exist_ok=True)
def urls(f):
    f=f.strip().replace(' ','_'); f=f[0].upper()+f[1:]; h=hashlib.md5(f.encode()).hexdigest(); q=urllib.parse.quote(f)
    for site in ('commons','en'):
        base=f'https://upload.wikimedia.org/wikipedia/{site}'
        for w in (960,800,640,500):
            yield f'{base}/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}'
        yield f'{base}/{h[0]}/{h[:2]}/{q}'
for e in L:
    if e['key'] not in only: continue
    out=f"{here}/photo-dl/{e['key']}.jpg"
    f=e.get('file')
    if not f:
        try:
            t=fetch('https://en.wikipedia.org/w/index.php?'+urllib.parse.urlencode({'title':e['wiki'].replace('_',' '),'action':'raw'})).decode()
            m=re.search(r'#REDIRECT\s*\[\[([^\]]+)\]\]',t,re.I)
            if m: t=fetch('https://en.wikipedia.org/w/index.php?'+urllib.parse.urlencode({'title':m.group(1),'action':'raw'})).decode()
        except Exception as x: print('NOPAGE',e['key'],x); continue
        m=re.search(r'\|\s*(?:image|photo|image_name|img)\s*=\s*(?:\[\[)?(?:File:|Image:)?([^|\]\n<{}]+\.(?:jpe?g|png|webp|tiff?))',t,re.I)
        if not m: print('NOIMG',e['key']); continue
        f=m.group(1)
    for u in urls(f):
        try: data=fetch(u)
        except urllib.error.HTTPError: continue
        open(out,'wb').write(data); print('ok',e['key'],f); break
    else: print('NOFILE',e['key'],f)
