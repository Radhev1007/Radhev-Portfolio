"""
Build the Axial SCX30 hero vehicle and export it as a glTF binary.

    /Applications/Blender.app/Contents/MacOS/Blender --background \
        --python tools/build_scx30.py

Authored from the reference photographs of Radhev's own truck: side, front,
front 3/4, rear, top, chassis, wheels, roof detail and axle detail.

PROPORTION LOCK (millimetres, 1/24 scale). Overall figures are the published
Axial SCX24 Jeep Wrangler JLU dimensions; everything else is read off the
reference photographs in proportion to them. These numbers are the contract —
nothing downstream re-scales the truck by eye.

    overall length      240        wheelbase          133
    overall width       100        track               86
    height to roof      110        ground clearance    25
    height to rack      120        tyre OD             54
    hard body width      88        tyre width          20
    belt line            68        rim OD              28

The model faces +Y in Blender, which the glTF exporter turns into -Z: the same
forward axis the game's driving code already uses.
"""

import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scx30_lib import (  # noqa: E402
    MM, add_box, add_cone, box, cylinder, empty, material, mm, spring, text_mesh, tube,
)
import bmesh  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "models", "scx30.glb")

# ── Proportion lock ─────────────────────────────────────────────
WB = 133.0            # wheelbase
TRACK = 86.0          # wheel centre to wheel centre
TYRE_D = 54.0
TYRE_R = TYRE_D / 2
TYRE_W = 20.0
RIM_R = 14.0
BODY_W = 88.0         # hard body
FLARE_X = 54.0        # outer face of the flares (overall width 100 over tyres)
SILL_Z = 28.0         # underside of the tub
BELT_Z = 72.0         # bottom of the side glass
ROOF_Z = 102.0        # underside of the hardtop
ROOF_TOP = 108.0
RACK_TOP = 120.0
HOOD_Z = 74.0
NOSE_Y = 100.0        # grille face
TAIL_Y = -93.0        # tailgate
COWL_Y = 52.0         # base of the windscreen
SCREEN_TOP_Y = 30.0
GRILLE_X = 23.0       # half-width of the grille; headlamps live outboard of it
AXLE_F = WB / 2
AXLE_R = -WB / 2

# ── Materials ───────────────────────────────────────────────────
WHITE = material("BodyWhite", (0.92, 0.92, 0.91), roughness=0.3)
BLACK = material("BlackPlastic", (0.045, 0.045, 0.05), roughness=0.62)
SATIN = material("BlackSatin", (0.025, 0.025, 0.03), roughness=0.42)
RUBBER = material("Rubber", (0.035, 0.035, 0.038), roughness=0.95)
METAL = material("Metal", (0.42, 0.43, 0.46), roughness=0.3, metallic=0.9)
CHROME = material("Chrome", (0.75, 0.76, 0.78), roughness=0.16, metallic=1.0)
GLASS = material("Glass", (0.012, 0.016, 0.022), roughness=0.07, alpha=0.86)
ORANGE = material("Orange", (0.72, 0.13, 0.025), roughness=0.38)
RED = material("Red", (0.62, 0.05, 0.03), roughness=0.4)
LENS = material("Lens", (0.9, 0.9, 0.88), roughness=0.1,
                emission=(1.0, 0.96, 0.88), strength=2.0)
TAIL = material("TailLens", (0.5, 0.03, 0.02), roughness=0.2,
                emission=(1.0, 0.1, 0.05), strength=1.2)
GREEN = material("ServoLabel", (0.45, 0.78, 0.1), roughness=0.4)
WIRE_R = material("WireRed", (0.55, 0.04, 0.03), roughness=0.55)
WIRE_K = material("WireBlack", (0.03, 0.03, 0.03), roughness=0.55)
WIRE_O = material("WireOrange", (0.85, 0.35, 0.03), roughness=0.55)


def clear_scene(keep_rig=True):
    """Empty the scene. `keep_rig` leaves a camera and a light behind, which is
    what you want when building into an interactive session rather than a
    headless one."""
    keep = set()
    if keep_rig:
        keep = {o.name for o in bpy.data.objects if o.type in {"CAMERA", "LIGHT"}}
    for ob in list(bpy.data.objects):
        if ob.name not in keep:
            bpy.data.objects.remove(ob)
    for coll in (bpy.data.meshes, bpy.data.curves):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)


