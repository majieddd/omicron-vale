"""Render hut.glb from 4 canonical angles using Workbench (flat, no lights needed).
Run: blender --background --factory-startup --python tools/blender/render_views.py
Writes docs/shots/blender_views/*.png"""
import bpy, math, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
GLB = os.path.join(ROOT, "assets", "blender", "hut.glb")
OUT = os.path.join(ROOT, "docs", "shots", "blender_views")
os.makedirs(OUT, exist_ok=True)

# clean scene
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))

scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'FLAT'
scene.display.shading.color_type = 'MATERIAL'
scene.render.resolution_x = 800
scene.render.resolution_y = 600
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("w")

# compute combined bbox to frame the camera
mins = [1e9]*3; maxs = [-1e9]*3
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        bpy.context.view_layer.update()
        for c in o.bound_box:
            w = o.matrix_world @ __import__('mathutils').Vector(c)
            for i in range(3):
                mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
ctr = __import__('mathutils').Vector([(mins[i]+maxs[i])/2 for i in range(3)])
size = max(maxs[i]-mins[i] for i in range(3))
print("BBOX", mins, maxs, "ctr", ctr, "size", size)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

def shoot(name, direction):
    d = __import__('mathutils').Vector(direction).normalized()
    cam.location = __import__('mathutils').Vector(ctr) + d * size * 1.9
    look = ctr - cam.location
    cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
    cam_data.lens = 40
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print("SHOT", name)

shoot("front", (0, 0, 1))        # looking at the +Z gable? (0,0,1) dir = camera on +Z side... careful: vector from center
shoot("side",  (1, 0, 0))
shoot("three4",(1, 0.6, 1))
shoot("top",   (0, 1, 0))
print("DONE")
