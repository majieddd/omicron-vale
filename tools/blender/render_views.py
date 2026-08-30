"""Render any GLB from 4 canonical angles (Workbench FLAT).
Usage: blender --background --python render_views.py -- <in.glb> <outdir> [prefix]
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
GLB = argv[0] if argv else 'hut.glb'
OUTDIR = argv[1] if len(argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs', 'shots', 'blender_views')
PREFIX = argv[2] if len(argv) > 2 else 'v'
os.makedirs(OUTDIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
scn.render.engine = 'BLENDER_WORKBENCH'
scn.render.resolution_x = 1280
scn.render.resolution_y = 800
scn.view_settings.view_transform = 'Standard'
sh = scn.display.shading
sh.light = 'FLAT'
sh.color_type = 'MATERIAL'
sh.show_shadows = False
try:
    sh.show_outline = True
    sh.outline_color = (0.08, 0.08, 0.08)
except Exception:
    pass

bpy.ops.import_scene.gltf(filepath=GLB)

# bbox over all mesh objects
mins = Vector((1e9,)*3); maxs = Vector((-1e9,)*3)
for ob in bpy.data.objects:
    if ob.type == 'MESH':
        for c in ob.bound_box:
            w = ob.matrix_world @ Vector(c)
            mins = Vector(map(min, mins, w)); maxs = Vector(map(max, maxs, w))
ctr = (mins + maxs) / 2
size = max(maxs - mins)
print("BBOX", tuple(round(v, 2) for v in mins), tuple(round(v, 2) for v in maxs))

cam = bpy.data.cameras.new("c"); cam.lens = 45
cam_ob = bpy.data.objects.new("cam", cam)
bpy.context.collection.objects.link(cam_ob)
scn.camera = cam_ob

VIEWS = {
  'front':  Vector((0, -1.0, 0.28)),    # gable end (front door side)
  'side':   Vector((1.0, 0, 0.28)),
  'three4': Vector((0.8, -0.75, 0.45)),
  'top':    Vector((0.05, 0.05, 1.0)),
}
for nm, dv in VIEWS.items():
    dv = dv.normalized()
    dist = size * 3.0
    cam_ob.location = ctr + dv * dist
    look = (ctr - cam_ob.location).to_track_quat('-Z', 'Y')
    cam_ob.rotation_euler = look.to_euler()
    scn.render.filepath = os.path.join(OUTDIR, f"{PREFIX}_{nm}.png")
    bpy.ops.render.render(write_still=True)
    print("SHOT", nm)
print("DONE")
