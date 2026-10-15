#!/usr/bin/env python3
"""Oddech robot model generator: one part list, every file Gazebo, ROS 2 and the website need.

    python tools/build_model.py            (run from the gazebo/ folder; needs numpy and matplotlib)

Writes, all from the PARTS, LINKS and JOINTS below:
    oddech_description/meshes/visual/*.dae     coloured visual meshes, one per link (COLLADA 1.4.1, metres, Z up)
    oddech_description/meshes/stl/*.stl        the same geometry as binary STL, one per link
    oddech_description/meshes/parts/*.stl      every part on its own, the inside parts too (CAD, 3D printing)
    oddech_description/urdf/oddech.urdf.xacro  the robot for ROS 2; oddech.gazebo.xacro holds the Gazebo plugins
    oddech_description/urdf/oddech.urdf        the same, expanded, for tools without xacro
    oddech_gazebo/models/oddech/               the robot as a plain SDF model, for gz sim without ROS
    oddech_gazebo/models/oddech_flat/          the 8 x 6 m flat of the website's room model
    oddech_gazebo/worlds/oddech_flat.sdf       the flat, empty: ROS spawns the robot into it
    oddech_gazebo/worlds/oddech_demo.sdf       the flat with the robot, keyboard driving and mast keys
    docs/oddech_general_arrangement.svg|pdf|png  the blueprint drawing
    blueprint.json                             parts, links, joints and dimensions for the website

Frames follow REP 103: x forward, y left, z up, metres; base_footprint is on the floor under the robot's centre.
Everything here is a design target for a robot not yet built: dimensions from the website's design, masses estimated.
"""
import json
import math
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DESC, GZ, DOCS = ROOT / "oddech_description", ROOT / "oddech_gazebo", ROOT / "docs"
MODEL_DATE = "2026-10-15"                      # fixed, so a re-run without changes writes the same bytes
PKG = "package://oddech_description/meshes"    # URDF (ROS); Gazebo resolves it through GZ_SIM_RESOURCE_PATH
GZM = "model://oddech/meshes"                   # SDF without ROS: a self-contained model, the same meshes copied in

# ======================================================================= the design
COL = {"shell": "F1ECE3", "shell2": "E4DED3", "dark": "26231F", "mid": "5E5850", "metal": "B7B0A4", "accent": "B4532A",
       "indigo": "2E4A6E", "board": "2F4236", "cell": "8C8378", "lidar": "121110", "bay": "0D0C0B", "glass": "DFE6EC",
       "well": "E9A0B4", "filter": "EDE8DF", "vent": "3A3631", "stage": "D9D3C8"}
DECK, STAGE, TRAVEL = 0.352, 0.32, 0.30        # deck top; each of four mast stages is 0.32 m long and travels 0.30 m
WHEEL_R, WHEEL_W, WHEEL_X, WHEEL_Y = 0.045, 0.028, -0.02, 0.152
STAGE_R = [0.024, 0.0195, 0.015, 0.0105]
STAGE_Z0 = 0.032                               # bottom of stage 1 when stowed; each inner stage sits 3 mm higher
HEAD_ON_STAGE = 0.359                          # the nose (head origin) above the bottom of stage 4: 0.40 m when stowed
V_MAX, W_MAX, A_MAX = 0.30, 1.6, 0.5           # drive limits: m/s, rad/s, m/s^2 (website model)
MAST_V = 0.25                                  # nose speed, m/s (0.0625 m/s per stage)


def body_r(z):                                 # the upper body tapers from 0.164 m (z 0.161) to 0.150 m (z 0.351)
    return 0.164 - (z - 0.161) * (0.164 - 0.150) / 0.19


PARTS = []


def part(name, link, shape, dims, xyz, col, **kw):
    PARTS.append(dict(name=name, link=link, shape=shape, dims=dims, xyz=list(xyz), col=col, axis=kw.pop("axis", "z"),
                      internal=kw.pop("internal", False), glow=kw.pop("glow", False), group=kw.pop("group"), dy=kw.pop("dy", 0.0),
                      label=kw.pop("label", name.replace("_", " "))))
    assert not kw, kw


# drive: hub motors, a ball caster in front and one behind (the centre of mass sits 6 mm ahead of the axle)
for side, s in (("left", 1), ("right", -1)):
    L = f"wheel_{side}_link"
    part(f"tyre_{side}", L, "cyl", dict(r1=WHEEL_R, r2=WHEEL_R, h=WHEEL_W, seg=48), (0, 0, 0), "dark", axis="y", group="drive", label=f"{side} drive wheel")
    part(f"hub_{side}", L, "cyl", dict(r1=0.022, r2=0.022, h=0.031, seg=32), (0, 0, 0), "metal", axis="y", group="drive", label=f"{side} hub motor")
    part(f"hub_mark_{side}", L, "box", dict(sx=0.008, sy=0.033, sz=0.006), (0.012, 0, 0), "accent", group="drive", label="hub mark (shows the wheel turning)")
part("caster_front", "caster_front_link", "sphere", dict(r=0.018, seg=20), (0, 0, 0), "metal", group="drive", label="front ball caster")
part("caster_rear", "caster_rear_link", "sphere", dict(r=0.018, seg=20), (0, 0, 0), "metal", group="drive", label="rear ball caster")
# chassis, bumper, charging contacts, exhaust
part("chassis", "base_link", "cyl", dict(r1=0.168, r2=0.170, h=0.10, seg=96), (0, 0, 0.08), "shell2", group="chassis", dy=0.06)
part("bumper", "base_link", "cyl", dict(r1=0.173, r2=0.173, h=0.05, seg=96, arc=(-math.pi / 2.2, math.pi / 1.1), t=0.004), (0, 0, 0.07), "mid", group="chassis", dy=0.06, label="front bumper")
for side, s in (("left", 1), ("right", -1)):
    part(f"contact_{side}", "base_link", "box", dict(sx=0.004, sy=0.03, sz=0.012), (-0.171, s * 0.04, 0.06), "metal", group="chassis", dy=0.06, label="charging contact")
part("exhaust_grille", "base_link", "cyl", dict(r1=0.1735, r2=0.1735, h=0.05, seg=96, arc=(math.pi - 0.82, 1.64), t=0.003), (0, 0, 0.10), "vent", group="vent", dy=0.06, label="exhaust grille: cleaned air out")
part("hepa_filter", "base_link", "cyl", dict(r1=0.04, r2=0.04, h=0.03, seg=40), (-0.135, 0, 0.08), "filter", axis="x", internal=True, group="vent", dy=0.06, label="HEPA and carbon filter")
part("lidar_band", "base_link", "cyl", dict(r1=0.166, r2=0.166, h=0.03, seg=96), (0, 0, 0.145), "lidar", group="lidar", dy=0.14, label="laser scanner window")
part("battery", "base_link", "box", dict(sx=0.16, sy=0.11, sz=0.05), (-0.03, 0, 0.07), "cell", internal=True, group="battery", dy=0.34, label="battery, 14.4 V, about 100 Wh")
part("computer", "base_link", "box", dict(sx=0.10, sy=0.08, sz=0.012), (0.02, 0, 0.22), "board", internal=True, group="compute", dy=0.5, label="on-board computer")
part("processor", "base_link", "box", dict(sx=0.03, sy=0.03, sz=0.008), (0.02, 0, 0.23), "dark", internal=True, group="compute", dy=0.5, label="processor")
# upper body: shell, deck, light ring, speaker grille, the living-cell window, the filter sampler at the back
part("body", "base_link", "cyl", dict(r1=0.164, r2=0.150, h=0.19, seg=96), (0, 0, 0.256), "shell", group="body", dy=0.66, label="upper body")
part("deck", "base_link", "cyl", dict(r1=0.150, r2=0.148, h=0.012, seg=96), (0, 0, DECK - 0.003), "shell2", group="body", dy=0.66)
part("light_ring", "base_link", "torus", dict(R=0.151, r=0.0065, seg=96, tube=12), (0, 0, DECK - 0.012), "indigo", glow=True, group="ring", dy=0.66, label="light ring")
part("speaker_grille", "base_link", "cyl", dict(r1=body_r(0.175) + 0.0015, r2=body_r(0.215) + 0.0015, h=0.04, seg=64, arc=(-0.7, 1.4), t=0.003), (0, 0, 0.195), "mid", group="ring", dy=0.66, label="speaker and microphones")
part("cell_window", "base_link", "box", dict(sx=0.03, sy=0.12, sz=0.07), (0.148, 0, 0.27), "bay", group="bio", dy=0.66, label="Living Air Sensor bay")
part("cartridge", "base_link", "box", dict(sx=0.075, sy=0.11, sz=0.006), (0.07, 0, 0.29), "glass", internal=True, group="bio", dy=0.98, label="8-well living-cell cartridge")
for k in range(8):
    part(f"well_{k + 1}", "base_link", "box", dict(sx=0.022, sy=0.022, sz=0.008), (0.07 + (0.017 if k < 4 else -0.017), 0.039 - (k % 4) * 0.026, 0.295), "well", internal=True, glow=True, group="bio", dy=0.98, label=("exposed" if k < 4 else "control and reference") + " well")
