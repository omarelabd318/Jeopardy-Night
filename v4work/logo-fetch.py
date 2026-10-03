# Downloads each brand's logo from the logo field of its English Wikipedia infobox (PNG thumbnail, 800px wide)
# into v4work/logo-photos/<key>.png. Usage: python3 v4work/logo-fetch.py  (reads v4work/logo-photos.json)
import json,re,urllib.request,urllib.parse,urllib.error,os,sys,time
H={'User-Agent':'JeopardyNight/1.0 (private party game logo fetch)'}
API='https://en.wikipedia.org/w/api.php?'
def fetch(u):
    for i in range(6):
        try: time.sleep(1.5); return urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60).read()
        except urllib.error.HTTPError as x:
            if x.code!=429: raise
            time.sleep(10*(i+1))
    raise RuntimeError('rate limited: '+u)
def get(p): return json.loads(fetch(API+urllib.parse.urlencode({**p,'format':'json','formatversion':2})))
here=os.path.dirname(os.path.abspath(__file__)); L=json.load(open(here+'/logo-photos.json'))
only=set(sys.argv[1:])
for e in L:
    if only and e['key'] not in only: continue
    out=f"{here}/logo-photos/{e['key']}.png"
    if os.path.exists(out) and not only: continue
    f=e.get('file')
    if not f:
        r=get({'action':'query','prop':'revisions','rvprop':'content','rvslots':'main','rvsection':0,'redirects':1,'titles':e['wiki']})
        try: t=r['query']['pages'][0]['revisions'][0]['slots']['main']['content']
        except Exception: print('NOPAGE',e['key']); continue
        m=re.search(r'\|\s*(?:logo|image_logo|logo_image|crest|badge|image)\s*=\s*(?:\[\[)?(?:File:|Image:)?([^|\]\n<{}]+\.(?:svg|png|jpg|jpeg|gif))',t,re.I)
        if not m: print('NOLOGO',e['key']); continue
        f=m.group(1).strip()
    r=get({'action':'query','prop':'imageinfo','iiprop':'url','iiurlwidth':800,'titles':'File:'+f})
    try: u=r['query']['pages'][0]['imageinfo'][0]['thumburl']
    except Exception: print('NOFILE',e['key'],f); continue
    data=fetch(u)
    open(out,'wb').write(data); print('ok',e['key'],f)
