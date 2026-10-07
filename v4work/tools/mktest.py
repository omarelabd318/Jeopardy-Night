# Makes _test.html (a copy of index.html for testing; never commit it) with optional tweaks:
#   python3 v4work/tools/mktest.py [--flip] [--bawab KIND SIDE] [--unlock]
#   --flip      every street scene round is mirrored
#   --bawab     force the bawab's visit kind (0, 1, 2) and side (1 = left, -1 = right)
#   --unlock    any code unlocks the locked category
import sys,os
here=os.path.dirname(os.path.abspath(__file__)); root=os.path.abspath(here+'/../..')
s=open(root+'/index.html').read(); a=sys.argv[1:]
def rep(x,y):
    global s
    assert x in s, 'not found: '+x; s=s.replace(x,y)
if '--flip' in a: rep('flip = Math.floor(shown++ / ACTS.length) % 2 === 1;','flip = (shown++, true);')
if '--bawab' in a:
    i=a.index('--bawab'); rep('bawab.kind = bawab.visits % 3;','bawab.kind = %s;'%a[i+1]); rep('bawab.side = bawab.visits % 2 ? -1 : 1;','bawab.side = %s;'%a[i+2])
if '--unlock' in a: rep('if(codeHash($("#lockCode").value) !== LOCKED[id])','if(false)')
open(root+'/_test.html','w').write(s); print('wrote _test.html')
