"""Geometry helpers for the SCX30 build.

Everything is authored in millimetres at 1/24 scale and converted to metres on
the way into Blender, so the numbers in the build script read like a spec sheet
and the exported GLB is in true real-world units.

No bpy.ops anywhere except the glTF export: operators depend on context that
does not reliably exist in background mode, and every shape here can be built
from bmesh and the data API instead.
"""

import bmesh
import bpy
import math
from mathutils import Matrix, Vector

MM = 0.001


def mm(v):
    return v * MM


# ── Materials ───────────────────────────────────────────────────

def material(name, colour, roughness=0.5, metallic=0.0, alpha=1.0, emission=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND"
    if emission is not None:
        for key in ("Emission Color", "Emission"):
            if key in bsdf.inputs:
                bsdf.inputs[key].default_value = (*emission, 1.0)
                break
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = strength
    return m


# ── bmesh primitives ────────────────────────────────────────────

def _finish(bm, name, mat, parent=None, bevel=None, smooth=False, collection=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if mat:
        me.materials.append(mat)
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    obj = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(obj)
    if parent:
        obj.parent = parent
    if bevel:
        b = obj.modifiers.new("Bevel", "BEVEL")
        b.width = mm(bevel)
        b.segments = 2
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(40)
        b.harden_normals = False
    return obj


def box(name, size, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, parent=None, bevel=0.6, collection=None):
    """size and loc in millimetres; loc is the centre."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    m = (
        Matrix.Translation(Vector((mm(loc[0]), mm(loc[1]), mm(loc[2]))))
        @ Matrix.Rotation(rot[2], 4, "Z")
        @ Matrix.Rotation(rot[1], 4, "Y")
        @ Matrix.Rotation(rot[0], 4, "X")
        @ Matrix.Diagonal((mm(size[0]), mm(size[1]), mm(size[2]), 1.0))
    )
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts)
    return _finish(bm, name, mat, parent, bevel, collection=collection)


def cylinder(name, r, depth, loc=(0, 0, 0), axis="Z", segments=20, mat=None, parent=None,
             bevel=0.3, r_top=None, collection=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=mm(r),
        radius2=mm(r if r_top is None else r_top),
        depth=mm(depth),
    )
    rot = {"Z": Matrix.Identity(4), "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
           "Y": Matrix.Rotation(math.pi / 2, 4, "X")}[axis]
    bmesh.ops.transform(bm, matrix=Matrix.Translation(Vector((mm(loc[0]), mm(loc[1]), mm(loc[2])))) @ rot,
                        verts=bm.verts)
    return _finish(bm, name, mat, parent, bevel, smooth=True, collection=collection)


def add_box(bm, size, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Merge a box into an existing bmesh — used to build one-piece tyres."""
    sub = bmesh.new()
    bmesh.ops.create_cube(sub, size=1.0)
    m = (
        Matrix.Translation(Vector((mm(loc[0]), mm(loc[1]), mm(loc[2]))))
        @ Matrix.Rotation(rot[2], 4, "Z")
        @ Matrix.Rotation(rot[1], 4, "Y")
        @ Matrix.Rotation(rot[0], 4, "X")
        @ Matrix.Diagonal((mm(size[0]), mm(size[1]), mm(size[2]), 1.0))
    )
    bmesh.ops.transform(sub, matrix=m, verts=sub.verts)
    me = bpy.data.meshes.new("_tmp")
    sub.to_mesh(me)
    sub.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def add_cone(bm, r1, r2, depth, loc=(0, 0, 0), axis="Z", segments=20):
    sub = bmesh.new()
    bmesh.ops.create_cone(sub, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=mm(r1), radius2=mm(r2), depth=mm(depth))
    rot = {"Z": Matrix.Identity(4), "X": Matrix.Rotation(math.pi / 2, 4, "Y"),
           "Y": Matrix.Rotation(math.pi / 2, 4, "X")}[axis]
    bmesh.ops.transform(sub, matrix=Matrix.Translation(Vector((mm(loc[0]), mm(loc[1]), mm(loc[2])))) @ rot,
                        verts=sub.verts)
    me = bpy.data.meshes.new("_tmp")
    sub.to_mesh(me)
    sub.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


# ── Curves: wiring, bull bar tubes, shock springs ───────────────

def tube(name, points, radius, mat=None, parent=None, resolution=3, collection=None):
    """A swept tube through points (millimetres). Wires and roll bars."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = mm(radius)
    cu.bevel_resolution = resolution
    cu.resolution_u = 4
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = Vector((mm(p[0]), mm(p[1]), mm(p[2])))
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    if mat:
        cu.materials.append(mat)
    obj = bpy.data.objects.new(name, cu)
    (collection or bpy.context.scene.collection).objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def spring(name, r, length, turns, wire, loc=(0, 0, 0), mat=None, parent=None, collection=None):
    """A real helix, because a shock with a painted-on spring reads as a stick."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = mm(wire)
    cu.bevel_resolution = 2
    cu.resolution_u = 3
    steps = int(turns * 10)
    sp = cu.splines.new("POLY")
    sp.points.add(steps)
    for i in range(steps + 1):
        t = i / steps
        a = t * turns * math.tau
        sp.points[i].co = (
            mm(loc[0] + math.cos(a) * r),
            mm(loc[1] + math.sin(a) * r),
            mm(loc[2] - length / 2 + t * length),
            1.0,
        )
    if mat:
        cu.materials.append(mat)
    obj = bpy.data.objects.new(name, cu)
    (collection or bpy.context.scene.collection).objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def text_mesh(name, body, size, mat=None, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), collection=None):
    """Font curve converted to mesh — real geometry for the RUBICON marking."""
    cu = bpy.data.curves.new(name + "_f", "FONT")
    cu.body = body
    cu.size = mm(size)
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = mm(0.15)
    tmp = bpy.data.objects.new(name + "_tmp", cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    bpy.data.curves.remove(cu)
    if mat:
        me.materials.append(mat)
    obj = bpy.data.objects.new(name, me)
    obj.location = (mm(loc[0]), mm(loc[1]), mm(loc[2]))
    obj.rotation_euler = rot
    (collection or bpy.context.scene.collection).objects.link(obj)
    if parent:
        obj.parent = parent
    return obj


def empty(name, loc=(0, 0, 0), parent=None, collection=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = mm(20)
    obj.location = (mm(loc[0]), mm(loc[1]), mm(loc[2]))
    (collection or bpy.context.scene.collection).objects.link(obj)
    if parent:
        obj.parent = parent
    return obj
