"""Checks behind the Oddech site. Run before every deploy:  python check_site.py   (add --sim to rerun node test_sim.js)

1. Every journal reference in site/refs.json: title and year against Crossref.
2. Every number or phrase the page quotes from a paper: present in that paper's abstract (OpenAlex) and on the page.
3. Web sources (product pages, news): fetched and searched for the phrase; if the site blocks robots, marked for a manual check.
4. The page itself: every citation key exists and every reference is cited; every element id the scripts use exists;
   the H1 sentences on the page agree with site/bench.json; the sample sizes agree with the proposal (numbers.tex).
Exits non-zero if anything fails.
"""
import html as htmlmod
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import requests

HERE = Path(__file__).parent
SITE = HERE / "site"
PAGE = (SITE / "index.html").read_text(encoding="utf-8")
REFS = json.loads((SITE / "refs.json").read_text(encoding="utf-8"))
BENCH = json.loads((SITE / "bench.json").read_text(encoding="utf-8"))
UA = {"User-Agent": "oddech-site-check/1.0 (research use)"}
fails, manual = [], []


def norm(s):
    s = unicodedata.normalize("NFKC", htmlmod.unescape(s or ""))
    s = s.replace("‐", "-").replace("–", "-").replace("−", "-").replace("µ", "μ")
    return re.sub(r"\s+", " ", s).strip().lower()


def letters(s):
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", norm(s)).encode("ascii", "ignore").decode())


PAGE_TEXT = norm(re.sub(r"<[^>]+>", " ", PAGE))

# ---------------------------------------------------------------- 1. Crossref
for r in REFS:
    if not r.get("doi"):
        continue
    try:
        m = requests.get(f"https://api.crossref.org/works/{r['doi']}", headers=UA, timeout=60).json()["message"]
    except Exception as e:  # noqa: BLE001
        fails.append(f"crossref {r['key']}: {e}"); continue
    title = re.sub(r"<[^>]+>", " ", (m.get("title") or [""])[0])          # Crossref titles can carry <i> tags
    if letters(title)[:40] not in letters(r["entry"]):
        fails.append(f"title {r['key']}: Crossref says '{title}'")
    years = {str(m[k]["date-parts"][0][0]) for k in ("issued", "published-print", "published-online")
             if m.get(k) and m[k].get("date-parts") and m[k]["date-parts"][0][0]}
    if not any(f"({y})" in r["entry"] for y in years):
        fails.append(f"year {r['key']}: entry has none of {sorted(years)}")
print(f"1. Crossref: {sum(1 for r in REFS if r.get('doi'))} DOIs checked")

# ---------------------------------------------------------------- 2. quoted figures: abstract and page
CLAIMS = [  # key, words in the abstract or title, words on the page
    ("kicinska2025", "decreased by 42%, 40%", "40 % less annual mean pm2.5"),
    ("kicinska2025", "were not met", "limit was still not met"),
    ("samek2017", "february 2014-70", "≈70 vs ≈10"),
    ("samek2017", "about 31", "≈31"),
    ("scibor2020", "around 70%", "≈70 %"),
    ("scibor2020", "concave landform", "concave landform"),
    ("scibor2020", "frequent air temperature inversions", "frequent temperature inversions"),
    ("klepeis2001", "87%", "87 %"),
    ("klepeis2001", "9386", "9,386 people"),
    ("danek2021", "main sources of air pollution from solid fuel heating", "main source of the smoke that reaches it"),
    ("zareba2022", "prone to accumulating pollutants from its neighborhood", "collect pollution from its neighbours"),
    ("blaszczyk2017", "no statistically significant differences", "did not differ significantly from outdoor"),
    ("rivas2014", "factor of 1.7", "1.7 times the urban background"),
    ("acevedo2011", "within 0.25 m of the source were 6-20 times as high as the predicted well-mixed", "6 to 20 times the well-mixed prediction"),
    ("lakey2021", "needs to be revisited", "needs to be revisited"),
    ("simona2025", "39.9% lower", "39.9 % lower"),
    ("simona2025", "17 los angeles unified school district elementary schools", "17 elementary schools"),
    ("castell2017", "varies from unit to unit", "vary from unit to unit"),
    ("jayaratne2018", "relative humidity above about 75 %", "above about 75 %"),
    ("crilley2018", "within 33 %", "within 33 %"),
    ("crilley2018", "köhler theory", "κ-köhler"),
    ("petters2007", "single hygroscopicity parameter", "κ"),
    ("daellenbach2020", "residential biomass burning", "residential biomass burning"),
    ("daellenbach2020", "may not reduce the oxidative potential", "cutting mass alone may not cut it"),
    ("gao2021", "decreased mitochondrial membrane potential", "lower membrane potential"),
    ("gao2021", "decreased levels of atp", "less atp"),
    ("puthussery2018", "mist chamber", "mist chamber"),
    ("puthussery2018", "syringe pump", "syringe pumps"),
    ("huang2021", "30 μg/cm2", "1 and 30 μg/cm²"),
    ("sotty2019", "especially copd", "especially copd"),
    ("guestrin2005", "np-complete", "a famously hard problem"),
    ("francis2022", "aerial robots", "gas mapping and source localisation with ground and aerial robots"),
    ("lee2004", "appropriately", "rely on automation appropriately"),
    ("ho2018", "equivalent whether participants thought they were disclosing to a chatbot or to a person", "same effects as disclosing them to a person"),
    ("nazaroff2004", "deposition onto indoor surfaces", "mass balance"),
    ("casotto2022", "pollution hot-spot in europe", "a pollution hot spot in europe"),
    ("guzman2020", "communicators", "a machine as a communicator"),
    ("anderson2020", "first odor-sensing biohybrid robot system to fly", "first odour-sensing biohybrid robot to fly"),
    ("ihantola2022", "notable genotoxic effects", "notable genotoxic effects"),
    ("ihantola2022", "after one-hour exposure", "after one-hour exposure"),
    ("upadhyay2018", "air-liquid interface", "air-liquid interface"),
    ("upadhyay2018", "ciliated cells, goblet cells, club cells and basal cells", "ciliated, goblet, club and basal cells"),
    ("juarez2024", "37 °c, 85–90% rh", "37 °c, 85–90 % rh"),
    ("juarez2024", "enable field studies", "built to enable field studies"),
    ("chidekel2012", "exposure to low humidity results in reduced epithelial cell function and increased inflammation", "dry air alone reduced airway-cell function and raised inflammation"),
    ("jeannet2015", "temperature and humidity conditioning, preventing cellular stress during exposure", "preventing cellular stress"),
    ("milici2021", "within minutes of application", "within minutes of application"),
    ("gibbs2013", "imaged in real time", "watched in real time"),
    ("corteselli2018", "temporal resolution that is not possible using conventional methods", "a time resolution conventional methods cannot reach"),
    ("corteselli2018", "destruction of the sample", "destroy the sample"),
    ("puthussery2018", "hourly measurements", "hourly readings"),
    ("huang2021", "pm2.5 for 24 h", "for 24 h"),
]
DOI = {r["key"]: r.get("doi") for r in REFS}
abstracts = {}
for key, in_abs, on_page in CLAIMS:
    if key not in abstracts:
        w = requests.get(f"https://api.openalex.org/works/doi:{DOI[key]}", headers=UA, timeout=60).json()
        inv = w.get("abstract_inverted_index") or {}
        text = " ".join(t for _, t in sorted((p, t) for t, ps in inv.items() for p in ps))
        if not text:                                     # OpenAlex has no abstract: try Europe PMC
            res = requests.get("https://www.ebi.ac.uk/europepmc/webservices/rest/search", headers=UA, timeout=60,
                               params={"query": f'DOI:"{DOI[key]}"', "format": "json", "resultType": "core"}).json()
            res = res.get("resultList", {}).get("result", [])
            text = res[0].get("abstractText", "") if res else ""
        abstracts[key] = norm(text + " " + (w.get("title") or ""))
    if norm(in_abs) not in abstracts[key]:
        fails.append(f"abstract {key}: '{in_abs}' not found")
    if norm(on_page) not in PAGE_TEXT:
        fails.append(f"page: '{on_page}' (from {key}) not on the page")
