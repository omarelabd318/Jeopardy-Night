# Downloads each brand's logo into v4work/logo-photos/<key>.png (list: v4work/logo-photos.json).
# Reads the logo file name from the page's infobox via action=raw (the Wikipedia API rate-limits this
# environment), or uses the entry's "file" if set, then downloads a 500px PNG from upload.wikimedia.org
# (Commons first, then English Wikipedia for non-free logos; falls back to the original file).
# Usage: python3 v4work/logo-fetch.py [key ...]   (no keys = every logo that's missing)
import json,re,urllib.request,urllib.parse,urllib.error,os,sys,time,hashlib
H={'User-Agent':'JeopardyNight/1.0 (private party game logo fetch)'}
def fetch(u):
    time.sleep(1); return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60).read()
here=os.path.dirname(os.path.abspath(__file__)); L=json.load(open(here+'/logo-photos.json'))
only=set(sys.argv[1:])
def urls(f):
    f=f.strip().replace(' ','_'); f=f[0].upper()+f[1:]; h=hashlib.md5(f.encode()).hexdigest(); q=urllib.parse.quote(f)
    for site in ('commons','en'):
        base=f'https://upload.wikimedia.org/wikipedia/{site}'
        for w in (500,330,250):
            yield f'{base}/thumb/{h[0]}/{h[:2]}/{q}/{w}px-{q}'+('.png' if f.lower().endswith('.svg') else '')
        if not f.lower().endswith('.svg'): yield f'{base}/{h[0]}/{h[:2]}/{q}'
for e in L:
    if only and e['key'] not in only: continue
    out=f"{here}/logo-photos/{e['key']}.png"
    if os.path.exists(out) and not only: continue
    f=e.get('file')
    if not f:
        try: t=fetch('https://en.wikipedia.org/w/index.php?'+urllib.parse.urlencode({'title':e['wiki'],'action':'raw','redirect':'yes'})).decode()
        except Exception as x: print('NOPAGE',e['key'],x); continue
        m=re.search(r'#REDIRECT\s*\[\[([^\]]+)\]\]',t,re.I)
        if m: t=fetch('https://en.wikipedia.org/w/index.php?'+urllib.parse.urlencode({'title':m.group(1),'action':'raw'})).decode()
        m=re.search(r'\|\s*(?:logo|image_logo|logo_image|crest|badge)\s*=\s*(?:\[\[)?(?:File:|Image:)?([^|\]\n<{}]+\.(?:svg|png|jpg|jpeg|gif))',t,re.I)
        if not m: print('NOLOGO',e['key']); continue
        f=m.group(1)
    for u in urls(f):
        try: data=fetch(u)
        except urllib.error.HTTPError: continue
        open(out,'wb').write(data); print('ok',e['key'],f); break
    else: print('NOFILE',e['key'],f)