part("sampler", "base_link", "cyl", dict(r1=0.024, r2=0.024, h=0.05, seg=32), (-0.175, 0, 0.25), "mid", axis="x", group="sampler", dy=0.66, label="filter sampler")
part("sampler_face", "base_link", "cyl", dict(r1=0.019, r2=0.019, h=0.004, seg=32), (-0.201, 0, 0.25), "accent", axis="x", group="sampler", dy=0.66, label="sampler filter face")
# telescoping mast: each stage's frame is at its bottom end
for k, r in enumerate(STAGE_R):
    part(f"stage_{k + 1}", f"mast_stage_{k + 1}", "cyl", dict(r1=r, r2=r, h=STAGE, seg=32), (0, 0, STAGE / 2), "stage" if k % 2 == 0 else "metal", group="mast", label=f"mast stage {k + 1}")
# the nose: the head's frame is the height the air is sampled at
part("head_body", "head_link", "cyl", dict(r1=0.046, r2=0.050, h=0.06, seg=48), (0, 0, -0.008), "shell", group="head", label="sensor head")
part("air_inlet", "head_link", "cyl", dict(r1=0.0505, r2=0.0505, h=0.014, seg=48), (0, 0, 0.026), "dark", group="head", label="air inlet slots")
part("head_cap", "head_link", "cyl", dict(r1=0.050, r2=0.044, h=0.01, seg=48), (0, 0, 0.038), "shell2", group="head", label="head cap")
part("status_led", "head_link", "sphere", dict(r=0.006, seg=12), (0.049, 0, -0.01), "accent", glow=True, group="head", label="status light")


def tube_mass(r, t=0.001, L=STAGE, rho=2700.0):     # aluminium tube, 1 mm wall
    return rho * 2 * math.pi * r * t * L


def I_cyl(m, r, h, axis="z"):                       # solid cylinder about its centre
    a, b = m * (3 * r * r + h * h) / 12, m * r * r / 2
    return {"z": (a, a, b), "y": (a, b, a), "x": (b, a, a)}[axis]


def I_tube(m, r, h):                                # thin-walled tube about its centre
    a = m * (6 * r * r + h * h) / 12
    return (a, a, m * r * r)


# link: mass (kg), centre of mass in the link frame, principal inertia about it, collision primitives (shape, dims, xyz, rpy)
LINKS = {
    "base_footprint": None,
    "base_link": dict(m=4.20, com=(-0.015, 0, 0.12), I=I_cyl(4.20, 0.17, 0.33), col=[("cylinder", dict(radius=0.173, length=0.322), (0, 0, 0.191), (0, 0, 0))]),
    "wheel_left_link": dict(m=0.28, com=(0, 0, 0), I=I_cyl(0.28, WHEEL_R, WHEEL_W, "y"), col=[("cylinder", dict(radius=WHEEL_R, length=WHEEL_W), (0, 0, 0), (math.pi / 2, 0, 0))]),
    "wheel_right_link": dict(m=0.28, com=(0, 0, 0), I=I_cyl(0.28, WHEEL_R, WHEEL_W, "y"), col=[("cylinder", dict(radius=WHEEL_R, length=WHEEL_W), (0, 0, 0), (math.pi / 2, 0, 0))]),
    "caster_front_link": dict(m=0.02, com=(0, 0, 0), I=(0.4 * 0.02 * 0.018 ** 2,) * 3, col=[("sphere", dict(radius=0.018), (0, 0, 0), (0, 0, 0))]),
    "caster_rear_link": dict(m=0.02, com=(0, 0, 0), I=(0.4 * 0.02 * 0.018 ** 2,) * 3, col=[("sphere", dict(radius=0.018), (0, 0, 0), (0, 0, 0))]),
    "head_link": dict(m=0.30, com=(0, 0, 0.0025), I=I_cyl(0.30, 0.05, 0.081), col=[("cylinder", dict(radius=0.05, length=0.081), (0, 0, 0.0025), (0, 0, 0))]),
    "lidar_link": None, "imu_link": None, "cartridge_link": None,
}
for k, r in enumerate(STAGE_R):
    m = tube_mass(r)
    LINKS[f"mast_stage_{k + 1}"] = dict(m=m, com=(0, 0, STAGE / 2), I=I_tube(m, r, STAGE), col=[("cylinder", dict(radius=r, length=STAGE), (0, 0, STAGE / 2), (0, 0, 0))])

# joint: name, type, parent, child, origin in the parent frame, axis, limits
MAST_LIM = dict(lower=0.0, upper=TRAVEL, effort=60.0, velocity=MAST_V / 4)
MAST_PID = (600.0, 60.0, 80.0)                 # force PID per stage (N/m, N/(m s), N s/m): holds the stages and head against gravity
JOINTS = [
    ("base_joint", "fixed", "base_footprint", "base_link", (0, 0, 0), None, None),
    ("wheel_left_joint", "continuous", "base_link", "wheel_left_link", (WHEEL_X, WHEEL_Y, WHEEL_R), (0, 1, 0), None),
    ("wheel_right_joint", "continuous", "base_link", "wheel_right_link", (WHEEL_X, -WHEEL_Y, WHEEL_R), (0, 1, 0), None),
    ("caster_front_joint", "fixed", "base_link", "caster_front_link", (0.12, 0, 0.018), None, None),
    ("caster_rear_joint", "fixed", "base_link", "caster_rear_link", (-0.13, 0, 0.0185), None, None),   # 0.5 mm clear: stops a tip back
    ("mast_joint_1", "prismatic", "base_link", "mast_stage_1", (0, 0, STAGE_Z0), (0, 0, 1), MAST_LIM),
    ("mast_joint_2", "prismatic", "mast_stage_1", "mast_stage_2", (0, 0, 0.003), (0, 0, 1), MAST_LIM),
    ("mast_joint_3", "prismatic", "mast_stage_2", "mast_stage_3", (0, 0, 0.003), (0, 0, 1), MAST_LIM),
    ("mast_joint_4", "prismatic", "mast_stage_3", "mast_stage_4", (0, 0, 0.003), (0, 0, 1), MAST_LIM),
    ("head_joint", "fixed", "mast_stage_4", "head_link", (0, 0, HEAD_ON_STAGE), None, None),
    ("lidar_joint", "fixed", "base_link", "lidar_link", (0, 0, 0.145), None, None),
    ("imu_joint", "fixed", "base_link", "imu_link", (0, 0, 0.10), None, None),
    ("cartridge_joint", "fixed", "base_link", "cartridge_link", (0.07, 0, 0.29), None, None),
]
LIDAR = dict(samples=360, rmin=0.20, rmax=8.0, rate=10, z=0.145)   # rmin > band radius: the scanner sees past its own window
MESH_OF = {"base_link": "base", "wheel_left_link": "wheel", "wheel_right_link": "wheel", "caster_front_link": "caster",
           "caster_rear_link": "caster", "head_link": "head", **{f"mast_stage_{k + 1}": f"mast_stage_{k + 1}" for k in range(4)}}


def link_origin(name, q=0.0):
    """Origin of a link in base_footprint at mast extension q per stage (0 to TRAVEL)."""
    if name == "base_footprint":
        return np.zeros(3)
    j = next(j for j in JOINTS if j[3] == name)
    o = link_origin(j[2], q) + np.array(j[4], float)
    if j[1] == "prismatic":
        o = o + q * np.array(j[5], float)
    return o


# ======================================================================= meshes
def rot_axis(axis):
    """Rotation taking a +z-aligned primitive onto the part's axis."""
    if axis == "x":
        return np.array([[0, 0, 1], [0, 1, 0], [-1, 0, 0]], float)        # +90 deg about y
    if axis == "y":
        return np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)        # -90 deg about x
    return np.eye(3)


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


class Mesh:
    """Triangle soup with per-corner normals."""

    def __init__(self):
        self.p, self.n = [], []

    def tri(self, a, b, c, na=None, nb=None, nc=None):
        a, b, c = (np.asarray(v, float) for v in (a, b, c))
        f = np.cross(b - a, c - a)
        if np.linalg.norm(f) < 1e-14:                   # degenerate (pole of a sphere): skip
            return
        f = unit(f)
        self.p += [a, b, c]
        self.n += [unit(na) if na is not None else f, unit(nb) if nb is not None else f, unit(nc) if nc is not None else f]

    def arrays(self):
        return np.array(self.p, float).reshape(-1, 3), np.array(self.n, float).reshape(-1, 3)


