"""
Build the Axial SCX30 Jeep Wrangler JLU and export it as a glTF binary.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/build_scx30.py

PROPORTION LOCK — millimetres, 1/30 scale.

Overall figures are Axial's published specification for AXI-2261:

    overall length   152        scale            1/30
    overall width     70        motor            88T brushed
    overall height    70        drivetrain       4WD

Axial does not publish a wheelbase, track or tyre size, so those are read off
the reference photographs in proportion to the published 152 mm length and
written down here. Everything else derives from them. These numbers are the
contract: nothing downstream rescales the truck by eye.

    wheelbase         91        tyre diameter    31
    track             56        tyre width       12
    body (hard) width 60        rim diameter     17
    belt line         42        ground clearance 13
    roof              58        hard body length 122

Platform features the specification calls out, and where they are in here:
ramped axle housings and high-clearance rear links (`build_axle`), angled skid
plate and low-mounted electronics (`build_chassis`), Black Rhino Atlas wheels
and Yokohama Geolandar X-MT tyres (`rim_mesh`, `tyre_mesh`), ICON Pro Series
tube bumpers front and rear (`build_body`, `build_rear`), front and rear LEDs.

The model faces +Y in Blender, which the glTF exporter turns into -Z: the same
forward axis the game's driving code uses.
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scx30_lib  # noqa: E402
from scx30_lib import (  # noqa: E402
    add_box, add_cone, box, cylinder, empty, loft, material, mm, profile, sphere, spring,
    text_mesh, tube,
)
import bmesh  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.abspath(os.path.join(HERE, "..", "public", "models"))

# ── Proportion lock ─────────────────────────────────────────────
OVERALL_L = 152.0
OVERALL_W = 70.0
OVERALL_H = 70.0

WB = 91.0
TRACK = 56.0
# A scale 36-inch tyre. The first pass used 38 mm, which at 1/30 is a scale
# 45-inch — monster truck, not crawler — and it was swallowing the body.
TYRE_D = 31.0
TYRE_R = TYRE_D / 2
TYRE_W = 12.0
RIM_R = 8.6

BODY_W = 60.0         # hard body across the doors
FLARE_X = 35.0        # outer face of the flares
SILL_Z = 19.0         # underside of the tub
BELT_Z = 42.0         # bottom of the side glass
ROOF_Z = 56.0         # underside of the hardtop
ROOF_TOP = 59.0
RACK_TOP = 70.0
HOOD_Z = 44.5         # bonnet panel, which the fender pods stand above
NOSE_Y = 62.0         # grille face
TAIL_Y = -60.0        # tailgate
COWL_Y = 29.0         # base of the windscreen
SCREEN_TOP_Y = 18.0   # 36 degrees of rake, as a JL has
GRILLE_X = 13.0       # half-width of the grille
FENDER_X = 22.0       # centre of each raised front fender pod
AXLE_F = WB / 2
AXLE_R = -WB / 2

# ── Detail levels ───────────────────────────────────────────────
# "high" feeds the garage, the inspector and the display plinth; "game" feeds
# the vehicle being driven. The difference is tessellation and whether the
# small parts exist at all — not a decimated copy of the same mesh, which on
# bevelled hard-surface geometry only ever looks broken.
LEVELS = {
    "high": {"cyl": 32, "tyre": 48, "lugs": 24, "bevel_seg": 3, "micro": True, "file": "scx30.glb"},
    "game": {"cyl": 18, "tyre": 28, "lugs": 16, "bevel_seg": 2, "micro": False, "file": "scx30-game.glb"},
}
D = LEVELS["high"]

# ── Materials ───────────────────────────────────────────────────
WHITE = material("BodyWhite", (0.90, 0.90, 0.895), roughness=0.26)
BLACK = material("BlackPlastic", (0.035, 0.035, 0.04), roughness=0.58)
SATIN = material("BlackSatin", (0.02, 0.02, 0.024), roughness=0.4)
RUBBER = material("Rubber", (0.028, 0.028, 0.03), roughness=0.94)
METAL = material("Metal", (0.4, 0.41, 0.44), roughness=0.3, metallic=0.9)
CHROME = material("Chrome", (0.72, 0.73, 0.76), roughness=0.17, metallic=1.0)
GLASS = material("Glass", (0.012, 0.016, 0.022), roughness=0.06, alpha=0.86)
ORANGE = material("Orange", (0.72, 0.13, 0.025), roughness=0.34)
RED = material("Red", (0.6, 0.05, 0.03), roughness=0.4)
LENS = material("Lens", (0.96, 0.96, 0.94), roughness=0.06,
                emission=(1.0, 0.98, 0.93), strength=3.4)
TAIL = material("TailLens", (0.48, 0.03, 0.02), roughness=0.18,
                emission=(1.0, 0.1, 0.05), strength=1.3)
GREEN = material("ServoLabel", (0.45, 0.78, 0.1), roughness=0.4)
WIRE_R = material("WireRed", (0.52, 0.04, 0.03), roughness=0.5)
WIRE_K = material("WireBlack", (0.025, 0.025, 0.025), roughness=0.5)
WIRE_O = material("WireOrange", (0.82, 0.33, 0.03), roughness=0.5)


def clear_scene(keep_rig=True):
    keep = {o.name for o in bpy.data.objects if o.type in {"CAMERA", "LIGHT"}} if keep_rig else set()
    for ob in list(bpy.data.objects):
        if ob.name not in keep:
            bpy.data.objects.remove(ob)
    for coll in (bpy.data.meshes, bpy.data.curves):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)


# ── Tyre: Yokohama Geolandar X-MT ───────────────────────────────

def tyre_mesh():
    """
    The X-MT's signature is a two-stage tread: chunky alternating centre blocks
    and very large shoulder lugs that wrap right over onto the sidewall, so the
    tyre reads as aggressive from the side and not only from above. Built as
    one merged mesh and bevelled as a whole, so every block is rounded without
    costing a modifier each.
    """
    bm = bmesh.new()
    seg = D["tyre"]

    # Carcass with a slight sidewall bulge.
    add_cone(bm, TYRE_R - 2.1, TYRE_R - 2.1, TYRE_W - 1.8, axis="X", segments=seg)
    for x in (-(TYRE_W / 2) + 1.2, (TYRE_W / 2) - 1.2):
        add_cone(bm, TYRE_R - 3.6, TYRE_R - 4.6, 1.4, loc=(x, 0, 0), axis="X", segments=seg)

    rows = D["lugs"]
    for i in range(rows):
        a = (i / rows) * math.tau

        # Centre blocks, two rows offset half a pitch from each other.
        for x, phase in ((-2.2, 0.0), (2.2, math.pi / rows)):
            ang = a + phase
            add_box(
                bm,
                (3.4, 3.0, 1.9),
                loc=(x, math.sin(ang) * (TYRE_R - 1.0), math.cos(ang) * (TYRE_R - 1.0)),
                rot=(-ang, 0, 0),
            )

        # Shoulder lugs: taller, wider, and carried over the sidewall.
        for x in (-4.6, 4.6):
            ang = a + math.pi / rows / 2
            add_box(
                bm,
                (2.6, 3.6, 2.2),
                loc=(x, math.sin(ang) * (TYRE_R - 1.3), math.cos(ang) * (TYRE_R - 1.3)),
                rot=(-ang, 0, 0),
            )
            add_box(
                bm,
                (1.5, 2.8, 1.7),
                loc=(x * 1.28, math.sin(ang) * (TYRE_R - 2.9), math.cos(ang) * (TYRE_R - 2.9)),
                rot=(-ang, 0, 0),
            )

    me = bpy.data.meshes.new("Tyre")
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    me.materials.append(RUBBER)
    return me


# ── Wheel: Black Rhino Atlas ────────────────────────────────────

def rim_mesh():
    """
    Atlas-style: a stepped outer lip, a dished face set back from it, a ring of
    round lightening holes and a raised centre cap. Not a disc.
    """
    bm = bmesh.new()
    seg = D["cyl"]
    face_x = TYRE_W / 2 - 1.0

    add_cone(bm, RIM_R, RIM_R, TYRE_W + 0.4, axis="X", segments=seg)          # barrel
    add_cone(bm, RIM_R + 1.3, RIM_R + 1.3, 1.5, loc=(face_x, 0, 0), axis="X", segments=seg)  # lip
    add_cone(bm, RIM_R + 1.3, RIM_R + 1.3, 1.2, loc=(-face_x, 0, 0), axis="X", segments=seg)
    add_cone(bm, RIM_R - 0.4, RIM_R - 0.4, 1.4, loc=(face_x - 1.6, 0, 0), axis="X", segments=seg)  # dish
    add_cone(bm, 2.6, 2.2, 2.2, loc=(face_x - 0.6, 0, 0), axis="X", segments=max(10, seg // 2))  # cap

    # Round holes read as holes because the spokes between them are raised.
    for i in range(8):
        a = (i / 8) * math.tau
        add_cone(bm, 1.6, 1.6, 1.7,
                 loc=(face_x - 1.7, math.sin(a) * 5.3, math.cos(a) * 5.3),
                 axis="X", segments=10)
    if D["micro"]:
        for i in range(6):
            a = (i / 6) * math.tau + 0.3
            add_cone(bm, 0.45, 0.45, 0.9,
                     loc=(face_x - 0.1, math.sin(a) * 1.7, math.cos(a) * 1.7),
                     axis="X", segments=6)

    me = bpy.data.meshes.new("Rim")
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    me.materials.append(BLACK)
    return me


def wheel(name, loc, parent, tyre_me, rim_me, flip=False):
    """Carrier steers and takes travel; the hub inside it spins."""
    carrier = empty(name, loc, parent)
    hub = empty(name.replace("Wheel", "Hub"), (0, 0, 0), carrier)
    for me, tag, bev in ((tyre_me, "Tyre", 0.22), (rim_me, "Rim", 0.18)):
        ob = bpy.data.objects.new(f"{name}_{tag}", me)
        ob.parent = hub
        if flip:
            ob.rotation_euler = (0, 0, math.pi)
        bpy.context.scene.collection.objects.link(ob)
        b = ob.modifiers.new("Bevel", "BEVEL")
        b.width = mm(bev)
        b.segments = max(1, D["bevel_seg"] - 1)
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(42)
        es = ob.modifiers.new("Sharpen", "EDGE_SPLIT")
        es.split_angle = math.radians(42)
        es.use_edge_sharp = False
    return carrier


# ── Body ────────────────────────────────────────────────────────

def build_body(root):
    """
    The shell, lofted rather than assembled from boxes.

    A Wrangler's front is three volumes, not one: a low bonnet between two
    raised fender pods. Building it as a single slab across the full width is
    what made the previous version read as a generic Jeep however good the
    grille got, and no amount of bevelling fixes it. The tub also tapers toward
    the nose and the greenhouse leans inward toward the roof — both things a
    box cannot do, and both things the eye reads immediately.
    """
    body = empty("Body", (0, 0, 0), root)
    K = 28 if D["micro"] else 20

    # ── Tub: tailgate to grille plane, narrowing at the nose ───
    tub = [
        (-60.0, (28.5, 29.5, SILL_Z, 42.0)),
        (-54.0, (29.5, 30.0, SILL_Z, 42.0)),
        (-30.0, (30.0, 30.0, SILL_Z, 42.0)),
        (0.0, (30.0, 30.0, SILL_Z, 42.0)),
        (24.0, (30.0, 29.8, SILL_Z, 43.0)),
        (34.0, (29.5, 29.0, SILL_Z, 43.5)),
        (48.0, (28.5, 27.0, 19.5, 43.5)),
        (58.0, (27.0, 25.0, 20.0, 43.0)),
        (62.0, (25.5, 23.0, 21.0, 42.5)),
    ]
    loft("BodyTub", [(y, profile(a, b, z0, z1, K, 6.0)) for y, (a, b, z0, z1) in tub],
         mat=WHITE, parent=body)

    # ── Greenhouse: tumblehome, so it leans in toward the roof ─
    green = [
        (-60.0, (28.4, 27.0, BELT_Z, 55.0)),
        (-52.0, (29.5, 28.4, BELT_Z, 56.0)),
        (-20.0, (29.5, 28.6, BELT_Z, ROOF_Z)),
        (2.0, (29.5, 28.6, BELT_Z, ROOF_Z)),
        (18.0, (29.3, 28.2, BELT_Z, ROOF_Z)),
    ]
    loft("Greenhouse", [(y, profile(a, b, z0, z1, K, 5.0)) for y, (a, b, z0, z1) in green],
         mat=WHITE, parent=body)

    # ── Raised front fenders, flanking the bonnet ──────────────
    for sx in (-1, 1):
        pod = [
            (26.0, (7.6, 7.0, 41.0, 44.2)),
            (34.0, (8.4, 7.8, 41.0, 46.0)),
            (46.0, (8.4, 7.8, 41.0, 46.3)),
            (56.0, (8.0, 7.2, 41.0, 45.2)),
            (62.0, (6.8, 5.6, 41.0, 43.4)),
        ]
        loft(
            f"FrontFender{sx}",
            [(y, [(x + sx * FENDER_X, z) for (x, z) in profile(a, b, z0, z1, K, 4.6)])
             for y, (a, b, z0, z1) in pod],
            mat=WHITE, parent=body,
        )

    # ── Bonnet, sitting between and below the fenders ──────────
    hood = [
        (28.0, (14.5, 14.0, 41.0, 43.8)),
        (40.0, (14.5, 14.0, 41.0, HOOD_Z)),
        (54.0, (13.8, 13.2, 41.0, HOOD_Z)),
        (62.0, (12.4, 11.6, 41.0, 43.4)),
    ]
    loft("Hood", [(y, profile(a, b, z0, z1, K, 4.0)) for y, (a, b, z0, z1) in hood],
         mat=WHITE, parent=body)
    if D["micro"]:
        for x in (-8, 8):
            for j in range(3):
                box(f"HoodLouvre{x}{j}", (7.5, 1.4, 1.2), loc=(x, 40 + j * 3.0, HOOD_Z + 0.4),
                    mat=SATIN, parent=body, bevel=0.2)

    # ── Glass ──────────────────────────────────────────────────
    for sx in (-1, 1):
        for y0, y1 in ((-7, 14), (-33, -11)):
            box(f"SideGlass{sx}{y0}", (1.4, y1 - y0, 11.5),
                loc=(sx * 29.6, (y0 + y1) / 2, (BELT_Z + ROOF_Z) / 2 + 0.8),
                mat=GLASS, parent=body, bevel=0.2)
            box(f"WindowFrame{sx}{y0}", (1.2, y1 - y0 + 2.2, 13.4),
                loc=(sx * 29.3, (y0 + y1) / 2, (BELT_Z + ROOF_Z) / 2 + 0.8),
                mat=SATIN, parent=body, bevel=0.3)

    rake = math.atan2(COWL_Y - SCREEN_TOP_Y, ROOF_Z - BELT_Z)
    box("Windscreen", (54, 1.3, 19),
        loc=(0, (COWL_Y + SCREEN_TOP_Y) / 2 + 0.4, (BELT_Z + ROOF_Z) / 2),
        rot=(rake, 0, 0), mat=GLASS, parent=body, bevel=0.2)
    for sx in (-1, 1):
        box(f"APillar{sx}", (3.2, 2.4, 21),
            loc=(sx * 28.2, (COWL_Y + SCREEN_TOP_Y) / 2 + 0.7, (BELT_Z + ROOF_Z) / 2),
            rot=(rake, 0, 0), mat=SATIN, parent=body, bevel=0.5)
    box("ScreenHeader", (56, 3.0, 2.8), loc=(0, SCREEN_TOP_Y + 0.8, ROOF_Z - 0.4),
        mat=SATIN, parent=body, bevel=0.5)
    box("Cowl", (54, 4.5, 2.6), loc=(0, COWL_Y + 1.2, BELT_Z + 0.4), mat=SATIN, parent=body, bevel=0.5)
    box("RearGlass", (50, 1.3, 10), loc=(0, TAIL_Y - 0.3, (BELT_Z + ROOF_Z) / 2 + 1.2),
        mat=GLASS, parent=body, bevel=0.2)

    # ── Hardtop ────────────────────────────────────────────────
    roof_sec = [
        (TAIL_Y - 3.5, (28.6, 27.4, ROOF_Z - 1.6, ROOF_TOP)),
        (TAIL_Y + 6, (30.0, 28.8, ROOF_Z - 1.6, ROOF_TOP)),
        (0.0, (30.2, 29.0, ROOF_Z - 1.6, ROOF_TOP)),
        (SCREEN_TOP_Y + 1.5, (29.8, 28.4, ROOF_Z - 1.6, ROOF_TOP - 0.4)),
    ]
    loft("Hardtop", [(y, profile(a, b, z0, z1, K, 5.0)) for y, (a, b, z0, z1) in roof_sec],
         mat=WHITE, parent=body)

    if D["micro"]:
        for x in (-9, 8):
            tube(f"Wiper{x}", [(x - 5, COWL_Y + 2, BELT_Z + 0.4), (x + 1.4, COWL_Y + 0.4, BELT_Z + 3)],
                 0.32, SATIN, body)

    # ── Front face: grille between the fenders, lamps beside it ─
    box("GrilleSurround", (GRILLE_X * 2 + 3, 2.6, 19.5), loc=(0, NOSE_Y + 0.4, 34),
        mat=WHITE, parent=body, bevel=0.8)
    box("GrilleRecess", (GRILLE_X * 2, 1.6, 17.5), loc=(0, NOSE_Y + 0.9, 34),
        mat=SATIN, parent=body, bevel=0.3)
    for i in range(7):
        box(f"GrilleBar{i}", (2.9, 1.8, 15.8),
            loc=((i - 3) * 3.5, NOSE_Y + 1.5, 34), mat=WHITE, parent=body, bevel=0.25)

    for x in (-19, 19):
        cylinder(f"HeadlampHousing{x}", 7.0, 3.0, loc=(x, NOSE_Y + 0.2, 35), axis="Y",
                 segments=D["cyl"], mat=SATIN, parent=body)
        cylinder(f"HeadlampReflector{x}", 4.6, 1.0, loc=(x, NOSE_Y + 1.2, 35), axis="Y",
                 segments=D["cyl"], mat=CHROME, parent=body, bevel=0.15)
        cylinder(f"HeadlampLens{x}", 4.0, 1.0, loc=(x, NOSE_Y + 1.8, 35), axis="Y",
                 segments=D["cyl"], mat=LENS, parent=body, bevel=0.15)

    # ── ICON Pro Series front bumper ───────────────────────────
    box("BumperFront", (56, 7.5, 6.5), loc=(0, NOSE_Y + 6.5, 24), mat=SATIN, parent=body, bevel=0.8)
    if D["micro"]:
        for x in (-14, -7, 0, 7, 14):
            cylinder(f"BumperHole{x}", 1.2, 3, loc=(x, NOSE_Y + 6.5, 24), axis="Y",
                     segments=10, mat=BLACK, parent=body, bevel=0.2)
    tube("BullBar", [(-13, NOSE_Y + 7, 27), (-12, NOSE_Y + 4.5, 40), (0, NOSE_Y + 3.8, 42),
                     (12, NOSE_Y + 4.5, 40), (13, NOSE_Y + 7, 27)], 1.1, SATIN, body)
    tube("BullBarBrace", [(-6, NOSE_Y + 4.2, 40.5), (6, NOSE_Y + 4.2, 40.5)], 0.8, SATIN, body)
    box("SkidPlateFront", (30, 14, 1.6), loc=(0, NOSE_Y + 1, 17.5), rot=(-0.36, 0, 0),
        mat=SATIN, parent=body, bevel=0.5)
    for x in (-23, 23):
        box(f"TowHook{x}", (3.0, 3.6, 3.0), loc=(x, NOSE_Y + 9, 24), mat=ORANGE, parent=body, bevel=0.4)

    # ── Sides ──────────────────────────────────────────────────
    for sx in (-1, 1):
        for y in (AXLE_F, AXLE_R):
            for i in range(11):
                a = math.radians(-75 + i * 15)
                box(
                    f"Flare{sx}{int(y)}{i}",
                    (FLARE_X - 30 + 4.5, 5.2, 2.8),
                    loc=(sx * 31.0,
                         y + math.sin(a) * (TYRE_R + 2.4),
                         TYRE_R + math.cos(a) * (TYRE_R + 2.4)),
                    rot=(-a, 0, 0), mat=SATIN, parent=body, bevel=0.8,
                )
        box(f"Slider{sx}", (4.6, 50, 3.6), loc=(sx * 29.5, 0, SILL_Z + 0.6),
            mat=SATIN, parent=body, bevel=0.8)
        if D["micro"]:
            for y in (14, -9, -34):
                box(f"Shut{sx}{y}", (0.7, 0.8, BELT_Z - SILL_Z - 4),
                    loc=(sx * 30.1, y, (BELT_Z + SILL_Z) / 2), mat=SATIN, parent=body, bevel=0.15)
            for y in (1, -22):
                box(f"Handle{sx}{y}", (1.5, 6, 2), loc=(sx * 30.6, y, BELT_Z - 6),
                    mat=SATIN, parent=body, bevel=0.4)
            for y in (14, -9):
                box(f"Hinge{sx}{y}", (1.2, 2.4, 3.2), loc=(sx * 30.3, y, BELT_Z - 4),
                    mat=SATIN, parent=body, bevel=0.3)
        tube(f"MirrorArm{sx}", [(sx * 28.4, COWL_Y - 1, BELT_Z + 3.5),
                                (sx * 31.6, COWL_Y + 0.6, BELT_Z + 5)], 0.8, SATIN, body)
        box(f"Mirror{sx}", (2.4, 2.6, 5.4), loc=(sx * 33, COWL_Y + 0.6, BELT_Z + 5.6),
            mat=SATIN, parent=body, bevel=0.7)
        text_mesh(f"Rubicon{sx}", "RUBICON", 4.2, RED, body,
                  loc=(sx * 29.0, 42, 39), rot=(math.pi / 2, 0, sx * math.pi / 2))

    return body


# ── Roof ────────────────────────────────────────────────────────

def build_roof(root):
    roof = empty("RoofSystem", (0, 0, 0), root)
    y0, y1 = TAIL_Y - 2, SCREEN_TOP_Y + 1

    for sx in (-1, 1):
        box(f"RackRail{sx}", (2.6, y1 - y0, 3.4), loc=(sx * 26, (y0 + y1) / 2, ROOF_TOP + 1.5),
            mat=SATIN, parent=roof, bevel=0.5)
    for y in (y0, y1):
        box(f"RackEnd{int(y)}", (54.6, 2.6, 3.4), loc=(0, y, ROOF_TOP + 1.5), mat=SATIN, parent=roof, bevel=0.5)
    for i in range(7):
        y = y0 + 2.5 + (i + 0.5) * ((y1 - y0 - 5) / 7)
        box(f"RackSlat{i}", (50, 2.8, 1.0), loc=(0, y, ROOF_TOP + 0.5), mat=SATIN, parent=roof, bevel=0.2)
    if D["micro"]:
        for sx in (-1, 1):
            for y in (y0 + 8, 0, y1 - 8):
                box(f"RackMount{sx}{int(y)}", (3.2, 2.6, 2.2), loc=(sx * 26, y, ROOF_TOP - 0.2),
                    mat=SATIN, parent=roof, bevel=0.3)

    box("TractionBoard", (38, 22, 1.8), loc=(0, 7, ROOF_TOP + 3.9), mat=ORANGE, parent=roof, bevel=0.5)
    for i in range(4):
        for j in range(3):
            box(f"TbNub{i}{j}", (4.4, 4.4, 1.0), loc=(-14 + i * 9.3, -1 + j * 6.5, ROOF_TOP + 4.9),
                mat=ORANGE, parent=roof, bevel=0.25)

    for i, x in enumerate((-13, 13)):
        box(f"RoofCase{i}", (21, 28, 7), loc=(x, -24, ROOF_TOP + 6.7), mat=BLACK, parent=roof, bevel=0.8)
        for j in range(3):
            box(f"RoofCaseRib{i}{j}", (19, 1.6, 0.8), loc=(x, -33 + j * 9, ROOF_TOP + 10.4),
                mat=BLACK, parent=roof, bevel=0.2)

    box("ShovelShaft", (2.4, 50, 2.4), loc=(-22, -24, ROOF_TOP + 4.3), mat=ORANGE, parent=roof, bevel=0.5)
    box("ShovelBlade", (6, 9, 1.6), loc=(-22, -53, ROOF_TOP + 4.3), mat=ORANGE, parent=roof, bevel=0.5)

    # Front LED bar: individual housings, as the specification lists.
    bar = empty("LightBar", (0, 0, 0), roof)
    box("LightBarFrame", (54, 4.4, 5.6), loc=(0, SCREEN_TOP_Y + 1.6, ROOF_TOP + 0.4),
        mat=SATIN, parent=bar, bevel=0.5)
    for i in range(10):
        x = (i - 4.5) * 5.3
        cylinder(f"BarHousing{i}", 2.2, 4.0, loc=(x, SCREEN_TOP_Y + 1.6, ROOF_TOP + 0.4), axis="Y",
                 segments=max(10, D["cyl"] // 2), mat=SATIN, parent=bar)
        cylinder(f"BarLens{i}", 1.7, 1.1, loc=(x, SCREEN_TOP_Y + 3.9, ROOF_TOP + 0.4), axis="Y",
                 segments=max(10, D["cyl"] // 2), mat=LENS, parent=bar, bevel=0.12)
    box("BarCover", (52, 3.6, 2.4), loc=(0, SCREEN_TOP_Y - 2.4, ROOF_TOP + 4.2),
        mat=ORANGE, parent=roof, bevel=0.5)

    return roof


# ── Rear ────────────────────────────────────────────────────────

def build_rear(root, tyre_me, rim_me):
    rear = empty("RearSystem", (0, 0, 0), root)

    tube("BumperRearTube",
         [(-30, TAIL_Y - 5, 21), (-30, TAIL_Y - 8, 21), (30, TAIL_Y - 8, 21), (30, TAIL_Y - 5, 21)],
         1.6, SATIN, rear)
    for x in (-19, 19):
        tube(f"BumperRearStay{x}", [(x, TAIL_Y - 0.5, 23), (x, TAIL_Y - 7.4, 21)], 1.2, SATIN, rear)

    for x in (-22, 22):
        box(f"TailLight{x}", (7, 2.0, 12), loc=(x, TAIL_Y - 1.2, 34), mat=TAIL, parent=rear, bevel=0.3)
        box(f"TailSurround{x}", (8.6, 1.4, 14), loc=(x, TAIL_Y - 0.3, 34), mat=SATIN, parent=rear, bevel=0.3)

    # Swing-out carrier and the spare, which is the same wheel and tyre as the
    # four on the ground.
    box("SpareMount", (8, 8, 24), loc=(4, TAIL_Y - 4.5, 40), mat=SATIN, parent=rear, bevel=0.7)
    tube("SpareArm", [(4, TAIL_Y - 0.5, 26), (4, TAIL_Y - 6, 33), (4, TAIL_Y - 7, 42)], 1.5, SATIN, rear)
    spare = empty("SpareWheel", (1.5, TAIL_Y - 9, 42), rear)
    for me, tag in ((tyre_me, "Tyre"), (rim_me, "Rim")):
        ob = bpy.data.objects.new(f"Spare_{tag}", me)
        ob.parent = spare
        ob.rotation_euler = (0, 0, math.pi / 2)
        bpy.context.scene.collection.objects.link(ob)
        b = ob.modifiers.new("Bevel", "BEVEL")
        b.width = mm(0.2)
        b.segments = max(1, D["bevel_seg"] - 1)
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(42)
        es = ob.modifiers.new("Sharpen", "EDGE_SPLIT")
        es.split_angle = math.radians(42)
        es.use_edge_sharp = False

    return rear


# ── Chassis ─────────────────────────────────────────────────────

def build_chassis(root):
    """Low-mounted electronics and an angled skid plate, as the spec calls out."""
    ch = empty("Chassis", (0, 0, 0), root)

    # The plate is the lowest thing on the vehicle and covers most of the
    # underside — without it you look up at the white inside of the body shell,
    # which is not what is under a real crawler.
    box("ChassisPlate", (38, 102, 2.2), loc=(0, -1, 16.4), mat=BLACK, parent=ch, bevel=0.6)
    for sx in (-1, 1):
        box(f"Rail{sx}", (4.0, 104, 6.5), loc=(sx * 17, -1, 19), mat=BLACK, parent=ch, bevel=0.5)
    for y in (36, -36):
        box(f"Crossmember{int(y)}", (34, 3.6, 3), loc=(0, y, 19), mat=BLACK, parent=ch, bevel=0.4)
    # Angled skid plate, as the specification calls out.
    box("SkidPlate", (30, 20, 1.8), loc=(0, 40, 16.0), rot=(-0.3, 0, 0), mat=BLACK, parent=ch, bevel=0.5)
    box("SkidPlateRear", (30, 18, 1.8), loc=(0, -40, 16.0), rot=(0.3, 0, 0), mat=BLACK, parent=ch, bevel=0.5)

    box("Transmission", (16, 19, 16), loc=(0, -4, 25), mat=BLACK, parent=ch, bevel=0.8)
    cylinder("Motor", 7.0, 19, loc=(9, -5, 28), axis="X", segments=D["cyl"], mat=METAL, parent=ch)
    cylinder("MotorCan", 7.4, 2.4, loc=(-1, -5, 28), axis="X", segments=D["cyl"], mat=BLACK, parent=ch)
    for y_from, y_to, tag in ((-12, AXLE_R + 5, "Rear"), (4, AXLE_F - 5, "Front")):
        cylinder(f"Driveshaft{tag}", 1.3, abs(y_to - y_from), loc=(0, (y_from + y_to) / 2, 19),
                 axis="Y", segments=max(8, D["cyl"] // 3), mat=METAL, parent=ch)

    box("Battery", (22, 30, 8), loc=(0, 20, 23), mat=BLACK, parent=ch, bevel=0.6)
    box("BatteryLabel", (16, 19, 0.4), loc=(0, 20, 27.2), mat=SATIN, parent=ch, bevel=0.15)
    box("ESC", (11, 15, 5), loc=(-11, 5, 24), mat=BLACK, parent=ch, bevel=0.5)
    box("Receiver", (9, 10, 3.6), loc=(11, 12, 27), mat=BLACK, parent=ch, bevel=0.4)
    box("Servo", (13, 7.5, 13), loc=(-9, -17, 23), mat=BLACK, parent=ch, bevel=0.5)
    box("ServoLabel", (10, 0.4, 8.5), loc=(-9, -21, 23), mat=GREEN, parent=ch, bevel=0.15)
    cylinder("ServoHorn", 2.6, 1.6, loc=(-9, -17, 30.5), axis="Z",
             segments=max(10, D["cyl"] // 2), mat=WHITE, parent=ch)
    tube("SteerDrag", [(-9, -17, 30.5), (-2, -30, 27), (6, AXLE_F - 34, 24)], 0.6, CHROME, ch)

    if D["micro"]:
        tube("WireBattRed", [(5, 34, 27), (8, 20, 29), (2, 6, 27), (-7, 1, 26)], 0.65, WIRE_R, ch)
        tube("WireBattBlack", [(2, 34, 26.5), (5, 20, 28.5), (0, 6, 26.5), (-8, 1, 25.5)], 0.65, WIRE_K, ch)
        for i, x in enumerate((-2.5, 0, 2.5)):
            tube(f"WireMotor{i}", [(-8, -1, 27), (x - 1, -6, 29), (4 + x, -7, 28)], 0.55, WIRE_O, ch)
        tube("WireServo", [(-10, -10, 28), (-11, -15, 29), (-9, -19, 28)], 0.55, WIRE_K, ch)
        for sx in (-1, 1):
            for y in (36, -36):
                cylinder(f"Screw{sx}{int(y)}", 0.6, 1.2, loc=(sx * 13, y, 18.8), axis="Z",
                         segments=6, mat=METAL, parent=ch)

    return ch


# ── Axles ───────────────────────────────────────────────────────

def build_axle(root, tag, y, tyre_me, rim_me):
    """
    Ramped axle housing, high-clearance links and damped coil-overs — the three
    things Axial's spec sheet singles out about this platform, so they are the
    three things that have to be visible from underneath.
    """
    ax = empty(f"Axle{tag}", (0, y, TYRE_R), root)
    seg = max(10, D["cyl"] // 2)

    cylinder(f"AxleTube{tag}", 3.2, TRACK - 9, loc=(0, 0, 0), axis="X", segments=seg,
             mat=BLACK, parent=ax)
    # The ramp: the housing is swept back and up on its leading face.
    box(f"AxleRamp{tag}", (24, 11, 7), loc=(-6, 2.5, 1.2), rot=(0.42, 0, 0),
        mat=BLACK, parent=ax, bevel=1.6)
    sphere(f"Diff{tag}", 6.4, loc=(-6, 0, 0), scale=(1.0, 0.95, 1.0),
           segments=max(12, D["cyl"] // 2), mat=BLACK, parent=ax)
    cylinder(f"DiffCover{tag}", 5.0, 2.4, loc=(-6, -5.6, 0), axis="Y", segments=seg,
             mat=BLACK, parent=ax)

    for sx, side in ((-1, "L"), (1, "R")):
        key = f"{tag[0]}{side}"
        box(f"Knuckle{key}", (4.4, 8, 9.5), loc=(sx * (TRACK / 2 - 4.4), 0, 0),
            mat=BLACK, parent=ax, bevel=1.0)
        cylinder(f"Stub{key}", 1.8, 4.4, loc=(sx * (TRACK / 2 - 1.2), 0, 0), axis="X",
                 segments=seg, mat=METAL, parent=ax)
        # High-clearance link, raised above the axle centreline.
        box(f"Link{key}", (2.6, 27, 2.6), loc=(sx * 16, -y * 0.3, 4.2), rot=(0.12, 0, 0),
            mat=BLACK, parent=ax, bevel=0.4)
        if D["micro"]:
            for e in (-1, 1):
                sphere(f"LinkEnd{key}{e}", 1.6, loc=(sx * 16, -y * 0.3 + e * 13.5, 4.2 + e * 1.6),
                       segments=10, mat=METAL, parent=ax)

        sh = empty(f"Shock{key}", (sx * 19, 0, 0), ax)
        cylinder(f"ShockBody{key}", 1.7, 12, loc=(0, 0, 13), axis="Z", segments=seg,
                 mat=BLACK, parent=sh)
        cylinder(f"ShockShaft{key}", 0.7, 11, loc=(0, 0, 5), axis="Z", segments=max(8, seg // 2),
                 mat=CHROME, parent=sh)
        spring(f"ShockSpring{key}", 2.3, 16, 7.0, 0.45, loc=(0, 0, 10), mat=CHROME, parent=sh)
        box(f"ShockEye{key}", (2.6, 2.6, 2), loc=(0, 0, 0), mat=BLACK, parent=sh, bevel=0.4)
        box(f"ShockCap{key}", (3.4, 3.4, 2), loc=(0, 0, 19.2), mat=BLACK, parent=sh, bevel=0.4)

    if tag == "Front":
        cylinder("SteerLink", 0.9, TRACK - 11, loc=(0, 5.6, -2.4), axis="X",
                 segments=max(8, seg // 2), mat=CHROME, parent=ax)

    for sx, side in ((-1, "L"), (1, "R")):
        wheel(f"Wheel{tag[0]}{side}", (sx * TRACK / 2, 0, 0), ax, tyre_me, rim_me, flip=sx < 0)

    return ax


# ── Build ───────────────────────────────────────────────────────

def build(detail="high"):
    global D
    D = LEVELS[detail]
    scx30_lib.SEGMENTS = D["bevel_seg"]

    tyre_me = tyre_mesh()
    rim_me = rim_mesh()
    root = empty("SCX30", (0, 0, 0))
    build_body(root)
    build_roof(root)
    build_rear(root, tyre_me, rim_me)
    build_chassis(root)
    build_axle(root, "Front", AXLE_F, tyre_me, rim_me)
    build_axle(root, "Rear", AXLE_R, tyre_me, rim_me)
    bpy.context.view_layer.update()
    return root


def triangle_count():
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for ob in bpy.data.objects:
        if ob.type in {"MESH", "CURVE", "FONT"}:
            try:
                me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
            except RuntimeError:
                continue
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            bpy.data.meshes.remove(me)
    return tris


def export(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(path),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        # Draco, decoded by a copy of the decoder served from /public — the
        # uncompressed pair came to 5 MB, and the alternative to compressing
        # them is pulling a decoder off someone else's CDN at runtime.
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
    )


def main(export_levels=("high", "game"), keep_rig=False):
    """Build each detail level and write its GLB. Pass () to build only."""
    for level in export_levels or ("high",):
        clear_scene(keep_rig=keep_rig)
        build(level)
        tris = triangle_count()
        if export_levels:
            export(os.path.join(OUT_DIR, LEVELS[level]["file"]))
        print(f"SCX30 level={level} objects={len(bpy.data.objects)} tris={tris} "
              f"file={LEVELS[level]['file'] if export_levels else '(not exported)'}")
    return {"objects": len(bpy.data.objects)}


if __name__ == "__main__":
    main()
