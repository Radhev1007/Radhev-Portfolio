"""
Render the SCX30 from the nine angles the reference set covers.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/render_scx30.py
"""
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_scx30  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", ".renders"))

TARGET = Vector((0, 0, 0.035))

# Distances are in metres against a 152 mm truck.
VIEWS = [
    ("01-side", (0.40, 0.0, 0.045), True),
    ("02-front", (0.0, 0.40, 0.050), True),
    ("03-front-34", (0.27, 0.26, 0.125), True),
    ("04-rear", (0.0, -0.40, 0.050), True),
    ("05-rear-34", (-0.26, -0.27, 0.125), True),
    ("06-top", (0.0, -0.012, 0.40), True),
    ("07-low-front", (0.145, 0.30, 0.026), True),
    ("08-low-side", (0.38, 0.07, 0.020), True),
    ("09-chassis", (0.11, 0.19, -0.17), False),
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
    sc.render.resolution_x = 1000
    sc.render.resolution_y = 760
    sc.world = bpy.data.worlds.new("W")
    sc.world.use_nodes = True
    sc.world.node_tree.nodes["Background"].inputs[0].default_value = (0.62, 0.64, 0.68, 1)
    sc.world.node_tree.nodes["Background"].inputs[1].default_value = 1.5

    me = bpy.data.meshes.new("Ground")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bm.to_mesh(me)
    bm.free()
    mat = bpy.data.materials.new("GroundMat")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.78, 0.78, 0.79, 1)
    me.materials.append(mat)
    ground = bpy.data.objects.new("Ground", me)
    bpy.context.scene.collection.objects.link(ground)

    for name, loc, energy in (("Key", (0.30, 0.36, 0.42), 26), ("Fill", (-0.36, 0.18, 0.26), 10),
                              ("Rim", (-0.12, -0.42, 0.30), 14)):
        ld = bpy.data.lights.new(name, "AREA")
        ld.energy = energy
        ld.size = 0.35
        ob = bpy.data.objects.new(name, ld)
        ob.location = loc
        ob.rotation_euler = (TARGET - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.collection.objects.link(ob)

    cam_d = bpy.data.cameras.new("Cam")
    cam_d.lens = 62
    cam_d.clip_start = 0.005
    cam = bpy.data.objects.new("Cam", cam_d)
    bpy.context.scene.collection.objects.link(cam)
    sc.camera = cam
    return cam, ground


def main():
    build_scx30.main(export_levels=())
    cam, ground = setup()
    os.makedirs(OUT, exist_ok=True)
    for name, loc, show_ground in VIEWS:
        ground.hide_render = not show_ground
        cam.location = Vector(loc)
        cam.rotation_euler = (TARGET - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.render.filepath = os.path.join(OUT, name + ".png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", name)


main()
