"""Towers x5: static bodies for all five towers (watertight, matches game dims).
Animated parts (P.parts: bow/string/drum/bellows/petals/arm/orb/glow) stay
procedural in-game; this GLB is the CONNECTED static body each tower plugs into.

Outputs (assets/blender/): tower-willow.glb, tower-forge.glb, tower-frost.glb,
tower-storm.glb, tower-lumen.glb
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import bpy

wood  = None  # set in build(); materials cached per run

def mats():
    return {
        'wood':  material('wood',  (0.54, 0.42, 0.28)),
        'wood2': material('wood2', (0.42, 0.32, 0.20)),
        'stone': material('stone', (0.71, 0.70, 0.64)),
        'dark':  material('stone2', (0.40, 0.38, 0.33)),
        'moss':  material('moss',  (0.50, 0.58, 0.33)),
        'ice':   material('ice',   (0.62, 0.85, 0.92), rough=0.6),
    }

def base(M, n=7):
    parts = []
    parts.append(cylinder('base', M['stone'], 0, 0, 0, 0.85, 1.05, 0.35, seg=n, noise=0.05, seed=4))
    return parts

def gen_willow(M):
    p = base(M)
    # game: CylinderGeometry(0.24,0.34,1.7) at y=1.2 -> spans 0.35..2.05 (base at cy)
    p.append(cylinder('pillar', M['wood'], 0, 0.35, 0, 0.24, 0.34, 1.7, seg=6, noise=0.04, seed=6))
    # platform: game center y=2.1 (h=0.16) -> spans 2.02..2.18; overlap pillar top
    p.append(cylinder('platform', M['wood2'], 0, 2.02, 0, 0.72, 0.60, 0.16, seg=7, noise=0.03, seed=8))
    # struts: angled braces from pillar mid to platform rim (embedded in both)
    for i in range(3):
        a = i / 3 * math.pi * 2
        p.append(box('strut', M['wood2'], math.cos(a) * 0.30, 1.78, math.sin(a) * 0.30,
                     0.06, 0.92, 0.06, rx=-math.sin(a) * 0.26, rz=math.cos(a) * 0.26))
    # sprout leaves (game hides its 5 procedural cones)
    for i in range(5):
        a = i * 1.3
        p.append(cone2('leaf', M['moss'], math.cos(a) * 0.5, 2.5 + math.sin(a) * 0.28,
                       math.sin(a) * 0.5, 0.1, 0.34, seg=4, rz=math.pi / 2))
    return p

def gen_forge(M):
    p = base(M)
    p.append(lathe('kiln', M['stone'], [(0.72, 0.35), (0.66, 0.8), (0.60, 1.25), (0.55, 1.55)],
                   seg=7, noise=0.05, seed=12))
    rr = random.Random(9)
    for i in range(7):
        a = i / 7 * math.pi * 2
        p.append(sphere('bump', M['stone'], math.cos(a) * 0.58, 0.9 + rr.random() * 0.5,
                        math.sin(a) * 0.58, 0.16 + rr.random() * 0.08,
                        seg=6, rings=4, noise=0.2, seed=40 + i))
    p.append(lathe('rim', M['dark'], [(0.58, 1.5), (0.66, 1.58), (0.60, 1.7)], seg=10, seed=2))
    return p


def gen_frost(M):
    p = base(M, 8)
    p.append(cylinder('staff', M['ice'], 0, 0, 0, 0.15, 0.24, 1.9, seg=6, noise=0.06, seed=15))
    for i in range(2):
        s = i * 2 - 1
        p.append(box('arm_chime', M['ice'], s * 0.28, 2.0, 0, 0.06, 0.5, 0.06, rz=s * 0.7))
        p.append(sphere('bell', M['ice'], s * 0.52, 2.28, 0, 0.07, seg=6, rings=4, noise=0.1, seed=51 + i))
    for i in range(5):
        a = i / 5 * math.pi * 2
        p.append(cone2('shard', M['ice'], math.cos(a) * 0.5, 0.35, math.sin(a) * 0.5,
                       0.11, 0.5 + i * 0.03, seg=4, rx=math.sin(a) * 0.25, rz=-math.cos(a) * 0.25))
    return p

def gen_storm(M):
    p = base(M, 8)
    for i in range(3):
        a = i / 3 * math.pi * 2
        p.append(cylinder('leg', M['wood'], math.cos(a) * 0.42, 0.78, math.sin(a) * 0.42,
                          0.07, 0.10, 1.56, seg=5, rx=-math.sin(a) * 0.28, rz=math.cos(a) * 0.28))
        p.append(box('brace', M['wood2'], math.cos(a + 0.5) * 0.5, 0.9, math.sin(a + 0.5) * 0.5,
                     0.05, 0.05, 0.62, ry=a + 0.5))
    return p


def gen_lumen(M):
    p = base(M, 8)
    p.append(lathe('pillar2', M['stone'], [(0.44, 0.35), (0.38, 1.0), (0.33, 1.55), (0.30, 1.85)],
                   seg=7, noise=0.05, seed=21))
    for i in range(4):
        a = i / 4 * math.pi * 2
        p.append(sphere('moss_blob', M['moss'], math.cos(a) * 0.2, 1.72, math.sin(a) * 0.2,
                        0.26, sx=1.2, sy=0.5, sz=1.0, seg=6, rings=4, noise=0.26, seed=60 + i))
    for i in range(4):
        a = i / 4 * math.pi * 2
        p.append(cylinder('bar', M['wood2'], math.cos(a) * 0.26, 2.1, math.sin(a) * 0.26,
                          0.035, 0.035, 0.6, seg=4, rx=-math.sin(a) * 0.12, rz=math.cos(a) * 0.12))

    return p

GENS = {'tower-willow': gen_willow, 'tower-forge': gen_forge, 'tower-frost': gen_frost,
        'tower-storm': gen_storm, 'tower-lumen': gen_lumen}
OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'blender')

def build_and_export(key):
    reset_scene()
    M = mats()
    parts = GENS[key](M)
    body = merge_objs(key, parts)
    out = os.path.join(OUTDIR, key + '.glb')
    export_glb(out)
    print('WROTE', key + '.glb')

if __name__ == '__main__':
    for k in ['tower-willow', 'tower-forge', 'tower-frost', 'tower-storm', 'tower-lumen']:
        build_and_export(k)
