#!/usr/bin/env python3
"""Turn a recorded Gazebo run into a compact replay for the website.

    gz topic -e -t /world/oddech_flat/dynamic_pose/info -d 90 > poses.txt     (while the run plays, see README)
    python tools/gz_log_to_replay.py poses.txt docs/gazebo_run.json

poses.txt holds gz.msgs.Pose_V messages in text form: the model's pose in the world, each link's pose in the model.
The replay keeps, at most 20 times a second: sim time, x, y, yaw of the robot, both wheel angles and the four mast stage extensions.
"""
import json
import math
import re
import sys

STOWED = {"mast_stage_1": 0.032, "mast_stage_2": 0.035, "mast_stage_3": 0.038, "mast_stage_4": 0.041}   # stage bottoms when stowed
NUM = r"(-?[\d.]+(?:e[-+]?\d+)?)"


def messages(text):
    """Split the echo into messages; yield (time, {name: (pos, quat)})."""
    for block in re.split(r"\n(?=header \{)", text):
        t = re.search(r"stamp \{\s*(?:sec: (\d+))?\s*(?:nsec: (\d+))?", block)
        if not t:
            continue
        time = int(t.group(1) or 0) + int(t.group(2) or 0) / 1e9
        poses = {}
        for m in re.finditer(r'pose \{\s*name: "([^"]+)".*?position \{([^}]*)\}\s*orientation \{([^}]*)\}', block, re.S):
            def vals(s, keys):
                d = {k: float(v) for k, v in re.findall(r"(\w+): " + NUM, s)}
                return [d.get(k, 0.0) for k in keys]
            poses[m.group(1)] = (vals(m.group(2), "xyz"), vals(m.group(3), "xyzw"))
        if "oddech" in poses:
            yield time, poses


def yaw(q):
    x, y, z, w = q
    return math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))


def pitch(q):
    x, y, z, w = q
    return math.atan2(2 * (w * y - z * x), 1 - 2 * (x * x + y * y))   # wheel spin about its axle (y)


def main(src, dst, hz=20.0):
    text = open(src, encoding="utf-8", errors="ignore").read()
    rows, last, spin, prev = [], -1e9, {"l": 0.0, "r": 0.0}, {}
    for t, P in messages(text):
        for side, link in (("l", "wheel_left_link"), ("r", "wheel_right_link")):   # unwrap the wheel angle
            if link in P:
                a = pitch(P[link][1])
                if side in prev:
                    d = a - prev[side]
                    d -= 2 * math.pi * round(d / (2 * math.pi))
                    spin[side] += d
                prev[side] = a
        if t - last < 1 / hz - 1e-6:
            continue
        last = t
        (x, y, _), q = P["oddech"]
        mast = [round(P[k][0][2] - z0, 4) if k in P else None for k, z0 in STOWED.items()]
        rows.append([round(t, 3), round(x, 4), round(y, 4), round(yaw(q), 4), round(spin["l"], 3), round(spin["r"], 3)] + mast)
    t0 = rows[0][0]
    for r in rows:
        r[0] = round(r[0] - t0, 3)
    out = {"source": "Gazebo Harmonic 8.10 (DART physics, 1 kHz), headless, recorded 2026-10-15 from oddech_gazebo/worlds/oddech_patrol.sdf "
                     "with the sensors system removed (no GPU on the test machine)",
           "note": "The timed sampling round started by /patrol/start: three stops, by the play mat (nose 1.10 then 1.60 m), by the dining "
                   "table (1.10 m) and by the cooktop (1.10 then 1.60 m). Open-loop commands; the poses are Gazebo's own.",
           "cols": ["t", "x", "y", "yaw", "wheel_left", "wheel_right", "mast_1", "mast_2", "mast_3", "mast_4"], "hz": hz, "rows": rows}
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"{len(rows)} samples, {rows[-1][0]:.1f} s; start {rows[0][1:4]}, end {rows[-1][1:4]}; max mast {max(r[6] or 0 for r in rows):.3f}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