# ── Wheel ───────────────────────────────────────────────────────

def tyre_mesh():
    """One tyre, built once and shared by all five wheels.

    The tread is what makes a crawler tyre read: two staggered inner rows of
    lugs and a row of shoulder blocks that break the silhouette, matching the
    Geolandar-style pattern in the close-up reference.
    """
    bm = bmesh.new()
    add_cone(bm, TYRE_R - 3.4, TYRE_R - 3.4, TYRE_W, axis="X", segments=28)
    # Sidewall shoulders, slightly proud of the carcass.
    for x in (-TYRE_W / 2 + 2.2, TYRE_W / 2 - 2.2):
        add_cone(bm, TYRE_R - 5.5, TYRE_R - 5.5, 2.6, loc=(x, 0, 0), axis="X", segments=28)

    rows = 15
    for i in range(rows):
        a = (i / rows) * math.tau
        for x, phase in ((-5.0, 0.0), (5.0, math.pi / rows)):
            ang = a + phase
            add_box(
                bm,
                (8.6, 7.4, 3.6),
                loc=(x, math.sin(ang) * (TYRE_R - 1.8), math.cos(ang) * (TYRE_R - 1.8)),
                rot=(-ang, 0, 0),
            )
        for x in (-10.6, 10.6):
            ang = a + math.pi / rows / 2
            add_box(
                bm,
                (4.4, 5.6, 4.6),
                loc=(x, math.sin(ang) * (TYRE_R - 2.6), math.cos(ang) * (TYRE_R - 2.6)),
                rot=(-ang, 0, 0),
            )

    me = bpy.data.meshes.new("Tyre")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(RUBBER)
    return me


def rim_mesh():
    """Black steel-look beadlock rim: barrel, outer ring, dish and lightening holes."""
    bm = bmesh.new()
    add_cone(bm, RIM_R, RIM_R, TYRE_W + 0.6, axis="X", segments=22)
    for x in (-(TYRE_W / 2) - 0.2, (TYRE_W / 2) + 0.2):
        add_cone(bm, RIM_R + 1.6, RIM_R + 1.6, 1.6, loc=(x, 0, 0), axis="X", segments=22)
        # Beadlock bolts
        for i in range(10):
            a = (i / 10) * math.tau
            add_cone(bm, 0.75, 0.75, 1.2,
                     loc=(x, math.sin(a) * (RIM_R + 0.4), math.cos(a) * (RIM_R + 0.4)),
                     axis="X", segments=6)
    # Dish face and hub
    add_cone(bm, RIM_R - 1.2, RIM_R - 1.2, 1.8, loc=(TYRE_W / 2 - 2.4, 0, 0), axis="X", segments=22)
    add_cone(bm, 4.2, 4.2, 4.0, loc=(TYRE_W / 2 - 1.0, 0, 0), axis="X", segments=12)
    for i in range(8):
        a = (i / 8) * math.tau
        add_cone(bm, 2.4, 2.4, 2.6,
                 loc=(TYRE_W / 2 - 3.0, math.sin(a) * 8.4, math.cos(a) * 8.4),
                 axis="X", segments=8)
    me = bpy.data.meshes.new("Rim")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(BLACK)
    return me


def wheel(name, loc, parent, tyre_me, rim_me, flip=False):
    """
    Two nested nodes per wheel: the carrier steers and takes suspension travel,
    the hub inside it spins. Driving both on one node means the game has to
    care about Euler order to steer a rolling wheel, which is a bug waiting to
    happen rather than a saving.
    """
    carrier = empty(name, loc, parent)
    hub = empty(name.replace("Wheel", "Hub"), (0, 0, 0), carrier)
    for me, tag in ((tyre_me, "Tyre"), (rim_me, "Rim")):
        ob = bpy.data.objects.new(f"{name}_{tag}", me)
        ob.parent = hub
        if flip:
            ob.rotation_euler = (0, 0, math.pi)
        bpy.context.scene.collection.objects.link(ob)
    return carrier


# ── Body ────────────────────────────────────────────────────────

