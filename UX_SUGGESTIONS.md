# UX Design Suggestions — Evacuation Simulation

Reviewed against the current EvacuationSim.jsx implementation. Recommendations are grouped by impact area and ordered roughly by priority.

---

## 1. Onboarding & Orientation

**Problem:** A first-time user sees a canvas full of colored dots with no explanation of what they are looking at.

- Add a one-paragraph "about" section above the scenario tabs explaining the model: families receive alerts, seek confirmation, mill (prepare), then evacuate.
- Define "milling" somewhere visible — it is a sociology term unfamiliar to most users.
- Add a "How to use" collapsed section or tooltip-triggered help button covering: what the sliders do, how to read the canvas, and what the event log means.
- Consider a short animated walkthrough that runs automatically on first load, highlighting each UI zone in sequence.

---

## 2. Slider Design & Feedback

**Problem:** Sliders are functional but give no intuitive sense of what changing them will produce.

- Add a short consequence hint below each slider that updates as the value changes. Examples:
  - Threat level 9: "Alerts spread very fast"
  - Info clarity 2: "Households need many confirmations before acting"
  - Neighbor influence 80%: "Social contagion will dominate alert spread"
- Disable (grey out) or hide sliders that don't meaningfully apply to the active scenario (e.g., neighbor influence is less relevant in a train scenario where passengers are strangers).
- Warn users when they change sliders while the simulation is running, since it silently resets mid-run. Either block changes during run, or show "Simulation reset" feedback.
- Consider grouping sliders into two sections: **Environment** (threat, info clarity) and **Population** (avg. family size, elder ratio, child ratio, neighbor influence).

---

## 3. Simulation Speed Control

**Problem:** The only options are 200 ms/tick or single-step. Researchers who want to explore parameters need to iterate quickly.

- Add a speed slider or preset buttons: 0.5×, 1× (default), 2×, 5×, Max (run as fast as the browser allows).
- "Max speed" mode would run ticks synchronously until done, then render the final state — useful for batch comparison.

---

## 4. Visual Clarity on the Canvas

**Problem:** Several visual elements are ambiguous or inconsistent.

- **Legend inconsistency:** The legend shows all status indicators as circles, but child nodes render as diamonds on the canvas. The legend should match the actual shapes.
- **Label overlap:** With random scatter layout, family name labels and status labels frequently overlap when nodes are close. Implement a label-offset algorithm that pushes text away from nearby text, or only show labels on hover/click.
- **Info node size:** The central info node is the same visual weight as family hubs. Give it a distinct shape (e.g., hexagon or larger ring) to communicate that it plays a different structural role.
- **Scenario-specific visual context:** The canvas looks identical across scenarios. For Car, lightly sketch road lines; for Train, sketch a rail line and a station marker. This helps users immediately orient to the scenario without reading the button label.
- **Evacuation direction arrows:** When a member enters EVAC status, a small directional arrow on their node would make movement intent clearer before they start visibly moving.

---

## 5. Event Log Quality

**Problem:** The log fills rapidly with low-signal messages ("t5 Alex: 1/2 confirmations") making it hard to spot meaningful events.

- Filter log messages by severity. Default view shows only phase transitions (Unaware→Seeking, Milling→Evac, Evacuated). A "Verbose" toggle shows confirmation increments.
- Color-code log lines to match the status color palette.
- Auto-scroll to bottom, but pause auto-scroll if the user manually scrolls up.
- At simulation end, append a structured summary block with key outcome metrics (see section 7).

---

## 6. Node Interactivity

**Problem:** The canvas is read-only. Users cannot inspect individual nodes.

- Make nodes clickable. On click, show a small tooltip or sidebar panel with that member's current state: name, family, status, confirmations received, ticks spent milling, age group.
- On hover, highlight that node's family group (dim all other families slightly).
- This would dramatically improve comprehension for new users trying to understand what each phase looks like.

---

## 7. End-of-Run Summary

**Problem:** When the simulation completes, the only feedback is a small "— complete" inline text. Users get no synthesis.

