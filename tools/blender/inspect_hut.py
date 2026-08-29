"""Inspect hut.glb: load it fresh in Blender and print each object's world bbox.
Run: blender --background --python tools/blender/inspect_hut.py"""
import bpy, os

GLB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "assets", "blender", "hut.glb")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))

for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        bpy.context.view_layer.update()
        # world bbox
        corners = [o.matrix_world @ __import__('mathutils').Vector(c) for c in o.bound_box]
        mins = [min(c[i] for c in corners) for i in range(3)]
        maxs = [max(c[i] for c in corners) for i in range(3)]
        print(f"OBJ {o.name} mat={o.data.materials[0].name if o.data.materials else '?'} "
              f"verts={len(o.data.vertices)} "
              f"bbox=({mins[0]:.2f},{mins[1]:.2f},{mins[2]:.2f})..({maxs[0]:.2f},{maxs[1]:.2f},{maxs[2]:.2f}) "
              f"size=({maxs[0]-mins[0]:.2f},{maxs[1]-mins[1]:.2f},{maxs[2]-mins[2]:.2f})")
print("DONE")
