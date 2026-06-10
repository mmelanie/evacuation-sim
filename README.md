# Evacuation Simulation

An interactive agent-based model of community evacuation behavior, built in React.

## What it models

- **Family clusters** — households with a hub node that waits for all members before departing
- **Information-seeking loops** — members hear an alert but must confirm it before milling begins; the single "Info" node's clarity and reliability control how quickly confirmations arrive
- **Neighbor social influence** — seeing adjacent families mill or evacuate counts as a confirmation signal
- **Elder delays** — elders need more confirmations, longer milling time, and slower travel speed
- **Child (<5) delays** — young children require longer milling (gathering, packing) and move slowest during evacuation

## Status lifecycle

```
UNAWARE → SEEKING → MILLING → EVACUATING → DONE
```

Each transition is probabilistic and depends on threat level, info clarity, and household composition.

## Setup

```bash
npm install
npm run dev        # development server at http://localhost:5173
npm run build      # production bundle → dist/
npm run preview    # preview the production build
```

## Project structure

```
evacuation-sim/
├── src/
│   ├── EvacuationSim.jsx   # Main component + all simulation logic
│   ├── main.jsx            # React entry point
│   └── index.css           # Minimal reset
├── index.html
├── package.json
└── vite.config.js
```

## Extending with Claude Code

The simulation logic is fully separated from the React UI into named exports:

| Export              | Description |
|---------------------|-------------|
| `buildSimulation()` | Creates a fresh sim from params |
| `stepSimulation()`  | Advances by one tick; returns new logs and finished flag |
| `drawSimulation()`  | Renders current state to a canvas context |
| `getStats()`        | Returns status counts and demographic tallies |

### Ideas for extension

**Road network & congestion**
Add a graph of road nodes. During `EVAC` status, route members along shortest path. Decrement road capacity as members use it; slow speed when capacity is exceeded.

```js
// in stepSimulation, replace straight-line movement:
const nextNode = getNextRoadNode(mem, sim.roadGraph);
const congestion = sim.roadGraph[nextNode].load / sim.roadGraph[nextNode].capacity;
const spd = baseSpeeds[mem.type] * (1 - congestion * 0.6);
```

**Side-by-side scenario comparison**
Render two canvases with independent `simRef` objects. Run `stepSimulation` on both each tick. Diff the `getStats()` outputs to highlight which scenario clears faster.

**CSV data export**
After each tick, push a row to an array: `{ tick, unaware, seeking, milling, evacuating, done, elders, children }`. On finish, serialize with:

```js
const csv = [Object.keys(rows[0]).join(","), ...rows.map(r => Object.values(r).join(","))].join("\n");
const blob = new Blob([csv], { type: "text/csv" });
const url = URL.createObjectURL(blob);
```

**Shelter-in-place branching**
Add a `SHELTER` status. During `SEEKING`, give households with elders or children a probability of choosing shelter-in-place instead of evacuation, based on threat level.

**Multiple information sources**
Replace the single `infoNode` with an array. Each member is assigned a primary source (official alert, social media, TV, word of mouth) with different reliability scores. Confirmations from multiple *different* sources count more than repeated checks of the same one.
