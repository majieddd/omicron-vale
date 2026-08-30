"""Deploy units: sculpted Blender geometry for every tower part and every
enemy body part, authored in each part's LOCAL frame (geometry centered at
the mesh origin, y-up author space), matching the game primitive's own
local space. Named nodes; game swaps geometry by name onto its existing
meshes, so all transforms / pivots / animations keep working untouched.

Outputs:
  assets/blender/tower-<k>-parts.glb   (nodes: bow, drumD1/D2, crown, ...)
  assets/blender/enemy-<kind>.glb      (nodes: body, shell, head, legUp.., ...)
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen_common import *
import bpy
from mathutils import Vector, Euler, Matrix

OUTDIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'blender')

def M(name, color, rough=0.85):
    return material(name, color, rough=rough)

def tube_arc(name, mat, R, tube, a0, a1, seg=12, tstep=8, taper_fn=None):
    """Circular tube along an arc in the XY plane (author space), centered at origin."""
    vs, fs = [], []
    rnd = random.Random(5)
    for i in range(seg + 1):
        ang = a0 + (a1 - a0) * i / seg
        cx, cy = math.cos(ang) * R, math.sin(ang) * R
        nx, ny = math.cos(ang), math.sin(ang)
        tr = tube * (taper_fn(ang / (a1 - a0)) if taper_fn else 1.0)
        for j in range(tstep):
            t = j / tstep * math.pi * 2
            rr = tr * (1 + (rnd.random() - 0.5) * 0.12)
            vs.append((cx + nx * math.cos(t) * rr, cy + ny * math.cos(t) * rr, math.sin(t) * rr))
    for i in range(seg):
        for j in range(tstep):
            j2 = (j + 1) % tstep
            fs.append((i * tstep + j, i * tstep + j2, (i + 1) * tstep + j2, (i + 1) * tstep + j))
    return _mesh_obj(name, vs, fs, mat)

def cone_c(name, mat, cx, cy, cz, r, h, seg=6, rx=0.0, ry=0.0, rz=0.0, noise=0.0, seed=1):
    """Cone CENTERED at (cx,cy,cz) like three.js ConeGeometry (y from -h/2..h/2)."""
    return lathe(name, mat, [(r, -h / 2.0), (0.0001, h / 2.0)], seg=seg, noise=noise,
                 seed=seed, rx=rx, ry=ry, rz=rz, cx=cx, cy=cy, cz=cz)


# ------------------------------------------------ tower animated parts
def willow_parts():
    p = []
    # bow: arc 1.2pi in XY plane with grip bulge (game TorusGeometry(0.42,0.05,...,PI*1.2))
    p.append(tube_arc('bow', M('bowm', (0.42, 0.31, 0.18)), 0.42, 0.055,
                      0.0, math.pi * 1.2, seg=14, tstep=8,
                      taper_fn=lambda t: 1.0 + 0.55 * math.exp(-((t - 0.12) / 0.1) ** 2)))
    return {'bow': p}

def forge_parts():
    p = []
    p.append(lathe('drumD1', M('drumm', (0.43, 0.32, 0.22)), [
        (0.42, -0.09), (0.52, -0.06), (0.60, 0.0), (0.52, 0.07), (0.42, 0.09)],
        seg=9, noise=0.05, seed=22))
    p.append(lathe('drumD2', M('drumm', (0.36, 0.26, 0.17)), [
        (0.34, -0.072), (0.42, -0.05), (0.44, 0.0), (0.42, 0.05), (0.34, 0.072)],
        seg=9, noise=0.06, seed=23))
    for s in [-1, 1]:
        t = 'R' if s > 0 else 'L'
        p.append(box('bellows%s' % t, M('bellm', (0.36, 0.29, 0.20)), 0, 0, 0, 0.22, 0.5, 0.3))
        p.append(cone2('bellNose%s' % t, M('darkm', (0.24, 0.2, 0.15)), 0, 0.12, 0.0,
                       0.07, 0.3, seg=5, rx=math.pi / 2))
    p.append(lathe('mouth', M('darkm', (0.20, 0.17, 0.14)), [
        (0.16, -0.25), (0.30, -0.16), (0.32, -0.02), (0.18, 0.20), (0.02, 0.25)],
        seg=7, noise=0.06, seed=24))
    return {'drumD1': [p[0]], 'drumD2': [p[1]], 'bellowsR': [p[2], p[4]], 'bellowsL': [p[3], p[5]], 'mouth': [p[6]]}

def frost_parts():
    c = []
    c.append(cone2('cr0', M('icem', (0.56, 0.78, 0.85), 0.6), 0, -0.20, 0, 0.20, 0.46, seg=5, noise=0.12, seed=30))
    c.append(cone2('cr1', M('icem', (0.56, 0.78, 0.85), 0.6), 0.16, -0.22, 0.06, 0.14, 0.34, seg=5, noise=0.14, seed=31, rz=-0.5))
    c.append(cone2('cr2', M('icem', (0.56, 0.78, 0.85), 0.6), -0.15, -0.24, 0.08, 0.12, 0.30, seg=5, noise=0.14, seed=32, rz=0.55))
    c.append(cone2('cr3', M('icem', (0.56, 0.78, 0.85), 0.6), 0.02, -0.28, -0.11, 0.11, 0.28, seg=5, noise=0.14, seed=33, rx=0.5))
    petal = lathe('petal', M('icem2', (0.72, 0.90, 0.95), 0.7), [
        (0.02, -0.35), (0.10, -0.26), (0.15, -0.05), (0.16, 0.10), (0.10, 0.28), (0.02, 0.35)],
        seg=4, noise=0.05, seed=34)
    drip = lathe('drip', M('icem', (0.56, 0.78, 0.85), 0.6), [
        (0.055, -0.05), (0.08, -0.02), (0.08, 0.03), (0.02, 0.07)],
        seg=6, noise=0.05, seed=35)
    return {'crown': c, 'petal': [petal], 'drip': [drip]}

def storm_parts():
    drum = lathe('drum', M('woodm', (0.41, 0.32, 0.24)), [
        (0.55, -0.25), (0.66, -0.16), (0.68, 0.0), (0.66, 0.16), (0.55, 0.25)],
        seg=9, noise=0.04, seed=40)
    skin = lathe('skin', M('skinm', (0.80, 0.75, 0.64)), [
        (0.55, -0.05), (0.60, -0.03), (0.60, 0.03), (0.52, 0.05)],
        seg=10, noise=0.02, seed=41)
    ah = lathe('armHandle', M('woodm', (0.41, 0.32, 0.24)), [
        (0.045, -0.35), (0.06, -0.20), (0.05, 0.20), (0.06, 0.35)],
        seg=5, noise=0.02, seed=42)
    m = [sphere('maceCore', M('dark2', (0.26, 0.24, 0.21)), 0, 0, 0, 0.13, seg=6, rings=5, noise=0.06, seed=43)]
    for i in range(5):
        ang = i / 5 * math.pi * 2
        m.append(cone2('maceSpike', M('dark2', (0.26, 0.24, 0.21)), math.cos(ang) * 0.12, 0.0, math.sin(ang) * 0.12,
                       0.035, 0.14, seg=4, rx=math.sin(ang) * 0.9, rz=-math.cos(ang) * 0.9))
    m.append(cone2('maceSpikeTop', M('dark2', (0.26, 0.24, 0.21)), 0, 0.13, 0, 0.035, 0.14, seg=4))
    return {'drum': [drum], 'skin': [skin], 'armHandle': [ah], 'mace': m}

def lumen_parts():
    orb = sphere('orb', M('orbo', (0.98, 0.72, 0.35)), 0, 0, 0, 0.22, seg=8, rings=6, noise=0.10, seed=50)
    ct = cone2('cageTop', M('cagm', (0.34, 0.26, 0.17)), 0, -0.15, 0, 0.30, 0.34, seg=6, noise=0.05, seed=51)
    fin = sphere('finial', M('cagm', (0.34, 0.26, 0.17)), 0, 0.22, 0, 0.055, seg=6, rings=4, noise=0.05, seed=52)
    return {'orb': [orb], 'cageTop': [ct, fin]}

# ------------------------------------------------ enemies
def wisp_parts():
    body = lathe('body', M('wispb', (0.58, 0.72, 0.36)), [
        (0.03, -0.42), (0.22, -0.30), (0.36, -0.10), (0.40, 0.10), (0.26, 0.34), (0.02, 0.48)],
        seg=8, noise=0.08, seed=60)
    wing = lambda nm, sd: lathe(nm, M('wingm', (0.72, 0.85, 0.52)), [
        (0.02, -0.40), (0.12, -0.34), (0.26, -0.14), (0.30, 0.02), (0.16, 0.26), (0.02, 0.40)],
        seg=5, noise=0.06, seed=sd)
    drop = lathe('drop', M('dropm', (0.62, 0.74, 0.40)), [
        (0.04, -0.05), (0.07, -0.01), (0.07, 0.03), (0.02, 0.06)],
        seg=6, noise=0.05, seed=63)
    return {'body': [body], 'wl': [wing('wl', 61)], 'wr': [wing('wr', 62)], 'drop': [drop]}

def beetle_parts():
    shell = sphere('shell', M('shelm', (0.42, 0.44, 0.32)), 0, 0, 0, 0.55,
                   seg=9, rings=6, noise=0.09, seed=70)
    plates = [cone_c('crown%d' % i, M('crownm', (0.37, 0.39, 0.29)), 0, 0, 0,
                      0.16, 0.34 - i * 0.06, seg=5, noise=0.10, seed=71 + i) for i in range(3)]
    head = lathe('head', M('headm', (0.34, 0.39, 0.27)), [
        (0.03, -0.20), (0.16, -0.14), (0.24, 0.0), (0.20, 0.14), (0.02, 0.22)],
        seg=6, noise=0.06, seed=75)
    legs = {}
    for i in range(3):
        for s in [-1, 1]:
            t = 'R' if s > 0 else 'L'
            legs['legUp%d%s' % (i, t)] = [lathe('x', M('legm', (0.26, 0.31, 0.20)), [
                (0.055, -0.21), (0.075, -0.06), (0.06, 0.06), (0.08, 0.21)],
                seg=5, noise=0.05, seed=76 + i * 2 + (1 if s > 0 else 0))]
            legs['legLow%d%s' % (i, t)] = [lathe('y', M('legm', (0.24, 0.29, 0.19)), [
                (0.03, -0.20), (0.05, -0.06), (0.045, 0.06), (0.055, 0.20)],
                seg=5, noise=0.05, seed=78 + i * 2 + (1 if s > 0 else 0))]
    return {'shell': [shell], 'crown0': [plates[0]], 'crown1': [plates[1]],
            'crown2': [plates[2]], 'head': [head], **legs}

def ember_parts():
    body = sphere('body', M('embm', (0.26, 0.22, 0.20)), 0, 0, 0, 0.34,
                  seg=8, rings=6, noise=0.16, seed=80)
    plume = lathe('plume', M('flam', (0.88, 0.48, 0.20)), [
        (0.01, -0.28), (0.10, -0.18), (0.18, 0.0), (0.16, 0.18), (0.04, 0.28)],
        seg=5, noise=0.10, seed=81)
    return {'body': [body], 'plume': [plume]}

def stalker_parts():
    body = lathe('body', M('stalkb', (0.61, 0.66, 0.44)), [
        (0.03, -0.75), (0.14, -0.60), (0.28, -0.30), (0.36, -0.02), (0.30, 0.30),
        (0.12, 0.62), (0.02, 0.75)],
        seg=6, noise=0.09, seed=85)
    hood = sphere('hood', M('hoodm', (0.53, 0.56, 0.37)), 0, 0, 0, 0.30,
                  seg=7, rings=5, noise=0.07, seed=86)
    arms = {}
    for s in [-1, 1]:
        t = 'R' if s > 0 else 'L'
        arms['armA%s' % t] = [lathe('x', M('armm', (0.53, 0.58, 0.40)), [
            (0.035, -0.35), (0.055, -0.20), (0.045, 0.20), (0.058, 0.35)],
            seg=5, noise=0.04, seed=87 + (1 if s > 0 else 0))]
        arms['armH%s' % t] = [cone_c('y', M('thm', (0.36, 0.42, 0.24)), 0, 0, 0,
                                      0.12, 0.30, seg=4, noise=0.06, seed=88 + (1 if s > 0 else 0))]
    return {'body': [body], 'hood': [hood], **arms}

def grunt_parts():
    body = sphere('body', M('grunb', (0.44, 0.48, 0.34)), 0, 0, 0, 0.5,
                  sx=1.1, sy=0.6, sz=0.75, seg=8, rings=5, noise=0.10, seed=90)
    dome = sphere('dome', M('dome', (0.37, 0.43, 0.28)), 0, 0, 0, 0.52,
                  seg=8, rings=5, noise=0.14, seed=91)
    head = sphere('head', M('head2', (0.52, 0.56, 0.38)), 0, 0, 0, 0.18,
                  sx=1.1, sy=1.0, sz=0.82, seg=6, rings=4, noise=0.08, seed=92)
    tusks, legs = {}, {}
    for s in [-1, 1]:
        t = 'R' if s > 0 else 'L'
        tusks['tusk%s' % t] = [cone_c('x', M('tuskm', (0.80, 0.78, 0.70)), 0, 0, 0,
                                       0.06, 0.26, seg=4, noise=0.05, seed=93 + (1 if s > 0 else 0))]
        for f in [-1, 1]:
            legs['leg%s%s' % (t, 'F' if f > 0 else 'B')] = [
                lathe('x', M('leg2', (0.35, 0.40, 0.28)), [
                    (0.065, -0.18), (0.10, -0.06), (0.09, 0.06), (0.11, 0.18)],
                    seg=5, noise=0.04, seed=95 + (1 if s > 0 else 0) + (1 if f > 0 else 0))]
    return {'body': [body], 'dome': [dome], 'head': [head], **tusks, **legs}

def boss_parts():
    rm = M('bossr', (0.55, 0.57, 0.50), 0.95)
    dm = M('bossd', (0.43, 0.46, 0.40), 0.95)
    p = {}
    p['pelvis'] = [sphere('pelvis', dm, 0, 0, 0, 0.55, sx=1.55, sy=0.82, sz=1.1,
                          seg=8, rings=5, noise=0.09, seed=100)]
    p['torso'] = [sphere('torso', rm, 0, 0, 0, 0.65, sx=1.77, sy=1.3, sz=1.08,
                         seg=8, rings=5, noise=0.09, seed=101)]
    p['plate'] = [box('plate', dm, 0, 0, 0, 1.9, 0.7, 0.35)]
    p['head'] = [sphere('head', rm, 0, 0, 0, 0.42, sx=1.2, sy=0.85, sz=0.95,
                        seg=7, rings=5, noise=0.08, seed=102)]
    horns = [cone_c('horn%d' % i, dm, 0, 0, 0, 0.18, 0.9 - abs(i - 2) * 0.18,
                     seg=4, noise=0.10, seed=103 + i) for i in range(5)]
    p.update({'horn%d' % i: [horns[i]] for i in range(5)})
    for s in [-1, 1]:
        t = 'R' if s > 0 else 'L'
        p['thigh%s' % t] = [sphere('thigh', rm, 0, 0, 0, 0.36, sx=0.78, sy=1.8, sz=1.05,
                                   seg=7, rings=5, noise=0.09, seed=110 + (1 if s > 0 else 0))]
        p['shin%s' % t] = [lathe('shin', dm, [
            (0.40, -0.60), (0.46, -0.30), (0.42, 0.30), (0.34, 0.60)],
            seg=6, noise=0.08, seed=111 + (1 if s > 0 else 0))]
        p['foot%s' % t] = [sphere('foot', rm, 0, 0, 0, 0.40, sx=0.94, sy=0.62, sz=1.4,
                                  seg=7, rings=4, noise=0.08, seed=112 + (1 if s > 0 else 0))]
        p['sh%s' % t] = [sphere('shaft', rm, 0, 0, 0, 0.42, sx=0.74, sy=1.8, sz=0.95,
                                seg=7, rings=5, noise=0.09, seed=113 + (1 if s > 0 else 0))]
        p['fist%s' % t] = [sphere('fist', dm, 0, 0, 0, 0.55, seg=7, rings=5,
                                  noise=0.14, seed=114 + (1 if s > 0 else 0))]
    return p

# ------------------------------------------------ export
UNITS = {
    'tower-willow-parts': willow_parts,
    'tower-forge-parts': forge_parts,
    'tower-frost-parts': frost_parts,
    'tower-storm-parts': storm_parts,
    'tower-lumen-parts': lumen_parts,
    'enemy-wisp': wisp_parts,
    'enemy-beetle': beetle_parts,
    'enemy-ember': ember_parts,
    'enemy-stalker': stalker_parts,
    'enemy-grunt': grunt_parts,
    'enemy-boss': boss_parts,
}

def build_one(key):
    reset_scene()
    parts = UNITS[key]()
    for name, objs in parts.items():
        if not objs:
            continue
        merged = merge_objs(name, objs)
        merged.name = name
    export_glb(os.path.join(OUTDIR, key + '.glb'))
    print('WROTE', key + '.glb')

if __name__ == '__main__':
    for k in UNITS:
        build_one(k)
