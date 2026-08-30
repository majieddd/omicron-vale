# Blender Asset Pipeline

## Why

The procedural meshes are built from separate primitives (spheres, boxes,
cones) stacked with transforms. The close-up screenshots exposed the failure
mode: parts that LOOK disconnected because they are separate shells that
overlap or float:

- Hut roof overhangs the wall box with a visible gap under the eave (no
  soffit/underside).
- Lumen Hearth lamp guard reads as a white "column" when bloom bleeds through
  the gap between guard and pillar (seen at gameplay distance).
- Mist puff sprites read as white rocks lying on the ground rather than fog.

Blender assets fix the class of problem: one watertight mesh per part,
explicit socket joints, real UV seams (or baked vertex colors), and
intentional eave/soffit geometry.

## Pipeline

1. `tools/blender/make_assets.py`  -  headless Blender job (run with
   `blender --background --python tools/blender/make_assets.py`).
   Builds each asset from primitives, then:
   - `bpy.ops.object.join()` parts per asset (roof+walls, lamp+guard, ...)
   - `bmesh.ops.remove_doubles()` to weld coincident verts
   - same palette constants as src/00_util.mjs (hardcoded RGB in the script)
   - flat shading + vertex colors (painterly style has no smooth normals)
   - export GLB (`export_scene.gltf(filepath, export_format='GLB',
     export_colors=True, export_apply=True)`)
2. `src/09_assets.mjs`  -  loads GLB via THREE.GLTFLoader from
   `assets/*.glb` (dev server) OR from the base64 payload fused into
   play.html (release). Registers material names so the game's animation
   factory looks up parts by name (torso, head, legL, ...).
3. `src/04_props.mjs` / `src/05_units.mjs`  -  get `makeAsset(name)` that
   builds from the GLB if available; fall back to procedural primitives if
   not (the game must never regress to broken just because an asset is
   missing).
4. `build.mjs`  -  inlines `assets/*.glb` as base64 data (single-file
   guarantee kept: no external refs).

## Palette (same as game, for bpy constants)

skyTop 0xcdc8b4, skyMid 0xdcd6bd, skyHorizon 0xeee8cd, cloud 0xf0ead2
grassHi 0x9aa563, grass 0x8a9558, grassLo 0x6e7a46
dirt 0xcdbb8b, dirtDark 0xa48e5f
stone 0xd3cfc0, stoneLo 0xa19d8c, stoneDk 0x7d796a
thatch 0xc9b186, thatchLo 0xa88f66
wood 0xa8865c, woodLo 0x7a6040, woodDk 0x5e4830
willowHi 0xd4dfa8, willow 0xb4c67c, willowLo 0x8da05e
leaf 0x94a468, leafLo 0x6f7f4c, leafHi 0xb2c288

## Asset list (priority order)

1. hut (roof + walls + gables + door + window + chimney, one watertight
   mesh per material group)
2. rock clusters / boulders (welded, no floating facets)
3. willow (trunk + strand curtain, merged strand mesh - game already
   batches leaves)
4. Lumen Hearth (base + pillar + guard + lantern; guard fully enclosed,
   no hole for bloom to bleed through)
5. Storm Drum (drum + tuning pegs + feet; feet sockets flush with drum)
6. Ember Forge (anvil + hearth + chimney)
7. Willow Warden (bow + wire + tower body)
8. Frostbloom Totem (stem + petals + crown ring)
9. enemies (wisp/beetle/ember/stalker/grunt/boss) as SKELETAL parts
   matching the animation factory's named parts

## Verification (per asset)

- glb loads, no box-in-box gaps at joint sockets (close-up screenshot,
  several angles)
- no external refs in play.html (build gate)
- full 3-wave campaign still wins, zero console errors
- no quality regression vs procedural build (side-by-side screenshot)