def build_body(root):
    body = empty("Body", (0, 0, 0), root)

    # Tub: the main white volume from sill to belt line.
    box("BodyTub", (BODY_W, NOSE_Y - TAIL_Y, BELT_Z - SILL_Z),
        loc=(0, (NOSE_Y + TAIL_Y) / 2, (BELT_Z + SILL_Z) / 2), mat=WHITE, parent=body, bevel=2.2)

    # Bonnet, a little above the belt line and inset from the flanks.
    box("Hood", (BODY_W - 5, NOSE_Y - COWL_Y, 8),
        loc=(0, (NOSE_Y + COWL_Y) / 2, HOOD_Z - 4), mat=WHITE, parent=body, bevel=1.6)
    # Two bonnet vents, as on the reference.
    for x in (-19, 19):
        box(f"HoodVent{x}", (16, 20, 3.5), loc=(x, 64, HOOD_Z + 1), mat=WHITE, parent=body, bevel=0.8)
        for j in range(3):
            box(f"HoodLouvre{x}{j}", (13, 2.6, 2.2), loc=(x, 61 + j * 5, HOOD_Z + 2.4),
                mat=SATIN, parent=body, bevel=0.3)

    # Greenhouse: white box, with the glass laid into it. Pillars come out the
    # right width this way instead of being whatever is left over.
    box("Greenhouse", (BODY_W - 2, SCREEN_TOP_Y - TAIL_Y, ROOF_Z - BELT_Z),
        loc=(0, (SCREEN_TOP_Y + TAIL_Y) / 2, (ROOF_Z + BELT_Z) / 2), mat=WHITE, parent=body, bevel=2.0)

    # Four side windows (front and rear door, both sides).
    for sx in (-1, 1):
        for y0, y1 in ((-10, 22), (-48, -16)):
            box(f"SideGlass{sx}{y0}", (1.6, y1 - y0, 26),
                loc=(sx * (BODY_W / 2 - 1.6), (y0 + y1) / 2, (BELT_Z + ROOF_Z) / 2),
                mat=GLASS, parent=body, bevel=0.3)

    # Raked windscreen between the cowl and the roof, plus the rear glass.
    rake = math.atan2(COWL_Y - SCREEN_TOP_Y, ROOF_Z - BELT_Z)
    box("Windscreen", (BODY_W - 6, 2.0, 38),
        loc=(0, (COWL_Y + SCREEN_TOP_Y) / 2 + 1, (BELT_Z + ROOF_Z) / 2),
        rot=(rake, 0, 0), mat=GLASS, parent=body, bevel=0.3)
    # The screen surround is pillars and a header rail — a solid panel in front
    # of the glass is how you end up with a windscreen you cannot see through.
    for sx in (-1, 1):
        box(f"APillar{sx}", (5, 4.0, 42),
            loc=(sx * (BODY_W / 2 - 2.5), (COWL_Y + SCREEN_TOP_Y) / 2 + 1.4, (BELT_Z + ROOF_Z) / 2),
            rot=(rake, 0, 0), mat=WHITE, parent=body, bevel=0.8)
    box("ScreenHeader", (BODY_W - 2, 5.0, 5),
        loc=(0, SCREEN_TOP_Y + 1.5, ROOF_Z - 1), mat=WHITE, parent=body, bevel=0.8)
    box("Cowl", (BODY_W - 4, 8, 5), loc=(0, COWL_Y + 2, BELT_Z + 1), mat=WHITE, parent=body, bevel=0.8)
    box("RearGlass", (BODY_W - 12, 2.0, 22),
        loc=(0, TAIL_Y - 0.6, (BELT_Z + ROOF_Z) / 2 + 2), mat=GLASS, parent=body, bevel=0.3)
    box("TailgateSeam", (BODY_W - 2, 1.0, 1.2), loc=(0, TAIL_Y - 0.6, BELT_Z - 2),
        mat=SATIN, parent=body, bevel=0.2)

    # Hardtop.
    box("Hardtop", (BODY_W + 2, SCREEN_TOP_Y - TAIL_Y + 6, ROOF_TOP - ROOF_Z),
        loc=(0, (SCREEN_TOP_Y + TAIL_Y) / 2 - 1, (ROOF_TOP + ROOF_Z) / 2),
        mat=WHITE, parent=body, bevel=1.8)

    # Wipers.
    for x in (-16, 14):
        tube(f"Wiper{x}", [(x - 9, COWL_Y + 4, BELT_Z + 1), (x + 2, COWL_Y + 1, BELT_Z + 6)],
             0.6, SATIN, body)

    # ── Front ──────────────────────────────────────────────────
    # Seven-slot grille. The surround is body colour on this truck, not black.
    box("Grille", (GRILLE_X * 2, 5, 36), loc=(0, NOSE_Y + 1, 56), mat=WHITE, parent=body, bevel=1.0)
    for i in range(7):
        box(f"GrilleSlot{i}", (4.2, 2.6, 29),
            loc=((i - 3) * 6.2, NOSE_Y + 3.0, 56), mat=SATIN, parent=body, bevel=0.3)
    # Round headlights, outboard of the grille where the reference has them.
    for x in (-33, 33):
        cylinder(f"HeadlampHousing{x}", 7.2, 4.0, loc=(x, NOSE_Y + 1.5, 56), axis="Y",
                 segments=18, mat=SATIN, parent=body)
        cylinder(f"HeadlampLens{x}", 6.0, 1.6, loc=(x, NOSE_Y + 3.6, 56), axis="Y",
                 segments=18, mat=LENS, parent=body, bevel=0.2)
        cylinder(f"HeadlampRing{x}", 7.0, 1.0, loc=(x, NOSE_Y + 4.1, 56), axis="Y",
                 segments=18, mat=CHROME, parent=body, bevel=0.2)

    # Bumper, skid plate and the black bull bar hoop over it.
    box("FrontBumper", (90, 13, 13), loc=(0, NOSE_Y + 9, 32), mat=SATIN, parent=body, bevel=1.4)
    box("SkidPlate", (48, 24, 3), loc=(0, NOSE_Y + 1, 25), mat=SATIN, parent=body, bevel=0.8)
    # A slim hoop sitting close to the bumper, not a cattle guard.
    tube("BullBar", [(-22, NOSE_Y + 9, 37), (-21, NOSE_Y + 7, 58), (0, NOSE_Y + 6, 61),
                     (21, NOSE_Y + 7, 58), (22, NOSE_Y + 9, 37)], 1.4, SATIN, body)
    tube("BullBarBrace", [(-10, NOSE_Y + 6.5, 59), (10, NOSE_Y + 6.5, 59)], 1.1, SATIN, body)
    for x in (-36, 36):
        box(f"TowHook{x}", (5, 6, 5), loc=(x, NOSE_Y + 13, 32), mat=ORANGE, parent=body, bevel=0.6)

    # ── Sides ──────────────────────────────────────────────────
    for sx in (-1, 1):
        # Wheel arches, built as an arc of segments over the tyre. A flat slab
        # over the wheel is the single thing that stops a Jeep reading as a
        # Jeep, so these follow the tyre radius.
        for y in (AXLE_F, AXLE_R):
            for i in range(7):
                a = math.radians(-66 + i * 22)
                box(
                    f"Flare{sx}{int(y)}{i}",
                    (FLARE_X - BODY_W / 2 + 7, 15, 7),
                    loc=(
                        sx * (BODY_W / 2 + 2),
                        y + math.sin(a) * (TYRE_R + 6),
                        TYRE_R + math.cos(a) * (TYRE_R + 6),
                    ),
                    rot=(-a, 0, 0),
                    mat=SATIN,
                    parent=body,
                    bevel=1.4,
                )
        box(f"Slider{sx}", (7, 74, 6), loc=(sx * (BODY_W / 2 - 1), 0, SILL_Z + 1),
            mat=SATIN, parent=body, bevel=1.2)
        # Door shut lines and handles.
        for y in (22, -14, -50):
            box(f"Shut{sx}{y}", (0.9, 1.1, BELT_Z - SILL_Z - 6),
                loc=(sx * (BODY_W / 2 + 0.2), y, (BELT_Z + SILL_Z) / 2), mat=SATIN, parent=body, bevel=0.2)
        for y in (2, -32):
            box(f"Handle{sx}{y}", (2.2, 9, 3), loc=(sx * (BODY_W / 2 + 1.2), y, BELT_Z - 9),
                mat=SATIN, parent=body, bevel=0.6)
        # Mirror on the A-pillar.
        tube(f"MirrorArm{sx}", [(sx * (BODY_W / 2 - 1), COWL_Y - 2, BELT_Z + 6),
                                (sx * (BODY_W / 2 + 4), COWL_Y + 1, BELT_Z + 8)], 1.3, SATIN, body)
        box(f"Mirror{sx}", (4, 4, 9), loc=(sx * (BODY_W / 2 + 6), COWL_Y + 1, BELT_Z + 9),
            mat=SATIN, parent=body, bevel=1.0)
        # RUBICON on the bonnet flank, in red, as on the reference.
        text_mesh(f"Rubicon{sx}", "RUBICON", 7.5, RED, body,
                  loc=(sx * (BODY_W / 2 - 1.6), 62, 64),
                  rot=(math.pi / 2, 0, sx * math.pi / 2))

    return body


