"""Enemy bodies x6 + boss: watertight static bodies. Animated limbs
(P.parts.legs/arms/wings, plume, crown, bellows) stay procedural in-game.
Outputs: enemy-wisp.glb, enemy-beetle.glb, enemy-ember.glb, enemy-stalker.glb,
enemy-grunt.glb, enemy-boss.glb
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import bpy

def mats():
    return {
        'shell':  material('shell',  (0.37, 0.50, 0.29)),
        'shell_lo': material('shell2', (0.30, 0.42, 0.24)),
        'char':   material('char',   (0.24, 0.20, 0.19)),
        'leafm':  material('leafm',  (0.60, 0.66, 0.44)),
        'leafm2': material('leafm2', (0.50, 0.56, 0.35)),
        'rock':   material('rock',   (0.55, 0.57, 0.50), rough=0.95),
        'dark':   material('rock2',  (0.44, 0.46, 0.40), rough=0.95),
        'mossg':  material('moss',   (0.42, 0.50, 0.33)),
        'bright': material('bright', (0.84, 0.90, 0.36), emissive=(0.5, 0.62, 0.1), emis_str=0.5),
    }

def gen_wisp(M):
    # teardrop body + trailing dewdrop (wings are animated -> procedural)
    p = []
    p.append(sphere('body', M['leafm'], 0, 0.75, 0, 0.34, sx=0.8, sy=1.15, sz=0.8,
                    seg=9, rings=6, noise=0.1, seed=31))
    p.append(cone2('tail', M['leafm2'], 0, 0.35, 0, 0.16, 0.4, seg=6, rx=math.pi))
    p.append(sphere('drop', M['bright'], 0, 0.16, 0, 0.08, seg=7, rings=5))
    return p

def gen_beetle(M):
    p = []
    p.append(sphere('shell', M['shell'], 0, 0.42, 0, 0.55, sx=1.0, sy=0.62, sz=1.25,
                    seg=10, rings=6, noise=0.08, seed=33))
    # crown plates along spine
    for i in range(3):
        p.append(cone2('crown_p', M['shell_lo'], 0, 0.72 - i * 0.06, -0.15 + i * 0.34,
                       0.14, 0.3, seg=4, rx=-0.5))
    p.append(sphere('head', M['shell_lo'], 0, 0.34, 0.62, 0.24, seg=7, rings=5, noise=0.06, seed=35))
    # eyes
    for s in (-1, 1):
        p.append(sphere('eye', M['bright'], s * 0.11, 0.42, 0.78, 0.05, seg=6, rings=4))
    return p

def gen_ember(M):
    p = []
    p.append(sphere('body', M['char'], 0, 0.55, 0, 0.34, sx=0.85, sy=1.1, sz=0.8,
                    seg=9, rings=6, noise=0.12, seed=37))
    # cracked lava veins as bright seams? keep simple: ember eyes
    for s in (-1, 1):
        p.append(sphere('eye', M['bright'], s * 0.11, 0.62, 0.22, 0.05, seg=6, rings=4))
    return p

def gen_stalker(M):
    p = []
    p.append(lathe('body', M['leafm'], [(0.02, 0.15), (0.22, 0.4), (0.36, 0.9), (0.30, 1.5)],
                   seg=7, noise=0.07, seed=39))
    p.append(sphere('hood', M['leafm2'], 0, 1.6, 0, 0.30, sx=1.0, sy=0.8, sz=1.0,
                    seg=8, rings=5, noise=0.1, seed=41))
    for s in (-1, 1):
        p.append(sphere('eye', M['bright'], s * 0.1, 1.62, 0.24, 0.05, seg=6, rings=4))
    return p

def gen_grunt(M):
    p = []
    p.append(box('body', M['leafm'], 0, 0.5, 0, 1.1, 0.6, 0.75))
    p.append(sphere('dome', M['mossg'], 0, 0.75, 0, 0.52, sx=1.15, sy=0.72, sz=0.95,
                    seg=9, rings=6, noise=0.14, seed=43))
    p.append(box('head', M['leafm2'], 0, 0.52, 0.5, 0.4, 0.35, 0.3))
    for s in (-1, 1):
        p.append(cone2('tusk', M['bright'] if False else material('bone', (0.81, 0.79, 0.70)),
                       s * 0.12, 0.58, 0.66, 0.06, 0.22, seg=4, rx=1.9))
        p.append(sphere('eye', M['dark'], s * 0.13, 0.62, 0.63, 0.045, seg=6, rings=4))
    return p

def gen_boss(M):
    p = []
    # pelvis + torso + chest plate + head (legs/arms stay procedural)
    p.append(box('pelvis', M['dark'], 0, 1.5, 0, 1.7, 0.9, 1.2))
    p.append(box('torso', M['rock'], 0, 2.85, -0.1, 2.3, 1.7, 1.4))
    p.append(box('chest', M['dark'], 0, 3.2, 0.6, 1.9, 0.7, 0.35))
    p.append(box('head', M['rock'], 0, 3.75, 0.35, 1.0, 0.7, 0.8))
    # horn crown
    for i in range(5):
        p.append(cone2('horn', M['dark'], (i - 2) * 0.42, 4.1 - abs(i - 2) * 0.1, -0.2,
                       0.18, 0.9 - abs(i - 2) * 0.18, seg=4, rz=(i - 2) * 0.22))
    for s in (-1, 1):
        p.append(sphere('eye', M['bright'], s * 0.26, 3.85, 0.78, 0.08, seg=6, rings=4))
    # shoulder rocks
    for s in (-1, 1):
        p.append(sphere('shoulder', M['dark'], s * 1.32, 3.5, -0.1, 0.52,
                        sx=1.0, sy=0.75, sz=1.0, seg=7, rings=5, noise=0.18, seed=77 + s))
    return p

GENS = {'enemy-wisp': gen_wisp, 'enemy-beetle': gen_beetle, 'enemy-ember': gen_ember,
        'enemy-stalker': gen_stalker, 'enemy-grunt': gen_grunt, 'enemy-boss': gen_boss}
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
    for k in ['enemy-wisp', 'enemy-beetle', 'enemy-ember', 'enemy-stalker',
              'enemy-grunt', 'enemy-boss']:
        build_and_export(k)
