"""Willow tree (hero): connected trunk+branches (bark) and hanging strand curtain (leaf)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import bpy
from mathutils import Vector

reset_scene()
bark = material('bark', (0.42, 0.36, 0.26), rough=1.0)
leaf = material('leaf', (0.55, 0.72, 0.36), rough=1.0)
twig = material('bark2', (0.36, 0.31, 0.22), rough=1.0)

H = 4.6            # trunk height
C = 2.6            # canopy curl radius (dome)

# ---------- trunk: tapered cylinder with root flare ----------
profile = [(0.55, 0.0), (0.42, 0.5), (0.33, 1.4), (0.27, 2.3), (0.24, 3.2), (0.20, 4.0), (0.16, 4.55)]
trunk = lathe('bark', bark, profile, seg=10, noise=0.05, seed=5)

# ---------- branch limbs: bent tubes from trunk top up/out ----------
def tube(name, mat, pts, r0, r1, seg=6):
    """Tube through pts (list of (x,y,z)) with radius lerp r0->r1."""
    vs, fs = [], []
    n = len(pts)
    # approximate frames via axis between points; use simple radial ring
    rings = []
    for i in range(n):
        p = Vector(pts[i])
        d = (Vector(pts[min(i+1, n-1)]) - Vector(pts[max(i-1, 0)])).normalized()
        # arbitrary perpendicular
        up = Vector((0, 0, 1)) if abs(d.dot(Vector((0, 0, 1)))) < 0.9 else Vector((1, 0, 0))
        t1 = d.cross(up).normalized()
        t2 = d.cross(t1).normalized()
        r = r0 + (r1 - r0) * (i / (n - 1))
        ring = []
        for j in range(seg):
            a = j / seg * math.pi * 2
            ring.append(tuple(p + t1 * (math.cos(a) * r) + t2 * (math.sin(a) * r)))
        rings.append(ring)
        vs.extend(ring)
    for i in range(n - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            fs.append((i*seg+j, i*seg+j2, (i+1)*seg+j2, (i+1)*seg+j))
    fs.append(tuple(range(seg))[::-1])
    fs.append(tuple(range((n-1)*seg, n*seg)))
    return _mesh_obj(name, vs, fs, mat)

branches = []
bdefs = [
    # (start y, angle, tilt, len, top r)
    (3.4, 0.0, 0.55, 2.2, 0.10),
    (3.7, 1.9, 0.50, 2.4, 0.09),
    (3.9, 3.6, 0.62, 2.1, 0.08),
    (3.6, 5.2, 0.58, 2.3, 0.09),
    (3.3, 0.9, 0.72, 1.8, 0.07),
]
bi = 0
for (y0, ang, tilt, L, r_end) in bdefs:
    pts = []
    for i in range(5):
        t = i / 4
        a = ang + t * 0.35 * (1 if bi % 2 else -1)
        rad = math.sin(tilt * (1.0 + t * 0.4)) * L * t
        yy = y0 + math.sin(min(t * 1.15, 1.0) * 1.5) * L * 0.5 - t * 0.55  # droop tips
        pts.append((math.cos(a) * rad, yy, math.sin(a) * rad))
    branches.append(tube(f'bark_{bi}', bark if bi % 2 else twig, pts, 0.16 - bi * 0.01, r_end))
    bi += 1

# ---------- canopy dome: lumpy sphere of leaf at top (parent of strands) ----------
canopy = sphere('leaf', leaf, 0, C + 1.1, 0, 1.55, sx=1.25, sy=0.68, sz=1.25, seg=10, rings=7, noise=0.16, seed=9)

# ---------- strand curtain: hanging tassels from canopy rim ----------
strand_parts = []
NSTR = 26
rnd = random.Random(41)
for i in range(NSTR):
    a = i / NSTR * math.pi * 2
    rad = 1.45 + rnd.random() * 0.22
    x0, z0 = math.cos(a) * rad, math.sin(a) * rad
    top_y = C + 1.1 - 0.35 - rnd.random() * 0.3
    drop = 1.9 + rnd.random() * 1.3
    # strand = tapered thin tube hugging the dome edge then dangling
    pts = [(x0, top_y, z0), (x0 * 1.08, top_y - drop * 0.35, z0 * 1.08),
           (x0 * 1.1, top_y - drop * 0.72, z0 * 1.1), (x0 * 1.06, top_y - drop, z0 * 1.06)]
    strand_parts.append(tube(f's{i}', leaf, pts, 0.045, 0.012, seg=4))
# secondary inner strands
for i in range(12):
    a = (i + 0.5) / 12 * math.pi * 2
    rad = 0.85 + rnd.random() * 0.35
    x0, z0 = math.cos(a) * rad, math.sin(a) * rad
    pts = [(x0, C + 0.95, z0), (x0 * 1.05, C + 0.3, z0 * 1.05), (x0, C - 1.1, z0)]
    strand_parts.append(tube(f's_in{i}', leaf, pts, 0.03, 0.008, seg=4))

strands = merge_objs('leaf_strands', strand_parts)
body = merge_objs('bark_all', [trunk] + branches)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'blender', 'willow.glb')
export_glb(out)
print("WROTE willow.glb")
