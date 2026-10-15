#!/usr/bin/env python3
"""7.10: draws the title-screen backgrounds (one SVG per mode) and writes src/titlebg.js.
Run: python3 v4work/tools/titlebg-gen.py   (then node build.js). Seeded, so the output is stable."""
import random, math, json, urllib.parse
W, H = 1600, 900
def wrap(body, base, scrim=.55):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice">'
            f'<defs><radialGradient id="sc" cx="50%" cy="42%" r="48%"><stop offset="0" stop-color="{base}" stop-opacity="{scrim}"/><stop offset="1" stop-color="{base}" stop-opacity="0"/></radialGradient></defs>'
            f'<rect width="{W}" height="{H}" fill="{base}"/>{body}<rect width="{W}" height="{H}" fill="url(#sc)"/></svg>')
out = {}
tiles = {}
def esc(v): return v.replace('"', "'").replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E')
def rgba(h, a): return f'rgba({int(h[1:3],16)},{int(h[3:5],16)},{int(h[5:7],16)},{a})'
def css_tile(body, size, base, scrim, fade=False):
    # 7.20: SVG patterns inside a background image did not show on Omar's device for Estimation and Tarneeb, so these are a small tile repeated by CSS
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 {size} {size}">{body}</svg>'
    layers = []
    if fade: layers.append(f'linear-gradient(90deg,{rgba(base,0)} 0,{rgba(base,.95)} 85%)')
    layers.append(f'radial-gradient(ellipse 48% 48% at 50% 42%,{rgba(base,scrim)},{rgba(base,0)})')
    layers.append(f'url("data:image/svg+xml,{esc(svg)}") 0 0/{size}px {size}px repeat')
    layers.append(f'linear-gradient({base},{base})')
    return ','.join(layers)
def star(cx, cy, r, col, op, sw=2):
    pts = []
    for i in range(16):
        a = math.pi * i / 8; rr = r if i % 2 == 0 else r * .62
        pts.append(f'{cx+rr*math.cos(a):.1f},{cy+rr*math.sin(a):.1f}')
    return f'<polygon points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="{sw}" opacity="{op}"/>'
def arabesque(c1, c2, dot):
    t = star(60, 60, 60, c1, .55) + f'<circle cx="60" cy="60" r="14" fill="{dot}" opacity=".3"/>' + star(0, 0, 42, c2, .3) + star(120, 0, 42, c2, .3) + star(0, 120, 42, c2, .3) + star(120, 120, 42, c2, .3)
    return t   # 7.20: just the 120px tile; it is repeated by CSS (see css_tile), not by an SVG pattern
# Bidding Wars: trading floor
r = random.Random(1)
b = ''.join(f'<line x1="0" x2="{W}" y1="{y}" y2="{y}" stroke="#ffb21a" opacity=".12"/><text x="{W-14}" y="{y+5}" fill="#ffb21a" opacity=".5" font-family="monospace" font-size="18" text-anchor="end">${(H-y)*3}</text>' for y in range(110, H, 110))
for x in range(10, W, 40):
    y = r.randint(250, 650); h = r.randint(30, 120); c = r.choice(['#38e07b', '#ff5a4d'])
    b += f'<line x1="{x+9}" x2="{x+9}" y1="{y-24}" y2="{y+h+24}" stroke="{c}" opacity=".35"/><rect x="{x}" y="{y}" width="18" height="{h}" fill="{c}" opacity=".35"/>'
for col, off in [('#38e07b', 0), ('#ffd21a', 90), ('#ff5a4d', -70)]:
    y = 480 + off; pts = []
    for x in range(0, W + 1, 30):
        y = max(180, min(760, y + r.randint(-34, 31))); pts.append(f'{x},{y}')
    b += f'<polyline points="{" ".join(pts)}" fill="none" stroke="{col}" stroke-width="4" opacity=".75"/>'
