// Checks for site/sim.js, and the H1 benchmark the page quotes (written to site/bench.json).
// Run:  node test_sim.js        (about nine minutes; it rewrites site/bench.json, so run it with all 24 seeds before a push)
"use strict";
const assert = require("assert");
const fs = require("fs");
const S = require("./site/sim.js");
const { NX, NY, NZ, DX, DY, DZ } = S;

// 1. every flow the room can have is exactly divergence-free, and no air crosses a wall
for (const cfg of [{}, { purifierOn: true, cadr: 600 / 3600 }, { stoveOn: true }, { windowOpen: true },
                   { purifierOn: true, cadr: 300 / 3600, purifier: { x: 2.0, y: 2.0 }, stoveOn: true, windowOpen: true }]) {
  const f = S.makeFlow(Object.assign({ purifier: S.LAYOUT.purifier, cadr: 0 }, cfg));
  let worst = 0, wall = 0;
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
    const du = f.u[i + 1 + (NX + 1) * (j + NY * k)] - f.u[i + (NX + 1) * (j + NY * k)];
    const dv = f.v[i + NX * (j + 1 + (NY + 1) * k)] - f.v[i + NX * (j + (NY + 1) * k)];
    const dw = f.w[i + NX * (j + NY * (k + 1))] - f.w[i + NX * (j + NY * k)];
    worst = Math.max(worst, Math.abs(du / DX + dv / DY + dw / DZ));
  }
  for (let k = 0; k < NZ; k++) for (let j = 0; j < NY; j++) wall = Math.max(wall, Math.abs(f.u[(NX + 1) * (j + NY * k)]), Math.abs(f.u[NX + (NX + 1) * (j + NY * k)]));
  assert(worst < 1e-5 && wall < 1e-7, `divergence ${worst}, wall flux ${wall}`);
}

// 2. no sources, window shut, purifier off: the room stays at the mass-balance steady state (mass conserved)
{
  const air = new S.Air({ cout: 60 });
  const m0 = air.mean();
  air.advance(1800);
  assert(Math.abs(air.mean() / m0 - 1) < 1e-3, `steady state drifted ${air.mean()} vs ${m0}`);
  for (const c of air.C) assert(c >= 0);
}

// 3. a purifier at CADR 300 m3/h lowers the room; the steady state is the order the well-mixed balance gives
{
  const off = new S.Air({ cout: 60 }), on = new S.Air({ cout: 60, purifierOn: true });
  off.advance(1800); on.advance(1800);
  const ssMixed = S.PHYS.lam * S.PHYS.P * 60 / (S.PHYS.lam + S.PHYS.kd + 300 / 3600 / S.VROOM);
  const L = S.PHYS.lam + S.PHYS.kd + 300 / 3600 / S.VROOM, mixed30 = ssMixed + (off.mean() - ssMixed) * Math.exp(-L * 1800);
  assert(on.mean() < 0.7 * off.mean(), "purifier should clean");
  assert(on.mean() > mixed30 && on.mean() < 2 * mixed30, `after 30 min ${on.mean()} vs well-mixed ${mixed30}: slower than ideal, not absurdly`);
  console.log(`purifier 30 min: room ${on.mean().toFixed(1)} vs ideal well-mixed ${mixed30.toFixed(1)}; off ${off.mean().toFixed(1)} µg/m3`);
}

// 4. cooking makes a gradient: the kitchen is much worse than the sofa (why one monitor is not enough)
{
  const air = new S.Air({ cout: 55, stoveOn: true });
  air.advance(900);
  const kitchen = air.at(1.25, 4.9, 1.1), sofa = air.at(5.75, 0.62, 1.1);
  assert(kitchen > 1.6 * sofa, `kitchen ${kitchen} sofa ${sofa}`);
  console.log(`cooking 15 min: kitchen ${kitchen.toFixed(0)}, sofa ${sofa.toFixed(0)}, room mean ${air.mean().toFixed(0)} µg/m3`);
}

// 5. the planner finds a path round the furniture and never enters a blocked cell
{
  const occ = S.occupancy(S.LAYOUT.purifier);
  const p = S.astar(occ, 6.6, 3.0, 1.4, 2.6);
  assert(p && p.length >= 2, "no path");
  for (let q = 1; q < p.length; q++) {
    const a = p[q - 1], b = p[q], n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.05);
    for (let s = 0; s <= n; s++) {
      const x = a.x + (b.x - a.x) * s / n, y = a.y + (b.y - a.y) * s / n;
      assert(!occ[Math.floor(x / DX) + NX * Math.floor(y / DY)], `path enters furniture at ${x},${y}`);
    }
  }
}