# ── Roof system ─────────────────────────────────────────────────

def build_roof(root):
    roof = empty("RoofSystem", (0, 0, 0), root)
    y0, y1 = TAIL_Y - 4, SCREEN_TOP_Y + 2

    # Rack platform: two rails, two ends, slats between them.
    for sx in (-1, 1):
        box(f"RackRail{sx}", (4, y1 - y0, 7), loc=(sx * 42, (y0 + y1) / 2, ROOF_TOP + 3.5),
            mat=SATIN, parent=roof, bevel=0.8)
    for y in (y0, y1):
        box(f"RackEnd{int(y)}", (88, 4, 7), loc=(0, y, ROOF_TOP + 3.5), mat=SATIN, parent=roof, bevel=0.8)
    for i in range(7):
        y = y0 + 4 + (i + 0.5) * ((y1 - y0 - 8) / 7)
        box(f"RackSlat{i}", (82, 4.5, 1.6), loc=(0, y, ROOF_TOP + 1.6), mat=SATIN, parent=roof, bevel=0.3)

    # Orange traction board, flat at the front of the rack.
    box("TractionBoard", (58, 34, 3), loc=(0, 12, ROOF_TOP + 8.4), mat=ORANGE, parent=roof, bevel=0.8)
    for i in range(4):
        for j in range(3):
            box(f"TbNub{i}{j}", (7, 7, 1.6), loc=(-21 + i * 14, 2 + j * 10, ROOF_TOP + 10.2),
                mat=ORANGE, parent=roof, bevel=0.4)

    # Two black storage cases behind it.
    for i, x in enumerate((-19, 19)):
        box(f"RoofCase{i}", (31, 44, 10), loc=(x, -38, ROOF_TOP + 12), mat=BLACK, parent=roof, bevel=1.2)
        for j in range(3):
            box(f"RoofCaseRib{i}{j}", (29, 2.4, 1.2), loc=(x, -52 + j * 14, ROOF_TOP + 17.4),
                mat=BLACK, parent=roof, bevel=0.3)

    # Recovery kit down the left rail: an orange shovel that overhangs the back.
    box("ShovelShaft", (3.6, 76, 3.6), loc=(-36, -36, ROOF_TOP + 9), mat=ORANGE, parent=roof, bevel=0.8)
    box("ShovelBlade", (9, 14, 2.4), loc=(-36, -82, ROOF_TOP + 9), mat=ORANGE, parent=roof, bevel=0.8)
    for i, y in enumerate((-16, -52)):
        box(f"RackBracket{i}", (10, 5, 8), loc=(-36, y, ROOF_TOP + 7), mat=BLACK, parent=roof, bevel=0.6)

    # Front light bar: ten round lamps in a black frame on the screen header.
    bar = empty("LightBar", (0, 0, 0), roof)
    box("LightBarFrame", (80, 7, 9), loc=(0, SCREEN_TOP_Y + 3, ROOF_TOP + 1), mat=SATIN, parent=bar, bevel=0.8)
    for i in range(10):
        x = (i - 4.5) * 7.8
        cylinder(f"BarHousing{i}", 3.4, 6.0, loc=(x, SCREEN_TOP_Y + 3, ROOF_TOP + 1), axis="Y",
                 segments=12, mat=SATIN, parent=bar)
        cylinder(f"BarLens{i}", 2.8, 1.6, loc=(x, SCREEN_TOP_Y + 6.4, ROOF_TOP + 1), axis="Y",
                 segments=12, mat=LENS, parent=bar, bevel=0.2)
    # Orange cover strip stowed above the bar, as in the reference.
    box("BarCover", (76, 6, 4), loc=(0, SCREEN_TOP_Y - 4, ROOF_TOP + 7), mat=ORANGE, parent=roof, bevel=0.8)

    return roof


