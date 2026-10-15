"""Assemble the Oddech page: site/index.html with its CSS, data and scripts inlined into one document.
Used by app.py (Streamlit) and by tools/deck_pdf.py (the pitch deck as a PDF)."""
import base64
import json
from html import escape
from pathlib import Path

HERE = Path(__file__).parent
SITE = HERE / "site"
SCRIPTS = ["robot3d.js", "art.js", "hero.js", "sensor.js", "bio.js", "scene.js", "results.js", "cloud.js", "blueprint.js", "twin.js", "deck.js", "main.js"]   # after three.min.js and sim.js
GZ = HERE / "gazebo"                             # the Gazebo package: the robot's part list, a recorded run, the drawing


def page() -> str:
    """Inline everything into one document."""
    read = lambda p: p.read_text(encoding="utf-8")
    safe = lambda s: s.replace("</script", "<\\/script")
    sim = read(SITE / "sim.js")
    imgs = {p.stem: "data:image/webp;base64," + base64.b64encode(p.read_bytes()).decode() for p in sorted((SITE / "img").glob("*.webp"))}   # robot renders
    data = (f"window.ODDECH_REFS={read(SITE / 'refs.json')};window.ODDECH_BENCH={read(SITE / 'bench.json')};"
            f"window.ODDECH_ROBOT={read(GZ / 'blueprint.json')};window.ODDECH_GZRUN={read(GZ / 'docs' / 'gazebo_run.json')};"
            f"window.ODDECH_IMG={json.dumps(imgs)};window.ODDECH_QR={read(SITE / 'qr.json')};"
            f"window.ODDECH_SIM_SRC={json.dumps(sim)};")
    scripts = [read(HERE / "vendor" / "three.min.js"), sim] + [read(SITE / f) for f in SCRIPTS]
    html = read(SITE / "index.html")
    film = escape(read(SITE / "living-air-sensor.html"), quote=True)
    film_frame = (
        '<iframe title="Living-cell air sensor animation" '
        'style="display:block;width:100%;height:1050px;border:0;" '
        'loading="lazy" '
        f'srcdoc="{film}"></iframe>'
    )
    html = html.replace("<!--LIVING_AIR_SENSOR-->", film_frame)
    sheet = read(GZ / "docs" / "oddech_general_arrangement.svg")
    sheet = sheet[sheet.index("<svg"):].replace('width="1190.88pt" height="841.68pt"', 'class="bp-svg" role="img" aria-label="General arrangement drawing of Oddech OD-1"', 1)
    assert html.count("<!--BLUEPRINT_SVG-->") == 1
    html = html.replace("<!--BLUEPRINT_SVG-->", sheet)
    for mark, block in (("<!--STYLE-->", f"<style>{read(SITE / 'style.css')}</style>"),
                        ("<!--DATA-->", f"<script>{safe(data)}</script>"),
                        ("<!--SCRIPTS-->", "".join(f"<script>{safe(s)}</script>" for s in scripts))):
        assert html.count(mark) == 1, mark
        html = html.replace(mark, block)
    return html


def stamp() -> float:
    """The newest source file time: a new value tells Streamlit's cache to rebuild the page."""
    return max(p.stat().st_mtime for p in [*SITE.iterdir(), *(SITE / "img").iterdir(), HERE / "vendor" / "three.min.js", GZ / "blueprint.json",
                                           GZ / "docs" / "gazebo_run.json", GZ / "docs" / "oddech_general_arrangement.svg"])
