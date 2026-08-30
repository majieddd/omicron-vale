"""Smoke test + first asset: 3 rock variants (rock_a/b/c)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import bpy

reset_scene()
stone = material('stone', (0.62, 0.61, 0.55), rough=0.95)

def rock(name, r, sx, sy, sz, seg, rings, noise, seed):
    ob = sphere(name, stone, 0, 0, 0, r, sx=sx, sy=sy, sz=sz,
                seg=seg, rings=rings, noise=noise, seed=seed)
    # flatten bottom: clamp lowest ring, then drop to z=0
    mz = min(v.co.z for v in ob.data.vertices)
    for v in ob.data.vertices:
        if v.co.z < mz + 0.14: v.co.z = mz + 0.14
    mz2 = min(v.co.z for v in ob.data.vertices)
    for v in ob.data.vertices:
        v.co.z -= mz2
    return ob

a = rock('rock_a', 0.5, 1.0, 0.8, 0.9, 9, 6, 0.22, 11)
b = rock('rock_b', 0.42, 1.1, 0.75, 1.0, 8, 6, 0.30, 23)
c = rock('rock_c', 0.34, 0.9, 0.95, 0.85, 8, 6, 0.26, 37)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'blender', 'rocks.glb')
export_glb(out)
print("WROTE rocks.glb")
