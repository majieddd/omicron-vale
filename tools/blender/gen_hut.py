"""
Omicron Willow Vale: Blender asset generator - hut (headless, v2).
Run: blender.exe --background --python tools/blender/gen_hut.py

ALL geometry built from explicit vertex coordinates (from_pydata): no
primitives, no scale/rotate baking, no axis ambiguity. Wall + gable are ONE
watertight prism; roof slabs and soffits are boxes with mathematically exact
corners; ridge is a 6-gon prism. Guaranteed connected.
"""
import bpy
import math
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
OUT_DIR = os.path.join(ROOT, "assets", "blender")
os.makedirs(OUT_DIR, exist_ok=True)

PAL = {
    "thatch": (0.788, 0.694, 0.525),
    "wood":   (0.659, 0.525, 0.361),
    "stone":  (0.631, 0.616, 0.549),
}

def make_material(name, rgb):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (rgb[0], rgb[1], rgb[2], 1.0)
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (rgb[0], rgb[1], rgb[2], 1.0)
        bsdf.inputs["Roughness"].default_value = 1.0
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.0
    return m

def mesh_from_verts_faces(name, verts, faces, mat):
    # CRITICAL: Blender is Z-up. Build verts as (x, y=height, z=depth) then
    # remap to Blender (x, -z, y) so the glTF exporter emits Y-up correctly:
    # glTF (X, Y, Z) = (x, height, depth). Without this the hut exports
    # lying on its side in the game.
    verts = [(x, -z, y) for (x, y, z) in verts]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob

# ---- primitives from explicit geometry ----

def box(name, cx, cy, cz, sx, sy, sz, mat):
    """Axis-aligned box centered at (cx,cy,cz) with full sizes sx,sy,sz."""
    x0, x1 = cx - sx / 2, cx + sx / 2
    y0, y1 = cy - sy / 2, cy + sy / 2
    z0, z1 = cz - sz / 2, cz + sz / 2
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh_from_verts_faces(name, v, f, mat)

def prism_xz(name, profile, y0, y1, mat):
    """Profile loop of (x,y) points extruded along Z from y0..y1 (weld: one mesh).
    Returns the box-like solid: cap A at z=y0, cap B at z=y1."""
    n = len(profile)
    v = [(x, y, z) for (x, y) in profile for z in (y0, y1)]
    faces = []
    # side quads
    for i in range(n):
        a, b = i, (i + 1) % n
        faces.append((a * 2, a * 2 + 1, b * 2 + 1, b * 2))
    # caps (fan; profiles are convex polygons here)
    faces.append(tuple(range(0, n * 2, 2)))            # cap at z0 (CCW)
    faces.append(tuple(range(1, n * 2 + 1, 2))[::-1])  # cap at z1 (reversed)
    return mesh_from_verts_faces(name, v, faces, mat)

def rot_z(points, cx, cy, ang):
    """Rotate 2D points (x,y) about (cx,cy) by ang (radians)."""
    c, s = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for (x, y) in points]

def rotated_box(name, cx, cy, cz, sx, sy, sz, ang, mat):
    """Box centered at (cx,cy) in XY, rotated about the Z axis by ang,
    extruded along Z from cz-sz/2..cz+sz/2. NOTE: hut roof tilts about Y
    (slope along X) -> pass angle for X-slope via XY rotation of profile."""
    # Build in "roof space": slab runs along X (length sl), thickness Y, depth Z.
    hx, hy = sx / 2, sy / 2
    prof = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
    prof = rot_z(prof, 0, 0, ang)
    v = [(px + cx, py + cy, cz - sz / 2) for (px, py) in prof] + \
        [(px + cx, py + cy, cz + sz / 2) for (px, py) in prof]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh_from_verts_faces(name, v, f, mat)

def ridge_bar(name, r, depth, cy, cz, mat):
    """6-gon ridge along Z at (0, cy, cz)."""
    v = []
    n = 6
    for k in range(2):
        z = cz + (depth / 2 if k else -depth / 2)
        for i in range(n):
            a = (i + 0.5) / n * math.tau  # flat-top hexagon
            v.append((r * math.cos(a), cy + r * math.sin(a), z))
    f = []
    for i in range(n):
        a, b = i, (i + 1) % n
        f.append((a, b, b + n, a + n))
    f.append(tuple(range(n)))
    f.append(tuple(range(2 * n - 1, n - 1, -1)))
    return mesh_from_verts_faces(name, v, f, mat)

def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    return o

def finalize(o):
    # consistent normals + flat shade (painterly faceted look)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_flat()

# ---------- build ----------
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob, do_unlink=True)

W, D, H = 6.4, 4.6, 2.6
roofH = 1.9
overX = 0.9          # eave overhang each side (width dir)
overZ = 0.8          # gable overhang each end (depth dir)
tilt = math.atan2(roofH, W * 0.5)      # slope angle of roof slabs

wood = make_material("wood", PAL["wood"])
thatch = make_material("thatch", PAL["thatch"])
stone = make_material("stone", PAL["stone"])

parts = {"wood": [], "thatch": [], "stone": []}

# 1) walls + gable: ONE pentagon prism (watertight, apex up)
pent = [(-W / 2, 0), (W / 2, 0), (W / 2, H), (0, H + roofH + 0.16), (-W / 2, H)]
parts["wood"].append(prism_xz("walls_gable", pent, -D / 2, D / 2, wood))

# 2) roof slabs: exact rotated boxes meeting at the ridge (0, H+roofH)
sl_len = math.hypot(W / 2 + overX, roofH)
slcx = (W / 2 + overX) / 2           # center of slab run from eave to ridge
for s in (-1, 1):
    ang = -s * tilt                    # +X end of right slab = eave (lower)
    midx = s * slcx + s * 0.05         # shift past x=0 so slabs overlap at ridge
    midy = (H + (H + roofH)) / 2 + 0.06
    slab = rotated_box(f"roof{s}", midx, midy, 0, sl_len, 0.42, D + 2 * overZ, ang, thatch)
    parts["thatch"].append(slab)
    # soffit: wood board tucked under eave, closing the wall->roof gap
    soff = box(f"soffit{s}", s * W * 0.19, H + 0.06, 0, W * 0.55, 0.10, D + 0.8, wood)
    parts["wood"].append(soff)

# 3) ridge cap
parts["thatch"].append(ridge_bar("ridge", 0.46, D + 2 * overZ, H + roofH + 0.10, 0, thatch))

# 4) chimney (stone, proud of roof): sits through roof on -X side
parts["stone"].append(box("chimney", -1.9, H + roofH * 0.78, -0.55, 0.8, 1.7, 0.8, stone))

# 5) door + frame (front +Z), window + frame
parts["stone"].append(box("door", 1.10, 0.92, D / 2 + 0.03, 1.10, 1.80, 0.14, stone))
parts["wood"].append(box("doorframe", 1.10, 1.00, D / 2 - 0.01, 1.35, 2.00, 0.10, wood))
parts["stone"].append(box("window", -1.60, 1.50, D / 2 + 0.02, 0.90, 0.70, 0.10, stone))
parts["wood"].append(box("windowframe", -1.60, 1.50, D / 2 - 0.02, 1.10, 0.90, 0.08, wood))

merged = []
for group, objs in parts.items():
    o = join("hut_" + group, objs)
    finalize(o)
    merged.append(o)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT_DIR, "hut.glb"),
    export_format='GLB',
    use_selection=False,
    export_apply=True,
)
print("WROTE hut.glb v2")