def m_cyl(r1, r2, h, seg, arc=None, t=None):
    """Frustum along +z centred on the origin (r1 at the bottom). With arc=(start, length), a curved shell of thickness t."""
    M, z0, z1, k = Mesh(), -h / 2, h / 2, (r1 - r2) / h
    if arc is None:
        for i in range(seg):
            a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            c0, s0, c1, s1 = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
            b0, b1, t0, t1 = (r1 * c0, r1 * s0, z0), (r1 * c1, r1 * s1, z0), (r2 * c0, r2 * s0, z1), (r2 * c1, r2 * s1, z1)
            n0, n1 = (c0, s0, k), (c1, s1, k)
            M.tri(b0, b1, t1, n0, n1, n1); M.tri(b0, t1, t0, n0, n1, n0)
            M.tri((0, 0, z0), b1, b0); M.tri((0, 0, z1), t0, t1)
        return M
    a_start, a_len = arc
    n = max(2, int(seg * a_len / (2 * math.pi)) + 1)
    q1, q2 = r1 - t, r2 - t
    ang = [a_start + a_len * i / n for i in range(n + 1)]
    for i in range(n):
        a0, a1 = ang[i], ang[i + 1]
        c0, s0, c1, s1 = math.cos(a0), math.sin(a0), math.cos(a1), math.sin(a1)
        ob0, ob1, ot0, ot1 = (r1 * c0, r1 * s0, z0), (r1 * c1, r1 * s1, z0), (r2 * c0, r2 * s0, z1), (r2 * c1, r2 * s1, z1)
        ib0, ib1, it0, it1 = (q1 * c0, q1 * s0, z0), (q1 * c1, q1 * s1, z0), (q2 * c0, q2 * s0, z1), (q2 * c1, q2 * s1, z1)
        M.tri(ob0, ob1, ot1, (c0, s0, k), (c1, s1, k), (c1, s1, k)); M.tri(ob0, ot1, ot0, (c0, s0, k), (c1, s1, k), (c0, s0, k))
        M.tri(ib0, it1, ib1, (-c0, -s0, -k), (-c1, -s1, -k), (-c1, -s1, -k)); M.tri(ib0, it0, it1, (-c0, -s0, -k), (-c0, -s0, -k), (-c1, -s1, -k))
        M.tri(ob0, ib1, ob1); M.tri(ob0, ib0, ib1)                         # bottom strip, facing down
        M.tri(ot0, ot1, it1); M.tri(ot0, it1, it0)                         # top strip, facing up
    for a, flip in ((ang[0], True), (ang[-1], False)):                    # the two end faces
        c, s = math.cos(a), math.sin(a)
        ob, ot, ib, it = (r1 * c, r1 * s, z0), (r2 * c, r2 * s, z1), (q1 * c, q1 * s, z0), (q2 * c, q2 * s, z1)
        if flip:
            M.tri(ob, ot, it); M.tri(ob, it, ib)
        else:
            M.tri(ob, it, ot); M.tri(ob, ib, it)
    return M


def m_box(sx, sy, sz):
    M, x, y, z = Mesh(), sx / 2, sy / 2, sz / 2
    v = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    for a, b, c, d in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)):
        M.tri(v[a], v[b], v[c]); M.tri(v[a], v[c], v[d])
    return M


def m_sphere(r, seg):
    M, rings = Mesh(), max(6, seg // 2)
    P = lambda u, w: (r * math.cos(w) * math.cos(u), r * math.cos(w) * math.sin(u), r * math.sin(w))
    for j in range(rings):
        w0, w1 = -math.pi / 2 + math.pi * j / rings, -math.pi / 2 + math.pi * (j + 1) / rings
        for i in range(seg):
            u0, u1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
            a, b, c, d = P(u0, w0), P(u1, w0), P(u1, w1), P(u0, w1)
            M.tri(a, b, c, a, b, c); M.tri(a, c, d, a, c, d)
    return M


def m_torus(R, r, seg, tube):
    M = Mesh()
    P = lambda u, v: ((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v))
    Nn = lambda u, v: (math.cos(v) * math.cos(u), math.cos(v) * math.sin(u), math.sin(v))
    for i in range(seg):
        u0, u1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        for j in range(tube):
            v0, v1 = 2 * math.pi * j / tube, 2 * math.pi * (j + 1) / tube
            M.tri(P(u0, v0), P(u1, v0), P(u1, v1), Nn(u0, v0), Nn(u1, v0), Nn(u1, v1))
            M.tri(P(u0, v0), P(u1, v1), P(u0, v1), Nn(u0, v0), Nn(u1, v1), Nn(u0, v1))
    return M


def part_mesh(p):
    """The part in its link frame: (positions, normals)."""
    d = p["dims"]
    if p["shape"] == "cyl":
        M = m_cyl(d["r1"], d["r2"], d["h"], d["seg"], d.get("arc"), d.get("t"))
    elif p["shape"] == "box":
        M = m_box(d["sx"], d["sy"], d["sz"])
    elif p["shape"] == "sphere":
        M = m_sphere(d["r"], d["seg"])
    else:
        M = m_torus(d["R"], d["r"], d["seg"], d["tube"])
    P, N = M.arrays()
    Rm = rot_axis(p["axis"])
    return P @ Rm.T + np.array(p["xyz"], float), N @ Rm.T


def write_stl(path, P, name):
    P = np.asarray(P, np.float32).reshape(-1, 3, 3)
    n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20)
    rec = np.zeros(len(P), dtype=[("n", "<f4", 3), ("v", "<f4", (3, 3)), ("a", "<u2")])
    rec["n"], rec["v"] = n, P
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        f.write(("Oddech " + name + " - Team Oddech " + MODEL_DATE + ", metres").encode().ljust(80, b" ")[:80])
        f.write(struct.pack("<I", len(P)))
        f.write(rec.tobytes())


def write_dae(path, name, groups):
    """groups: [(material, hex colour, glow, P, N)] -> one COLLADA geometry with a <triangles> block per material."""
    fmt = lambda a: " ".join(f"{v:.6g}" for v in np.asarray(a).ravel())
    P = np.concatenate([g[3] for g in groups]); N = np.concatenate([g[4] for g in groups])
    gid = f"{name}-mesh"
    eff, mats, tris, binds, off = [], [], [], [], 0
    for mat, hexc, glow, Pg, _ in groups:
        r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (0, 2, 4))
        em = f"{r:.4f} {g:.4f} {b:.4f} 1" if glow else "0 0 0 1"
        eff.append(f'<effect id="{mat}-effect"><profile_COMMON><technique sid="common"><phong>'
                   f'<emission><color sid="emission">{em}</color></emission>'
                   f'<ambient><color sid="ambient">{r * .6:.4f} {g * .6:.4f} {b * .6:.4f} 1</color></ambient>'
                   f'<diffuse><color sid="diffuse">{r:.4f} {g:.4f} {b:.4f} 1</color></diffuse>'
                   f'<specular><color sid="specular">0.25 0.25 0.25 1</color></specular>'
                   f'<shininess><float sid="shininess">24</float></shininess></phong></technique></profile_COMMON></effect>')
        mats.append(f'<material id="{mat}-material" name="{mat}"><instance_effect url="#{mat}-effect"/></material>')
        t = len(Pg) // 3
        idx = np.arange(off, off + 3 * t)
        tris.append(f'<triangles material="{mat}-material" count="{t}"><input semantic="VERTEX" source="#{gid}-vertices" offset="0"/>'
                    f'<input semantic="NORMAL" source="#{gid}-normals" offset="1"/><p>{" ".join(f"{i} {i}" for i in idx)}</p></triangles>')
        binds.append(f'<instance_material symbol="{mat}-material" target="#{mat}-material"/>')
        off += 3 * t
    src = lambda kind, A: (f'<source id="{gid}-{kind}"><float_array id="{gid}-{kind}-array" count="{A.size}">{fmt(A)}</float_array>'
                           f'<technique_common><accessor source="#{gid}-{kind}-array" count="{len(A)}" stride="3">'
                           f'<param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>')
    doc = (f'<?xml version="1.0" encoding="utf-8"?>\n<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">\n'
           f'<asset><contributor><author>Team Oddech</author><authoring_tool>oddech build_model.py</authoring_tool></contributor>'
           f'<created>{MODEL_DATE}T00:00:00</created><modified>{MODEL_DATE}T00:00:00</modified><unit name="meter" meter="1"/><up_axis>Z_UP</up_axis></asset>\n'
           f'<library_effects>{"".join(eff)}</library_effects>\n<library_materials>{"".join(mats)}</library_materials>\n'
           f'<library_geometries><geometry id="{gid}" name="{name}"><mesh>{src("positions", P)}{src("normals", N)}'
           f'<vertices id="{gid}-vertices"><input semantic="POSITION" source="#{gid}-positions"/></vertices>{"".join(tris)}</mesh></geometry></library_geometries>\n'
           f'<library_visual_scenes><visual_scene id="Scene" name="Scene"><node id="{name}" name="{name}" type="NODE">'
           f'<instance_geometry url="#{gid}" name="{name}"><bind_material><technique_common>{"".join(binds)}</technique_common></bind_material>'
           f'</instance_geometry></node></visual_scene></library_visual_scenes>\n<scene><instance_visual_scene url="#Scene"/></scene>\n</COLLADA>\n')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(doc, encoding="utf-8")


