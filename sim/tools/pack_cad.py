"""Pack Antonio's CAD (3model/*.dae, exported from 3model/Oddech.FCStd) for the live simulator.

Writes sim/static/cad/<file>.dae.gz (the browser unzips them with DecompressionStream and parses them with three.js's
ColladaLoader) and sim/static/cad/manifest.json: per file its size and parts, per part its triangle count, bounding box,
colour and the FreeCAD label of the body it came from (LWheel, Camera, ...). Run it again whenever 3model/ changes:
    python sim/tools/pack_cad.py
"""
import gzip
import json
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SRC, OUT = REPO / "3model", HERE.parent / "static" / "cad"
NS = {"c": "http://www.collada.org/2005/11/COLLADASchema"}


def freecad_labels(fcstd: Path) -> dict:
    """Exported part name (a FreeCAD label) -> its object, type and the label of the PartDesign body it was made from:
    the body whose tip it is, or the body found by following its Base (or Faces) links, as Fillet013 -> Cut002 -> Corpo."""
    root = ET.fromstring(zipfile.ZipFile(fcstd).read("Document.xml"))
    types = {o.get("name"): o.get("type") for o in root.find("Objects")}
    label, tip_of, base = {}, {}, {}
    for o in root.find("ObjectData"):
        props = {p.get("name"): p for p in o.find("Properties")}
        lab = props.get("Label")
        label[o.get("name")] = lab.find("String").get("value") if lab is not None else o.get("name")
        if types.get(o.get("name")) == "PartDesign::Body" and props.get("Tip") is not None:
            for link in props["Tip"].iter("Link"):
                tip_of[link.get("value")] = o.get("name")
        for key in ("Base", "Faces"):
            if props.get(key) is not None:
                links = [l.get("value") for l in props[key].iter() if l.tag in ("Link", "LinkSub") and l.get("value")]
                if links:
                    base[o.get("name")] = links[0]; break

    def body_of(name, depth=0):
        if depth > 20 or name is None: return None
        if types.get(name) == "PartDesign::Body": return name
        return tip_of.get(name) or body_of(base.get(name), depth + 1)
    out = {}
    for name, lab in label.items():
        body = body_of(name)
        out[lab] = {"object": name, "type": types.get(name), "body": label[body] if body else None}
    return out


def parts(dae: Path) -> list:
    root = ET.parse(dae).getroot()
    color = {}
    for e in root.iterfind(".//c:library_effects/c:effect", NS):
        d = e.find(".//c:diffuse/c:color", NS)
        color[e.get("id")] = [round(float(v), 3) for v in d.text.split()[:3]] if d is not None else None
    effect = {m.get("id"): m.find("c:instance_effect", NS).get("url")[1:] for m in root.iterfind(".//c:library_materials/c:material", NS)}
    bound = {}                                                         # geometry id -> material, from the scene's bindings
    for ig in root.iterfind(".//c:instance_geometry", NS):
        im = ig.find(".//c:instance_material", NS)
        if im is not None:
            bound[ig.get("url")[1:]] = im.get("target")[1:]
    out = []
    for g in root.iterfind(".//c:library_geometries/c:geometry", NS):
        mesh = g.find("c:mesh", NS)
        pos_id = mesh.find("c:vertices/c:input[@semantic='POSITION']", NS).get("source")[1:]
        src = next(s for s in mesh.findall("c:source", NS) if s.get("id") == pos_id)
        v = [float(t) for t in src.find("c:float_array", NS).text.split()]
        xs, ys, zs = v[0::3], v[1::3], v[2::3]
        tris = sum(int(t.get("count")) for t in mesh.findall("c:triangles", NS))
        out.append({"name": g.get("name"), "triangles": tris, "vertices": len(xs),
                    "bbox": [[round(min(a), 4) for a in (xs, ys, zs)], [round(max(a), 4) for a in (xs, ys, zs)]],
                    "color": color.get(effect.get(bound.get(g.get("id"))))})
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    labels = freecad_labels(SRC / "Oddech.FCStd")
    files = []
    for dae in sorted(SRC.glob("*.dae")):
        raw = dae.read_bytes()
        gz = gzip.compress(raw, compresslevel=9, mtime=0)            # mtime 0: the same input gives the same bytes
        (OUT / (dae.name + ".gz")).write_bytes(gz)
        ps = parts(dae)
        for p in ps:
            p["freecad"] = labels.get(p["name"], {})
        files.append({"file": dae.name, "bytes": len(raw), "gz_bytes": len(gz), "parts": ps})
        print(f"{dae.name:26} {len(raw) / 1e6:6.2f} MB -> {len(gz) / 1e6:5.2f} MB gz, {len(ps)} parts, {sum(p['triangles'] for p in ps):,} triangles")
    for stale in OUT.glob("*.dae.gz"):                                 # a file removed from 3model/ leaves the app too
        if not (SRC / stale.name[:-3]).exists():
            stale.unlink()
    manifest = {"source": "3model/ (Antonio Galiza Cerdeira Gonzalez, branch CADmodel)", "freecad": "3model/Oddech.FCStd",
                "unit": "metre", "up": "Z", "files": files}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
