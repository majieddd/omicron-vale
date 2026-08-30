"""Boulder variants (rock_a/b/c): watertight faceted low-poly rocks.
Root cause fixed: game's IcosahedronGeometry(size,1) is NON-INDEXED in
three.js, so per-vertex jitter tore shared corners apart (crack shards).
Here: icosphere mesh with SHARED vertices, deterministic radial jitter,
clamped bottom -> single connected closed rock per variant.
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import bpy

reset_scene()
stone = material('stone', (0.72, 0.71, 0.64), rough=0.95)

def ico_subdivide(verts, faces):
    """Half-edge subdivision preserving shared vertices (watertight)."""
    mid = {}
    def mp(a, b):
        key = (a, b) if a < b else (b, a)
        if key not in mid:
            mx, my, mz = (verts[a][0]+verts[b][0])/2, (verts[a][1]+verts[b][1])/2, (verts[a][2]+verts[b][2])/2
            L = math.sqrt(mx*mx + my*my + mz*mz) or 1.0
            mid[key] = len(verts)
            verts.append((mx/L, my/L, mz/L))
        return mid[key]
    out = []
    for a, b, c in faces:
        ab, bc, ca = mp(a, b), mp(b, c), mp(c, a)
        out += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
    return verts, out

def rock(name, r, sx, sy, sz, jitter, seed, clamp=0.42):
    rnd = random.Random(seed)
    t = (1 + math.sqrt(5)) / 2
    verts = [(-1,t,0),(1,t,0),(-1,-t,0),(1,-t,0),(0,-1,t),(0,1,t),(0,-1,-t),(0,1,-t),
             (t,0,-1),(t,0,1),(-t,0,-1),(-t,0,1)]
    verts = [(x/math.sqrt(1+t*t), y/math.sqrt(1+t*t), z/math.sqrt(1+t*t)) for x,y,z in verts]
    faces = [(0,11,5),(0,5,1),(0,1,7),(0,7,10),(0,10,11),(1,5,9),(5,11,4),(11,10,2),
             (10,7,6),(7,1,8),(3,9,4),(3,4,2),(3,2,6),(3,6,8),(3,8,9),(4,9,5),(2,4,11),
             (6,2,10),(8,6,7),(9,8,1)]
    verts, faces = ico_subdivide(list(verts), list(faces))
    # radial jitter (shared verts stay welded) + y squash + bottom clamp
    jv = []
    for (x, y, z) in verts:
        k = 1.0 + (rnd.random() - 0.5) * 2 * jitter
        jv.append((x * k * sx, y * k * sy, z * k * sz))
    jv = [(x, max(y, -clamp * sy), z) for (x, y, z) in jv]
    # normalize max radius to 1.0 and center x/z at 0
    mx = max(math.sqrt(x*x + z*z) for x, _, z in jv)
    jv = [(x / mx, y / mx, z / mx) for (x, y, z) in jv]
    ob = _mesh_obj(name, [(x * r, y * r, z * r) for (x, y, z) in jv], faces, stone)
    return ob

a = rock('rock_a', 0.5, 1.15, 0.72, 0.96, 0.20, 11)
b = rock('rock_b', 0.42, 0.90, 0.86, 1.12, 0.24, 23)
c = rock('rock_c', 0.34, 1.05, 0.68, 1.05, 0.28, 37)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'blender', 'rocks.glb')
export_glb(out)
print("WROTE rocks.glb")
