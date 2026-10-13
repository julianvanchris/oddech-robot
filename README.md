# Oddech: a robot that reads the air

Team site for the FL Joint Program 2026 (Kraków), Proposal A. *Oddech* is Polish for breath: a ground robot with a telescoping
sensor mast that maps fine dust in a room, estimates what people breathe, explains it in plain words and tells the window and the
purifier what to do. The site is also the final-presentation deck (press **P** for presentation mode, arrow keys to move,
**F** for full screen).

Deployed like the CBIC app: GitHub repository, then Streamlit Community Cloud with `app.py` as the main file.

## What is on the site

| Section | Content |
|---|---|
| 01 Problem | Kraków's PM2.5 against WHO and EU yardsticks; the valley and inversion schematic |
| 02 Diagnosis | Twelve hard questions (why a robot, why not a purifier, why not a drone, toxicity and mitochondria, trust, privacy, competitors, kill criteria), each tagged evidence / design / to be tested |
| 03 Concept | Measure, map, dose, explain, act; the airway dose in µg/cm² as the bridge to airway-cell studies |
| 04 Robot | Interactive 3D model (mast 0.40–1.60 m, exploded view), platform comparison, power and stability calculators |
| 05 Sensor | Animated optical particle counter; the humidity (κ-Köhler) correction; what is measured on board and off board |
| 06 Simulation | Live 3D flat: PM2.5 transport, the robot's map and uncertainty, path planning, purifier, advice in the four WP3 wordings, dose; the H1 benchmark |
| 07–13 | Users, market, business model and pivots, research questions, roadmap, team, the ask |
| Sources | 38 references, every journal entry checked against Crossref and every quoted figure against its abstract |

## Files

```
app.py            Streamlit entry: assembles site/ into one page and shows it full screen
site/index.html   page content (citations are data-ref keys into refs.json)
site/style.css    editorial design: paper, ink, terracotta (at stake), indigo (the model's belief)
site/sim.js       the model: 3D advection-diffusion of PM2.5, Gaussian-process map, A* planner, robot, advice, H1 benchmark
site/scene.js     the 3D simulation (Three.js)        site/robot3d.js   robot model and viewer
site/hero.js      opening smog field                  site/sensor.js    particle-counter animation, humidity chart
site/main.js      citations, navigation, calculators, market map, benchmark panel
site/refs.json    references                          site/bench.json   H1 benchmark results (written by test_sim.js)
vendor/three.min.js  Three.js r149 (MIT), inlined so the page needs no CDN for 3D
test_sim.js       checks of the model (mass conservation, divergence-free flow, planner, robot, advice) and the benchmark
check_site.py     Crossref, abstract and page-consistency checks
```

## Run and check

```bash
pip install -r requirements.txt
streamlit run app.py                 # http://localhost:8501
node test_sim.js                     # model checks; rewrites site/bench.json (about a minute)
python check_site.py                 # references, quoted figures, citation keys, element ids, benchmark sentences
```

## Deploy (Streamlit Community Cloud)

1. Push this folder to a GitHub repository (for example `oddech`), branch `main`.
2. On share.streamlit.io: **New app**, choose the repository, branch `main`, main file `app.py`, **Deploy**.

Fonts load from Google Fonts; everything else is in the repository.

## What is a model and what is a claim

- The simulation is a model room with stated, illustrative parameters. It demonstrates the method; it is not evidence about real
  rooms. The H1 result (24 simulated rooms) is labelled as simulation throughout.
- Robot dimensions, power and costs are design targets and planning assumptions, not a built prototype or quotes.
- Business lines are hypotheses to be tested in interviews and at the Entre Challenge.
