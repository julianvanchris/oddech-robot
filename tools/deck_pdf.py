"""The pitch deck as a PDF, one 1280 x 720 slide per page, exactly as the page prints it.

    python tools/deck_pdf.py "Evan) 101626_Oddech_Pitch.pdf"

Builds the page (build.py), opens it in headless Chrome in deck-print mode (#print-deck) and saves it with the DevTools
call Page.printToPDF at the CSS page size, backgrounds on. Chrome: CHROME env var, else the usual Windows path.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests
import websocket

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import build  # noqa: E402

CHROME = os.environ.get("CHROME", r"C:\Program Files\Google\Chrome\Application\chrome.exe")
PORT = 9339


def cdp(ws, method, params=None, _id=[0]):
    """Send one DevTools command and wait for its answer (events in between are skipped)."""
    _id[0] += 1
    ws.send(json.dumps({"id": _id[0], "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == _id[0]:
            if "error" in msg:
                raise RuntimeError(f"{method}: {msg['error']}")
            return msg.get("result", {})


def main(out):
    tmp = Path(tempfile.mkdtemp(prefix="oddech_pdf_"))
    html = tmp / "deck.html"
    html.write_text(build.page(), encoding="utf-8")
    proc = subprocess.Popen([CHROME, "--headless=new", f"--remote-debugging-port={PORT}", f"--user-data-dir={tmp / 'profile'}",
                             "--no-first-run", "--no-default-browser-check", "--window-size=1280,900", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(60):                                # wait for the DevTools endpoint
            try:
                requests.get(f"http://127.0.0.1:{PORT}/json/version", timeout=1); break
            except requests.RequestException:
                time.sleep(0.5)
        tab = requests.put(f"http://127.0.0.1:{PORT}/json/new", timeout=10).json()      # a blank tab; the hash survives Page.navigate
        ws = websocket.create_connection(tab["webSocketDebuggerUrl"], timeout=120, suppress_origin=True)
        cdp(ws, "Page.enable")
        cdp(ws, "Page.navigate", {"url": html.as_uri() + "#print-deck"})
        # wait for the page, its web fonts and the deck's pictures, then a moment for layout
        cdp(ws, "Runtime.evaluate", {"expression": "new Promise(r => { const go = () => document.fonts.ready.then(() => setTimeout(r, 2500)); "
                                                  "document.readyState === 'complete' ? go() : addEventListener('load', go); })", "awaitPromise": True})
        state = cdp(ws, "Runtime.evaluate", {"expression": "JSON.stringify({mode: document.body.classList.contains('print-deck'), slides: document.querySelectorAll('#deckStage .slide').length, url: location.href.slice(-30)})",
                                             "returnByValue": True})["result"]["value"]
        n = json.loads(state)["slides"]
        if not json.loads(state)["mode"] or not n:
            raise RuntimeError(f"deck not ready for print: {state}")
        # layout check, in print layout: nothing outside the 1120 x 600 content box, nothing in the footer's band (the footer itself excepted)
        cdp(ws, "Emulation.setEmulatedMedia", {"media": "print"})
        bad = cdp(ws, "Runtime.evaluate", {"returnByValue": True, "expression": """JSON.stringify([...document.querySelectorAll('#deckStage .slide')].map((s, i) => {
            const r = s.getBoundingClientRect(), out = [];
            s.querySelectorAll('*').forEach(e => {
              if (e.closest('.sl-foot') || e.closest('.sl-brand') || (e.ownerSVGElement)) return;
              const b = e.getBoundingClientRect(); if (!b.width || !b.height) return;
              if (b.right > r.left + 1204 || b.left < r.left + 58 || b.top < r.top + 40 || b.bottom > r.top + 662)
                out.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ' ' + [b.left - r.left, b.top - r.top, b.right - r.left, b.bottom - r.top].map(Math.round).join(','));
            });
            return [i + 1, out.slice(0, 6)];
          }).filter(x => x[1].length))"""})["result"]["value"]
        for slide, items in json.loads(bad):
            print(f"  slide {slide}: outside the content box: {items}")
        pdf = cdp(ws, "Page.printToPDF", {"printBackground": True, "preferCSSPageSize": True, "marginTop": 0, "marginBottom": 0,
                                         "marginLeft": 0, "marginRight": 0, "displayHeaderFooter": False})
        Path(out).write_bytes(base64.b64decode(pdf["data"]))
        static = Path(__file__).resolve().parent.parent / "static" / "Oddech_Pitch.pdf"   # what the deck's Download PDF button fetches
        static.parent.mkdir(exist_ok=True); static.write_bytes(base64.b64decode(pdf["data"]))
        print(f"{out}: {n} slides, {Path(out).stat().st_size // 1024} KB")
        ws.close()
    finally:
        proc.terminate()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "deck.pdf")