def build_meshes():
    written = {}
    for link, mesh in MESH_OF.items():
        if mesh in written:
            continue
        parts = [p for p in PARTS if p["link"] == link and not p["internal"]]
        groups, allP = [], []
        for col in dict.fromkeys(p["col"] for p in parts):
            PP = [part_mesh(p) for p in parts if p["col"] == col]
            Pg, Ng = np.concatenate([a for a, _ in PP]), np.concatenate([b for _, b in PP])
            glow = any(p["glow"] for p in parts if p["col"] == col)
            groups.append((col, COL[col], glow, Pg, Ng)); allP.append(Pg)
        write_dae(DESC / "meshes" / "visual" / f"{mesh}.dae", mesh, groups)
        write_dae(GZ / "models" / "oddech" / "meshes" / f"{mesh}.dae", mesh, groups)
        write_stl(DESC / "meshes" / "stl" / f"{mesh}.stl", np.concatenate(allP), mesh)
        written[mesh] = sum(len(g[3]) // 3 for g in groups)
    for p in PARTS:
        write_stl(DESC / "meshes" / "parts" / f"{p['name']}.stl", part_mesh(p)[0], p["name"])
    return written


# ======================================================================= URDF (ROS 2) and SDF (Gazebo)
f3 = lambda v: " ".join(f"{x:.6g}" for x in v)
HEADER = (f"<!-- Oddech OD-1 · generated by tools/build_model.py on {MODEL_DATE} from the part list: edit the generator, not this file.\n"
          "     Frames: REP 103 (x forward, y left, z up), metres, kilograms. Design targets for a robot not yet built. -->")


def urdf_geometry(kind, d):
    if kind == "cylinder":
        return f'<cylinder radius="{d["radius"]:.6g}" length="{d["length"]:.6g}"/>'
    if kind == "sphere":
        return f'<sphere radius="{d["radius"]:.6g}"/>'
    return f'<box size="{f3(d["size"])}"/>'


def urdf_links():
    out = []
    for name, L in LINKS.items():
        if L is None:
            out.append(f'  <link name="{name}"/>')
            continue
        out.append(f'  <link name="{name}">')
        out.append(f'    <visual name="{name}_visual"><origin xyz="0 0 0" rpy="0 0 0"/><geometry><mesh filename="{PKG}/visual/{MESH_OF[name]}.dae"/></geometry></visual>')
        for i, (kind, d, xyz, rpy) in enumerate(L["col"]):
            out.append(f'    <collision name="{name}_collision_{i}"><origin xyz="{f3(xyz)}" rpy="{f3(rpy)}"/><geometry>{urdf_geometry(kind, d)}</geometry></collision>')
        I = L["I"]
        out.append(f'    <inertial><origin xyz="{f3(L["com"])}" rpy="0 0 0"/><mass value="{L["m"]:.6g}"/>'
                   f'<inertia ixx="{I[0]:.6g}" ixy="0" ixz="0" iyy="{I[1]:.6g}" iyz="0" izz="{I[2]:.6g}"/></inertial>')
        out.append('  </link>')
    return out


def urdf_joints():
    out = []
    for name, kind, parent, child, xyz, axis, lim in JOINTS:
        s = f'  <joint name="{name}" type="{kind}"><parent link="{parent}"/><child link="{child}"/><origin xyz="{f3(xyz)}" rpy="0 0 0"/>'
        if axis:
            s += f'<axis xyz="{f3(axis)}"/>'
        if kind == "continuous":
            s += '<dynamics damping="0.01" friction="0.0"/>'
        if lim:
            s += f'<limit lower="{lim["lower"]}" upper="{lim["upper"]}" effort="{lim["effort"]}" velocity="{lim["velocity"]}"/><dynamics damping="2.0" friction="0.2"/>'
        out.append(s + '</joint>')
    return out


def gz_plugins(indent="    "):
    """Model plugins, shared by the URDF <gazebo> block and the SDF model."""
    js = [indent + '<plugin filename="gz-sim-diff-drive-system" name="gz::sim::systems::DiffDrive">',
          f'{indent}  <left_joint>wheel_left_joint</left_joint><right_joint>wheel_right_joint</right_joint>',
          f'{indent}  <wheel_separation>{2 * WHEEL_Y:.6g}</wheel_separation><wheel_radius>{WHEEL_R:.6g}</wheel_radius>',
          f'{indent}  <max_linear_velocity>{V_MAX}</max_linear_velocity><max_angular_velocity>{W_MAX}</max_angular_velocity>',
          f'{indent}  <max_linear_acceleration>{A_MAX}</max_linear_acceleration><min_linear_acceleration>-{A_MAX}</min_linear_acceleration>',
          f'{indent}  <topic>/cmd_vel</topic><odom_topic>/odom</odom_topic><tf_topic>/tf</tf_topic>',
          f'{indent}  <frame_id>odom</frame_id><child_frame_id>base_footprint</child_frame_id><odom_publish_frequency>30</odom_publish_frequency>',
          indent + '</plugin>',
          indent + '<plugin filename="gz-sim-joint-state-publisher-system" name="gz::sim::systems::JointStatePublisher"><topic>/joint_states</topic></plugin>']
    for k in range(4):   # every stage follows the same command: the extension of one stage, 0 to 0.30 m (nose = 0.40 + 4 x cmd)
        js.append(f'{indent}<plugin filename="gz-sim-joint-position-controller-system" name="gz::sim::systems::JointPositionController">'
                  f'<joint_name>mast_joint_{k + 1}</joint_name><topic>/mast/cmd</topic><initial_position>0</initial_position>'
                  f'<p_gain>{MAST_PID[0]}</p_gain><i_gain>{MAST_PID[1]}</i_gain><d_gain>{MAST_PID[2]}</d_gain><i_max>20</i_max><i_min>-20</i_min>'
                  f'<cmd_max>{MAST_LIM["effort"]}</cmd_max><cmd_min>-{MAST_LIM["effort"]}</cmd_min></plugin>')
    return js


def sensor_lidar(indent, pose=None):
    p = f"<pose>{f3(pose)} 0 0 0</pose>" if pose else ""
    return (f'{indent}<sensor name="lidar" type="gpu_lidar">{p}<topic>/scan</topic><gz_frame_id>lidar_link</gz_frame_id>'
            f'<update_rate>{LIDAR["rate"]}</update_rate><always_on>true</always_on><visualize>true</visualize><lidar><scan><horizontal>'
            f'<samples>{LIDAR["samples"]}</samples><resolution>1</resolution><min_angle>-3.14159</min_angle><max_angle>3.12414</max_angle>'
            f'</horizontal></scan><range><min>{LIDAR["rmin"]}</min><max>{LIDAR["rmax"]}</max><resolution>0.01</resolution></range>'
            f'<noise><type>gaussian</type><mean>0</mean><stddev>0.01</stddev></noise></lidar></sensor>')


def sensor_imu(indent, pose=None):
    p = f"<pose>{f3(pose)} 0 0 0</pose>" if pose else ""
    return (f'{indent}<sensor name="imu" type="imu">{p}<topic>/imu</topic><gz_frame_id>imu_link</gz_frame_id>'
            f'<update_rate>50</update_rate><always_on>true</always_on></sensor>')


def gazebo_blocks():
    out = ['  <!-- Gazebo Harmonic: friction, sensors and model plugins -->']
    for w in ("wheel_left_link", "wheel_right_link"):
        out.append(f'  <gazebo reference="{w}"><mu1>1.0</mu1><mu2>1.0</mu2></gazebo>')
    for c in ("caster_front_link", "caster_rear_link"):
        out.append(f'  <gazebo reference="{c}"><mu1>0.0</mu1><mu2>0.0</mu2></gazebo>')
    out.append('  <gazebo reference="lidar_link">'); out.append(sensor_lidar("    ")); out.append('  </gazebo>')
    out.append('  <gazebo reference="imu_link">'); out.append(sensor_imu("    ")); out.append('  </gazebo>')
    out.append('  <gazebo>'); out += gz_plugins("    "); out.append('  </gazebo>')
    return out


def write_urdf():
    d = DESC / "urdf"
    d.mkdir(parents=True, exist_ok=True)
    body = urdf_links() + urdf_joints()
    xa = ['<?xml version="1.0"?>', HEADER, '<robot name="oddech" xmlns:xacro="http://www.ros.org/wiki/xacro">',
          '  <xacro:arg name="gazebo" default="true"/>'] + body + [
          '  <xacro:if value="$(arg gazebo)"><xacro:include filename="$(find oddech_description)/urdf/oddech.gazebo.xacro"/></xacro:if>', '</robot>']
    (d / "oddech.urdf.xacro").write_text("\n".join(xa) + "\n", encoding="utf-8")
    gz = ['<?xml version="1.0"?>', HEADER, '<robot xmlns:xacro="http://www.ros.org/wiki/xacro">'] + gazebo_blocks() + ['</robot>']
    (d / "oddech.gazebo.xacro").write_text("\n".join(gz) + "\n", encoding="utf-8")
    flat = ['<?xml version="1.0"?>', HEADER, '<robot name="oddech">'] + body + gazebo_blocks() + ['</robot>']
    (d / "oddech.urdf").write_text("\n".join(flat) + "\n", encoding="utf-8")


def sdf_inertial(L):
    I = L["I"]
    return (f'<inertial><pose>{f3(L["com"])} 0 0 0</pose><mass>{L["m"]:.6g}</mass><inertia><ixx>{I[0]:.6g}</ixx><ixy>0</ixy><ixz>0</ixz>'
            f'<iyy>{I[1]:.6g}</iyy><iyz>0</iyz><izz>{I[2]:.6g}</izz></inertia></inertial>')


def sdf_geom(kind, d):
    if kind == "cylinder":
        return f'<cylinder><radius>{d["radius"]:.6g}</radius><length>{d["length"]:.6g}</length></cylinder>'
    if kind == "sphere":
        return f'<sphere><radius>{d["radius"]:.6g}</radius></sphere>'
    return f'<box><size>{f3(d["size"])}</size></box>'


MODEL_CONFIG = """<?xml version="1.0"?>
<model>
  <name>{title}</name>
  <version>1.0</version>
  <sdf version="1.10">model.sdf</sdf>
  <author><name>Team Oddech</name><email>s254167v@st.go.tuat.ac.jp</email></author>
  <description>{desc}</description>
</model>
"""


def write_sdf_model():
    """The robot without ROS: casters, sensors and frames folded into base_link, as the URDF converter does."""
    d = GZ / "models" / "oddech"
    d.mkdir(parents=True, exist_ok=True)
    o = ['<?xml version="1.0"?>', HEADER, '<sdf version="1.10">', '  <model name="oddech">', '    <pose>0 0 0 0 0 0</pose>']
    base = LINKS["base_link"]
    o.append('    <link name="base_link">')
    o.append('      ' + sdf_inertial(base))
    o.append(f'      <visual name="base_visual"><geometry><mesh><uri>{GZM}/base.dae</uri></mesh></geometry></visual>')
    kind, dd, xyz, rpy = base["col"][0]
    o.append(f'      <collision name="base_collision"><pose>{f3(xyz)} {f3(rpy)}</pose><geometry>{sdf_geom(kind, dd)}</geometry></collision>')
    for c in ("caster_front", "caster_rear"):
        xyz = link_origin(f"{c}_link")
        o.append(f'      <visual name="{c}_visual"><pose>{f3(xyz)} 0 0 0</pose><geometry><mesh><uri>{GZM}/caster.dae</uri></mesh></geometry></visual>')
        o.append(f'      <collision name="{c}_collision"><pose>{f3(xyz)} 0 0 0</pose><geometry><sphere><radius>0.018</radius></sphere></geometry>'
                 '<surface><friction><ode><mu>0.0</mu><mu2>0.0</mu2></ode></friction></surface></collision>')
    o.append(sensor_lidar("      ", (0, 0, LIDAR["z"])))
    o.append(sensor_imu("      ", (0, 0, 0.10)))
    o.append('    </link>')
    for name in ("wheel_left_link", "wheel_right_link", "mast_stage_1", "mast_stage_2", "mast_stage_3", "mast_stage_4", "head_link"):
        L = LINKS[name]
        o.append(f'    <link name="{name}"><pose>{f3(link_origin(name))} 0 0 0</pose>')
        o.append('      ' + sdf_inertial(L))
        o.append(f'      <visual name="{name}_visual"><geometry><mesh><uri>{GZM}/{MESH_OF[name]}.dae</uri></mesh></geometry></visual>')
        for i, (kind, dd, xyz, rpy) in enumerate(L["col"]):
            fr = '<surface><friction><ode><mu>1.0</mu><mu2>1.0</mu2></ode></friction></surface>' if name.startswith("wheel") else ""
            o.append(f'      <collision name="{name}_collision_{i}"><pose>{f3(xyz)} {f3(rpy)}</pose><geometry>{sdf_geom(kind, dd)}</geometry>{fr}</collision>')
        o.append('    </link>')
    for name, kind, parent, child, xyz, axis, lim in JOINTS:
        if child in ("base_link", "caster_front_link", "caster_rear_link", "lidar_link", "imu_link", "cartridge_link"):
            continue
        t = {"continuous": "revolute"}.get(kind, kind)
        s = f'    <joint name="{name}" type="{t}"><parent>{parent}</parent><child>{child}</child>'
        if axis:
            s += f'<axis><xyz>{f3(axis)}</xyz>'
            if kind == "continuous":
                s += '<limit><lower>-1e16</lower><upper>1e16</upper></limit><dynamics><damping>0.01</damping></dynamics>'
            else:
                s += (f'<limit><lower>{lim["lower"]}</lower><upper>{lim["upper"]}</upper><effort>{lim["effort"]}</effort><velocity>{lim["velocity"]}</velocity></limit>'
                      '<dynamics><damping>2.0</damping><friction>0.2</friction></dynamics>')
            s += '</axis>'
        o.append(s + '</joint>')
    for fr, xyz in (("lidar_link", (0, 0, LIDAR["z"])), ("imu_link", (0, 0, 0.10)), ("cartridge_link", (0.07, 0, 0.29))):
        o.append(f'    <frame name="{fr}" attached_to="base_link"><pose>{f3(xyz)} 0 0 0</pose></frame>')
    o += gz_plugins("    ")
    o += ['  </model>', '</sdf>']
    (d / "model.sdf").write_text("\n".join(o) + "\n", encoding="utf-8")
    (d / "model.config").write_text(MODEL_CONFIG.format(title="Oddech OD-1", desc="Oddech: a robot that breathes the room. "
                                    "Differential drive, a four-stage telescoping mast lifting the air inlet from 0.40 to 1.60 m, 2D lidar and IMU. Design targets."), encoding="utf-8")


# ======================================================================= the flat (sim.js LAYOUT: 8 x 6 x 2.7 m)
ROOM = dict(Lx=8.0, Ly=6.0, H=2.7)
FURN = [  # name, centre xyz, size xyz, rgb hex, collide
    ("kitchen_counter", (1.4, 5.675, 0.45), (2.8, 0.65, 0.9), "D8D2C6", True),
    ("kitchen_counter_side", (0.31, 4.375, 0.45), (0.62, 1.95, 0.9), "D8D2C6", True),
    ("cooktop", (1.25, 5.62, 0.915), (0.6, 0.5, 0.03), "26231F", True),
    ("sofa_seat", (5.75, 0.62, 0.21), (2.3, 0.86, 0.42), "7E98BC", True),
    ("sofa_back", (5.75, 0.25, 0.5), (2.3, 0.2, 0.6), "6C86AA", True),
    ("bookshelf", (7.81, 2.75, 0.95), (0.38, 3.1, 1.9), "B9A58C", True),
    ("household_monitor", (7.6, 2.6, 1.25), (0.06, 0.12, 0.08), "F1ECE3", False),
    ("play_mat", (3.5, 1.7, 0.004), (1.6, 1.6, 0.008), "E9C9A8", False),
    ("dock", (7.79, 5.0, 0.07), (0.12, 0.34, 0.14), "2E4A6E", True),
]
TABLES = [("dining_table", (3.15, 3.55, 4.85, 4.65), 0.75, "C9B79C"), ("coffee_table", (5.0, 1.5, 6.2, 2.05), 0.42, "C9B79C")]
CYLS = [("purifier", (7.25, 0.55, 0.275), 0.17, 0.55, "EDE8DF", True), ("pot", (1.25, 5.62, 1.0), 0.12, 0.14, "B7B0A4", True),
        ("candle", (4.0, 4.1, 0.80), 0.03, 0.10, "F6EBD9", True)]
PEOPLE = [  # name, x, y, body radius, body bottom, body top, head radius, head centre (= breathing height, sim.js)
    ("child", 3.5, 1.7, 0.12, 0.0, 0.36, 0.09, 0.45),
    ("adult", 5.75, 0.62, 0.17, 0.42, 0.99, 0.11, 1.10)]


def wall_boxes():
    t, H = 0.1, ROOM["H"]
    return [("wall_west", (-t / 2, 3.0, H / 2), (t, 6.0 + 2 * t, H), 0.0),
            ("wall_south", (4.0, -t / 2, H / 2), (8.0 + 2 * t, t, H), 0.75),
            ("wall_north_a", (2.25, 6.0 + t / 2, H / 2), (4.7, t, H), 0.0),
            ("wall_north_b", (7.25, 6.0 + t / 2, H / 2), (1.7, t, H), 0.0),
            ("wall_north_sill", (5.5, 6.0 + t / 2, 0.45), (1.8, t, 0.9), 0.0),
            ("wall_north_head", (5.5, 6.0 + t / 2, 2.45), (1.8, t, 0.5), 0.0),
            ("wall_east_a", (8.0 + t / 2, 2.225, H / 2), (t, 4.65, H), 0.75),
            ("wall_east_b", (8.0 + t / 2, 5.775, H / 2), (t, 0.65, H), 0.75),
            ("wall_east_head", (8.0 + t / 2, 5.0, 2.4), (t, 0.9, 0.6), 0.75)]


def mat(hexc, emissive=False):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (0, 2, 4))
    e = f"<emissive>{r:.3f} {g:.3f} {b:.3f} 1</emissive>" if emissive else ""
    return (f"<material><ambient>{r * .7:.3f} {g * .7:.3f} {b * .7:.3f} 1</ambient><diffuse>{r:.3f} {g:.3f} {b:.3f} 1</diffuse>"
            f"<specular>0.1 0.1 0.1 1</specular>{e}</material>")