// 6. the live world runs: the robot drives, reads three heights, the map improves, advice appears
{
  const w = new S.World({ scenario: "cooking", seed: 3 });
  w.advance(300);
  const e1 = w.hist[w.hist.length - 1].err;
  w.advance(900);
  const r = w.live.robot, e2 = w.hist[w.hist.length - 1].err;
  assert(r.visits >= 6, `robot visits ${r.visits}`);
  assert(r.profile.every(v => v !== null), "three mast heights read");
  assert(w.advice && w.advice.text.warm_stated.startsWith("Ania"), "advice");
  assert(w.air.cfg.purifierOn, "auto mode switched the purifier on during cooking");
  console.log(`live: map error ${e1.toFixed(3)} -> ${e2.toFixed(3)} (log RMSE), visits ${r.visits}, battery ${r.pct.toFixed(0)} %`);
  console.log("advice:", w.advice.text.warm_stated);
  const s = new S.World({ scenario: "smog", seed: 5 }); s.follow = true; s.advance(900);
  assert(!s.air.cfg.windowOpen, "household followed 'close the window'");
  console.log("smog log:", s.log.map(l => `${Math.round(l.t)} s ${l.text}`).join("; "));
}

// 7. the harm field: sources weighted by relative harm; candle smoke is worse per gram than cooking
{
  const a = new S.Air({ cout: 0, candleOn: true }), b = new S.Air({ cout: 0, stoveOn: true });
  a.advance(600); b.advance(600);
  const ra = a.O.reduce((s, v) => s + v, 0) / a.C.reduce((s, v) => s + v, 0), rb = b.O.reduce((s, v) => s + v, 0) / b.C.reduce((s, v) => s + v, 0);
  assert(Math.abs(ra - S.TOX.candle) < 0.02 && Math.abs(rb - S.TOX.stove) < 0.02, `harm per mass candle ${ra}, stove ${rb}`);
}

// 8. the Living Air Sensor: same dust mass, smoke-like air stresses the cells more; clean air barely; controls stay flat
{
  const run = (m, tox) => { const L = new S.LivingSensor(3); for (let i = 0; i < 36; i++) L.cycle(m, m * tox, i * 600); return L.last; };
  const smoke = run(70, 1.4), cook = run(70, 0.7), clean = run(8, 1.0);
  assert(smoke.index > 1.5 * cook.index && cook.index > clean.index && clean.index < 10, `index smoke ${smoke.index} cook ${cook.index} clean ${clean.index}`);
  assert(Math.abs(smoke.dCtl) < 0.05, `controls drift ${smoke.dCtl}`);
  assert(smoke.life > 0.9, "a cartridge lasts a week");
  const wc = new S.World({ scenario: "candle", seed: 4 }), wk = new S.World({ scenario: "cooking", seed: 4 }); wc.advance(1800); wk.advance(1800);
  assert(wc.bio.last.n >= 2 && wc.bio.last.toxPerMass > wk.bio.last.toxPerMass, `cycles ${wc.bio.last.n}; harm per mass candle ${wc.bio.last.toxPerMass}, cooking ${wk.bio.last.toxPerMass}`);
  console.log(`living sensor, 6 h at 70 µg/m3: smoke-like ${smoke.index.toFixed(0)}, cooking-like ${cook.index.toFixed(0)}; clean 8 µg/m3: ${clean.index.toFixed(0)} / 100`);
}

// 9. unit economics at the page's default sliders
{
  const u = S.unitEconomics({ hw: 1100, fee: 120, cart: 4, pc: 25, svc: 20, life: 36 });
  assert(u.gm === 150 && Math.abs(u.pay - 7.333) < 0.01 && u.ltv === 4300, JSON.stringify(u));
}

// 10. H1 benchmark: 4 fixed sensors vs 3 fixed + Oddech vs 3 fixed + a robot going to random places
const seeds = +(process.env.SEEDS || 24);
const med = a => { const b = a.slice().sort((x, y) => x - y); return (b[(b.length - 1) >> 1] + b[b.length >> 1]) / 2; };
let bench;
{
  const minutes = 20, rows = [];
  for (let s = 1; s <= seeds; s++) rows.push(S.benchRun(s, minutes));
  bench = { seeds, minutes, metric: "RMSE of ln(PM2.5 + 2) at 1.1 m over the free floor, minutes 5 to 20",
    metricPeople: "mean |error| of ln(PM2.5 + 2) where the child and the adult breathe, minutes 5 to 20",
    median: {}, wins: {}, rows };
  for (const k of ["fixed4", "oddech", "random", "fixed4_people", "oddech_people", "random_people"]) bench.median[k] = med(rows.map(r => r[k]));
  bench.wins = { field_vs_fixed: rows.filter(r => r.oddech < r.fixed4).length, field_vs_random: rows.filter(r => r.oddech < r.random).length,
                 people_vs_fixed: rows.filter(r => r.oddech_people < r.fixed4_people).length, people_vs_random: rows.filter(r => r.oddech_people < r.random_people).length };
  console.log("bench median", bench.median, "wins of", seeds, bench.wins);
}

