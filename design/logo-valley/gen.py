# Bluffing Valley icon, round 4 (owner 2026-09-27): a front mountain, a little shorter than two peaks
# behind it (left taller than right). Each mountain is a pyramid: split along its ridge, which twists as
# it runs down from the peak; the face left of the ridge is lit (light from the upper left), the right
# face in shadow. Front = the two darkest tones, back = the three lighter darks; sky = the five lights.
import math
# red sunset (owner 2026-09-27, from a reference picture they like): a pale sun in the valley, the sky in
# rings spreading out from it (pale peach -> deeper salmon), coral back peaks, a brick/maroon front.
SKY_RINGS = ["#FCE6CF", "#F9CDB0", "#F6B99B", "#F2A487", "#EE9075"]   # sun, then each ring outward
LIGHTS = SKY_RINGS
D1, D2, D3, D4, D5 = "#E9785B", "#DA644B", "#C4513F", "#A63B36", "#7E2A2F"   # back lit, back mid, back shade, front lit, front shade
uid = [0]
def nid(): uid[0] += 1; return f"k{uid[0]}"

def slices():
    return ""          # (the sky is drawn per design: rings round its sun — see design())

SKY3 = ["#F9CDB0", "#F4AE90", "#EE9075"]          # the three sky regions, nearest the sun first
SUN = "#FCE6CF"

import random
MAX_CORNER = 170.1     # owner: the ring corners may now exceed 150 deg

def ngon(cx, cy, r, n, turn=0.0, sx=1.0, jitter=0.0, seed=1):
    """A polygon round (cx, cy): n corners, radius r, stretched sx wide; jitter (0…1) moves each corner
    a little (angle and radius) for a faceted, hand-cut ring. Corner angles stay 90–150 deg."""
    rnd = random.Random(seed)
    pts = []
    for i in range(n):
        a = math.radians(turn + 360 * i / n + (rnd.uniform(-1, 1) * jitter * 180 / n))
        rr = r * (1 + rnd.uniform(-1, 1) * jitter * 0.12)
        pts.append((cx + rr * math.cos(a) * sx, cy + rr * math.sin(a)))
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"

def corner_angles(d):
    p = [tuple(map(float, q.split())) for q in d[1:-2].split(" L")]
    out = []
    for i in range(len(p)):
        a, b, c = p[i - 1], p[i], p[(i + 1) % len(p)]
        v1, v2 = (a[0] - b[0], a[1] - b[1]), (c[0] - b[0], c[1] - b[1])
        cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (math.hypot(*v1) * math.hypot(*v2))
        out.append(math.degrees(math.acos(max(-1, min(1, cos)))))
    return out

def sky(sx, sy, r=58, rings=((150, 8), (250, 8)), turn=22.5, rturn=(22.5, 22.5), stretch=1.0, jitter=0.0, **_):
    """No round edges: the sun is an octagon; the sky is three regions — two many-sided rings round the
    sun and the rest — each ring's corners between 90 and 150 deg."""
    out = f'<rect width="512" height="512" fill="{SKY3[2]}"/>'
    for (rad, n), c, t, seed in zip(reversed(rings), [SKY3[1], SKY3[0]], reversed(rturn), (7, 3)):
        # a hand-cut ring: try cuts until every corner is within 90–150 deg (the owner's range)
        for _ in range(400):
            d = ngon(sx, sy, rad, n, t, stretch, jitter, seed)
            if all(89.9 <= x <= MAX_CORNER for x in corner_angles(d)): break
            seed += 101
        else:
            raise SystemExit(f"no ring within 90–150 deg: n={n} stretch={stretch} jitter={jitter} {corner_angles(d)}")
        out += f'<path d="{d}" fill="{c}"/>'
    return out + f'<path d="{ngon(sx, sy, r, 8, turn)}" fill="{SUN}"/>'

def pts(p): return " ".join(f"{x:.1f} {y:.1f}" for x, y in p)

def mountain(apex, left, right, ridge, faces, curve=0):
    """apex (x,y); left/right = where the slopes leave the tile; ridge = [(x,y)…] from the apex down past
    the tile; faces = (lit, shadow) or (lit, mid, shadow) — a 3-face mountain takes ridge = [ridgeA, ridgeB]."""
    ax, ay = apex
    if curve:   # slopes bow outward a little (a rounder shoulder)
        outline = (f"M{left[0]} 600 L{left[0]} {left[1]} Q{(left[0]+ax)/2 - curve} {(left[1]+ay)/2 - curve} {ax} {ay} "
                   f"Q{(right[0]+ax)/2 + curve} {(right[1]+ay)/2 - curve} {right[0]} {right[1]} L{right[0]} 600 Z")
    else:
        outline = f"M{left[0]} 600 L{left[0]} {left[1]} L{ax} {ay} L{right[0]} {right[1]} L{right[0]} 600 Z"
    cid = nid()
    s = f'<clipPath id="{cid}"><path d="{outline}"/></clipPath><g clip-path="url(#{cid})">'
    s += f'<rect x="-100" y="-100" width="800" height="800" fill="{faces[-1]}"/>'        # shadow: everything
    ridges = ridge if isinstance(ridge[0], list) else [ridge]
    # each face left of a ridge, painted from the rightmost ridge back to the leftmost (lit last)
    for r, tone in zip(reversed(ridges), reversed(faces[:-1])):
        # overlap the ridge by 1.5 px so no hairline shows between the faces
        poly = [(ax, -100)] + [(x + 1.5, y) for x, y in r] + [(r[-1][0] + 1.5, 700), (-200, 700), (-200, -100)]
        s += f'<path d="M{pts(poly)} Z" fill="{tone}"/>'
    return s + "</g>"