def visual_collision(name, c, geom, hexc, collide=True, transparency=0.0, emissive=False):
    col = f'<collision name="{name}_collision"><pose>{f3(c)} 0 0 0</pose><geometry>{geom}</geometry></collision>' if collide else ""
    tr = f"<transparency>{transparency}</transparency>" if transparency else ""
    return f'      {col}<visual name="{name}"><pose>{f3(c)} 0 0 0</pose><geometry>{geom}</geometry>{mat(hexc, emissive)}{tr}</visual>'


def write_flat_model():
    d = GZ / "models" / "oddech_flat"
    d.mkdir(parents=True, exist_ok=True)
    box = lambda s: f"<box><size>{f3(s)}</size></box>"
    o = ['<?xml version="1.0"?>', HEADER.replace("the part list", "the website's room model (sim.js LAYOUT)"), '<sdf version="1.10">',
         '  <model name="oddech_flat">', '    <static>true</static>', '    <link name="room">']
    for name, c, s, tr in wall_boxes():
        o.append(visual_collision(name, c, box(s), "EFEBE3", True, tr))
    o.append(visual_collision("window_glass", (5.5, 6.05, 1.55), box((1.8, 0.02, 1.3)), "9FB4D2", False, 0.6))
    for name, c, s, hexc, collide in FURN:
        o.append(visual_collision(name, c, box(s), hexc, collide))
    for name, (x0, y0, x1, y1), h, hexc in TABLES:       # tops on four legs: the robot's scanner sees the legs
        o.append(visual_collision(f"{name}_top", ((x0 + x1) / 2, (y0 + y1) / 2, h - 0.02), box((x1 - x0, y1 - y0, 0.04)), hexc))
        for i, (lx, ly) in enumerate(((x0 + .06, y0 + .06), (x1 - .06, y0 + .06), (x1 - .06, y1 - .06), (x0 + .06, y1 - .06))):
            o.append(visual_collision(f"{name}_leg_{i}", (lx, ly, (h - 0.04) / 2), box((0.05, 0.05, h - 0.04)), hexc))
    for name, c, r, h, hexc, collide in CYLS:
        o.append(visual_collision(name, c, f"<cylinder><radius>{r}</radius><length>{h}</length></cylinder>", hexc, collide))
    o.append(visual_collision("candle_flame", (4.0, 4.1, 0.87), "<sphere><radius>0.012</radius></sphere>", "FFB060", False, emissive=True))
    for name, x, y, br, z0, z1, hr, zh in PEOPLE:          # simple figures where people breathe: the scanner sees them too
        o.append(visual_collision(f"{name}_body", (x, y, (z0 + z1) / 2), f"<cylinder><radius>{br}</radius><length>{z1 - z0}</length></cylinder>", "D9875C"))
        o.append(visual_collision(f"{name}_head", (x, y, zh), f"<sphere><radius>{hr}</radius></sphere>", "E8B48F"))
    o += ['    </link>', '  </model>', '</sdf>']
    (d / "model.sdf").write_text("\n".join(o) + "\n", encoding="utf-8")
    (d / "model.config").write_text(MODEL_CONFIG.format(title="Oddech flat", desc="The 8 x 6 m model flat of the Oddech website: kitchen with "
                                    "cooktop, dining table with a candle, play mat with a child, sofa with an adult, bookshelf with the household monitor, purifier and dock."), encoding="utf-8")


