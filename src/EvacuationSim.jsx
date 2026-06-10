import { useEffect, useRef, useState, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS = { UNAWARE: 0, SEEKING: 1, MILLING: 2, EVAC: 3, DONE: 4 };

const STATUS_COLORS = {
  [STATUS.UNAWARE]: { fill: "#888780", stroke: "#5F5E5A" },
  [STATUS.SEEKING]: { fill: "#378ADD", stroke: "#185FA5" },
  [STATUS.MILLING]: { fill: "#EF9F27", stroke: "#BA7517" },
  [STATUS.EVAC]:    { fill: "#E24B4A", stroke: "#A32D2D" },
  [STATUS.DONE]:    { fill: "#1D9E75", stroke: "#0F6E56" },
};

const ELDER_FILL = "#7F77DD";
const ELDER_STR  = "#534AB7";
const CHILD_FILL = "#D4537E";
const CHILD_STR  = "#993556";

const FAMILY_NAMES = ["Rivera", "Kim", "Okafor", "Hassan", "Novak", "Tanaka"];
const PERSON_NAMES = ["Alex", "Jordan", "Sam", "Casey", "Morgan", "Riley", "Blake", "Avery"];
const FAMILY_COLORS = ["#534AB7", "#0F6E56", "#993C1D", "#185FA5", "#854F0B", "#993556"];

const CANVAS_HEIGHT = 440;
const NUM_FAMILIES  = 6;
const SIM_INTERVAL_MS = 200; // ms between ticks when running

const STATUS_LABEL      = ["Unaware", "Seeking info", "Milling", "Evacuating", "Evacuated"];
const STATUS_TEXT_COLOR = ["#737069", "#185FA5", "#BA7517", "#A32D2D", "#0F6E56"];

// ─── Scenario definitions ─────────────────────────────────────────────────────

const SCENARIOS = {
  pedestrian: {
    label: "Pedestrian",
    icon: "🚶",
    millingBase:  [2, 4], millingElder: [2, 5], millingChild: [3, 6],
    evacBase:     [3, 6], evacElder:    [3, 7], evacChild:    [2, 5],
    speeds: { child: 1.5, elder: 1.8, adult: 2.6 },
  },
  car: {
    label: "Car",
    icon: "🚗",
    millingBase:  [1, 3], millingElder: [1, 2], millingChild: [2, 3],
    evacBase:     [1, 2], evacElder:    [0, 1], evacChild:    [0, 1],
    speeds: { child: 5.5, elder: 5.5, adult: 5.5 },
  },
  train: {
    label: "Train",
    icon: "🚆",
    millingBase:  [4, 8], millingElder: [2, 4], millingChild: [1, 3],
    evacBase:     [1, 2], evacElder:    [0, 1], evacChild:    [0, 1],
    speeds: { child: 8.0, elder: 8.0, adult: 8.0 },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const rnd   = (a, b) => a + Math.random() * (b - a);
const irnd  = (a, b) => Math.floor(rnd(a, b + 1));
const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ─── Simulation builder ───────────────────────────────────────────────────────

/**
 * Build a fresh simulation state from slider parameters.
 *
 * @param {object} params
 * @param {number} params.threat        - 1–10, threat severity
 * @param {number} params.elderPct      - 0–1, fraction of non-hub members who are elders
 * @param {number} params.childPct      - 0–1, fraction of non-hub members who are children <5
 * @param {number} params.infoClar      - 1–10, information clarity / reliability
 * @param {number} params.nbrInfluence  - 0–1, neighbor social influence strength
 * @param {number} params.avgFamilySize - 1–7, average members per family
 * @param {string} params.scenario      - "pedestrian" | "car" | "train"
 * @param {number} canvasWidth
 */
export function buildSimulation({ threat, elderPct, childPct, infoClar, nbrInfluence, avgFamilySize = 3, scenario = "pedestrian", canvasWidth }) {
  const sc = SCENARIOS[scenario] ?? SCENARIOS.pedestrian;
  const W = canvasWidth;
  const H = CANVAS_HEIGHT;

  const infoNode = {
    x: W / 2,
    y: H / 2,
    reliability: clamp(infoClar / 10, 0.1, 0.95),
    clarity: infoClar,
  };

  const PAD = 80;
  const MIN_DIST = 110;
  const MIN_INFO_DIST = 90;
  const hubPositions = [];
  for (let fi = 0; fi < NUM_FAMILIES; fi++) {
    let hx, hy, attempts = 0;
    do {
      hx = rnd(PAD, W - PAD);
      hy = rnd(PAD, H - PAD);
      attempts++;
    } while (
      attempts < 200 &&
      (
        Math.hypot(W / 2 - hx, H / 2 - hy) < MIN_INFO_DIST ||
        hubPositions.some((p) => Math.hypot(p.x - hx, p.y - hy) < MIN_DIST)
      )
    );
    hubPositions.push({ x: hx, y: hy });
  }

  const families = hubPositions.map(({ x: hx, y: hy }, fi) => {
    const size = irnd(Math.max(1, avgFamilySize - 1), avgFamilySize + 1);
    const name = FAMILY_NAMES[fi];
    const members = [];
    let childCount = 0;
    let elderCount = 0;

    for (let m = 0; m < size; m++) {
      const isElder = m > 0 && Math.random() < elderPct;
      const isChild = m > 0 && !isElder && Math.random() < childPct;
      if (isElder) elderCount++;
      if (isChild) childCount++;

      const mang   = (m / size) * Math.PI * 2 + rnd(-0.3, 0.3);
      const spread = m === 0 ? 0 : rnd(20, 32);

      // Confirmations needed before milling: more for elders, more when info is unclear
      const confirmNeeded = irnd(1, 3) + (infoClar < 4 ? irnd(1, 2) : 0) + (isElder ? 1 : 0);

      // Milling delay: time to prepare before departing
      const millingExtra = isElder ? irnd(...sc.millingElder) : isChild ? irnd(...sc.millingChild) : 0;
      const millingTicks = irnd(...sc.millingBase) + millingExtra;

      // Evacuation travel time
      const evacExtra = isElder ? irnd(...sc.evacElder) : isChild ? irnd(...sc.evacChild) : 0;
      const evacTicks = irnd(...sc.evacBase) + evacExtra;

      members.push({
        x: hx + Math.cos(mang) * spread,
        y: hy + Math.sin(mang) * spread,
        // Saved so we can reset positions without rebuilding
        ox: hx + Math.cos(mang) * spread,
        oy: hy + Math.sin(mang) * spread,
        isElder,
        isChild,
        isHub: m === 0,
        name: m === 0 ? name : pick(PERSON_NAMES),
        status: STATUS.UNAWARE,
        confirmNeeded,
        confirmCount: 0,
        seekStart: null,
        millingStart: null,
        evacStart: null,
        doneAt: null,
        millingTicks,
        evacTicks,
        tx: 0,
        ty: 0,
        family: fi,
      });
    }

    // Hub node sits at center of cluster
    members[0].x = hx;
    members[0].y = hy;
    members[0].ox = hx;
    members[0].oy = hy;
    members[0].isHub = true;
    members[0].name = name;
    // Hub waits for slowest household member
    members[0].millingTicks = Math.max(...members.map((m) => m.millingTicks));
    members[0].evacTicks    = Math.max(...members.map((m) => m.evacTicks));

    return { name, members, fi, col: FAMILY_COLORS[fi], childCount, elderCount };
  });

  // Neighbor edges: ring + skip-one connections
  const rawEdges = [];
  for (let i = 0; i < NUM_FAMILIES; i++) {
    rawEdges.push({ a: families[i], b: families[(i + 1) % NUM_FAMILIES] });
    rawEdges.push({ a: families[i], b: families[(i + 2) % NUM_FAMILIES] });
  }
  const seen = new Set();
  const neighborEdges = rawEdges.filter((e) => {
    const key = [e.a.fi, e.b.fi].sort().join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    families,
    neighborEdges,
    infoNode,
    threat,
    infoClar,
    nbrInfluence,
    scenario,
    tick: 0,
    started: false,
    activeArcs: [], // transient visual arcs from info node to members
  };
}

// ─── Simulation step ──────────────────────────────────────────────────────────

/**
 * Advance simulation by one tick. Mutates sim in place.
 * Returns { sim, logs, finished }.
 *
 * @param {object} sim     - simulation state (mutated)
 * @param {number} canvasH - canvas height, used to compute evac direction
 * @param {number} canvasW
 */
export function stepSimulation(sim, canvasW, canvasH) {
  sim.tick++;
  const t = sim.tick;
  const newLogs = [];

  // Expire old visual arcs (social arcs live longer than official arcs)
  sim.activeArcs = sim.activeArcs.filter((a) => t - a.born < (a.social ? 7 : 8));

  sim.families.forEach((f) => {
    f.members.forEach((mem) => {
      if (mem.status === STATUS.DONE) return;

      // ── UNAWARE → SEEKING ──────────────────────────────────────────────────
      if (mem.status === STATUS.UNAWARE) {
        const alertChance = clamp(sim.threat / 10 * 0.35 + (t / 30) * 0.15, 0.02, 0.55);
        if (Math.random() < alertChance) {
          mem.status = STATUS.SEEKING;
          mem.seekStart = t;
          mem.confirmCount = 0;
          const tag = mem.isElder ? "[elder]" : mem.isChild ? "[child<5]" : "";
          newLogs.push(`t${t} ${mem.name} (${f.name}) ${tag} receives alert — needs ${mem.confirmNeeded} confirmation(s)`);
          sim.activeArcs.push({ x1: sim.infoNode.x, y1: sim.infoNode.y, x2: mem.x, y2: mem.y, born: t, col: "#378ADD" });
        }
      }

      // ── SEEKING → MILLING ─────────────────────────────────────────────────
      else if (mem.status === STATUS.SEEKING) {
        const confirmChance = clamp(sim.infoNode.reliability * 0.45 + (sim.infoClar / 10) * 0.2, 0.05, 0.75);
        if (Math.random() < confirmChance) {
          mem.confirmCount++;
          sim.activeArcs.push({ x1: sim.infoNode.x, y1: sim.infoNode.y, x2: mem.x, y2: mem.y, born: t, col: "#EF9F27" });
          newLogs.push(`t${t} ${mem.name}: ${mem.confirmCount}/${mem.confirmNeeded} confirmations`);
        }

        // Neighbor influence: seeing others mill/evac counts as a confirmation
        const activeNeighbor = sim.neighborEdges
          .filter((e) => e.a === f || e.b === f)
          .map((e) => (e.a === f ? e.b : e.a))
          .find((nf) => nf.members.some((m) => m.status === STATUS.MILLING || m.status === STATUS.EVAC));
        if (activeNeighbor && Math.random() < sim.nbrInfluence) {
          mem.confirmCount = Math.min(mem.confirmNeeded, mem.confirmCount + 1);
          newLogs.push(`t${t} ${mem.name} sees neighbor active — +1 confirmation`);
          const srcHub = activeNeighbor.members[0];
          sim.activeArcs.push({ x1: srcHub.x, y1: srcHub.y, x2: mem.x, y2: mem.y, born: t, col: "#D97706", social: true });
        }

        if (mem.confirmCount >= mem.confirmNeeded) {
          mem.status = STATUS.MILLING;
          mem.millingStart = t;
          const delay = t - mem.seekStart;
          const why = mem.isElder ? "elder: extra prep" : mem.isChild ? "child<5: gathering kids" : "";
          newLogs.push(`t${t} ${mem.name} (${f.name}) confirmed after ${delay}t — milling${why ? " (" + why + ")" : ""}`);
        }
      }

      // ── MILLING → EVAC ────────────────────────────────────────────────────
      else if (mem.status === STATUS.MILLING) {
        if (t - mem.millingStart >= mem.millingTicks) {
          mem.status = STATUS.EVAC;
          mem.evacStart = t;
          const ang = Math.atan2(mem.y - canvasH / 2, mem.x - canvasW / 2);
          mem.tx = mem.x + Math.cos(ang) * 300;
          mem.ty = mem.y + Math.sin(ang) * 300;
          newLogs.push(`t${t} ${mem.name} (${f.name}) evacuating`);
        }
      }

      // ── EVAC → DONE ───────────────────────────────────────────────────────
      else if (mem.status === STATUS.EVAC) {
        const { speeds } = SCENARIOS[sim.scenario] ?? SCENARIOS.pedestrian;
        const spd = mem.isChild ? speeds.child : mem.isElder ? speeds.elder : speeds.adult;
        const dx = mem.tx - mem.x;
        const dy = mem.ty - mem.y;
        const d  = Math.hypot(dx, dy);
        if (d > spd) { mem.x += (dx / d) * spd; mem.y += (dy / d) * spd; }
        if (t - mem.evacStart >= mem.evacTicks + 2) {
          mem.status = STATUS.DONE;
          mem.doneAt = t;
          newLogs.push(`t${t} ${mem.name} (${f.name}) evacuated ✓`);
        }
      }
    });
  });

  const finished = sim.families.every((f) => f.members.every((m) => m.status === STATUS.DONE));
  if (finished) newLogs.push(`All evacuated at tick ${sim.tick}.`);

  return { sim, newLogs, finished };
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function drawHexagon(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i;
    const x = cx + r * Math.cos(ang);
    const y = cy + r * Math.sin(ang);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawScenarioBackground(ctx, scenario, W, H, darkMode) {
  const c = darkMode ? "rgba(255,255,255," : "rgba(0,0,0,";
  ctx.save();

  if (scenario === "car") {
    ctx.fillStyle = c + "0.04)";
    ctx.fillRect(0, H * 0.3,  W, 34);
    ctx.fillRect(W * 0.63, 0, 34, H);
    ctx.strokeStyle = c + "0.07)";
    ctx.lineWidth = 1;
    ctx.setLineDash([14, 10]);
    ctx.beginPath(); ctx.moveTo(0, H * 0.3 + 17);   ctx.lineTo(W, H * 0.3 + 17);   ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W * 0.63 + 17, 0);   ctx.lineTo(W * 0.63 + 17, H);  ctx.stroke();
    ctx.setLineDash([]);

  } else if (scenario === "train") {
    const ry = H * 0.83;
    ctx.strokeStyle = c + "0.07)";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "square";
    for (let x = 14; x < W; x += 18) {
      ctx.beginPath(); ctx.moveTo(x, ry - 5); ctx.lineTo(x, ry + 5); ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, ry - 3); ctx.lineTo(W, ry - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ry + 3); ctx.lineTo(W, ry + 3); ctx.stroke();
    ctx.strokeStyle = c + "0.1)";
    ctx.lineWidth = 1;
    ctx.lineCap = "butt";
    ctx.strokeRect(W - 64, ry - 20, 56, 24);
    ctx.fillStyle = c + "0.1)";
    ctx.font = "8px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STATION", W - 36, ry - 8);

  } else if (scenario === "pedestrian") {
    ctx.strokeStyle = c + "0.06)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.setLineDash([5, 9]);
    ctx.beginPath();
    ctx.moveTo(0, H * 0.27);
    ctx.bezierCurveTo(W * 0.33, H * 0.17, W * 0.58, H * 0.38, W, H * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W * 0.18, 0);
    ctx.bezierCurveTo(W * 0.26, H * 0.33, W * 0.2, H * 0.63, W * 0.32, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

/**
 * Draw the current simulation state onto a canvas context.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} sim
 * @param {number} W  - canvas width
 * @param {number} H  - canvas height
 * @param {boolean} darkMode
 */
export function drawSimulation(ctx, sim, W, H, darkMode = false, highlightFamilyIdx = null) {
  const BG   = darkMode ? "#1a1a18" : "#f8f7f4";
  const GCOL = darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)";

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = GCOL;
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y < H; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Scenario-specific background context
  drawScenarioBackground(ctx, sim.scenario, W, H, darkMode);

  // Neighbor edges (dashed) — brighten when an endpoint is socially active
  ctx.setLineDash([3, 4]);
  sim.neighborEdges.forEach((e) => {
    const aActive = e.a.members.some(m => m.status === STATUS.MILLING || m.status === STATUS.EVAC);
    const bActive = e.b.members.some(m => m.status === STATUS.MILLING || m.status === STATUS.EVAC);
    const socially = aActive || bActive;
    const highlighted = highlightFamilyIdx === null || e.a.fi === highlightFamilyIdx || e.b.fi === highlightFamilyIdx;
    ctx.globalAlpha = highlighted ? 1 : 0.1;
    ctx.lineWidth   = socially ? 1.5 : 1;
    ctx.strokeStyle = socially ? "rgba(217,119,6,0.55)" : "rgba(120,118,112,0.42)";
    const ha = e.a.members[0], hb = e.b.members[0];
    ctx.beginPath(); ctx.moveTo(ha.x, ha.y); ctx.lineTo(hb.x, hb.y); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  // Family bonds
  sim.families.forEach((f) => {
    ctx.globalAlpha = (highlightFamilyIdx === null || f.fi === highlightFamilyIdx) ? 1 : 0.1;
    const hub = f.members[0];
    f.members.slice(1).forEach((m) => {
      if (m.status === STATUS.DONE) return;
      ctx.beginPath(); ctx.moveTo(hub.x, hub.y); ctx.lineTo(m.x, m.y);
      ctx.strokeStyle = f.col + "44";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  });
  ctx.globalAlpha = 1;

  // Information arcs — official (blue) and social/neighbor (amber)
  sim.activeArcs.forEach((a) => {
    const maxAge = a.social ? 7 : 8;
    const age    = (sim.tick - a.born) / maxAge;
    if (age >= 1) return;
    const alpha  = Math.max(0, 1 - age) * (a.social ? 0.85 : 0.75);
    const hex    = Math.round(alpha * 255).toString(16).padStart(2, "0");

    ctx.save();
    if (age < 0.25) {
      ctx.shadowColor = a.col;
      ctx.shadowBlur  = a.social ? 8 : 6;
    }

    // Line
    ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2);
    ctx.strokeStyle = a.col + hex;
    ctx.lineWidth   = a.social ? 2 : 1.5;
    ctx.setLineDash(a.social ? [5, 4] : [3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Arrowhead at receiving end
    const ang  = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const dist = Math.hypot(a.x2 - a.x1, a.y2 - a.y1);
    if (dist > 20) {
      const offset = a.social ? 12 : 10;
      const tx = a.x2 - Math.cos(ang) * offset;
      const ty = a.y2 - Math.sin(ang) * offset;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx - Math.cos(ang - 0.42) * 7, ty - Math.sin(ang - 0.42) * 7);
      ctx.lineTo(tx - Math.cos(ang + 0.42) * 7, ty - Math.sin(ang + 0.42) * 7);
      ctx.closePath();
      ctx.fillStyle = a.col + hex;
      ctx.fill();
    }

    ctx.restore();
  });

  // Info node (center)
  const nd = sim.infoNode;
  const seekingCount = sim.families.reduce(
    (n, f) => n + f.members.filter((m) => m.status === STATUS.SEEKING).length, 0
  );
  const pulse = seekingCount > 0;
  drawHexagon(ctx, nd.x, nd.y, pulse ? 18 : 15);
  ctx.fillStyle   = pulse ? "#185FA5" : "rgba(55,138,221,0.2)";
  ctx.fill();
  ctx.strokeStyle = "#185FA5";
  ctx.lineWidth   = pulse ? 2 : 0.8;
  ctx.stroke();
  ctx.font      = '500 10px system-ui, sans-serif';
  ctx.fillStyle = pulse ? "#E6F1FB" : "#0C447C";
  ctx.textAlign = "center";
  ctx.fillText("Info", nd.x, nd.y + 1);
  ctx.font      = "9px system-ui, sans-serif";
  ctx.fillStyle = darkMode ? "rgba(181,212,244,0.75)" : "#185FA5";
  ctx.fillText(`clarity ${sim.infoClar}/10`, nd.x, nd.y + 24);
  ctx.fillText(`${Math.round(nd.reliability * 100)}% reliable`, nd.x, nd.y + 34);
  const sc = SCENARIOS[sim.scenario] ?? SCENARIOS.pedestrian;
  ctx.fillStyle = darkMode ? "rgba(200,200,200,0.6)" : "rgba(80,80,80,0.55)";
  ctx.fillText(`${sc.icon} ${sc.label}`, nd.x, nd.y + 46);

  // Members
  sim.families.forEach((f) => {
    ctx.globalAlpha = (highlightFamilyIdx === null || f.fi === highlightFamilyIdx) ? 1 : 0.15;
    f.members.forEach((m) => {
      if (m.status === STATUS.DONE && !m.isHub) return;
      const rad  = m.isHub ? 9 : m.isChild ? 4 : 5.5;
      const fill = m.isElder ? ELDER_FILL : m.isChild ? CHILD_FILL : STATUS_COLORS[m.status].fill;
      const str  = m.isElder && m.status !== STATUS.DONE
        ? ELDER_STR
        : m.isChild && m.status !== STATUS.DONE
          ? CHILD_STR
          : STATUS_COLORS[m.status].stroke;

      // Seeking ring (confirmation progress arc)
      if (m.status === STATUS.SEEKING) {
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(55,138,221,0.13)"; ctx.fill();
        const prog = clamp(m.confirmCount / Math.max(1, m.confirmNeeded), 0, 1);
        ctx.beginPath();
        ctx.arc(m.x, m.y, rad + 5, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
        ctx.strokeStyle = "#378ADD"; ctx.lineWidth = 2; ctx.stroke();
      }

      // Milling glow
      if (m.status === STATUS.MILLING) {
        ctx.beginPath(); ctx.arc(m.x, m.y, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(239,159,39,0.16)"; ctx.fill();
      }

      // Child: diamond; everyone else: circle
      if (m.isChild && m.status !== STATUS.DONE) {
        ctx.save();
        ctx.translate(m.x, m.y); ctx.rotate(Math.PI / 4);
        ctx.beginPath(); ctx.rect(-4, -4, 8, 8);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = str; ctx.lineWidth = 0.8; ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(m.x, m.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = fill; ctx.fill();
        ctx.strokeStyle = str; ctx.lineWidth = m.isHub ? 1.5 : 0.8; ctx.stroke();
      }

      // Evacuation direction arrow
      if (m.status === STATUS.EVAC && Math.hypot(m.tx - m.x, m.ty - m.y) > 8) {
        const ang = Math.atan2(m.ty - m.y, m.tx - m.x);
        const tip = rad + 8;
        const ax = m.x + Math.cos(ang) * tip;
        const ay = m.y + Math.sin(ang) * tip;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(ang - 0.5) * 6, ay - Math.sin(ang - 0.5) * 6);
        ctx.lineTo(ax - Math.cos(ang + 0.5) * 6, ay - Math.sin(ang + 0.5) * 6);
        ctx.closePath();
        ctx.fillStyle = STATUS_COLORS[STATUS.EVAC].stroke;
        ctx.fill();
      }

      // Labels — hub name always; detail labels only when this family is highlighted
      const showDetail = highlightFamilyIdx !== null && f.fi === highlightFamilyIdx;
      if (m.isHub) {
        ctx.font      = '500 10px system-ui, sans-serif';
        ctx.fillStyle = f.col;
        ctx.textAlign = "center";
        const tags = [];
        if (f.elderCount > 0) tags.push(`${f.elderCount}e`);
        if (f.childCount > 0) tags.push(`${f.childCount}c`);
        ctx.fillText(f.name + (tags.length ? ` (${tags.join(" ")})` : ""), m.x, m.y - (rad + 14));
      }
      if (showDetail && m.isElder && m.status !== STATUS.DONE) {
        ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = ELDER_STR; ctx.textAlign = "center";
        ctx.fillText("elder", m.x, m.y + (rad + 7));
      }
      if (showDetail && m.isChild && m.status !== STATUS.DONE) {
        ctx.font = "9px system-ui, sans-serif"; ctx.fillStyle = CHILD_STR; ctx.textAlign = "center";
        ctx.fillText("<5", m.x, m.y + (rad + 9));
      }
      if (showDetail && m.status === STATUS.SEEKING) {
        ctx.font      = "9px system-ui, sans-serif";
        ctx.fillStyle = darkMode ? "#B5D4F4" : "#185FA5";
        ctx.textAlign = "center";
        ctx.fillText(`${m.confirmCount}/${m.confirmNeeded}`, m.x, m.y - (rad + 8));
      }
    });

    // Per-family evacuation progress bar
    const hub  = f.members[0];
    const done = f.members.filter((m) => m.status === STATUS.DONE).length;
    const tot  = f.members.length;
    if (done > 0 && done < tot) {
      const bw = 34, bx = hub.x - 17, by = hub.y + 12;
      ctx.fillStyle = "rgba(150,148,142,0.25)"; ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = "#1D9E75";               ctx.fillRect(bx, by, bw * (done / tot), 4);
    }
  });
  ctx.globalAlpha = 1;
}

// ─── Stats helper ─────────────────────────────────────────────────────────────

/**
 * Count members by status and return summary stats.
 * @param {object} sim
 * @returns {{ counts: number[], elders: number, children: number, total: number, pctClear: number }}
 */
export function getStats(sim) {
  const counts = [0, 0, 0, 0, 0];
  let total = 0, elders = 0, children = 0;
  sim.families.forEach((f) =>
    f.members.forEach((m) => {
      counts[m.status]++;
      total++;
      if (m.isElder)  elders++;
      if (m.isChild) children++;
    })
  );
  return { counts, elders, children, total, pctClear: total > 0 ? Math.round((counts[4] / total) * 100) : 0 };
}

// ─── Run summary ──────────────────────────────────────────────────────────────

export function computeRunSummary(sim, params) {
  const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  const familyData = sim.families.map(f => {
    const ms    = f.members;
    const seek  = ms.filter(m => m.seekStart  !== null && m.millingStart !== null).map(m => m.millingStart - m.seekStart);
    const mill  = ms.filter(m => m.millingStart !== null && m.evacStart  !== null).map(m => m.evacStart   - m.millingStart);
    const evac  = ms.filter(m => m.evacStart   !== null && m.doneAt      !== null).map(m => m.doneAt      - m.evacStart);
    const avgSeek = avg(seek), avgMill = avg(mill), avgEvac = avg(evac);
    return {
      name: f.name, col: f.col,
      elderCount: f.elderCount, childCount: f.childCount,
      seek: avgSeek, mill: avgMill, evac: avgEvac,
      total: avgSeek + avgMill + avgEvac,
      lastDone: Math.max(...ms.map(m => m.doneAt ?? 0)),
    };
  });

  const allMs   = sim.families.flatMap(f => f.members);
  const allSeek = allMs.filter(m => m.seekStart !== null  && m.millingStart !== null).map(m => m.millingStart - m.seekStart);
  const allMill = allMs.filter(m => m.millingStart !== null && m.evacStart  !== null).map(m => m.evacStart   - m.millingStart);
  const allEvac = allMs.filter(m => m.evacStart   !== null && m.doneAt      !== null).map(m => m.doneAt      - m.evacStart);

  const slowest = familyData.reduce((a, b) => a.lastDone > b.lastDone ? a : b);
  let bottleneck = "";
  if (slowest.elderCount > 0) bottleneck = `${slowest.elderCount} elder${slowest.elderCount > 1 ? "s" : ""}`;
  if (slowest.childCount > 0) bottleneck += (bottleneck ? " + " : "") + `${slowest.childCount} child${slowest.childCount > 1 ? "ren" : ""}`;
  if (!bottleneck) bottleneck = "large household";

  return {
    id: Date.now(),
    totalTicks:  sim.tick,
    avgSeeking:  avg(allSeek),
    avgMilling:  avg(allMill),
    avgEvac:     avg(allEvac),
    slowestFamily: slowest.name,
    bottleneck,
    familyData,
    scenario: sim.scenario,
    params: { ...params },
  };
}

// ─── Canvas interaction helpers ───────────────────────────────────────────────

function getCanvasCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    cx: (e.clientX - rect.left) * scaleX,
    cy: (e.clientY - rect.top)  * scaleY,
    px: e.clientX - rect.left,
    py: e.clientY - rect.top,
    canvasWidth: rect.width,
  };
}

function hitTest(cx, cy, families) {
  for (const f of families) {
    for (const m of f.members) {
      const rad = (m.isHub ? 9 : m.isChild ? 4 : 5.5) + 5;
      if (Math.hypot(cx - m.x, cy - m.y) <= rad) return { member: m, family: f };
    }
  }
  return null;
}

// ─── React UI component ───────────────────────────────────────────────────────

export default function EvacuationSim() {
  const canvasRef            = useRef(null);
  const simRef               = useRef(null);
  const timerRef             = useRef(null);
  const hoveredFamilyIdxRef  = useRef(null);
  const paramsRef            = useRef(null);

  const [running,      setRunning]      = useState(false);
  const [tick,         setTick]         = useState(0);
  const [stats,        setStats]        = useState(null);
  const [logs,         setLogs]         = useState([]);
  const [finished,     setFinished]     = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showSliders,  setShowSliders]  = useState(true);
  const [runSummary,   setRunSummary]   = useState(null);
  const [runHistory,   setRunHistory]   = useState([]);
  const [pinnedRunId,  setPinnedRunId]  = useState(null);

  const [scenario, setScenario] = useState("pedestrian");

  const [params, setParams] = useState({
    threat:        6,
    elderPct:      20,  // stored as integer percent
    childPct:      20,
    infoClar:      5,
    nbrInfluence:  55,
    avgFamilySize: 3,
  });

  // ── Build / reset ──────────────────────────────────────────────────────────
  const reset = useCallback((overrideScenario) => {
    clearInterval(timerRef.current);
    setRunning(false);
    setFinished(false);
    setTick(0);
    setLogs(["Ready. Press Run to start the evacuation."]);
    setSelectedNode(null);
    setRunSummary(null);
    hoveredFamilyIdxRef.current = null;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.clientWidth;
    canvas.width  = W;
    canvas.height = CANVAS_HEIGHT;

    const sim = buildSimulation({
      threat:        params.threat,
      elderPct:      params.elderPct / 100,
      childPct:      params.childPct / 100,
      infoClar:      params.infoClar,
      nbrInfluence:  params.nbrInfluence / 100,
      avgFamilySize: params.avgFamilySize,
      scenario:      overrideScenario ?? scenario,
      canvasWidth:   W,
    });
    simRef.current = sim;

    const ctx = canvas.getContext("2d");
    drawSimulation(ctx, sim, W, CANVAS_HEIGHT, false, hoveredFamilyIdxRef.current);
    setStats(getStats(sim));
  }, [params, scenario]);

  useEffect(() => { reset(); }, [reset]);

  // ── Step ───────────────────────────────────────────────────────────────────
  const step = useCallback(() => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return false;

    if (!sim.started) {
      sim.started = true;
      setLogs((prev) => [
        ...prev,
        `⚠ Alert issued — threat ${sim.threat}/10, clarity ${sim.infoClar}/10.`,
      ]);
    }

    const W   = canvas.width;
    const H   = canvas.height;
    const { newLogs, finished } = stepSimulation(sim, W, H);

    const ctx = canvas.getContext("2d");
    drawSimulation(ctx, sim, W, H, false, hoveredFamilyIdxRef.current);
    setTick(sim.tick);
    setStats(getStats(sim));
    setLogs((prev) => [...prev, ...newLogs].slice(-80));

    if (finished) {
      setFinished(true);
      clearInterval(timerRef.current);
      setRunning(false);
      const summary = computeRunSummary(simRef.current, paramsRef.current);
      setRunSummary(summary);
      setRunHistory(prev => [summary, ...prev].slice(0, 5));
    }
    return !finished;
  }, []);

  // ── Run / pause ────────────────────────────────────────────────────────────
  const toggleRun = useCallback(() => {
    if (running) {
      clearInterval(timerRef.current);
      setRunning(false);
    } else {
      setRunning(true);
      timerRef.current = setInterval(() => {
        const cont = step();
        if (!cont) clearInterval(timerRef.current);
      }, SIM_INTERVAL_MS);
    }
  }, [running, step]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  useEffect(() => { if (running) setShowSliders(false); }, [running]);
  useEffect(() => { paramsRef.current = params; }, [params]);

  // ── Slider change ──────────────────────────────────────────────────────────
  const handleSlider = (key) => (e) => {
    setParams((prev) => ({ ...prev, [key]: +e.target.value }));
  };

  // ── Canvas interaction ─────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return;
    const { cx, cy } = getCanvasCoords(e, canvas);
    const hit    = hitTest(cx, cy, sim.families);
    const newIdx = hit ? hit.family.fi : null;
    if (newIdx !== hoveredFamilyIdxRef.current) {
      hoveredFamilyIdxRef.current = newIdx;
      const ctx = canvas.getContext("2d");
      drawSimulation(ctx, sim, canvas.width, canvas.height, false, newIdx);
    }
    canvas.style.cursor = hit ? "pointer" : "default";
  }, []);

  const handleMouseLeave = useCallback(() => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return;
    hoveredFamilyIdxRef.current = null;
    const ctx = canvas.getContext("2d");
    drawSimulation(ctx, sim, canvas.width, canvas.height, false, null);
    canvas.style.cursor = "default";
  }, []);

  const handleCanvasClick = useCallback((e) => {
    const canvas = canvasRef.current;
    const sim    = simRef.current;
    if (!canvas || !sim) return;
    const coords = getCanvasCoords(e, canvas);
    const hit    = hitTest(coords.cx, coords.cy, sim.families);
    if (hit) {
      hoveredFamilyIdxRef.current = hit.family.fi;
      const ctx = canvas.getContext("2d");
      drawSimulation(ctx, sim, canvas.width, canvas.height, false, hit.family.fi);
      setSelectedNode({ member: hit.member, family: hit.family, x: coords.px, y: coords.py, canvasWidth: coords.canvasWidth });
    } else {
      setSelectedNode(null);
    }
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────
  const s = stats || {};
  const counts = s.counts || [0, 0, 0, 0, 0];

  const sliderGroups = [
    {
      group: "Environment",
      items: [
        { key: "threat",    label: "Threat level",  min: 1,  max: 10,  suffix: "",
          hint: v => v <= 3 ? "Low urgency — alerts spread slowly"
                 : v <= 6  ? "Moderate threat — some urgency to act"
                            : "High threat — alerts spread rapidly" },
        { key: "infoClar",  label: "Info clarity",  min: 1,  max: 10,  suffix: "",
          hint: v => v <= 3 ? "Poor clarity — many confirmations needed before families act"
                 : v <= 6  ? "Moderate clarity — standard confirmation requirements"
                            : "High clarity — families act quickly on first alert" },
      ],
    },
    {
      group: "Population",
      items: [
        { key: "avgFamilySize", label: "Avg. family size",   min: 1, max: 7,   suffix: "",
          hint: v => v <= 2 ? "Small households — faster to coordinate"
                 : v <= 4  ? "Typical household size"
                            : "Large households — longer to coordinate and depart" },
        { key: "elderPct",      label: "Elder ratio",         min: 0, max: 60,  suffix: "%",
          hint: v => v === 0 ? "No elders in population"
                 : v <= 20  ? "Small elder population — minor delays"
                 : v <= 40  ? "Moderate elders — noticeable prep and mobility impact"
                            : "High elder population — significant delays" },
        { key: "childPct",      label: "Children <5 ratio",   min: 0, max: 50,  suffix: "%",
          hint: v => v === 0 ? "No young children in population"
                 : v <= 20  ? "Small child population — some gathering delays"
                            : "High child population — significant preparation delays" },
        { key: "nbrInfluence",  label: "Neighbor influence",  min: 0, max: 100, suffix: "%",
          hint: (v, sc) => {
            if (sc === "train") return "Lower relevance in train scenario — passengers are often strangers";
            return v === 0  ? "No social contagion — only official alerts matter"
                 : v <= 40  ? "Low social influence — neighbors rarely trigger others"
                 : v <= 70  ? "Moderate contagion — neighbors noticeably accelerate confirmations"
                            : "High contagion — one family evacuating can cascade through the network";
          }},
      ],
    },
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", color: "#3d3d3a", maxWidth: 720, margin: "0 auto", padding: "12px 16px" }}>

      {/* Scenario selector */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {Object.entries(SCENARIOS).map(([key, sc]) => {
          const active = scenario === key;
          return (
            <button
              key={key}
              onClick={() => { setScenario(key); reset(key); }}
              style={{
                flex: 1, padding: "7px 0", fontSize: 12, cursor: "pointer",
                borderRadius: 8, fontWeight: active ? 600 : 400,
                background: active ? "#185FA5" : "#f1efe8",
                color: active ? "#fff" : "#3d3d3a",
                border: active ? "none" : "0.5px solid rgba(0,0,0,0.12)",
              }}
            >
              {sc.icon} {sc.label}
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <button onClick={toggleRun} disabled={finished} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", borderRadius: 6, background: "#E6F1FB", color: "#0C447C", border: "0.5px solid #185FA5" }}>
          {running ? "⏸ Pause" : "▶ Run"}
        </button>
        <button onClick={step} disabled={running || finished} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", borderRadius: 6 }}>
          Step
        </button>
        <button onClick={reset} style={{ fontSize: 12, padding: "5px 12px", cursor: "pointer", borderRadius: 6 }}>
          Reset
        </button>
        <span style={{ fontSize: 11, color: "#737069" }}>
          Tick <strong style={{ fontWeight: 500 }}>{tick}</strong>
          {finished && <span style={{ marginLeft: 8, color: "#0F6E56" }}>— complete</span>}
        </span>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8, fontSize: 10, color: "#737069" }}>
        {[
          { col: "#888780", label: "Unaware",     shape: "circle"  },
          { col: "#378ADD", label: "Seeking info", shape: "circle"  },
          { col: "#EF9F27", label: "Milling",      shape: "circle"  },
          { col: "#E24B4A", label: "Evacuating",   shape: "circle"  },
          { col: "#1D9E75", label: "Evacuated",    shape: "circle"  },
          { col: "#7F77DD", label: "Elder",        shape: "circle"  },
          { col: "#D4537E", label: "Child <5",     shape: "diamond" },
        ].map(({ col, label, shape }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <span style={{
              width: 9, height: 9, flexShrink: 0,
              borderRadius: shape === "circle" ? "50%" : 0,
              transform: shape === "diamond" ? "rotate(45deg)" : "none",
              background: col, display: "inline-block",
            }} />
            {label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleCanvasClick}
          style={{ width: "100%", borderRadius: 10, border: "0.5px solid rgba(0,0,0,0.1)", display: "block" }}
        />
        {selectedNode && (() => {
          const { member: m, family: f, x, y, canvasWidth } = selectedNode;
          const t          = simRef.current?.tick ?? 0;
          const ageGroup   = m.isElder ? "Elder" : m.isChild ? "Child <5" : "Adult";
          const phaseStart = m.status === STATUS.SEEKING ? m.seekStart
                           : m.status === STATUS.MILLING  ? m.millingStart
                           : m.status === STATUS.EVAC     ? m.evacStart : null;
          const phaseTicks = phaseStart !== null ? t - phaseStart : null;
          const flipLeft   = x + 14 + 160 > canvasWidth;
          return (
            <div style={{
              position: "absolute",
              left:  flipLeft ? Math.max(4, x - 164) : x + 14,
              top:   Math.max(4, y - 56),
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.14)",
              borderRadius: 8,
              padding: "8px 12px",
              fontSize: 11,
              lineHeight: 1.75,
              pointerEvents: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
              minWidth: 152,
              zIndex: 10,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 1 }}>
                {m.name} <span style={{ color: f.col, fontWeight: 400 }}>· {f.name}</span>
              </div>
              <div style={{ color: "#737069" }}>{ageGroup}</div>
              <div>
                Status: <span style={{ color: STATUS_TEXT_COLOR[m.status], fontWeight: 500 }}>
                  {STATUS_LABEL[m.status]}
                </span>
              </div>
              {m.status === STATUS.SEEKING && (
                <div>Confirmations: {m.confirmCount}/{m.confirmNeeded}</div>
              )}
              {phaseTicks !== null && (
                <div style={{ color: "#737069" }}>
                  In phase: {phaseTicks} tick{phaseTicks !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {[
          { label: "Unaware",   val: counts[0], col: "#737069" },
          { label: "Seeking",   val: counts[1], col: "#185FA5" },
          { label: "Milling",   val: counts[2], col: "#BA7517" },
          { label: "Evacuating",val: counts[3], col: "#A32D2D" },
          { label: "Evacuated", val: counts[4], col: "#0F6E56" },
          { label: "Elders",    val: s.elders,  col: "#534AB7" },
          { label: "Children",  val: s.children,col: "#993556" },
          { label: "% Clear",   val: (s.pctClear ?? "—") + (stats ? "%" : ""), col: "#737069" },
        ].map(({ label, val, col }) => (
          <div key={label} style={{ background: "#f1efe8", borderRadius: 6, padding: "5px 10px", fontSize: 11, flex: 1, minWidth: 60, textAlign: "center" }}>
            <span style={{ fontSize: 9, color: "#737069", display: "block" }}>{label}</span>
            <strong style={{ fontSize: 16, fontWeight: 500, color: col }}>{val ?? "—"}</strong>
          </div>
        ))}
      </div>

      {/* Event log */}
      <div style={{ maxHeight: 120, overflowY: "auto", fontSize: 11, lineHeight: 1.75, color: "#737069", background: "#f1efe8", borderRadius: 6, padding: "7px 10px", marginTop: 8 }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>

      {/* End-of-run summary */}
      {finished && runSummary && (() => {
        const prev       = runHistory[1] ?? null;
        const pinnedRun  = pinnedRunId ? runHistory.find(r => r.id === pinnedRunId) : null;
        const maxTotal   = Math.max(...runSummary.familyData.map(f => f.total), 1);
        const diffVsPrev = prev ? runSummary.totalTicks - prev.totalTicks : null;
        const diffVsPin  = pinnedRun && pinnedRun.id !== runSummary.id
          ? runSummary.totalTicks - pinnedRun.totalTicks : null;
        const diffColor  = d => d < 0 ? "#0F6E56" : d > 0 ? "#A32D2D" : "#737069";
        const diffText   = (d, label) =>
          `${Math.abs(d)} tick${Math.abs(d) !== 1 ? "s" : ""} ${d < 0 ? "faster" : d > 0 ? "slower" : "same"} than ${label}`;

        return (
          <div style={{ marginTop: 10, background: "#f1efe8", borderRadius: 10, padding: "12px 14px" }}>
            {/* Header */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                Complete — {runSummary.totalTicks} ticks
              </span>
              {diffVsPrev !== null && (
                <span style={{ fontSize: 11, color: diffColor(diffVsPrev) }}>
                  {diffText(diffVsPrev, "previous")}
                </span>
              )}
              {diffVsPin !== null && (
                <span style={{ fontSize: 11, color: diffColor(diffVsPin) }}>
                  📌 {diffText(diffVsPin, "pinned")}
                </span>
              )}
            </div>

            {/* Phase averages + slowest family */}
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[
                { label: "Avg. seeking", val: runSummary.avgSeeking, col: "#185FA5" },
                { label: "Avg. milling", val: runSummary.avgMilling, col: "#BA7517" },
                { label: "Avg. evac",    val: runSummary.avgEvac,    col: "#A32D2D" },
              ].map(({ label, val, col }) => (
                <div key={label} style={{ flex: 1, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: "#737069" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: col }}>{val}t</div>
                </div>
              ))}
              <div style={{ flex: 1.6, background: "#fff", borderRadius: 6, padding: "5px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#737069" }}>Slowest family</div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{runSummary.slowestFamily}</div>
                <div style={{ fontSize: 9, color: "#737069" }}>{runSummary.bottleneck}</div>
              </div>
            </div>

            {/* Family timeline bar chart */}
            <div style={{ fontSize: 9, color: "#737069", marginBottom: 5 }}>
              Family timelines — avg. ticks per phase
            </div>
            {runSummary.familyData.map(fd => (
              <div key={fd.name} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 500, color: fd.col, minWidth: 52 }}>{fd.name}</div>
                <div style={{ flex: 1, display: "flex", height: 14, borderRadius: 3, overflow: "hidden", background: "rgba(0,0,0,0.06)" }}>
                  <div style={{ width: `${(fd.seek / maxTotal) * 100}%`, background: "#378ADD" }} title={`Seeking: ${fd.seek}t`} />
                  <div style={{ width: `${(fd.mill / maxTotal) * 100}%`, background: "#EF9F27" }} title={`Milling: ${fd.mill}t`} />
                  <div style={{ width: `${(fd.evac / maxTotal) * 100}%`, background: "#E24B4A" }} title={`Evac: ${fd.evac}t`} />
                </div>
                <div style={{ fontSize: 9, color: "#737069", minWidth: 28, textAlign: "right" }}>
                  {fd.total}t
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 5, fontSize: 9, color: "#737069" }}>
              {[["#378ADD","Seeking"],["#EF9F27","Milling"],["#E24B4A","Evac"]].map(([col, label]) => (
                <span key={label} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ width: 8, height: 8, background: col, display: "inline-block", borderRadius: 1 }} />
                  {label}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Run history */}
      {runHistory.length > 0 && (
        <div style={{ marginTop: 10, background: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 8 }}>Run history</div>
          {runHistory.map((run, i) => {
            const sc       = SCENARIOS[run.scenario];
            const isPinned = pinnedRunId === run.id;
            const isLatest = i === 0;
            return (
              <div key={run.id} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "5px 8px",
                borderRadius: 6, marginBottom: 4,
                background: isPinned ? "rgba(24,95,165,0.06)" : "transparent",
                border: isPinned ? "0.5px solid rgba(24,95,165,0.2)" : "0.5px solid transparent",
              }}>
                <span style={{ fontSize: 13 }}>{sc?.icon}</span>
                <span style={{ fontSize: 10, color: "#737069", flex: 1 }}>
                  T:{run.params.threat} C:{run.params.infoClar} E:{run.params.elderPct}% N:{run.params.nbrInfluence}%
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, minWidth: 52, textAlign: "right" }}>
                  {run.totalTicks} ticks
                </span>
                {isLatest && (
                  <span style={{ fontSize: 9, color: "#0F6E56", minWidth: 30 }}>latest</span>
                )}
                <button
                  onClick={() => setPinnedRunId(isPinned ? null : run.id)}
                  style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 4, cursor: "pointer",
                    background: isPinned ? "#185FA5" : "#f1efe8",
                    color: isPinned ? "#fff" : "#737069",
                    border: "0.5px solid rgba(0,0,0,0.12)",
                  }}
                >
                  {isPinned ? "📌 Pinned" : "Pin"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Sliders — collapsible panel at bottom */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setShowSliders(v => !v)}
          style={{
            width: "100%", padding: "6px 12px", fontSize: 11, cursor: "pointer",
            borderRadius: showSliders ? "8px 8px 0 0" : 8,
            background: "#f1efe8", color: "#737069",
            border: "0.5px solid rgba(0,0,0,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
            userSelect: "none",
          }}
        >
          <span>⚙ Parameters</span>
          <span>{showSliders ? "▴" : "▾"}</span>
          {running && !showSliders && (
            <span style={{ marginLeft: 6, color: "#BA7517" }}>· hidden while running</span>
          )}
        </button>
        {showSliders && (
          <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.12)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 14px" }}>
            {running && (
              <div style={{ fontSize: 11, color: "#BA7517", background: "#FEF3E2", borderRadius: 6, padding: "6px 10px", marginBottom: 10 }}>
                ⚠ Simulation is running — changing a parameter will reset it.
              </div>
            )}
            {sliderGroups.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {group}
                </div>
                {items.map(({ key, label, min, max, suffix, hint }) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label style={{ fontSize: 11, color: "#737069", minWidth: 130 }}>{label}</label>
                      <input
                        type="range" min={min} max={max} step={1}
                        value={params[key]}
                        onChange={handleSlider(key)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, minWidth: 32, textAlign: "right" }}>
                        {params[key]}{suffix}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "#999895", marginTop: 2, paddingLeft: 138 }}>
                      {hint(params[key], scenario)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