// 11. H2 outcome, the deck's results slides: the same rooms and purifier, left in its corner, on high, or used as Oddech advises
{
  const minutes = 30, rows = [];
  for (let s = 1; s <= seeds; s++) rows.push(S.careRun(s, minutes));
  const cutC = r => 1 - r.oddech / r.corner, cutH = r => 1 - r.oddech / r.high;
  const c = bench.care = { seeds, minutes,
    metric: "child's inhaled PM2.5 dose over 30 min; monitor and map: mean ln((reading + 2) / (child's air + 2)), minutes 5 to 30",
    median: { cutCorner: med(rows.map(cutC)), cutHigh: med(rows.map(cutH)), monitorLog: med(rows.map(r => r.monitorLog)), oddechLog: med(rows.map(r => r.oddechLog)) },
    wins: { corner: rows.filter(r => cutC(r) > 0).length, high: rows.filter(r => cutH(r) > 0).length,
            closer: rows.filter(r => Math.abs(r.oddechLog) < Math.abs(r.monitorLog)).length }, rows };
  assert(c.wins.corner === seeds && c.median.cutCorner > 0.15, `dose cut ${c.median.cutCorner}, lower in ${c.wins.corner}/${seeds}`);
  assert(c.median.monitorLog < -0.2 && c.wins.closer === seeds, `monitor ${c.median.monitorLog}, Oddech closer in ${c.wins.closer}/${seeds}`);
  console.log(`H2: child's dose ${(-100 * c.median.cutCorner).toFixed(0)} % vs corner (${c.wins.corner}/${seeds}), ${(-100 * c.median.cutHigh).toFixed(0)} % vs high (${c.wins.high}/${seeds});`,
    `shelf monitor ${(100 * (Math.exp(c.median.monitorLog) - 1)).toFixed(0)} %, Oddech ${(100 * (Math.exp(c.median.oddechLog) - 1)).toFixed(0)} % vs the child's air`);
}

// 12. one evening for the deck: cooking, seed 3, the same flat twice; maps at minute 10, curves every 30 s
{
  const kid = S.LAYOUT.people[0], r1 = v => v === null || v === undefined ? null : Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
  const A = new S.World({ scenario: "cooking", seed: 3, purifierMode: "on" }), O = new S.World({ scenario: "cooking", seed: 3, purifierMode: "auto" });
  O.follow = true;
  const ex = bench.example = { scenario: "cooking", seed: 3, minutes: 30, mapMinute: 10,
    curveCols: ["t s", "child, Oddech acting", "child, purifier left in its corner", "Oddech's estimate", "low", "high", "shelf monitor"], curve: [], advice: null };
  for (let t = 0; t < 1800; t += 30) {
    A.advance(30, { advice: false }); O.advance(30);
    const e = S.exposures(O)[0], a = O.advice && O.advice.actions[0];
    ex.curve.push([Math.round(O.t), r1(O.air.at(kid.x, kid.y, kid.z)), r1(A.air.at(kid.x, kid.y, kid.z)), r1(e.c), r1(e.lo), r1(e.hi), r1(O.live.sensors[0].last)]);
    if (!ex.advice && a && a.id === "movePurifier") ex.advice = O.advice.text.warm_stated;
    if (Math.round(O.t) === ex.mapMinute * 60) {
      const m = O.live.map, r = O.live.robot, ge = m.grid(1.1, O.t, S.NX, S.NY, false), gs = m.grid(1.1, O.t, 20, 15, true);
      ex.maps = { truth: Array.from(O.air.plane(1.1), Math.round), harm: Array.from(O.air.plane(1.1, null, O.air.O), Math.round),
        est: Array.from(ge.mu, v => Math.round(S.EXP(v))), sd: Array.from(gs.sd, r2),
        samples: m.samples.filter(s => s.src === "robot").map(s => [r2(s.x), r2(s.y)]), trail: r.trail.filter((p, i) => i % 3 === 0).slice(-160).map(p => [r2(p[0]), r2(p[1])]),
        robot: [r2(r.x), r2(r.y)], purifier: [O.air.cfg.purifier.x, O.air.cfg.purifier.y, O.air.cfg.purifierOn ? 1 : 0] };
    }
  }
  ex.actions = O.log.map(l => [Math.round(l.t), l.text]);
  ex.dose = { oddech: r1(O.dose.child), corner: r1(A.dose.child) };
  assert(ex.maps && ex.advice && /move the purifier/.test(ex.advice), "maps and the move-the-purifier advice recorded");
  assert(ex.dose.oddech < 0.85 * ex.dose.corner, `evening dose ${ex.dose.oddech} vs ${ex.dose.corner}`);
  console.log(`evening: child's dose ${ex.dose.oddech} vs ${ex.dose.corner} µg; actions: ${ex.actions.map(a => a[1]).join("; ")}`);
}
fs.writeFileSync(__dirname + "/site/bench.json", JSON.stringify(bench, null, 1));
console.log("all sim checks passed");
