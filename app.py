"""Oddech: the team's site for the FL Joint Program 2026 (Krakow), served with Streamlit.

The site is one HTML page (site/index.html with its CSS and scripts) that build.py assembles; this file shows it full
screen in a component iframe, deployed like the CBIC app: GitHub repository -> Streamlit Community Cloud.
Run locally:  streamlit run app.py
"""
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

import build

HERE = Path(__file__).parent

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
    """The assembled page; `stamp` (newest file time) refreshes the cache when a file changes."""
    return build.page()


components.html(page(build.stamp()), height=900, scrolling=True)