WORLD_HEAD = """<?xml version="1.0"?>
{header}
<sdf version="1.10">
  <world name="oddech_flat">
    <physics name="1ms" type="ignored"><max_step_size>0.001</max_step_size><real_time_factor>1.0</real_time_factor></physics>
    <plugin filename="gz-sim-physics-system" name="gz::sim::systems::Physics"/>
    <plugin filename="gz-sim-user-commands-system" name="gz::sim::systems::UserCommands"/>
    <plugin filename="gz-sim-scene-broadcaster-system" name="gz::sim::systems::SceneBroadcaster"/>
    <plugin filename="gz-sim-sensors-system" name="gz::sim::systems::Sensors"><render_engine>ogre2</render_engine></plugin>
    <plugin filename="gz-sim-imu-system" name="gz::sim::systems::Imu"/>
    <scene><ambient>0.55 0.56 0.6 1</ambient><background>0.06 0.11 0.18 1</background><shadows>true</shadows><grid>false</grid></scene>
    <light type="directional" name="sun"><cast_shadows>true</cast_shadows><pose>4 3 12 0 0 0</pose><diffuse>0.85 0.83 0.8 1</diffuse>
      <specular>0.2 0.2 0.2 1</specular><direction>-0.35 0.25 -0.9</direction></light>
    <light type="point" name="lamp"><pose>4 3 2.5 0 0 0</pose><diffuse>0.5 0.48 0.45 1</diffuse><specular>0.1 0.1 0.1 1</specular>
      <attenuation><range>12</range><constant>0.6</constant><linear>0.05</linear><quadratic>0.01</quadratic></attenuation><cast_shadows>false</cast_shadows></light>
    <model name="ground_plane"><static>true</static><link name="link">
      <collision name="collision"><geometry><plane><normal>0 0 1</normal><size>40 40</size></plane></geometry>
        <surface><friction><ode><mu>1.0</mu><mu2>1.0</mu2></ode></friction></surface></collision>
      <visual name="visual"><geometry><plane><normal>0 0 1</normal><size>40 40</size></plane></geometry>
        <material><ambient>0.62 0.6 0.56 1</ambient><diffuse>0.82 0.79 0.74 1</diffuse><specular>0.05 0.05 0.05 1</specular></material></visual></link></model>
    <include><uri>model://oddech_flat</uri><name>flat</name><pose>0 0 0 0 0 0</pose></include>
"""