out['modeBid'] = wrap(b, '#07090c', .6)
# Category Bingo: real-looking balls
r = random.Random(2)
cols = {'B': '#2f6fdb', 'I': '#d93a3a', 'N': '#e9e6df', 'G': '#2fa84f', 'O': '#f2c230'}
rng = {'B': (1, 15), 'I': (16, 30), 'N': (31, 45), 'G': (46, 60), 'O': (61, 75)}
defs = ''.join(f'<radialGradient id="b{k}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".25" stop-color="{c}"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>' for k, c in cols.items())
b = f'<defs>{defs}</defs>'
cell = 290
for gy in range(-1, H // cell + 2):
    for gx in range(-1, W // cell + 2):
        x = gx * cell + cell / 2 + r.randint(-44, 44) + (cell / 2 if gy % 2 else 0); y = gy * cell + cell / 2 + r.randint(-40, 40); rad = r.randint(70, 84)
        L = r.choice('BINGO'); n = r.randint(*rng[L]); ink = '#1a1a1a'
        b += (f'<g><ellipse cx="{x+8}" cy="{y+rad*.95}" rx="{rad*.9}" ry="{rad*.22}" fill="#000" opacity=".35"/>'
              f'<circle cx="{x}" cy="{y}" r="{rad}" fill="{cols[L]}"/><circle cx="{x}" cy="{y}" r="{rad}" fill="url(#b{L})"/>'
              f'<circle cx="{x}" cy="{y}" r="{rad*.58}" fill="#fbf8ef"/>'
              f'<text x="{x}" y="{y-rad*.06}" text-anchor="middle" font-family="Arial Black,Arial" font-size="{rad*.3}" fill="{ink}">{L}</text>'
              f'<text x="{x}" y="{y+rad*.3}" text-anchor="middle" font-family="Arial Black,Arial" font-size="{rad*.42}" fill="{ink}">{n}</text>'
              f'<ellipse cx="{x-rad*.42}" cy="{y-rad*.5}" rx="{rad*.2}" ry="{rad*.1}" fill="#fff" opacity=".7" transform="rotate(-35 {x-rad*.42} {y-rad*.5})"/></g>')
out['modeBingo'] = wrap(b, '#10183f', .9)
# Hot Seat: curtains and spotlight
b = ''.join(f'<rect x="{x}" y="0" width="64" height="{H}" fill="{"#8c1d1d" if (x//64)%2==0 else "#6d1414"}"/>' for x in range(0, W, 64))
b += ('<defs><radialGradient id="sp" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#fff7d6" stop-opacity=".9"/><stop offset=".5" stop-color="#fff7d6" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
      '<linearGradient id="dk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient></defs>'
      f'<rect width="{W}" height="{H}" fill="url(#dk)"/><polygon points="690,0 910,0 1280,{H} 320,{H}" fill="url(#sp)"/><ellipse cx="800" cy="840" rx="380" ry="40" fill="#fff7d6" opacity=".3"/>')
out['modeHot'] = wrap(b, '#4a0c0c', .35)
# Survival: stormy sea
b = '<polygon points="840,0 760,240 840,240 740,480 950,180 850,180 930,0" fill="#ffe066" opacity=".85"/>'
for c, y in [('#7d3cc4', 440), ('#6a2bb0', 520), ('#5a1f98', 600), ('#491680', 680), ('#380e66', 760), ('#2a0a4d', 840)]:
    d = f'M0,{y} ' + ' '.join(f'Q{x+80},{y-40} {x+160},{y}' for x in range(0, W, 160)) + f' L{W},{H} L0,{H} Z'
    b += f'<path d="{d}" fill="{c}"/>'
for x, y in [(240, 560), (1180, 640), (1420, 500)]:
    b += f'<g transform="translate({x},{y})" opacity=".9"><circle r="46" fill="none" stroke="#ff5a4d" stroke-width="18"/><circle r="46" fill="none" stroke="#fff" stroke-width="18" stroke-dasharray="36 36"/></g>'
out['modeSurv'] = wrap(b, '#1b0b33', .3)
# Imposter: blinds, redactions, fingerprint
r = random.Random(3)
b = ''.join(f'<polygon points="0,{y} {W},{y-200} {W},{y-150} 0,{y+50}" fill="#e6e1d3" opacity=".07"/>' for y in range(100, H + 300, 100))
b += ''.join(f'<rect x="{r.randint(20,1100)}" y="{y}" width="{r.randint(180,420)}" height="30" fill="#000" opacity=".7"/>' for y in range(60, H, 80))
b += ''.join(f'<circle cx="1260" cy="470" r="{rr}" fill="none" stroke="#c8281f" stroke-width="4" opacity=".45" stroke-dasharray="{r.randint(60,240)} 20"/>' for rr in range(40, 270, 24))
b += '<text x="200" y="800" fill="#c8281f" opacity=".5" font-size="110" font-family="Special Elite, Courier, monospace" transform="rotate(-8 200 800)">CLASSIFIED</text>'
out['modeImp'] = wrap(b, '#1d1312', .5)
# Psych: halftone (7.13, Omar: the speech bubbles are gone; to bring them back run b += bubbles)
psy_tile = '<circle cx="18" cy="18" r="10" fill="#d2232a" opacity=".32"/>'   # 7.20: 36px tile, repeated by CSS
bubbles = ('<g fill="#fff" stroke="#1e2a26" stroke-width="7"><path transform="translate(-130,70)" d="M170,140 h330 a44,44 0 0 1 44,44 v70 a44,44 0 0 1 -44,44 h-215 l-72,58 v-58 h-43 a44,44 0 0 1 -44,-44 v-70 a44,44 0 0 1 44,-44z"/>'
      '<path transform="translate(40,-300)" d="M1060,560 h300 a44,44 0 0 1 44,44 v60 a44,44 0 0 1 -44,44 h-44 v58 l-72,-58 h-184 a44,44 0 0 1 -44,-44 v-60 a44,44 0 0 1 44,-44z"/></g>'
      '<text x="140" y="298" font-family="Arial Black" font-size="50" fill="#1e2a26">TRUE?</text><text x="1150" y="350" font-family="Arial Black" font-size="50" fill="#d2232a">LIAR!</text>')
tiles['modePsy'] = css_tile(psy_tile, 36, '#f6f3e8', .6, fade=True)
# Codenames: radar
b = ''.join(f'<circle cx="800" cy="450" r="{rr}" fill="none" stroke="#36a3ff" stroke-width="2.5" opacity=".35"/>' for rr in range(90, 900, 110))
b += (f'<line x1="0" x2="{W}" y1="450" y2="450" stroke="#36a3ff" opacity=".25"/><line x1="800" x2="800" y1="0" y2="{H}" stroke="#36a3ff" opacity=".25"/>'
      '<defs><linearGradient id="sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#36a3ff" stop-opacity="0"/><stop offset="1" stop-color="#36a3ff" stop-opacity=".5"/></linearGradient></defs>'
      '<path d="M800,450 L800,-250 A700,700 0 0 1 1400,60 Z" fill="url(#sw)"/>')
b += ''.join(f'<circle cx="{x}" cy="{y}" r="9" fill="{c}"/>' for x, y, c in [(1020, 290, '#ff4d63'), (610, 610, '#36a3ff'), (1150, 560, '#36a3ff'), (480, 320, '#ff4d63'), (900, 690, '#cfe6ff'), (300, 700, '#36a3ff'), (1350, 220, '#ff4d63')])
out['modeCn'] = wrap(b, '#0a1626', .5)
# Decrypto: cipher paper
r = random.Random(4)
b = ''.join(f'<text x="{r.randint(0,W)}" y="{r.randint(0,H)}" fill="#efe6cf" opacity="{r.choice([.1,.16,.24])}" font-family="Courier, monospace" font-size="{r.choice([22,28,36])}">{r.choice(["3-1-4","2-4-1","1-3-2","4-2-3",".-.. --- ..-.","-.-. --- -.. .","A=7","K9","·−·"])}</text>' for _ in range(110))
b += f'<rect x="0" y="770" width="{W}" height="52" fill="#efe6cf" opacity=".85"/><text x="20" y="805" font-family="Courier, monospace" font-size="30" fill="#23251f" letter-spacing="4">3-1-4 · 2-4-1 · 1-3-2 · 4-2-3 · 3-2-1 · 1-4-2 · 2-1-3 · 4-1-3 · 2-3-4 · 3-4-1 · 1-2-4 ·</text>'
out['modeDec'] = wrap(b, '#23251f', .5)
# For Sale: Cairo skyline
r = random.Random(5)
b = '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#144d33"/><stop offset="1" stop-color="#1f6b45"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="240" cy="170" r="70" fill="#f3d77a"/><circle cx="272" cy="154" r="66" fill="#144d33"/>'
for x in range(0, W, 88):
    h = r.randint(190, 470); b += f'<rect x="{x}" y="{H-h}" width="74" height="{h}" fill="#0b2c1c"/>' + ''.join(f'<rect x="{x+13+(j%2)*28}" y="{H-h+22+(j//2)*35}" width="14" height="19" fill="#f3d77a" opacity="{r.choice([0,.8,.9])}"/>' for j in range(int(h/35)*2))
b += '<g fill="#0b2c1c"><rect x="1020" y="400" width="22" height="500"/><path d="M1005,400 h52 l-26,-64z"/><circle cx="1031" cy="328" r="11"/><path d="M320,530 a96,96 0 0 1 192,0 v370 h-192z"/><rect x="408" y="400" width="16" height="150"/></g>'
b += '<g transform="rotate(-10 1350 370)"><rect x="1250" y="310" width="240" height="110" fill="#c0392b" stroke="#fbf6e6" stroke-width="6"/><text x="1370" y="388" text-anchor="middle" font-family="Arial Black" font-size="58" fill="#fbf6e6">SOLD</text></g>'
out['modeSale'] = wrap(b, '#144d33', .35)
# Estimation: green arabesque (Omar: like Tarneeb's, in Estimation's green)
tiles['modeEst'] = css_tile(arabesque('#46c783', '#2e9a5f', '#46c783'), 120, '#0b4a2a', .55)
# Tarneeb: brown arabesque
tiles['modeTn'] = css_tile(arabesque('#c49a4a', '#c49a4a', '#c49a4a'), 120, '#2a190f', .55)
# Hold'em: lattice and chips
b = '<defs><radialGradient id="h" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#8a1b2d"/><stop offset="1" stop-color="#33080f"/></radialGradient></defs><rect width="1600" height="900" fill="url(#h)"/>'
b += ''.join(f'<path d="M{x},{y} l48,48 l-48,48 l-48,-48z" fill="none" stroke="#e8c25a" opacity=".13"/>' for y in range(0, H, 96) for x in range(0, W, 96))
for x, y, c in [(190, 690, '#e8c25a'), (290, 740, '#f6ecd6'), (240, 640, '#1a1a1a'), (1330, 190, '#f6ecd6'), (1410, 240, '#e8c25a'), (1280, 260, '#1a1a1a'), (1380, 760, '#e8c25a')]:
    ac = '#7a1018' if c != '#1a1a1a' else '#e8c25a'
    b += f'<g transform="translate({x},{y})"><circle r="74" fill="{c}" stroke="#000" stroke-opacity=".4" stroke-width="4"/><circle r="55" fill="none" stroke="{ac}" stroke-width="8" stroke-dasharray="22 16"/><circle r="35" fill="{ac}" opacity=".85"/></g>'
out['modeHold'] = wrap(b, '#5e1020', .3)
# Liar's Bar: wood, lamps, bottles
b = ''.join(f'<rect x="{x}" y="0" width="160" height="{H}" fill="{c}"/><line x1="{x}" x2="{x}" y1="0" y2="{H}" stroke="#000" opacity=".5" stroke-width="4"/>' for x, c in zip(range(0, W, 160), ['#2a1a10', '#321f13', '#2a1a10', '#2e1c11', '#35221a'] * 2))
b += '<defs><radialGradient id="lg"><stop offset="0" stop-color="#ffd27a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>'
b += ''.join(f'<line x1="{x}" y1="0" x2="{x}" y2="110" stroke="#c9a14a" stroke-width="4"/><path d="M{x-64},190 a64,80 0 0 1 128,0z" fill="#c9a14a"/><circle cx="{x}" cy="200" r="210" fill="url(#lg)"/>' for x in (320, 800, 1280))
b += f'<rect x="0" y="710" width="{W}" height="22" fill="#6d4a28"/>' + ''.join(f'<g fill="#0a0603" opacity=".9"><rect x="{x}" y="{610-h}" width="42" height="{100+h}" rx="6"/><rect x="{x+13}" y="{560-h}" width="16" height="64"/></g>' for x, h in zip(range(96, W, 144), [10, 60, 0, 50, 30, 80, 10, 50, 0, 60, 30]))
out['modeLb'] = wrap(b, '#1a0f09', .35)
# Taboo: sound waves and red glow (no ON AIR sign, Omar 7.10)
r = random.Random(6)
b = '<defs><radialGradient id="ar"><stop offset="0" stop-color="#c0182a" stop-opacity=".4"/><stop offset="1" stop-color="#c0182a" stop-opacity="0"/></radialGradient></defs>' + f'<circle cx="800" cy="450" r="520" fill="url(#ar)"/>'
b += ''.join(f'<rect x="{x}" y="{450-h/2}" width="18" height="{h}" rx="9" fill="#f2c14e" opacity=".5"/>' for x, h in zip(range(30, W, 42), [r.randint(50, 420) for _ in range(40)]))
out['modeTb'] = wrap(b, '#170509', .5)
# 3-5-8: art-deco fans
b = '<defs><radialGradient id="p" cx="50%" cy="100%" r="100%"><stop offset="0" stop-color="#5a2f93"/><stop offset="1" stop-color="#150726"/></radialGradient></defs><rect width="1600" height="900" fill="url(#p)"/>'
b += ''.join(f'<line x1="800" y1="{H}" x2="{800+1100*math.cos(math.pi*(1-i/18)):.0f}" y2="{H-1100*math.sin(math.pi*(1-i/18)):.0f}" stroke="#f4d58a" opacity=".18"/>' for i in range(19))
b += ''.join(f'<circle cx="{cx}" cy="{H}" r="{rr}" fill="none" stroke="#f4d58a" stroke-width="3" opacity="{.5-rr/1500:.2f}"/>' for cx in (0, 800, 1600) for rr in range(90, 980, 80))
out['modeTf'] = wrap(b, '#2a1248', .3)
# Fake Artist (7.29, Omar picked the Evidence Board): cork board, polaroid sketches, red string. No text (a background image cannot load web fonts), no sticky note, no captions, each picture centred on its paper (7.30).
r = random.Random(11)
b = f'<rect width="{W}" height="{H}" fill="#9a6a3c"/>'
b += ''.join(f'<circle cx="{r.randint(0,W)}" cy="{r.randint(0,H)}" r="{r.uniform(1.5,5):.1f}" fill="{r.choice(["#6e4624","#b58450","#7d5330","#c49560"])}" opacity="{r.uniform(.25,.6):.2f}"/>' for _ in range(520))
b += f'<rect x="12" y="12" width="{W-24}" height="{H-24}" fill="none" stroke="#5b3a1d" stroke-width="24"/>'
sk = {
    'pyr': '<path d="M28 168 L110 48 L192 168 Z M110 48 L132 168" fill="none" stroke="#e0393e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    'camel': '<path d="M26 150 q12-52 42-30 q10-44 32-8 q22-36 42 2 q26-10 36 34 l-2 40 M70 172 v32 M152 172 v32 M26 150 q-8 8 0 20" fill="none" stroke="#2b6fd6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    'glass': '<path d="M66 56 h88 l-12 124 h-64 Z M72 100 h76" fill="none" stroke="#2e9e4f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    'fake': '<path d="M30 160 C60 60 80 190 110 110 S150 40 190 150 M40 70 C90 40 120 100 170 60 M50 190 C90 120 130 200 180 170" fill="none" stroke="#a64dff" stroke-width="6" stroke-linecap="round"/><path d="M84 76 C84 30 146 30 146 74 C146 106 110 104 110 138" fill="none" stroke="#e6007e" stroke-width="12" stroke-linecap="round"/><circle cx="110" cy="170" r="8" fill="#e6007e"/>',
}
def card(x, y, rot, k):
    return (f'<g transform="translate({x} {y}) rotate({rot})"><rect width="250" height="310" fill="#000" opacity=".28" transform="translate(10 12)"/><rect width="250" height="310" fill="#f6f3ea"/>'
            f'<rect x="15" y="45" width="220" height="220" fill="#ecebe6"/><g transform="translate(15 45)">{sk[k]}</g>'
            f'<circle cx="125" cy="-2" r="11" fill="#d81f2a"/><circle cx="121" cy="-6" r="3.5" fill="#fff" opacity=".6"/></g>')
def pin(x, y, rot):
    a = math.radians(rot); return (x + 125 * math.cos(a) + 2 * math.sin(a), y + 125 * math.sin(a) - 2 * math.cos(a))
cards = [(80, 70, -6, 'pyr'), (1350, 62, 5, 'camel'), (40, 545, 4, 'fake'), (1300, 520, -4, 'glass')]
P = [pin(*c[:3]) for c in cards]
def string(a, c, sag): return f'<path d="M{a[0]:.0f} {a[1]:.0f} Q{(a[0]+c[0])/2:.0f} {(a[1]+c[1])/2+sag:.0f} {c[0]:.0f} {c[1]:.0f}" fill="none" stroke="#c4202b" stroke-width="3.2" stroke-linecap="round"/>'
b += string(P[0], P[1], 170) + string(P[0], P[2], -70) + string(P[1], P[3], -60) + string(P[2], P[3], 150) + string(P[0], P[3], 120) + string(P[2], P[1], -80)
b += ''.join(card(*c) for c in cards)
out['modeFa'] = wrap(b, '#2a1a0e', .7)
# Hues and Cues (7.44, Paint Chip look): the 480-shade board itself as a wall of square paint chips with white gaps (same vivid shades as the game: hue 12 degrees per column, light to dark down the rows).
def hc_shade(c, r):
    t = r / 15; l = 70 - t * 40; sat = 92 + t * 8
    return f'hsl({(c * 12) % 360} {sat:.1f}% {l:.1f}%)'
b = ''
cw = W / 30; ch = H / 16
for c in range(30):
    for r in range(16):
        b += f'<rect x="{c*cw+4:.1f}" y="{r*ch+4:.1f}" width="{cw-8:.1f}" height="{ch-8:.1f}" fill="{hc_shade(c, r)}"/>'
out['modeHc'] = wrap(b, '#f4f5f3', .9)
# Speed Trivia (7.47, Studio Podiums look): a TV game-show set: navy studio, spotlight beams from above, a row of marquee bulbs and a wooden stage floor with a podium lamp for each of four players.
r = random.Random(47)
b = '<defs><linearGradient id="bm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9db8ff" stop-opacity=".42"/><stop offset="1" stop-color="#9db8ff" stop-opacity="0"/></linearGradient>' \
    '<linearGradient id="fl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4a12"/><stop offset="1" stop-color="#2a1b06"/></linearGradient></defs>'
for cx, spread, lean in [(220, 190, -60), (560, 170, -20), (1040, 170, 20), (1380, 190, 60)]:
    b += f'<polygon points="{cx},-10 {cx-spread+lean},760 {cx+spread+lean},760" fill="url(#bm)"/>'
for i in range(52):
    b += f'<circle cx="{20+i*30.6:.0f}" cy="28" r="7" fill="#ffcf4a" opacity="{r.choice([.95, .95, .55]):.2f}"/>'
b += f'<rect x="0" y="740" width="{W}" height="160" fill="url(#fl)"/>'
for k in range(1, 9):
    b += f'<line x1="{W/2}" y1="740" x2="{W/2+(k-4.5)*420:.0f}" y2="900" stroke="#000" opacity=".25" stroke-width="2"/>'
b += f'<line x1="0" x2="{W}" y1="740" y2="740" stroke="#ffcf4a" stroke-width="4" opacity=".7"/>'
for k, col in enumerate(['#e8413a', '#2f7bf0', '#22b45f', '#f2b31b']):
    x = 190 + k * 400
    b += f'<rect x="{x-110}" y="770" width="220" height="130" rx="6" fill="#4a3209" stroke="#1d1303" stroke-width="3"/><rect x="{x-90}" y="782" width="180" height="22" rx="4" fill="{col}" opacity=".85"/><circle cx="{x}" cy="760" r="16" fill="{col}" opacity=".8"/>'
out['modeSp'] = wrap(b, '#0c1846', .55)
js = ('/* 7.10 (Omar): a drawn background for every mode but Jeopardy Night. Generated by v4work/tools/titlebg-gen.py. Do not edit by hand. */\n'
      'const TTBG = {\n' + ',\n'.join(f'  {k}: "data:image/svg+xml,{v.replace('"', "'").replace('%', '%25').replace('#', '%23').replace('<', '%3C').replace('>', '%3E')}"' for k, v in out.items()) + '\n};\n'
      '/* 7.20: Estimation, Tarneeb and Psych are small tiles repeated by CSS (a full CSS background value each), not SVG patterns */\n'
      'const TTTILE = {\n' + ',\n'.join(f'  {k}: {json.dumps(v)}' for k, v in tiles.items()) + '\n};\n')
open('src/titlebg.js', 'w').write(js)
print({k: len(v) // 1024 for k, v in out.items()}, len(js) // 1024, 'KB')
