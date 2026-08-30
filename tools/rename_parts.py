import re, io

p = 'src/05_units.mjs'
s = open(p, encoding='utf-8').read()

# ---- import the new bridge function
s = s.replace("import { requestUnitBlenderAsset } from './09_assets.mjs';",
              "import { requestUnitBlenderAsset, requestUnitGeometries } from './09_assets.mjs';")

# ---- ENEMIES: name each part mesh (name matches GLB node)
repl = [
    ('const wl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 4), wingMat);',
     'const wl = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.8, 4), wingMat); wl.name = "wl";'),
    ('const wr = wl.clone(); wr.position.x = 0.34; wr.rotation.z = -1.05;',
     'const wr = wl.clone(); wr.position.x = 0.34; wr.rotation.z = -1.05; wr.name = "wl";'),
    ('body.scale.set(0.8, 1.15, 0.8);\n    body.position.y = 0.75;',
     'body.scale.set(0.8, 1.15, 0.8);\n    body.position.y = 0.75; body.name = "body";'),
    ('shell.scale.set(1, 0.62, 1.25);\n    shell.position.y = 0.42;',
     'shell.scale.set(1, 0.62, 1.25);\n    shell.position.y = 0.42; shell.name = "shell";'),
    ('head.position.set(0, 0.34, 0.62); head.castShadow = true;',
     'head.position.set(0, 0.34, 0.62); head.castShadow = true; head.name = "head";'),
    ('const p = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), mat(0x4c6a3c));\n      p.position.set(0, 0.72 - i * 0.06, -0.15 + i * 0.34);',
     'const p = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 4), mat(0x4c6a3c));\n      p.name = "crown" + i;\n      p.position.set(0, 0.72 - i * 0.06, -0.15 + i * 0.34);'),
    ('const up = limb(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 5), legM, 0, -0.18, 0);',
     'const up = limb(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 5), legM, 0, -0.18, 0);\n        up.name = "legUp" + i + (s > 0 ? "R" : "L");'),
    ('const low = limb(new THREE.CylinderGeometry(0.04, 0.03, 0.4, 5), legM, 0, -0.52, 0);',
     'const low = limb(new THREE.CylinderGeometry(0.04, 0.03, 0.4, 5), legM, 0, -0.52, 0);\n        low.name = "legLow" + i + (s > 0 ? "R" : "L");'),
    ('body.position.y = 0.55; body.scale.set(0.85, 1.1, 0.8);',
     'body.position.y = 0.55; body.scale.set(0.85, 1.1, 0.8); body.name = "body";'),
    ('plume.position.y = 1.05; plume.rotation.z = 0.12;',
     'plume.position.y = 1.05; plume.rotation.z = 0.12; plume.name = "plume";'),
    ('body.position.y = 0.95; body.castShadow = true;',
     'body.position.y = 0.95; body.castShadow = true; body.name = "body";'),
    ('hood.position.y = 1.6; hood.scale.set(1, 0.8, 1);',
     'hood.position.y = 1.6; hood.scale.set(1, 0.8, 1); hood.name = "hood";'),
    ('const a = limb(new THREE.CylinderGeometry(0.05, 0.035, 0.7, 5), armM, 0, -0.3, 0);\n      a.rotation.z = s * 0.65;',
     'const a = limb(new THREE.CylinderGeometry(0.05, 0.035, 0.7, 5), armM, 0, -0.3, 0);\n      a.name = "armA" + (s > 0 ? "R" : "L");\n      a.rotation.z = s * 0.65;'),
    ('const hand = limb(new THREE.ConeGeometry(0.12, 0.3, 4), mat(0x5d6b3d), 0, -0.72, 0);',
     'const hand = limb(new THREE.ConeGeometry(0.12, 0.3, 4), mat(0x5d6b3d), 0, -0.72, 0);\n      hand.name = "armH" + (s > 0 ? "R" : "L");'),
    ('const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), bodyM);\n    body.position.y = 0.5; body.castShadow = true;',
     'const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.6, 0.75), bodyM);\n    body.position.y = 0.5; body.castShadow = true; body.name = "body";'),
    ('dome.position.y = 0.75; dome.scale.set(1.15, 0.72, 0.95);',
     'dome.position.y = 0.75; dome.scale.set(1.15, 0.72, 0.95); dome.name = "dome";'),
    ('const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.3), mat(0x818e60));\n    head.position.set(0, 0.52, 0.5); g.add(head);',
     'const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.3), mat(0x818e60));\n    head.name = "head";\n    head.position.set(0, 0.52, 0.5); g.add(head);'),
    ('const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), tuskM);\n      t.position.set(s * 0.12, 0.58, 0.66);',
     'const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 4), tuskM);\n      t.name = "tusk" + (s > 0 ? "R" : "L");\n      t.position.set(s * 0.12, 0.58, 0.66);'),
    ('const l = limb(new THREE.CylinderGeometry(0.09, 0.07, 0.36, 5), legM, 0, -0.16, 0);\n        hip.add(l); g.add(hip);',
     'const l = limb(new THREE.CylinderGeometry(0.09, 0.07, 0.36, 5), legM, 0, -0.16, 0);\n        l.name = "leg" + (s > 0 ? "R" : "L") + (f > 0 ? "F" : "B");\n        hip.add(l); g.add(hip);'),
    ('const pelvis = limb(new THREE.BoxGeometry(1.7, 0.9, 1.2), darkM, 0, 1.5, 0);',
     'const pelvis = limb(new THREE.BoxGeometry(1.7, 0.9, 1.2), darkM, 0, 1.5, 0);\n    pelvis.name = "pelvis";'),
    ('const thigh = limb(new THREE.BoxGeometry(0.55, 1.3, 0.75), rockM, 0, -0.65, 0);',
     'const thigh = limb(new THREE.BoxGeometry(0.55, 1.3, 0.75), rockM, 0, -0.65, 0);\n      thigh.name = "thigh" + (s > 0 ? "R" : "L");'),
    ('const shin = limb(new THREE.CylinderGeometry(0.34, 0.46, 1.2, 5), darkM, 0, -1.85, 0);',
     'const shin = limb(new THREE.CylinderGeometry(0.34, 0.46, 1.2, 5), darkM, 0, -1.85, 0);\n      shin.name = "shin" + (s > 0 ? "R" : "L");'),
    ('const foot = limb(new THREE.BoxGeometry(0.75, 0.5, 1.15), rockM, 0, -2.5, 0.28);',
     'const foot = limb(new THREE.BoxGeometry(0.75, 0.5, 1.15), rockM, 0, -2.5, 0.28);\n      foot.name = "foot" + (s > 0 ? "R" : "L");'),
    ('const torso = limb(new THREE.BoxGeometry(2.3, 1.7, 1.4), rockM, 0, 2.85, -0.1);\n    torso.rotation.x = -0.06;',
     'const torso = limb(new THREE.BoxGeometry(2.3, 1.7, 1.4), rockM, 0, 2.85, -0.1);\n    torso.name = "torso";\n    torso.rotation.x = -0.06;'),
    ('const chestPlate = limb(new THREE.BoxGeometry(1.9, 0.7, 0.35), darkM, 0, 3.2, 0.6);',
     'const chestPlate = limb(new THREE.BoxGeometry(1.9, 0.7, 0.35), darkM, 0, 3.2, 0.6);\n    chestPlate.name = "plate";'),
    ('const h = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9 - Math.abs(i - 2) * 0.18, 4), darkM);',
     'const h = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.9 - Math.abs(i - 2) * 0.18, 4), darkM);\n      h.name = "horn" + i;'),
    ('const head = limb(new THREE.BoxGeometry(1.0, 0.7, 0.8), rockM, 0, 3.75, 0.35);',
     'const head = limb(new THREE.BoxGeometry(1.0, 0.7, 0.8), rockM, 0, 3.75, 0.35);\n    head.name = "head";'),
    ('const sh = limb(new THREE.BoxGeometry(0.62, 1.5, 0.8), rockM, 0, -0.65, 0);',
     'const sh = limb(new THREE.BoxGeometry(0.62, 1.5, 0.8), rockM, 0, -0.65, 0);\n      sh.name = "sh" + (s > 0 ? "R" : "L");'),
    ('const fist = limb(new THREE.IcosahedronGeometry(0.55, 1), darkM, 0, -1.6, 0.15);',
     'const fist = limb(new THREE.IcosahedronGeometry(0.55, 1), darkM, 0, -1.6, 0.15);\n      fist.name = "fist" + (s > 0 ? "R" : "L");'),
]
misses = 0
for old, new in repl:
    if old not in s:
        misses += 1
        print('MISS:', old[:70].replace('\n', ' | '))
    s = s.replace(old, new, 1)