KEYS = [(16777235, "gz.msgs.Twist", "/cmd_vel", "linear: {x: 0.25}, angular: {z: 0.0}"),       # arrow up
        (16777237, "gz.msgs.Twist", "/cmd_vel", "linear: {x: -0.15}, angular: {z: 0.0}"),      # arrow down
        (16777234, "gz.msgs.Twist", "/cmd_vel", "linear: {x: 0.0}, angular: {z: 1.0}"),        # arrow left
        (16777236, "gz.msgs.Twist", "/cmd_vel", "linear: {x: 0.0}, angular: {z: -1.0}"),       # arrow right
        (32, "gz.msgs.Twist", "/cmd_vel", "linear: {x: 0.0}, angular: {z: 0.0}"),              # space: stop
        (49, "gz.msgs.Double", "/mast/cmd", "data: 0.0"),                                      # 1: nose at 0.40 m
        (50, "gz.msgs.Double", "/mast/cmd", "data: 0.175"),                                    # 2: 1.10 m
        (51, "gz.msgs.Double", "/mast/cmd", "data: 0.3")]                                      # 3: 1.60 m


# a sampling round, timed in simulation time: (seconds after /patrol/start, topic, message)
PATROL = [(1.0, "/cmd_vel", "v", 0.25), (6.85, "/cmd_vel", "v", 0.0),                     # 1.4 m along -x, to (5.2, 3.0)
          (7.5, "/cmd_vel", "w", 0.8), (8.335, "/cmd_vel", "w", 0.0),                      # face stop A
          (8.6, "/cmd_vel", "v", 0.25), (13.69, "/cmd_vel", "v", 0.0),                     # to A (4.25, 2.25), by the play mat
          (14.5, "/mast/cmd", "m", 0.175), (18.5, "/mast/cmd", "m", 0.3), (22.5, "/mast/cmd", "m", 0.0),   # nose 1.10, 1.60, 0.40 m
          (28.0, "/cmd_vel", "w", -0.8), (29.333, "/cmd_vel", "w", 0.0),
          (29.6, "/cmd_vel", "v", 0.25), (38.09, "/cmd_vel", "v", 0.0),                    # to B (2.35, 3.05), by the dining table
          (39.0, "/mast/cmd", "m", 0.175), (45.0, "/mast/cmd", "m", 0.0),
          (51.0, "/cmd_vel", "w", -0.8), (51.761, "/cmd_vel", "w", 0.0),
          (52.0, "/cmd_vel", "v", 0.25), (59.35, "/cmd_vel", "v", 0.0),                    # to C (1.4, 4.55), by the cooktop
          (60.0, "/mast/cmd", "m", 0.175), (64.0, "/mast/cmd", "m", 0.3), (68.0, "/mast/cmd", "m", 0.0),
          (75.0, "/cmd_vel", "w", 0.8), (77.0, "/cmd_vel", "w", 0.0)]


def patrol_plugins():
    out = []
    for t, topic, kind, val in PATROL:
        if kind == "m":
            typ, msg = "gz.msgs.Double", f"data: {val}"
        else:
            typ, msg = "gz.msgs.Twist", (f"linear: {{x: {val}}}, angular: {{z: 0.0}}" if kind == "v" else f"linear: {{x: 0.0}}, angular: {{z: {val}}}")
        out.append(f'    <plugin filename="gz-sim-triggered-publisher-system" name="gz::sim::systems::TriggeredPublisher">'
                   f'<input type="gz.msgs.Empty" topic="/patrol/start"/><output type="{typ}" topic="{topic}">{msg}</output>'
                   f'<delay_ms>{round(t * 1000)}</delay_ms></plugin>\n')
    return "".join(out)


def write_worlds():
    d = GZ / "worlds"
    d.mkdir(parents=True, exist_ok=True)
    h = HEADER.replace("the part list", "the website's room model")
    (d / "oddech_flat.sdf").write_text(WORLD_HEAD.format(header=h) + "  </world>\n</sdf>\n", encoding="utf-8")
    keys = "".join(f'    <plugin filename="gz-sim-triggered-publisher-system" name="gz::sim::systems::TriggeredPublisher">'
                   f'<input type="gz.msgs.Int32" topic="/keyboard/keypress"><match field="data">{code}</match></input>'
                   f'<output type="{t}" topic="{topic}">{msg}</output></plugin>\n' for code, t, topic, msg in KEYS)
    demo = (WORLD_HEAD.format(header=h)
            + '    <include><uri>model://oddech</uri><name>oddech</name><pose>6.6 3.0 0 0 0 3.14159</pose></include>\n'
            + "    <!-- keyboard: open the Key Publisher plugin (top-right menu), then the arrows drive, space stops, 1 2 3 set the nose to 0.40, 1.10, 1.60 m -->\n"
            + keys + "  </world>\n</sdf>\n")
    (d / "oddech_demo.sdf").write_text(demo, encoding="utf-8")
    patrol = (WORLD_HEAD.format(header=h)
              + '    <include><uri>model://oddech</uri><name>oddech</name><pose>6.6 3.0 0 0 0 3.14159</pose></include>\n'
              + "    <!-- a sampling round: gz topic -t /patrol/start -m gz.msgs.Empty -p ' '  starts it; every step is timed in simulation time -->\n"
              + patrol_plugins() + "  </world>\n</sdf>\n")
    (d / "oddech_patrol.sdf").write_text(patrol, encoding="utf-8")


# ======================================================================= the blueprint drawing
def hull(pts):
    pts = sorted(set(map(tuple, np.round(pts, 6))))
    if len(pts) < 3:
        return np.array(pts)
    cross = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 0:
            hi.pop()
        hi.append(p)
    return np.array(lo[:-1] + hi[:-1])


def world_parts(q=0.0):
    """Every part's positions in base_footprint at mast extension q per stage."""
    return [(p, part_mesh(p)[0] + link_origin(p["link"], q)) for p in PARTS]