# ── Rear system ─────────────────────────────────────────────────

def build_rear(root, tyre_me, rim_me):
    rear = empty("RearSystem", (0, 0, 0), root)

    box("RearBumper", (94, 14, 12), loc=(0, TAIL_Y - 8, 30), mat=SATIN, parent=rear, bevel=1.4)
    for x in (-34, 34):
        box(f"TailLight{x}", (11, 3, 19), loc=(x, TAIL_Y - 1.8, 56), mat=TAIL, parent=rear, bevel=0.5)
        box(f"TailSurround{x}", (13, 2, 22), loc=(x, TAIL_Y - 0.5, 56), mat=SATIN, parent=rear, bevel=0.5)

    # Swing-out spare carrier and the spare itself — same tyre and rim as the
    # four on the ground, which is how it is on the real truck.
    box("SpareMount", (12, 12, 34), loc=(6, TAIL_Y - 7, 62), mat=SATIN, parent=rear, bevel=1.0)
    tube("SpareArm", [(6, TAIL_Y - 1, 40), (6, TAIL_Y - 9, 52), (6, TAIL_Y - 11, 66)], 2.2, SATIN, rear)
    spare = empty("SpareWheel", (2, TAIL_Y - 13, 66), rear)
    for me, tag in ((tyre_me, "Tyre"), (rim_me, "Rim")):
        ob = bpy.data.objects.new(f"Spare_{tag}", me)
        ob.parent = spare
        ob.rotation_euler = (0, 0, math.pi / 2)
        bpy.context.scene.collection.objects.link(ob)

    return rear