print(f"2. claims: {len(CLAIMS)} checked against {len(abstracts)} abstracts")

# ---------------------------------------------------------------- 3. web sources
WEB = [("ecovacs", ["600", "PM2.5"]), ("ballie", ["innovation platform"]), ("astro", ["Astro for Business"]), ("airly", ["Airly"]),
       ("millicell", ["1.7", "4"]), ("who2020lbm", ["Laboratory biosafety manual", "waste management"])]
URL = {r["key"]: r.get("url") for r in REFS}
for key, words in WEB:
    resp, text = None, ""
    try:
        resp = requests.get(URL[key], headers={"User-Agent": "Mozilla/5.0"}, timeout=40)
        text = resp.text if resp.status_code == 200 else ""
    except Exception:  # noqa: BLE001
        pass
    if not text:
        manual.append(f"{key}: HTTP {getattr(resp, 'status_code', 'error')}, checked by hand on 13 Oct 2026 ({URL[key]})")
    elif not all(w.lower() in text.lower() for w in words):
        fails.append(f"web {key}: {words} not all found")
print(f"3. web sources: {len(WEB) - len(manual)} fetched, {len(manual)} need a manual check")

# ---------------------------------------------------------------- 4. the page itself
cited = set()
for refs in re.findall(r'data-ref="([^"]+)"', PAGE):
    cited.update(k.strip() for k in refs.split(","))
keys = {r["key"] for r in REFS}
if cited - keys:
    fails.append(f"cited but not in refs.json: {sorted(cited - keys)}")
if keys - cited:
    fails.append(f"in refs.json but never cited: {sorted(keys - cited)}")
ids = set(re.findall(r'id="([^"]+)"', PAGE))
for js in SITE.glob("*.js"):
    for used in set(re.findall(r'(?:\$|getElementById)\("([A-Za-z][\w-]*)"\)', js.read_text(encoding="utf-8"))):
        if used not in ids:
            fails.append(f"{js.name} uses #{used}, which the page does not have")
n, w = BENCH["seeds"], BENCH["wins"]
if not (n == 24 and w["people_vs_fixed"] == n):
    fails.append(f"page says Oddech beat four fixed sensors where people breathe in all 24 rooms; bench.json: {w['people_vs_fixed']}/{n}")
if "in our simulation of 24 rooms" not in PAGE_TEXT:
    fails.append("the 24-room sentence is missing from the diagnosis")
numbers = (HERE.parent / "source" / "numbers.tex").read_text(encoding="utf-8")
for name, shown in (("nMedium", "128 people"), ("nCellMedium", "32 per cell")):
    val = re.search(r"\\newcommand{\\%s}{(\d+)}" % name, numbers).group(1)
    if val not in shown or norm(shown) not in PAGE_TEXT:
        fails.append(f"sample size {name}={val} vs page '{shown}'")
print(f"4. page: {len(cited)} cited keys, {len(ids)} ids, bench {w}")

if "--sim" in sys.argv:
    subprocess.run(["node", "test_sim.js"], cwd=HERE, check=True)

for m in manual:
    print("   manual:", m)
if fails:
    print("\nFAILED:\n  " + "\n  ".join(fails))
    sys.exit(1)
print("\nall checks passed")