- Show a summary panel below the canvas (or as an overlay) when the simulation finishes:
  - Total ticks to full evacuation
  - Breakdown of average ticks per phase (seeking, milling, evac) across all members
  - Slowest family and why (e.g., "Hassan: 2 elders caused bottleneck")
  - Comparison to previous run if one exists: "4 ticks faster than last run"
- A simple horizontal bar chart showing how long each family spent in each phase would make bottlenecks immediately visible.

---

## 8. Run Comparison / History

**Problem:** There is no memory between runs. Users who change a parameter and run again have no way to compare outcomes.

- Maintain a small run history panel (last 3–5 runs) showing: scenario, key parameter values, and ticks to completion.
- Allow users to "pin" a run to compare against future runs.
- This is the primary value for a research tool — parameter → outcome traceability.

---

## 9. Accessibility

**Problem:** The simulation relies entirely on color to communicate state, and font sizes are very small.

- Add a colorblind-friendly mode that replaces status colors with high-contrast patterns or increases shape differentiation (e.g., elders as squares, adults as circles, children as diamonds — currently only children use a distinct shape).
- Minimum readable font size is 12px; most canvas labels are 9–10px. Increase to at least 11–12px.
- Add `aria-label` attributes to all buttons.
- The canvas is not accessible to screen readers. At minimum, add a live-region text summary below the canvas that updates each tick ("Tick 12: 3 evacuated, 4 evacuating, 5 milling, 6 seeking").

---

## 10. Scenario Descriptions

**Problem:** Switching between Pedestrian, Car, and Train scenarios gives no context for what mechanically changes.

- Add a one-line description below the scenario tabs explaining the key behavioral difference. Examples:
  - Pedestrian: "Age strongly affects prep time and movement speed."
  - Car: "Vehicle access equalizes mobility; departure prep is fast."
  - Train: "Long wait for scheduled departure; all passengers travel at the same speed once aboard."
- Consider adding a fourth scenario: **Shelter-in-place** (no evacuation, just information spread) as a baseline contrast.

---

## 11. Mobile & Responsive Layout

**Problem:** The layout is designed for ~720px desktop width. On smaller screens the slider panel becomes cramped and the canvas overflows.

- Stack the slider panel into two columns on screens narrower than 480px.
- Make the canvas height proportional to viewport height on mobile (e.g., `min(440px, 55vw)`).
- The scenario tabs wrap poorly at narrow widths — consider an icon-only display on mobile with the label as a tooltip.

---

## 12. Simulation Reset UX

**Problem:** The Reset button is the same visual style as Step, making it easy to accidentally trigger. It also uses the label "Reset" when "New simulation" better communicates what it does (generates a new random layout, not just rewinds).

- Rename "Reset" to "New simulation" or "Randomize".
- Visually distinguish it from Run/Step (e.g., ghost/outline style, placed on the right side of the control row).
- Add a "Rerun same layout" option that replays the same hub positions with fresh status — useful for isolating parameter effects from random scatter variation.

---

## 13. Information Flow Visualization

**Problem:** Information flow is the central mechanism of the simulation — the two channels (official broadcast from the info node and social influence from neighbors) directly drive when and how quickly families evacuate. Currently both channels are underrepresented visually: the official channel shows brief 1px fading lines that last only 4 ticks, and the neighbor social influence channel has **no visual representation at all** on the canvas despite being one of the key experimental parameters.

---

### 13a. Distinguish the Two Information Channels

The most critical gap: when a neighbor's milling or evacuating status boosts a member's confirmation count, nothing is drawn on the canvas. This is a significant lost opportunity since "neighbor influence" is a primary slider and represents a fundamentally different pathway than the official broadcast.

- Draw a distinct visual pulse **along the neighbor edge** (the dashed line between family hubs) when influence fires — a different color from the official channel. Suggested: warm green or amber for social influence vs. the existing blue for official broadcasts.
- Use a different line style to reinforce the distinction: official channel as straight lines radiating from the info node; neighbor influence as a curved arc that bows along the existing neighbor edge, making both pathways spatially legible simultaneously.
- The current code logs neighbor influence events (`t${t} ${mem.name} sees neighbor active — +1 confirmation`) but never draws them. Adding the visual here would make the log redundant for power users and comprehensible for new ones.