# ── Chassis ─────────────────────────────────────────────────────

def build_chassis(root):
    ch = empty("Chassis", (0, 0, 0), root)

    for sx in (-1, 1):
        box(f"Rail{sx}", (6, 160, 8), loc=(sx * 21, -2, 26), mat=BLACK, parent=ch, bevel=0.8)
    for y in (54, -54):
        box(f"Crossmember{int(y)}", (46, 6, 5), loc=(0, y, 26), mat=BLACK, parent=ch, bevel=0.6)

    # Transmission, motor and driveshafts.
    box("Transmission", (26, 30, 26), loc=(0, -6, 38), mat=BLACK, parent=ch, bevel=1.2)
    cylinder("Motor", 11, 30, loc=(14, -8, 42), axis="X", segments=16, mat=METAL, parent=ch)
    cylinder("MotorCan", 11.6, 4, loc=(-1.5, -8, 42), axis="X", segments=16, mat=BLACK, parent=ch)
    for y_from, y_to, tag in ((-18, AXLE_R + 8, "Rear"), (6, AXLE_F - 8, "Front")):
        cylinder(f"Driveshaft{tag}", 2.2, abs(y_to - y_from), loc=(0, (y_from + y_to) / 2, 31),
                 axis="Y", segments=8, mat=METAL, parent=ch)

    # Battery, ESC, receiver and the steering servo with its green label.
    box("Battery", (34, 48, 13), loc=(0, 30, 38), mat=BLACK, parent=ch, bevel=1.0)
    box("BatteryLabel", (26, 30, 0.6), loc=(0, 30, 44.8), mat=SATIN, parent=ch, bevel=0.2)
    box("ESC", (17, 24, 8), loc=(-17, 8, 40), mat=BLACK, parent=ch, bevel=0.8)
    box("Receiver", (14, 16, 6), loc=(17, 18, 44), mat=BLACK, parent=ch, bevel=0.6)
    box("Servo", (20, 12, 22), loc=(-14, -26, 38), mat=BLACK, parent=ch, bevel=0.8)
    box("ServoLabel", (16, 0.6, 14), loc=(-14, -32.2, 38), mat=GREEN, parent=ch, bevel=0.2)

    # Wiring, routed as it is in the chassis photograph rather than at random.
    tube("WireBattRed", [(8, 52, 44), (12, 30, 48), (4, 10, 44), (-10, 2, 42)], 1.1, WIRE_R, ch)
    tube("WireBattBlack", [(4, 52, 43), (8, 30, 47), (0, 10, 43), (-12, 2, 41)], 1.1, WIRE_K, ch)
    for i, x in enumerate((-4, 0, 4)):
        tube(f"WireMotor{i}", [(-12, -2, 42), (x - 2, -10, 46), (6 + x, -12, 44)], 0.9, WIRE_O, ch)
    tube("WireServo", [(-16, -16, 44), (-18, -24, 46), (-14, -30, 44)], 0.9, WIRE_K, ch)

    return ch


