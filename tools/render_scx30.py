"""
Render the SCX30 from the angles the reference set covers, for comparison.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/render_scx30.py
"""
import math
import os
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_scx30  # noqa: F401,E402  (building is the import's whole purpose)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", ".renders"))

VIEWS = [
    ("01-side", (0.62, 0.0, 0.07), 0.0),
    ("02-front-34", (0.42, 0.40, 0.20), 0.0),
    ("03-front", (0.0, 0.60, 0.09), 0.0),
    ("04-rear-34", (-0.40, -0.42, 0.20), 0.0),
    ("05-top", (0.0, -0.02, 0.62), 0.0),
    ("06-low-front", (0.22, 0.44, 0.045), 0.0),
    ("07-crawl", (0.34, 0.30, 0.10), 0.0),
]


def setup():
    sc = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            sc.render.engine = engine
            break
        except TypeError:
            continue
    print("ENGINE", sc.render.engine)
    sc.render.resolution_x = 900
    sc.render.resolution_y = 700
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.64, 0.68, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.6

    # Ground, so the truck is not floating in a void.
    me = bpy.data.meshes.new("Ground")
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.5)
    bm.to_mesh(me)
    bm.free()
    mat = bpy.data.materials.new("GroundMat")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
    me.materials.append(mat)
    g = bpy.data.objects.new("Ground", me)
    bpy.context.scene.collection.objects.link(g)

    for name, loc, energy in (("Key", (0.5, 0.6, 0.7), 120), ("Fill", (-0.6, 0.3, 0.4), 45),
                              ("Rim", (-0.2, -0.7, 0.5), 60)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = 0.6
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        ob.rotation_euler = (Vector((0, 0, 0.055)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(ob)

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 68
    cam = bpy.data.objects.new("Cam", cam_d)
    bpy.context.scene.collection.objects.link(cam)
    sc.camera = cam
    return cam


def main():
    cam = setup()
    os.makedirs(OUT, exist_ok=True)
    target = Vector((0, 0, 0.055))
    for name, loc, _ in VIEWS:
        cam.location = Vector(loc)
        cam.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.render.filepath = os.path.join(OUT, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", name)


main()
