#!/usr/bin/env python3
"""Checks for the Oddech model files. Run after tools/build_model.py, from the gazebo/ folder:

    python tools/check_model.py

Meshes: every part is a closed, consistently wound solid with its normals outward; the link meshes exist in both formats.
URDF and SDF: one tree from base_footprint, physically valid inertias, every referenced mesh exists, the same moving joints,
the drive, joint-state and four mast plugins. Worlds: every included model exists. blueprint.json: every listed file exists.
"""
import json
import struct
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_model as B  # noqa: E402  the same part list the files were made from

ROOT, fails = B.ROOT, []


def check(ok, msg):
    if not ok:
        fails.append(msg)


def closed_outward(P):
    """Edges used once in each direction (closed and consistently wound); positive signed volume (normals outward)."""
    T = np.asarray(P).reshape(-1, 3, 3)
    key = lambda p: tuple(np.round(p, 6))
    edges = {}
    for t in T:
        a, b, c = (key(p) for p in t)
        for e in ((a, b), (b, c), (c, a)):
            edges[e] = edges.get(e, 0) + 1
    bad = sum(1 for (u, v), k in edges.items() if k != 1 or edges.get((v, u), 0) != 1)
    vol = float(np.einsum("ij,ij->i", T[:, 0], np.cross(T[:, 1], T[:, 2])).sum() / 6)
    return bad, vol


def stl_count(path):
    data = path.read_bytes()
    n = struct.unpack("<I", data[80:84])[0]
    return n, len(data) == 84 + 50 * n


# ---------------------------------------------------------------- 1. meshes
for p in B.PARTS:
    bad, vol = closed_outward(B.part_mesh(p)[0])
    check(bad == 0 and vol > 0, f"part {p['name']}: {bad} open or misdirected edges, volume {vol:.3e} m3")
    n, ok = stl_count(ROOT / "oddech_description" / "meshes" / "parts" / f"{p['name']}.stl")
    check(ok and n > 0, f"parts/{p['name']}.stl unreadable")
for mesh in set(B.MESH_OF.values()):
    for f in (ROOT / "oddech_description" / "meshes" / "visual" / f"{mesh}.dae", ROOT / "oddech_gazebo" / "models" / "oddech" / "meshes" / f"{mesh}.dae"):
        try:
            ET.parse(f)
        except Exception as e:
            fails.append(f"{f.relative_to(ROOT)}: {e}")
    n, ok = stl_count(ROOT / "oddech_description" / "meshes" / "stl" / f"{mesh}.stl")
    check(ok, f"stl/{mesh}.stl unreadable")
print(f"1. meshes: {len(B.PARTS)} parts closed and outward; {len(set(B.MESH_OF.values()))} link meshes as COLLADA and STL")


# ---------------------------------------------------------------- 2. URDF
def inertia_ok(ixx, iyy, izz):
    return min(ixx, iyy, izz) > 0 and ixx + iyy >= izz and iyy + izz >= ixx and ixx + izz >= iyy


urdf = ET.parse(ROOT / "oddech_description" / "urdf" / "oddech.urdf").getroot()
links = {l.get("name") for l in urdf.findall("link")}
children, mass = {}, 0.0
for j in urdf.findall("joint"):
    par, ch = j.find("parent").get("link"), j.find("child").get("link")
    check(par in links and ch in links, f"joint {j.get('name')}: unknown link")
    check(ch not in children, f"link {ch} has two parents")
    children[ch] = j.get("name")
check(links - set(children) == {"base_footprint"}, f"tree roots: {links - set(children)}")
for l in urdf.findall("link"):
    i = l.find("inertial")
    if i is not None:
        I = i.find("inertia")
        check(inertia_ok(*(float(I.get(k)) for k in ("ixx", "iyy", "izz"))), f"inertia of {l.get('name')}")
        mass += float(i.find("mass").get("value"))
    for m in l.iter("mesh"):
        f = m.get("filename").replace("package://oddech_description", str(ROOT / "oddech_description"))
        check(Path(f).exists(), f"URDF mesh missing: {m.get('filename')}")
moving_urdf = {j.get("name"): j.get("type") for j in urdf.findall("joint") if j.get("type") != "fixed"}
xacro = ET.parse(ROOT / "oddech_description" / "urdf" / "oddech.urdf.xacro").getroot()
check({j.get("name") for j in xacro.findall("joint")} == {j.get("name") for j in urdf.findall("joint")}, "xacro and URDF differ")
print(f"2. URDF: {len(links)} links in one tree from base_footprint, {len(moving_urdf)} moving joints, mass {mass:.2f} kg")

# ---------------------------------------------------------------- 3. SDF model, flat and worlds
sdf = ET.parse(ROOT / "oddech_gazebo" / "models" / "oddech" / "model.sdf").getroot().find("model")
moving_sdf = {j.get("name"): j.get("type") for j in sdf.findall("joint") if j.get("type") != "fixed"}
check(set(moving_sdf) == set(moving_urdf), f"moving joints differ: URDF {sorted(moving_urdf)}, SDF {sorted(moving_sdf)}")
for u in sdf.iter("uri"):
    f = ROOT / "oddech_gazebo" / "models" / u.text.replace("model://", "")
    check(f.exists(), f"SDF mesh missing: {u.text}")
names = [p.get("name") for p in sdf.findall("plugin")]
check(names.count("gz::sim::systems::DiffDrive") == 1 and names.count("gz::sim::systems::JointStatePublisher") == 1
      and names.count("gz::sim::systems::JointPositionController") == 4, f"model plugins: {names}")
for l in sdf.findall("link"):
    I = l.find("inertial/inertia")
    check(inertia_ok(*(float(I.find(k).text) for k in ("ixx", "iyy", "izz"))), f"SDF inertia of {l.get('name')}")
ET.parse(ROOT / "oddech_gazebo" / "models" / "oddech_flat" / "model.sdf")
worlds = sorted((ROOT / "oddech_gazebo" / "worlds").glob("*.sdf"))
for w in worlds:
    for inc in ET.parse(w).getroot().iter("include"):
        name = inc.find("uri").text.replace("model://", "")
        check((ROOT / "oddech_gazebo" / "models" / name / "model.config").exists(), f"{w.name}: missing model {name}")
patrol = ET.parse(ROOT / "oddech_gazebo" / "worlds" / "oddech_patrol.sdf").getroot()
check(len([p for p in patrol.iter("plugin") if p.get("name") == "gz::sim::systems::TriggeredPublisher"]) == len(B.PATROL), "patrol steps")
print(f"3. SDF: moving joints match the URDF, {len(names)} model plugins; worlds {', '.join(w.name for w in worlds)}")

# ---------------------------------------------------------------- 4. the website's copy
bp = json.loads((ROOT / "blueprint.json").read_text(encoding="utf-8"))
check(len(bp["parts"]) == len(B.PARTS), "blueprint parts")
missing = [f["path"] for f in bp["files"] if not (ROOT / f["path"]).exists()]
check(not missing, f"blueprint lists missing files: {missing[:5]}")
check(abs(bp["dims"]["mass"] - mass) < 0.01, f"blueprint mass {bp['dims']['mass']} vs URDF {mass:.2f}")
print(f"4. blueprint.json: {len(bp['parts'])} parts, {len(bp['files'])} files listed, all present")

if fails:
    print("\nFAILED:\n  " + "\n  ".join(fails))
    sys.exit(1)
print("\nall model checks passed")
