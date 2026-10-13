"""Oddech: the team's site for the FL Joint Program 2026 (Krakow), served with Streamlit.

The site is one HTML page (site/index.html with its CSS and scripts) that this file assembles and shows full screen in a
component iframe, deployed like the CBIC app: GitHub repository -> Streamlit Community Cloud.
Run locally:  streamlit run app.py
"""
import json
from pathlib import Path
from html import escape

import streamlit as st
import streamlit.components.v1 as components

HERE = Path(__file__).parent
SITE = HERE / "site"
SCRIPTS = ["robot3d.js", "hero.js", "sensor.js", "bio.js", "scene.js", "results.js", "cloud.js", "deck.js", "main.js"]   # after three.min.js and sim.js

st.set_page_config(page_title="Oddech · a robot that reads the air", page_icon=str(HERE / "assets" / "icon.png"),
                   layout="wide", initial_sidebar_state="collapsed")
st.markdown("""<style>
header[data-testid="stHeader"], footer, #MainMenu, [data-testid="stToolbar"], [data-testid="stDecoration"],
[data-testid="stStatusWidget"], [data-testid="stSidebar"], [data-testid="collapsedControl"] { display: none !important; }
html, body, .stApp, [data-testid="stAppViewContainer"], [data-testid="stMain"] { background: #0F0E0C; overflow: hidden; }
.block-container, [data-testid="stMainBlockContainer"] { padding: 0 !important; max-width: 100% !important; }
[data-testid="stVerticalBlock"] { gap: 0 !important; }
iframe { display: block; width: 100vw !important; height: 100vh !important; border: 0; }
</style>""", unsafe_allow_html=True)


@st.cache_data(show_spinner=False)
def page(stamp: float) -> str:
    """Inline everything into one document; `stamp` (newest file time) refreshes the cache when a file changes."""
    read = lambda p: p.read_text(encoding="utf-8")
    safe = lambda s: s.replace("</script", "<\\/script")
    sim = read(SITE / "sim.js")
    data = (f"window.ODDECH_REFS={read(SITE / 'refs.json')};window.ODDECH_BENCH={read(SITE / 'bench.json')};"
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
    for mark, block in (("<!--STYLE-->", f"<style>{read(SITE / 'style.css')}</style>"),
                        ("<!--DATA-->", f"<script>{safe(data)}</script>"),
                        ("<!--SCRIPTS-->", "".join(f"<script>{safe(s)}</script>" for s in scripts))):
        assert html.count(mark) == 1, mark
        html = html.replace(mark, block)
    return html


stamp = max(p.stat().st_mtime for p in [*SITE.iterdir(), HERE / "vendor" / "three.min.js"])
components.html(page(stamp), height=900, scrolling=True)
