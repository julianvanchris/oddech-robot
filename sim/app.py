"""Oddech Sim: the live simulator, a second Streamlit app next to the site (branch `simulation`, main file sim/app.py).

The page is sim/index.html with its CSS and scripts, assembled by build_sim.py and shown full screen in a component iframe.
Antonio's CAD (3model/*.dae, gzipped by tools/pack_cad.py into static/cad/) is served by Streamlit's static file serving
(.streamlit/config.toml: enableStaticServing) and parsed in the browser.
Run locally from the repository folder:  streamlit run sim/app.py
"""
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

import build_sim

HERE = Path(__file__).parent

st.set_page_config(page_title="Oddech Sim · the robot, live", page_icon=str(HERE.parent / "assets" / "icon.png"),
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
    """The assembled page; `stamp` (newest file time) refreshes the cache when a file changes."""
    return build_sim.page()


components.html(page(build_sim.stamp()), height=900, scrolling=False)