# ── Axles ───────────────────────────────────────────────────────

def build_axle(root, tag, y, tyre_me, rim_me):
    """
    A real axle assembly: tube, offset differential, knuckles, hubs, link arms
    and two coil-overs with actual helical springs. One object per axle, so the
    game can articulate it, and the wheels parented under it so they come along.
    """
    ax = empty(f"Axle{tag}", (0, y, TYRE_R), root)

    cylinder(f"AxleTube{tag}", 5.5, TRACK - 14, loc=(0, 0, 0), axis="X", segments=14,
             mat=BLACK, parent=ax)
    box(f"Diff{tag}", (20, 22, 21), loc=(-11, 0, 0), mat=BLACK, parent=ax, bevel=4.0)
    cylinder(f"DiffCover{tag}", 9.5, 4, loc=(-11, -10, 0), axis="Y", segments=14,
             mat=BLACK, parent=ax)
    for sx, side in ((-1, "L"), (1, "R")):
        key = f"{tag[0]}{side}"
        box(f"Knuckle{key}", (7, 13, 15), loc=(sx * (TRACK / 2 - 7), 0, 0),
            mat=BLACK, parent=ax, bevel=1.6)
        cylinder(f"Stub{key}", 3.0, 7, loc=(sx * (TRACK / 2 - 2), 0, 0), axis="X",
                 segments=10, mat=METAL, parent=ax)
        # Four-link arms back to the chassis.
        box(f"Link{key}", (4, 40, 4), loc=(sx * 26, -y * 0.26, -2), mat=BLACK, parent=ax, bevel=0.6)
        # Coil-over. The game scales this node to compress it.
        sh = empty(f"Shock{key}", (sx * 30, 0, 0), ax)
        cylinder(f"ShockBody{key}", 2.6, 20, loc=(0, 0, 22), axis="Z", segments=10,
                 mat=BLACK, parent=sh)
        cylinder(f"ShockShaft{key}", 1.1, 18, loc=(0, 0, 8), axis="Z", segments=8,
                 mat=CHROME, parent=sh)
        spring(f"ShockSpring{key}", 3.6, 26, 7.5, 0.7, loc=(0, 0, 17), mat=CHROME, parent=sh)
        box(f"ShockEye{key}", (4, 4, 3), loc=(0, 0, 0), mat=BLACK, parent=sh, bevel=0.6)

    # Steering link across the front knuckles.
    if tag == "Front":
        cylinder("SteerLink", 1.4, TRACK - 16, loc=(0, 9, -4), axis="X", segments=8,
                 mat=CHROME, parent=ax)

    for sx, side in ((-1, "L"), (1, "R")):
        wheel(f"Wheel{tag[0]}{side}", (sx * TRACK / 2, 0, 0), ax, tyre_me, rim_me, flip=sx < 0)

    return ax


# ── Build ───────────────────────────────────────────────────────

def main(export=True, keep_rig=False):
    """Build the truck. `export` writes the GLB; skip it when building into an
    open session so the committed asset is not quietly rewritten."""
    clear_scene(keep_rig=keep_rig)
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

    if export:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=os.path.abspath(OUT),
            export_format="GLB",
            export_apply=True,
            export_yup=True,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
            export_draco_mesh_compression_enable=False,
        )

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
    print(f"SCX30_BUILD objects={len(bpy.data.objects)} tris={tris} "
          f"out={os.path.abspath(OUT) if export else '(not exported)'}")
    return {"objects": len(bpy.data.objects), "tris": tris}


if __name__ == "__main__":
    main()