# enemies: request geometry swap right before return P
old_ret = """  P.parts.hpBar = hb;
  return P;
}"""
new_ret = """  P.parts.hpBar = hb;
  requestUnitGeometries('enemy-' + kind, g);
  return P;
}"""
if old_ret not in s:
    misses += 1
    print('MISS: enemy return block')
s = s.replace(old_ret, new_ret, 1)

# ---- TOWERS: name parts
trepl = [
    ('bow.position.y = 2.62;\n    g.add(bow);', 'bow.name = "bow";\n    bow.position.y = 2.62;\n    g.add(bow);'),
    ('string.position.y = 2.62; string.position.x = -0.38;',
     'string.name = "string";\n    string.position.y = 2.62; string.position.x = -0.38;'),
    ('mouth.rotation.x = Math.PI / 2 + 0.5;\n    mouth.position.set(0, 1.5, 0.35);',
     'mouth.rotation.x = Math.PI / 2 + 0.5;\n    mouth.name = "mouth";\n    mouth.position.set(0, 1.5, 0.35);'),
    ('const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 8), drumM);',
     'const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 8), drumM);\n    d1.name = "drumD1";'),
    ('const d2 = d1.clone(); d2.position.y = 0.28; d2.scale.setScalar(0.8);',
     'const d2 = d1.clone(); d2.name = "drumD2"; d2.position.y = 0.28; d2.scale.setScalar(0.8);'),
    ('b.position.set(s * 0.5, 1.1, -0.2);\n      b.rotation.z = s * 0.3;',
     'b.name = "bellows" + (s > 0 ? "R" : "L");\n      b.position.set(s * 0.5, 1.1, -0.2);\n      b.rotation.z = s * 0.3;'),
    ('crown.position.y = 2.35;\n    g.add(crown);', 'crown.name = "crown";\n    crown.position.y = 2.35;\n    g.add(crown);'),
    ('petal.rotation.z = -Math.PI / 2;\n      petal.position.y = 0.3;',
     'petal.name = "petal";\n      petal.rotation.z = -Math.PI / 2;\n      petal.position.y = 0.3;'),
    ('drip.position.set(0, 0.4, 0);\n    g.add(drip);', 'drip.name = "drip";\n    drip.position.set(0, 0.4, 0);\n    g.add(drip);'),
    ('const skinTop = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 9), mat(0xd8cbb0));',
     'const skinTop = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 9), mat(0xd8cbb0));\n    skinTop.name = "skin";'),
    ('const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.5, 9), mat(0x68523c));',
     'const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.5, 9), mat(0x68523c));\n    drum.name = "drum";'),
    ('a1.position.y = 0.35; mace.position.y = 0.75;',
     'a1.name = "armHandle"; mace.name = "mace";\n    a1.position.y = 0.35; mace.position.y = 0.75;'),
    ('orb.position.y = 2.38;\n    g.add(orb);', 'orb.name = "orb";\n    orb.position.y = 2.38;\n    g.add(orb);'),
    ('cageTop.position.y = 2.75;\n    g.add(cageTop);', 'cageTop.name = "cageTop";\n    cageTop.position.y = 2.75;\n    g.add(cageTop);'),
]
for old, new in trepl:
    if old not in s:
        misses += 1
        print('MISS-T:', old[:70].replace('\n', ' | '))
    s = s.replace(old, new, 1)

old_t = """  requestUnitBlenderAsset('tower-' + typeKey, g, P.parts);
  return P;"""
new_t = """  requestUnitBlenderAsset('tower-' + typeKey, g, P.parts);
  requestUnitGeometries('tower-' + typeKey + '-parts', g);
  return P;"""
if old_t not in s:
    misses += 1
    print('MISS: tower return block')
s = s.replace(old_t, new_t, 1)

open(p, 'w', encoding='utf-8').write(s)
print('DONE, misses =', misses)
