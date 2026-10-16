"""Assemble Oddech Sim: sim/index.html with its CSS, the CAD manifest and the scripts inlined into one document.
Used by sim/app.py (Streamlit). For a look without Streamlit:
    python sim/build_sim.py preview.html /sim/static/      (then serve the repository folder over http)
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
SCRIPTS = [REPO / "vendor" / "three.min.js", HERE / "vendor" / "collada.js", REPO / "site" / "sim.js", HERE / "gz.js"]
SITE_URL = "https://oddech-robot.streamlit.app/"          # the main site, linked from the top bar
CAD_RAW = "https://raw.githubusercontent.com/julianvanchris/oddech-robot/simulation/sim/static/cad/"   # if static serving fails


def page(static=None):
    """The page. `static`: where the CAD files are served from, if not Streamlit's app/static/ next to the app."""
    read = lambda p: p.read_text(encoding="utf-8")
    safe = lambda s: s.replace("</script", "<\\/script")
    html = read(HERE / "index.html")
    data = (f"window.ODDECH_CAD={read(HERE / 'static' / 'cad' / 'manifest.json')};window.ODDECH_SITE={json.dumps(SITE_URL)};"
            f"window.ODDECH_CAD_RAW={json.dumps(CAD_RAW)};"
            + (f"window.ODDECH_STATIC={json.dumps(static)};" if static else ""))
    for mark, block in (("<!--STYLE-->", f"<style>{read(HERE / 'gz.css')}</style>"),
                        ("<!--DATA-->", f"<script>{safe(data)}</script>"),
                        ("<!--SCRIPTS-->", "".join(f"<script>{safe(read(p))}</script>" for p in SCRIPTS))):
        assert html.count(mark) == 1, mark
        html = html.replace(mark, block)
    return html


def stamp():
    """The newest source file time: a new value tells Streamlit's cache to rebuild the page."""
    return max(p.stat().st_mtime for p in [*SCRIPTS, HERE / "index.html", HERE / "gz.css", HERE / "static" / "cad" / "manifest.json"])


if __name__ == "__main__":
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "preview.html"
    out.write_text(page(sys.argv[2] if len(sys.argv) > 2 else None), encoding="utf-8")
    print(out, out.stat().st_size // 1024, "KB")
