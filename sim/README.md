# Oddech Sim: the robot, live

A second Streamlit app next to the site: a Gazebo-style simulator that runs in the browser. It is deployed from the branch
`simulation` with main file `sim/app.py`. The main site (branch `main`) links to it.

- **The robot** is Antonio's CAD from `3model/`, loaded from its COLLADA files. These are `Oddech.dae` (body, wheels,
  casters, port), `Oddech-Cilindro*.dae` (the four mast stages) and `Oddech_sniffer.dae` (the head). Part names come from
  `Oddech.FCStd`.
- **What moves:**
  - The wheels turn with the motion.
  - The four stages telescope: the nose goes from 0.40 to 1.69 m.
  - The sniffer lid glows while it samples.
- **Model, not measurement:** the air, the map of the air, the planner, the living cells and the advice are the site's
  model, `site/sim.js`, the same one section 06 runs.
- **Added here:**
  - Driving with limits and collisions.
  - A 360-beam laser ray-cast against the furniture, and a 5 cm occupancy map built from it.
  - Wheel odometry that drifts, and an IMU.
  - ROS 2-style topics with their rates and `ros2 topic echo`.
  - An entity tree with an inspector, an exploded view, and the CAD's own colours on request.

## When Antonio updates the model

```bash
git fetch && git checkout simulation && git merge origin/CADmodel     # his new 3model/*.dae
python sim/tools/pack_cad.py                                            # gzips them into sim/static/cad/, rewrites the manifest
git add 3model sim/static && git commit -m "Sim: Antonio's model of <date>" && git push
```

The app reads the parts by their FreeCAD names, so renamed or new parts still load. The roles are assigned as follows:
- Files with "Cilindro" become mast stages, ordered by height.
- The sniffer file becomes the head.
- Bodies named "...Wheel" become wheels.
- Everything else is the body.

## Run locally

```bash
streamlit run sim/app.py                      # from the repository folder; serves sim/static/ (enableStaticServing)
python sim/build_sim.py sim/preview.html static/ && python -m http.server   # or: http://localhost:8000/sim/preview.html
```

## What is assumed

- **Front:** the front is the round port, so the robot drives toward FreeCAD's −y. In FreeCAD's front view that side faces
  the viewer, with LWheel on the viewer's left.
- **Laser:** it sits in the band (Segment6), since the CAD has no scanner.
- **Mast:** the four stages retract into the body.
- **Dynamics and limits:** these are the package's design targets: 0.30 m/s, 1.6 rad/s, 0.5 m/s², nose 0.25 m/s.
- **The map:** it is built at the true pose, so localisation is assumed.
- **The room:** everything about the room is a model with stated, illustrative parameters.
