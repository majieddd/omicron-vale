"""Verify rocks.glb: import, spread the 3 variants apart, render 3/4 view."""
import bpy, sys, os, math
from mathutils import Vector

GLB = sys.argv[-2] if len(sys.argv) >= 2 else "assets/blender/rocks.glb"
OUT = sys.argv[-1]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB)
scn = bpy.context.scene

# spread variants (they all sit at origin in the GLB)
objs = sorted([o for o in scn.objects if o.type == 'MESH'], key=lambda o: o.name)
for i, o in enumerate(objs):
    o.location.x = (i - 1) * 2.0

# ground plane
bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))

# shadows for depth
scn.render.engine = 'BLENDER_WORKBENCH'
sh = scn.display.shading
sh.light = 'STUDIO'
sh.color_type = 'MATERIAL'
sh.show_shadows = True
sh.show_cavity = True
scn.render.resolution_x = 900
scn.render.resolution_y = 600
scn.render.film_transparent = False
scn.world = bpy.data.worlds.new("W")
scn.world.color = (0.75, 0.75, 0.75)

cam = bpy.data.cameras.new("C"); cam.lens = 45
co = bpy.data.objects.new("C", cam)
scn.collection.objects.link(co)
scn.camera = co
co.location = Vector((0.0, -5.8, 3.6))
direc = Vector((0, 0, 0.3)) - co.location
co.rotation_euler = direc.to_track_quat('-Z', 'Y').to_euler()

scn.render.filepath = OUT
scn.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
print("SHOT", OUT)