def draw_blueprint():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon, Rectangle

    BLUE, INK, FAINT, HOT = "#123A63", "#EAF2FB", "#9FC0E2", "#F0A27C"
    plt.rcParams.update({"font.family": "DejaVu Sans Mono", "svg.fonttype": "none", "pdf.fonttype": 42, "svg.hashsalt": "oddech"})
    fig = plt.figure(figsize=(16.54, 11.69), facecolor=BLUE)          # A3 landscape
    bg = fig.add_axes([0, 0, 1, 1]); bg.set_xlim(0, 420); bg.set_ylim(0, 297); bg.axis("off")
    for x in range(0, 421, 10):
        bg.plot([x, x], [0, 297], color="#FFFFFF", alpha=0.07 if x % 50 else 0.14, lw=0.4)
    for y in range(0, 298, 10):
        bg.plot([0, 420], [y, y], color="#FFFFFF", alpha=0.07 if y % 50 else 0.14, lw=0.4)
    bg.add_patch(Rectangle((8, 8), 404, 281, fill=False, ec=INK, lw=1.4))
    bg.add_patch(Rectangle((10, 10), 400, 277, fill=False, ec=INK, lw=0.4))

    def view(x_mm, y_mm, scale, u_rng, v_rng, title):
        """An axes on the sheet (mm) whose data units are metres at 1:scale."""
        w_mm, h_mm = (u_rng[1] - u_rng[0]) * 1000 / scale, (v_rng[1] - v_rng[0]) * 1000 / scale
        ax = fig.add_axes([x_mm / 420, y_mm / 297, w_mm / 420, h_mm / 297])
        ax.set_xlim(*u_rng); ax.set_ylim(*v_rng); ax.axis("off"); ax.set_facecolor("none")
        bg.text(x_mm, y_mm - 6, title, color=INK, fontsize=9, fontweight="bold")
        bg.text(x_mm, y_mm - 10.5, f"SCALE 1:{scale}", color=FAINT, fontsize=6.5)
        return ax

    def outline(ax, proj, q=0.0, ghost=False, internals=True):
        for p, P in world_parts(q):
            if p["internal"] and not internals:
                continue
            h = hull(proj(P))
            if len(h) < 3:
                continue
            hidden = p["internal"] or (p["group"] == "mast" and q == 0)    # a stowed mast is inside the body
            dashed = hidden or ghost
            ax.add_patch(Polygon(h, closed=True, fill=not dashed, fc=BLUE, ec=FAINT if dashed else INK, lw=0.5 if dashed else 0.8,
                                 ls=(0, (3, 2)) if dashed else "-", alpha=0.75 if ghost else 1, zorder=3 if hidden else 2))

    def dim(ax, a, b, off, text, vertical=False, color=INK):
        (x0, y0), (x1, y1) = a, b
        if vertical:
            x = max(x0, x1) + off
            ax.plot([x0, x], [y0, y0], color=FAINT, lw=0.4); ax.plot([x1, x], [y1, y1], color=FAINT, lw=0.4)
            ax.annotate("", (x, y0), (x, y1), arrowprops=dict(arrowstyle="<|-|>", color=color, lw=0.6, shrinkA=0, shrinkB=0, mutation_scale=7))
            ax.text(x + 0.008, (y0 + y1) / 2, text, color=color, fontsize=6.5, rotation=90, va="center", ha="left")
        else:
            y = min(y0, y1) - off
            ax.plot([x0, x0], [y0, y], color=FAINT, lw=0.4); ax.plot([x1, x1], [y1, y], color=FAINT, lw=0.4)
            ax.annotate("", (x0, y), (x1, y), arrowprops=dict(arrowstyle="<|-|>", color=color, lw=0.6, shrinkA=0, shrinkB=0, mutation_scale=7))
            ax.text((x0 + x1) / 2, y - 0.008, text, color=color, fontsize=6.5, ha="center", va="top")

    front = lambda P: P[:, [1, 2]]                   # seen from the front: the robot's left to the viewer's right
    side = lambda P: P[:, [0, 2]]                    # seen from the right: forward to the right
    top = lambda P: P[:, [0, 1]]                     # seen from above: forward to the right, left up
    a = view(20, 152, 5, (-0.25, 0.25), (-0.06, 0.48), "A  FRONT ELEVATION")
    outline(a, front); dim(a, (-0.173, 0.0), (0.173, 0.0), 0.02, "Ø346 body")
    dim(a, (0.173, 0.0), (0.173, 0.443), 0.03, "443 stowed", vertical=True)
    a.plot([0, 0], [-0.01, 0.47], color=FAINT, lw=0.4, ls=(0, (8, 2, 1, 2)))
    b = view(130, 152, 5, (-0.26, 0.24), (-0.06, 0.48), "B  RIGHT SIDE ELEVATION")
    outline(b, side); dim(b, (-0.201, 0.0), (0.173, 0.0), 0.02, "374 with sampler")
    for zz, txt in ((LIDAR["z"], "laser plane 145"), (0.4, "nose 400")):
        b.plot([-0.22, 0.2], [zz, zz], color=HOT, lw=0.5, ls=(0, (4, 2))); b.text(0.205, zz, txt, color=HOT, fontsize=6, va="center")
    b.plot([WHEEL_X, WHEEL_X], [-0.01, 0.1], color=FAINT, lw=0.4, ls=(0, (8, 2, 1, 2)))
    c = view(20, 30, 5, (-0.25, 0.25), (-0.22, 0.22), "C  PLAN · INSIDE PARTS DASHED")
    outline(c, top); dim(c, (WHEEL_X, -WHEEL_Y), (WHEEL_X, WHEEL_Y), 0.255, f"track {2 * WHEEL_Y * 1000:.0f}", vertical=True)
    c.annotate("", (0.235, 0), (0.18, 0), arrowprops=dict(arrowstyle="-|>", color=HOT, lw=0.8, mutation_scale=9))
    c.text(0.18, 0.012, "forward", color=HOT, fontsize=6)
    d = view(262, 82, 10, (-0.35, 0.55), (-0.04, 1.75), "D  MAST · NOSE AT 0.40, 1.10, 1.60 m")
    for q, ghost in ((0.0, False), (0.175, True), (0.3, True)):
        outline(d, side, q, ghost, internals=False)
    for zz, txt in ((0.4, "0.40 child on the floor"), (1.1, "1.10 seated adult"), (1.6, "1.60 standing adult")):
        d.plot([-0.3, 0.2], [zz, zz], color=HOT, lw=0.6, ls=(0, (5, 2))); d.text(0.22, zz, txt, color=HOT, fontsize=6.3, va="center")
    dim(d, (-0.27, 0.0), (-0.27, 1.643), -0.04, "1643 max", vertical=True)
    tb = [("PROJECT", "ODDECH · a robot that breathes the room"), ("DRAWING", "General arrangement, OD-1"),
          ("UNITS", "millimetres unless stated"), ("SCALE", "A, B, C 1:5 · D 1:10 on A3"),
          ("DATE", MODEL_DATE), ("DRAWN", "Team Oddech · FL Joint 2026"), ("STATUS", "design targets, not a built robot"), ("SHEET", "1 of 1 · REV A")]
    x0, y0, w, rh = 286, 12, 122, 6.6
    for i, (k, v) in enumerate(reversed(tb)):
        bg.add_patch(Rectangle((x0, y0 + i * rh), w, rh, fill=False, ec=INK, lw=0.5))
        bg.text(x0 + 2, y0 + i * rh + 2.2, k, color=FAINT, fontsize=5.5); bg.text(x0 + 22, y0 + i * rh + 2.2, v, color=INK, fontsize=6.5)
    bom = [("1", "sensor head: air inlet, dust counter, CO2, VOC"), ("2", "telescoping mast, 4 x 320 mm stages"), ("3", "Living Air Sensor bay, 8-well cartridge"),
           ("4", "HEPA and carbon filter, exhaust grille"), ("5", "light ring, speaker and microphones"), ("6", "laser scanner, 360°, 0.20 to 8 m"),
           ("7", "on-board computer"), ("8", "battery 14.4 V, about 100 Wh"), ("9", "hub motors, wheels Ø90, ball casters front and rear"),
           ("10", "body, chassis, bumper; filter sampler")]
    by = 76
    bg.text(132, by + len(bom) * 5.4 + 3, "PARTS", color=INK, fontsize=8, fontweight="bold")
    for i, (n, t) in enumerate(bom):
        yy = by + (len(bom) - 1 - i) * 5.4
        bg.text(133, yy, n, color=HOT, fontsize=6.5); bg.text(142, yy, t, color=INK, fontsize=6.5)
    tot = sum(L["m"] for L in LINKS.values() if L)
    bg.text(132, 58, f"mass about {tot:.1f} kg (estimated)", color=FAINT, fontsize=6.4)
    bg.text(132, 52, f"speed up to {V_MAX:.2f} m/s · turn up to {W_MAX} rad/s · nose {MAST_V} m/s", color=FAINT, fontsize=6.4)
    bg.text(132, 46, "frames REP 103: x forward, y left, z up", color=FAINT, fontsize=6.4)
    bg.text(132, 40, "origin on the floor under the robot's centre", color=FAINT, fontsize=6.4)
    bg.text(20, 274, "ODDECH  OD-1", color=INK, fontsize=22, fontweight="bold")
    bg.text(20, 266, "General arrangement · drawn from the same part list as the Gazebo model", color=FAINT, fontsize=8)
    DOCS.mkdir(parents=True, exist_ok=True)
    fig.savefig(DOCS / "oddech_general_arrangement.svg", facecolor=BLUE, metadata={"Date": None})
    fig.savefig(DOCS / "oddech_general_arrangement.pdf", facecolor=BLUE, metadata={"CreationDate": None})
    fig.savefig(DOCS / "oddech_general_arrangement.png", facecolor=BLUE, dpi=110)
    plt.close(fig)


# ======================================================================= website data
def write_blueprint():
    tot = sum(L["m"] for L in LINKS.values() if L)
    data = dict(name="Oddech", model="OD-1", date=MODEL_DATE, frames="REP 103: x forward, y left, z up; metres", colors=COL,
                parts=PARTS,
                links={k: (None if v is None else dict(m=round(v["m"], 4), com=list(v["com"]))) for k, v in LINKS.items()},
                joints=[dict(name=n, type=t, parent=p, child=c, xyz=list(x), axis=list(a) if a else None, limit=l) for n, t, p, c, x, a, l in JOINTS],
                dims=dict(diameter=0.346, height_stowed=0.443, height_max=round(0.443 + 4 * TRAVEL, 3), deck=DECK + 0.003, wheel_d=2 * WHEEL_R,
                          track=2 * WHEEL_Y, mast_travel=4 * TRAVEL, stage=STAGE, stages=4, nose=[0.40, 1.10, 1.60], lidar=LIDAR,
                          mass=round(tot, 2), v_max=V_MAX, w_max=W_MAX, a_max=A_MAX, mast_v=MAST_V),
                patrol=[list(s) for s in PATROL])
    files = sorted(p for p in ROOT.rglob("*") if p.is_file() and p.name != "blueprint.json"
                   and not any(s.startswith(".") or s == "__pycache__" for s in p.relative_to(ROOT).parts))
    data["files"] = [dict(path=p.relative_to(ROOT).as_posix(), bytes=p.stat().st_size) for p in files]
    (ROOT / "blueprint.json").write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return data


def main():
    tris = build_meshes()
    write_urdf(); write_sdf_model(); write_flat_model(); write_worlds(); draw_blueprint()
    data = write_blueprint()
    print("meshes (triangles):", tris)
    print(f"parts {len(PARTS)}, links {len(LINKS)}, joints {len(JOINTS)}, mass {data['dims']['mass']} kg, files {len(data['files'])}")


if __name__ == "__main__":
    main()