---

### 13b. Add Arrowheads to Information Arcs

Current arcs are plain lines with no directional indicator. A reader cannot tell which end is the source and which is the receiver without prior knowledge of the model. Add a small filled arrowhead at the **receiving member's end** of each arc — this one change makes the flow direction self-evident.

---

### 13c. Increase Arc Visibility and Duration

At default speed, arcs last 4 ticks (800 ms real time) and are drawn at 1px. They are nearly invisible when the simulation runs continuously. Recommended:

- Increase arc thickness to 1.5–2px.
- Extend display duration from 4 to 7–8 ticks.
- For the first 1–2 ticks of an arc's life, add a soft glow via `ctx.shadowBlur` and `ctx.shadowColor` to give the arc a "fired" feeling before it fades.

---

### 13d. Persistent "Reached" Halo

Once a member transitions UNAWARE → SEEKING, there is no persistent visual record that information has arrived. If the family is dimmed by hover, even the blue seeking color fades. Add a thin permanent ring around any member who has received at least one alert — a subtle, always-visible marker that survives all subsequent status changes. This creates a spatial map of information penetration that accumulates over time and is independent of the evacuation status.

---

### 13e. Animate Neighbor Edges When Active

The dashed lines between family hubs look identical whether neighbor influence is 0% or 100%. When a hub is in MILLING or EVAC status — meaning it is actively radiating social influence to adjacent families — animate the dash offset on its outgoing neighbor edges to suggest information flowing outward. A simple `lineDashOffset` increment each tick achieves this with minimal code. Edges connected to UNAWARE hubs stay static.

---

### 13f. Information Saturation Gauge on Canvas

Add a thin bar across the top of the canvas showing in real time what fraction of the population has left the UNAWARE state (i.e., reached + evacuated / total). This is distinct from the "% Clear" stat in the stats row, which tracks completed evacuations. The **gap between "reached" and "evacuated"** is one of the most important things this simulation can reveal — a large gap means milling and confirmation delays are the bottleneck; a small gap means information spread itself is the constraint. Currently there is no easy way to see this gap visually.

---

### 13g. Always-Visible Confirmation Progress

The confirmation progress arc (the ring around SEEKING nodes) only appears when that family is hovered. At default view with no hover, a user cannot tell whether a seeking member has 0 of 3 confirmations or 2 of 3. Consider rendering the confirmation arc at all times — perhaps at 40% opacity when not highlighted, full opacity when highlighted. Seeing which households are "almost confirmed" vs. "just started" at a glance would make the info clarity slider's effect immediately legible without needing to hover over each node.

---

### 13h. Broadcast Ripple from Info Node

When the info node sends an alert to a new member, emit a brief circular ripple (an expanding thin ring) outward from the hexagon. This is a widely understood visual idiom for broadcasts. The ripple's behavior could reflect the clarity setting: high clarity produces a fast, clean ring that reaches nodes quickly; low clarity produces a slower or irregular ring. This gives the info node visible agency and helps users understand why some members get alerted before others.

---

### 13i. Cascade Highlight at Moment of Confirmation

When neighbor influence fires and causes a member to confirm and begin milling, briefly highlight the full chain: source family hub → neighbor edge → receiving member. This "cascade" is the most interesting dynamic in the model — social contagion causing a wave of evacuations — and it is currently completely invisible. A 2–3 tick highlight of the chain in a distinct color (e.g., a warm pulse along the path) would make this moment legible and rewarding to observe.

---

### 13j. Confirmation Source Indicator

When a member transitions SEEKING → MILLING, it is valuable to know whether that final confirmation came primarily from the official channel or the neighbor channel. Consider a brief directional flash on the member node at the moment of confirmation — blue flash if the last confirmation came from the info node, amber/green flash if it came from a neighbor. Over multiple runs this would help users understand which channel is actually driving evacuations under different parameter combinations, which is the core research question the simulation is designed to explore.