def ridge(apex, bends, bottom=600):
    """A ridge from the apex down: bends = [(dx, y)…] offsets from the apex's x."""
    ax, ay = apex
    return [(ax, ay)] + [(ax + dx, y) for dx, y in bends] + [(ax + bends[-1][0] if bends else ax, bottom)]

V = []
SKYOPT = {}
def design(name, back_l, back_r, front):
    fx, fy = front[0]
    o = dict(SKYOPT)
    lift = o.pop("lift", 26)
    V.append((name, sky(fx - 4, fy - lift, **o) + mountain(*back_r) + mountain(*back_l) + mountain(*front)))

# round 6/7 (owner): back peaks slightly steeper, the front a little gentler (more sky, balance); each
# ridge = the owner's sketch: a short drop, then wide near-horizontal zig-zag strokes straight down.
def scene(name, L, R, F, rl, rr, rf, faces_l=(D1, D3), faces_r=(D2, D3), steep=1.0, gentle=1.0):
    (lx, ly), (rx, ry), (fx, fy) = L, R, F
    design(name,
        ((lx, ly), (-20, ly + (lx + 20) * 1.45 * steep), (lx + (440 - ly) * 0.58 / steep, 440), ridge((lx, ly), rl), faces_l),
        ((rx, ry), (rx - (440 - ry) * 0.6 / steep, 440), (532, ry + (532 - rx) * 1.35 * steep), ridge((rx, ry), rr), faces_r),
        ((fx, fy), (-20, fy + (fx + 20) * 0.62 * gentle), (532, fy + (532 - fx) * 0.62 * gentle), ridge((fx, fy), rf), (D4, D5)))

# the owner's sketch (2026-09-27): a short, near-vertical drop from the peak, then a zig-zag of wide,
# almost-horizontal strokes going left-right straight DOWN under the peak, ending near the bottom.
# Points as (dx, dy) fractions of the mountain's visible height, read off the sketch.
SKETCH = [(0.02, 0.04), (0.0, 0.21), (0.09, 0.30), (-0.07, 0.44), (0.11, 0.51), (-0.05, 0.65), (0.12, 0.73), (-0.01, 0.90)]

def sketch_ridge(apex, wide=1.0, lead=1.0, flip=1, zigs=None, stretch=1.0, drift=0.0):
    """The sketched ridge on a mountain whose peak is `apex`: wide scales the zig width, lead the first
    drop, flip -1 mirrors it, zigs trims the number of strokes, stretch scales its length, drift slides
    it right as it descends (share of the depth: 0.1 = 10 px right for every 100 px down)."""
    ax, ay = apex
    H = (512 - ay) * stretch
    pts = SKETCH[:2] + SKETCH[2:2 + zigs] if zigs else SKETCH
    out = []
    for i, (fx, fy) in enumerate(pts):
        fy = fy * lead if i < 2 else fy
        out.append((flip * fx * wide * H + drift * fy * H, ay + fy * H))
    last_x, last_y = out[-1]
    out.append((last_x + drift * (640 - last_y), 640))
    return out

def Sk(name, L, R, F, kl={}, kr={}, kf={}, **kw):
    scene(name, L, R, F, sketch_ridge(L, **kl), sketch_ridge(R, **kr), sketch_ridge(F, **kf), **kw)

# round 13 (owner): layouts 6–10 of round 12; the front ridge swings wider (its slope is gentler); every
# ridge drifts a little to the right as it descends. Each layout twice: a (moderate) and b (stronger).
LAYOUTS = {
    "Mirrored front": ((104, 150), (420, 236), (262, 318), dict(flip=-1)),
    "Lower still": ((104, 186), (420, 262), (262, 340), {}),
    "Wider gap": ((80, 150), (446, 236), (262, 318), {}),
    "Front higher": ((104, 150), (420, 236), (262, 290), {}),
    "Taller left": ((100, 120), (424, 250), (262, 322), {}),
}
def D(title, layout, sky_opts, fw=1.6, dr=0.08):
    global SKYOPT
    L, R, F, fk = LAYOUTS[layout]
    SKYOPT = sky_opts
    Sk(title, L, R, F, dict(drift=dr), dict(drift=dr), dict(fk, wide=fw, drift=dr))

D("Official", "Lower still", dict(rings=((180, 10), (300, 10)), rturn=(0, 18), lift=34, r=66))
_name, BODY = V[0]
# full-bleed square art (maskable / apple-touch) and the rounded tile (favicon / any-purpose / brand)
SQUARE = f'<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">{BODY}</svg>'
ROUND = (f'<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">'
         f'<clipPath id="tile"><rect width="512" height="512" rx="112"/></clipPath><g clip-path="url(#tile)">{BODY}</g></svg>')
import sys
out = sys.argv[1]
open(f"{out}/valley-square.svg", "w").write(SQUARE)
open(f"{out}/valley-round.svg", "w").write(ROUND)
