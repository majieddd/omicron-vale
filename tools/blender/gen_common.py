"""
Omicron Willow Vale: shared Blender asset helpers (headless).
Conventions:
  - Author geometry with Y = up, X = width (right), Z = depth (fwd/back).
    Blender is Z-up, so remap at mesh creation: bpy_vert = (x, -z, y).
  - Each exported NODE is named <part key>; geometry baked so the local
    frame matches the game part (pivot at part origin, geometry around it).
  - Materials carry names the game maps to canvas textures (see TEX_BY_MAT).
"""
import bpy, math, random
from mathutils import Vector, Euler

__all__ = ['reset_scene', 'material', 'box', 'sphere', 'lathe', 'cone2',
           'cone_frustum', 'cylinder', 'merge_objs', 'recenter', 'export_glb',
           'transform', '_mesh_obj']

# ---------------------------------------------------------------- scene reset
def reset_scene():
    _MATS.clear()  # materials die with the scene; never cache across resets
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'FLAT'
    scn.display.shading.color_type = 'MATERIAL'
    scn.world = bpy.data.worlds.new("W")

# ---------------------------------------------------------------- materials
_MATS = {}
def material(name, color, rough=1.0, metal=0.0, emissive=None, emis_str=0.0):
    name = 'mat_' + name
    if name in _MATS: return _MATS[name]
    m = bpy.data.materials.new(name)
    try:
        m.name = name.replace('mat_', '')  # glTF stores the material name; game maps it
    except Exception:
        pass
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emissive is not None:
        bsdf.inputs["Emission Color"].default_value = (*emissive, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emis_str
    m.diffuse_color = (*color, 1.0)
    _MATS[name] = m
    return m

# ---------------------------------------------------------------- mesh core
def _mesh_obj(name, verts, faces, mat):
    bv = [Vector((v[0], -v[2], v[1])) for v in verts]  # Y-up author -> Z-up Blender
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in bv], [], faces)
    me.validate()
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    if mat: ob.data.materials.append(mat)
    _weld(ob)
    return ob

def _weld(ob):
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    try:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.0006)
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception:
        try: bpy.ops.object.mode_set(mode='OBJECT')
        except Exception: pass

def _rotv(rot, v):
    return rot.to_matrix() @ Vector(v)

# ---------------------------------------------------------------- primitives
def box(name, mat, cx, cy, cz, sx, sy, sz, rx=0.0, ry=0.0, rz=0.0):
    hx, hy, hz = sx/2, sy/2, sz/2
    rot = Euler((rx, ry, rz), 'XYZ')
    def a(x, y, z):
        p = _rotv(rot, (x, y, z))
        return (cx + p.x, cy + p.y, cz + p.z)
    v = [a(-hx,-hy,-hz), a(hx,-hy,-hz), a(hx,hy,-hz), a(-hx,hy,-hz),
         a(-hx,-hy,hz), a(hx,-hy,hz), a(hx,hy,hz), a(-hx,hy,hz)]
    f = [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    return _mesh_obj(name, v, f, mat)

def sphere(name, mat, cx, cy, cz, r, sx=1.0, sy=1.0, sz=1.0, seg=10, rings=8,
           noise=0.0, seed=1):
    rnd = random.Random(seed)
    vs, fs = [], []
    for i in range(1, rings):
        th = i / rings * math.pi
        for j in range(seg):
            ph = j / seg * math.pi * 2
            n = 1.0 + (rnd.random() - 0.5) * 2 * noise
            x = r * n * math.sin(th) * math.cos(ph) * sx
            y = r * n * math.cos(th) * sy
            z = r * n * math.sin(th) * math.sin(ph) * sz
            vs.append((cx + x, cy + y, cz + z))
    top = len(vs); vs.append((cx, cy + r * sy, cz))
    bot = len(vs); vs.append((cx, cy - r * sy, cz))
    def vi(i, j): return (i - 1) * seg + j
    for i in range(1, rings - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            fs.append((vi(i, j), vi(i, j2), vi(i + 1, j2), vi(i + 1, j)))
    for j in range(seg):
        j2 = (j + 1) % seg
        fs.append((top, vi(1, j2), vi(1, j)))
        fs.append((bot, vi(rings - 1, j), vi(rings - 1, j2)))
    return _mesh_obj(name, vs, fs, mat)

def make_verts(pts, n):
    """Helper: pts = list of (x,y,z) in author space."""
    return pts

def transform(verts, cx, cy, cz, rx=0.0, ry=0.0, rz=0.0):
    rot = Euler((rx, ry, rz), 'XYZ')
    out = []
    for v in verts:
        p = _rotv(rot, v)
        out.append((cx + p.x, cy + p.y, cz + p.z))
    return out

def lathe(name, mat, profile, seg=10, noise=0.0, seed=7, rx=0.0, ry=0.0, rz=0.0,
          cx=0.0, cy=0.0, cz=0.0):
    """profile: list of (radius, height) bottom->top. Revolving body of revolution."""
    rnd = random.Random(seed)
    vs, fs = [], []
    n = len(profile)
    for (r, y) in profile:
        for j in range(seg):
            ph = j / seg * math.pi * 2
            nz = 1.0 + (rnd.random() - 0.5) * 2 * noise
            vs.append((math.cos(ph) * r * nz, y, math.sin(ph) * r * nz))
    for i in range(n - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            fs.append((i * seg + j, i * seg + j2, (i + 1) * seg + j2, (i + 1) * seg + j))
    fs.append(tuple(range(seg))[::-1])
    fs.append(tuple(range((n - 1) * seg, n * seg)))
    vs = transform(vs, cx, cy, cz, rx, ry, rz)
    return _mesh_obj(name, vs, fs, mat)

def cone2(name, mat, cx, cy, cz, r, h, seg=6, rx=0.0, ry=0.0, rz=0.0, noise=0.0, seed=1):
    return lathe(name, mat, [(r, 0.0), (0.0001, h)], seg=seg, rx=rx, ry=ry, rz=rz,
                 cx=cx, cy=cy, cz=cz, noise=noise, seed=seed)

def cone_frustum(name, mat, cx, cy, cz, r_bot, r_top, h, seg=6, rx=0.0, ry=0.0, rz=0.0):
    return lathe(name, mat, [(r_bot, 0.0), (r_top, h)], seg=seg, rx=rx, ry=ry, rz=rz,
                 cx=cx, cy=cy, cz=cz)

def cylinder(name, mat, cx, cy, cz, r_top, r_bot, h, seg=8, rx=0.0, ry=0.0, rz=0.0,
             noise=0.0, seed=3):
    return lathe(name, mat, [(r_bot, 0.0), (r_top, h)], seg=seg, noise=noise,
                 seed=seed, rx=rx, ry=ry, rz=rz, cx=cx, cy=cy, cz=cz)

# ---------------------------------------------------------------- geometry utils
def merge_objs(name, objs):
    """Join meshes into one object, preserving materials."""
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    ob.data.name = name
    return ob

def recenter(ob, cx, cy, cz):
    """Move geometry to origin; position the node at the pivot.
    Author coords (Y-up) -> Blender (x, -z, y)."""
    from mathutils import Matrix
    piv = Vector((cx, -cz, cy))
    ob.data.transform(Matrix.Translation(-piv))
    ob.location = piv
    return ob

def export_glb(out):
    """Export the whole scene as GLB (each object = named node)."""
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB',
                              use_selection=False, export_apply=True,
                              export_yup=True, export_normals=True,
                              export_materials='EXPORT')
