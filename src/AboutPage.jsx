import { useState, useEffect, useRef } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useFadeIn(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function FadeIn({ children, delay = 0, style = {} }) {
  const [ref, visible] = useFadeIn();
  return (
    <div ref={ref} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(22px)",
      transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`,
      ...style,
    }}>
      {children}
    </div>
  );
}

function hexPts(cx, cy, r) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

// ─── Phase illustration (sticky SVG) ─────────────────────────────────────────

const NODES = [
  { id: 0, x: 62,  y: 62,  label: "Rivera", members: [{ dx: -14, dy: 12 }, { dx: 14, dy: 12 }] },
  { id: 1, x: 210, y: 55,  label: "Kim",    members: [{ dx: -12, dy: 14 }, { dx: 10, dy: 16, isElder: true }] },
  { id: 2, x: 258, y: 155, label: "Okafor", members: [{ dx: -16, dy: -4 }, { dx: -8, dy: 16, isChild: true }] },
  { id: 3, x: 205, y: 240, label: "Hassan", members: [{ dx: -14, dy: -10 }, { dx: 10, dy: -14, isElder: true }] },
  { id: 4, x: 68,  y: 240, label: "Novak",  members: [{ dx: 14, dy: -12 }] },
  { id: 5, x: 24,  y: 150, label: "Tanaka", members: [{ dx: 14, dy: -10 }, { dx: 16, dy: 10 }] },
];

const EDGES = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,2],[1,3]];

const PHASE_STATUS = ["unaware","seeking","milling","evac","done","social"];
const STATUS_FILL  = { unaware:"#888780", seeking:"#378ADD", milling:"#EF9F27", evac:"#E24B4A", done:"#1D9E75" };
const STATUS_STR   = { unaware:"#5F5E5A", seeking:"#185FA5", milling:"#BA7517", evac:"#A32D2D", done:"#0F6E56" };
const ELDER_FILL = "#7F77DD", ELDER_STR = "#534AB7";
const CHILD_FILL = "#D4537E", CHILD_STR = "#993556";

function PhaseIllustration({ step }) {
  const CX = 140, CY = 152;
  // step 0–5 maps to phases; "featured" family is Kim (id=1) and Hassan (id=3)
  const featuredId  = step <= 2 ? 1 : 3;
  const featured    = NODES.find(n => n.id === featuredId);
  const socialStep  = step === 5;

  function nodeStatus(id) {
    if (step === 0) return "unaware";
    if (id === featuredId) return PHASE_STATUS[Math.min(step, 4)];
    if (step >= 4 && id === 0) return "done";  // Rivera also done by step 4
    if (step >= 3 && id === 2) return "milling"; // Okafor milling
    return "unaware";
  }

  // Evac offset for featured node at step 3+
  function nodeOffset(id) {
    if (id === featuredId && step === 3) return { dx: 22, dy: -18 };
    if (id === featuredId && step >= 4)  return { dx: 38, dy: -30 };
    return { dx: 0, dy: 0 };
  }

  return (
    <svg viewBox="0 0 280 280" style={{ width: "100%", borderRadius: 12, background: "#f8f7f4", border: "0.5px solid rgba(0,0,0,0.08)" }}>
      {/* Edges */}
      {EDGES.map(([a, b]) => {
        const na = NODES[a], nb = NODES[b];
        const oa = nodeOffset(a), ob = nodeOffset(b);
        const active = socialStep && (a === 0 || b === 0 || a === featuredId || b === featuredId);
        return (
          <line key={`${a}-${b}`}
            x1={na.x + oa.dx} y1={na.y + oa.dy}
            x2={nb.x + ob.dx} y2={nb.y + ob.dy}
            stroke={active ? "#EF9F27" : "rgba(150,148,142,0.3)"}
            strokeWidth={active ? 1.5 : 1}
            strokeDasharray="3 3"
            style={{ transition: "stroke 0.5s, stroke-width 0.5s" }}
          />
        );
      })}

      {/* Info arc (seeking step) */}
      {step === 1 && (
        <line x1={CX} y1={CY} x2={featured.x} y2={featured.y}
          stroke="#378ADD" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
      )}
      {/* Social arc (social step) */}
      {socialStep && (
        <line x1={NODES[0].x} y1={NODES[0].y} x2={NODES[5].x} y2={NODES[5].y}
          stroke="#EF9F27" strokeWidth={2} opacity={0.7} />
      )}

      {/* Info node hexagon */}
      <polygon points={hexPts(CX, CY, step === 1 ? 18 : 14)}
        fill={step === 1 ? "#185FA5" : "rgba(55,138,221,0.15)"}
        stroke="#185FA5" strokeWidth={step === 1 ? 1.8 : 0.8}
        style={{ transition: "all 0.5s" }}
      />
      <text x={CX} y={CY + 4} textAnchor="middle" fontSize="9" fontWeight="500"
        fill={step === 1 ? "#fff" : "#0C447C"}>Info</text>

      {/* Family nodes */}
      {NODES.map(n => {
        const st    = nodeStatus(n.id);
        const off   = nodeOffset(n.id);
        const nx    = n.x + off.dx, ny = n.y + off.dy;
        const fill  = STATUS_FILL[st], str = STATUS_STR[st];

        return (
          <g key={n.id} style={{ transition: "transform 0.6s ease" }}>
            {/* Seeking progress ring */}
            {st === "seeking" && (
              <circle cx={nx} cy={ny} r={14} fill="rgba(55,138,221,0.1)"
                stroke="#378ADD" strokeWidth={2} strokeDasharray="22 66" strokeLinecap="round"
                transform={`rotate(-90 ${nx} ${ny})`} />
            )}
            {/* Milling glow */}
            {st === "milling" && (
              <circle cx={nx} cy={ny} r={14} fill="rgba(239,159,39,0.15)" />
            )}
            {/* Evac arrow */}
            {st === "evac" && (() => {
              const ang = Math.atan2(ny - CY, nx - CX);
              const tx = nx + Math.cos(ang) * 17, ty = ny + Math.sin(ang) * 17;
              return (
                <polygon
                  points={`${tx},${ty} ${tx - Math.cos(ang-0.5)*6},${ty - Math.sin(ang-0.5)*6} ${tx - Math.cos(ang+0.5)*6},${ty - Math.sin(ang+0.5)*6}`}
                  fill={STATUS_STR.evac}
                />
              );
            })()}
            {/* Hub circle */}
            <circle cx={nx} cy={ny} r={9} fill={fill} stroke={str} strokeWidth={1.5}
              style={{ transition: "fill 0.5s, stroke 0.5s" }} />
            {/* Hub label — positioned above */}
            <text x={nx} y={ny - 13} textAnchor="middle" fontSize="8" fontWeight="500"
              fill={str} style={{ transition: "fill 0.5s" }}>{n.label}</text>
            {/* Members */}
            {n.members.map((mem, mi) => {
              const mx = nx + mem.dx, my = ny + mem.dy;
              const mfill = mem.isElder ? ELDER_FILL : mem.isChild ? CHILD_FILL : fill;
              const mstr  = mem.isElder ? ELDER_STR  : mem.isChild ? CHILD_STR  : str;
              if (mem.isChild) {
                return (
                  <rect key={mi} x={mx - 4} y={my - 4} width={8} height={8}
                    fill={mfill} stroke={mstr} strokeWidth={0.8}
                    transform={`rotate(45 ${mx} ${my})`}
                    style={{ transition: "fill 0.5s" }} />
                );
              }
              return (
                <circle key={mi} cx={mx} cy={my} r={5} fill={mfill} stroke={mstr} strokeWidth={0.8}
                  style={{ transition: "fill 0.5s" }} />
              );
            })}
          </g>
        );
      })}

      {/* Phase label */}
      <text x={140} y={272} textAnchor="middle" fontSize="9" fill="#737069">
        {["All unaware","Alert received","Seeking confirmation","Milling — preparing","Evacuating","Social influence"][step] ?? ""}
      </text>
    </svg>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const PHASE_STEPS = [
  {
    tag: "Phase 0",
    title: "A community before the emergency",
    body: "The simulation models six households — each with a hub member (the family name) and 1–3 individuals. At the start, everyone is unaware. Grey nodes. Nothing happening yet.",
  },
  {
    tag: "Phase 1 — Alert",
    title: "An official warning is issued",
    body: "A central information node broadcasts an alert. Whether a household receives it depends on threat level and information clarity. Low clarity means a weak, ambiguous signal that not everyone picks up.",
  },
  {
    tag: "Phase 2 — Seeking",
    title: "People don't act on a single alert",
    body: "Most households seek confirmation from multiple sources before accepting the threat as real. The progress ring shows how many confirmations have been received. Elders require one extra confirmation before they believe it.",
  },
  {
    tag: "Phase 3 — Milling",
    title: "Confirmed — but not yet moving",
    body: "Once confirmed, households enter the milling phase: gathering belongings, contacting family, completing routines. This is normal behaviour, not panic. Families with elders or young children take significantly longer.",
  },
  {
    tag: "Phase 4 — Evacuating",
    title: "The hub waits for everyone",
    body: "The family hub only departs when its slowest member is ready. On foot, elders move at 1.8 px/tick and children at 1.5 — compared to 2.6 for adults. In a car or on a train, this gap largely disappears.",
  },
  {
    tag: "Phase 5 — Social influence",
    title: "Neighbours accelerate the cascade",
    body: "Seeing a neighbour prepare or evacuate can count as an additional social confirmation. The Neighbour influence slider controls how powerful this effect is. At high values, one family departing can cascade through the entire network.",
  },
];

function StickyPhases() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    const observers = stepRefs.current.map((el, i) => {
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveStep(i); },
        { rootMargin: "-30% 0px -50% 0px", threshold: 0 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o?.disconnect());
  }, []);

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            How it works
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 40, letterSpacing: "-0.3px" }}>
            The evacuation cycle
          </h2>
        </FadeIn>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 28 }}>
          {/* Sticky illustration */}
          <div style={{ position: "sticky", top: "15vh", width: 240, flexShrink: 0 }}>
            <PhaseIllustration step={activeStep} />
            {/* Step dots */}
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {PHASE_STEPS.map((_, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: i === activeStep ? "#185FA5" : "rgba(24,95,165,0.2)",
                  transition: "background 0.3s",
                }} />
              ))}
            </div>
          </div>
          {/* Scrolling text */}
          <div style={{ flex: 1 }}>
            {PHASE_STEPS.map((s, i) => (
              <div key={i} ref={el => stepRefs.current[i] = el}
                style={{ minHeight: "68vh", display: "flex", flexDirection: "column", justifyContent: "center", paddingTop: i === 0 ? 0 : 16 }}>
                <div style={{
                  opacity: activeStep === i ? 1 : 0.35,
                  transform: activeStep === i ? "translateX(0)" : "translateX(-6px)",
                  transition: "opacity 0.4s, transform 0.4s",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    {s.tag}
                  </div>
                  <h3 style={{ fontSize: 17, fontWeight: 600, color: "#0f1e36", marginBottom: 10, lineHeight: 1.35 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", margin: 0 }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Channels() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Information pathways
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Two channels drive evacuations
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            Whether a household evacuates — and how quickly — depends on which channel reaches it first and how reliable that channel is perceived to be.
          </p>
        </FadeIn>
        <div style={{ display: "flex", gap: 14 }}>
          <FadeIn delay={0} style={{ flex: 1 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "20px 20px 24px", height: "100%" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🔵</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#185FA5", marginBottom: 8 }}>Official channel</div>
              <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>
                The central information node broadcasts alerts to all households simultaneously. The quality of this channel is controlled by the <strong>Info clarity</strong> slider. Low clarity means families need more confirmations before they believe the threat.
              </p>
              <div style={{ marginTop: 14, padding: "8px 10px", background: "#E6F1FB", borderRadius: 6, fontSize: 11, color: "#0C447C" }}>
                Represented by blue arcs from the hexagon node
              </div>
            </div>
          </FadeIn>
          <FadeIn delay={120} style={{ flex: 1 }}>
            <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "20px 20px 24px", height: "100%" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>🟡</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#BA7517", marginBottom: 8 }}>Social channel</div>
              <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>
                Seeing a neighbour milling or evacuating acts as a powerful social confirmation. The <strong>Neighbour influence</strong> slider controls the strength of this effect. At high values, it can cascade through the entire network independently of the official broadcast.
              </p>
              <div style={{ marginTop: 14, padding: "8px 10px", background: "#FEF3E2", borderRadius: 6, fontSize: 11, color: "#854F0B" }}>
                Represented by amber pulses along neighbour edges
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function PopulationFactors() {
  const bars = [
    { label: "Adult",      millingExtra: 0, speed: 2.6, fill: "#888780", str: "#5F5E5A" },
    { label: "Elder",      millingExtra: 3.5, speed: 1.8, fill: "#7F77DD", str: "#534AB7", shape: "circle" },
    { label: "Child <5",   millingExtra: 4.5, speed: 1.5, fill: "#D4537E", str: "#993556", shape: "diamond" },
  ];
  const maxMill = 4.5, maxSpeed = 2.6;

  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Population factors
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Age shapes the timeline
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            Elders and young children affect both how long households take to prepare and how fast they can move. The hub waits for its slowest member — so one elder can delay an entire family.
          </p>
        </FadeIn>
        <div style={{ display: "flex", gap: 24 }}>
          <FadeIn delay={0} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              Extra milling delay (avg. ticks)
            </div>
            {bars.map(b => (
              <div key={b.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 10, height: 10, flexShrink: 0, display: "inline-block",
                    background: b.fill, borderRadius: b.shape === "diamond" ? 0 : "50%",
                    transform: b.shape === "diamond" ? "rotate(45deg)" : "none",
                  }} />
                  <span style={{ fontSize: 11, color: "#3d3d3a", minWidth: 62 }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: "#737069" }}>{b.millingExtra === 0 ? "none" : `+${b.millingExtra}t avg.`}</span>
                </div>
                <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 5,
                    width: `${(b.millingExtra / maxMill) * 100 || 4}%`,
                    background: b.str,
                    transition: "width 0.8s ease",
                  }} />
                </div>
              </div>
            ))}
          </FadeIn>
          <FadeIn delay={120} style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#737069", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
              Movement speed (px / tick, pedestrian)
            </div>
            {bars.map(b => (
              <div key={b.label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{
                    width: 10, height: 10, flexShrink: 0, display: "inline-block",
                    background: b.fill, borderRadius: b.shape === "diamond" ? 0 : "50%",
                    transform: b.shape === "diamond" ? "rotate(45deg)" : "none",
                  }} />
                  <span style={{ fontSize: 11, color: "#3d3d3a", minWidth: 62 }}>{b.label}</span>
                  <span style={{ fontSize: 10, color: "#737069" }}>{b.speed} px/t</span>
                </div>
                <div style={{ height: 10, background: "rgba(0,0,0,0.06)", borderRadius: 5, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 5,
                    width: `${(b.speed / maxSpeed) * 100}%`,
                    background: b.str,
                    transition: "width 0.8s ease",
                  }} />
                </div>
              </div>
            ))}
          </FadeIn>
        </div>
      </div>
    </div>
  );
}

function ScenariosSection() {
  const cards = [
    {
      icon: "🚶", key: "pedestrian", title: "Pedestrian",
      color: "#534AB7",
      points: ["Age strongly affects speed", "Elders +3–7t evac delay", "Children slowest at 1.5 px/t", "Social influence most impactful"],
    },
    {
      icon: "🚗", key: "car", title: "Car",
      color: "#185FA5",
      points: ["Vehicle equalises mobility", "All ages travel same speed", "Short prep time (1–3t base)", "Age effect nearly eliminated"],
    },
    {
      icon: "🚆", key: "train", title: "Train",
      color: "#0F6E56",
      points: ["Long wait for departure (4–8t)", "All passengers same speed", "Info clarity critical (platform?)", "Once aboard: fastest mode"],
    },
  ];
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Scenarios
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 8, letterSpacing: "-0.3px" }}>
            Context changes everything
          </h2>
          <p style={{ fontSize: 13, lineHeight: 1.8, color: "#5a5a55", marginBottom: 32, maxWidth: 520 }}>
            The same community, threat level, and information quality can produce very different outcomes depending on the available mode of evacuation.
          </p>
        </FadeIn>
        <div style={{ display: "flex", gap: 12 }}>
          {cards.map((c, i) => (
            <FadeIn key={c.key} delay={i * 100} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", overflow: "hidden" }}>
                <div style={{ background: c.color, padding: "14px 16px", color: "#fff" }}>
                  <span style={{ fontSize: 20, marginRight: 8 }}>{c.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</span>
                </div>
                <ul style={{ margin: 0, padding: "14px 16px 16px 26px", listStyle: "disc" }}>
                  {c.points.map(p => (
                    <li key={p} style={{ fontSize: 11, lineHeight: 1.75, color: "#5a5a55" }}>{p}</li>
                  ))}
                </ul>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

function HowToUse() {
  const steps = [
    { n: 1, title: "Choose a scenario", body: "Select Pedestrian, Car, or Train. Each changes milling times and movement speeds." },
    { n: 2, title: "Set your parameters", body: "Open the ⚙ Parameters panel and adjust sliders. Each shows a live hint describing the effect." },
    { n: 3, title: "Run the simulation", body: "Press ▶ Run. Use Step for tick-by-tick observation. Hover a family to highlight it; click a node to inspect it." },
    { n: 4, title: "Read the summary", body: "When complete, a summary panel shows per-phase timing, the slowest family, and a bar chart of family timelines." },
    { n: 5, title: "Compare runs", body: "Pin any run in the Run History panel. Subsequent runs show whether they are faster or slower than the pinned baseline." },
  ];
  return (
    <div style={{ background: "#fff", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Getting started
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 32, letterSpacing: "-0.3px" }}>
            How to use the simulation
          </h2>
        </FadeIn>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {steps.map((s, i) => (
            <FadeIn key={s.n} delay={i * 80}>
              <div style={{ display: "flex", gap: 16, paddingBottom: 24, borderLeft: i < steps.length - 1 ? "1.5px solid rgba(24,95,165,0.15)" : "none", paddingLeft: 24, position: "relative" }}>
                <div style={{
                  position: "absolute", left: -12, top: 0,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#185FA5", color: "#fff",
                  fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{s.n}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f1e36", marginBottom: 4 }}>{s.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.7, color: "#5a5a55" }}>{s.body}</div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

function Research() {
  return (
    <div style={{ background: "#f8f7f4", padding: "60px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
        <FadeIn>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#185FA5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            Research background
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f1e36", marginBottom: 24, letterSpacing: "-0.3px" }}>
            Grounded in disaster sociology
          </h2>
        </FadeIn>
        <div style={{ display: "flex", gap: 14 }}>
          {[
            {
              name: "Enrico Quarantelli",
              org: "Disaster Research Center, U. Delaware",
              body: "Established that people rarely panic during disasters — they mill: seeking confirmation from multiple sources before accepting a threat as real. His concept of warning response directly inspired the confirmation-seeking mechanics in this model.",
            },
            {
              name: "Thomas Drabek",
              org: "University of Denver",
              body: "Documented that families evacuate as units, not individuals — they wait until all members are present before departing. His research on household decision-making, tourist evacuations, and elder vulnerability underpins the hub and age mechanics.",
            },
          ].map((r, i) => (
            <FadeIn key={r.name} delay={i * 100} style={{ flex: 1 }}>
              <div style={{ background: "#fff", borderRadius: 12, border: "0.5px solid rgba(0,0,0,0.1)", padding: "18px 18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0f1e36", marginBottom: 2 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "#737069", marginBottom: 10 }}>{r.org}</div>
                <p style={{ fontSize: 12, lineHeight: 1.75, color: "#5a5a55", margin: 0 }}>{r.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>
        <FadeIn delay={200}>
          <p style={{ fontSize: 11, color: "#999895", marginTop: 20, lineHeight: 1.7 }}>
            Timing values in this simulation are qualitative approximations inspired by this research, not calibrated empirical measurements. For calibrated models, consult FEMA evacuation timing studies and peer-reviewed agent-based evacuation literature.
          </p>
        </FadeIn>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function AboutPage({ onLaunch }) {
  return (
    <div style={{ color: "#3d3d3a" }}>

      {/* Hero */}
      <div style={{ background: "#0f1e36", color: "#fff", padding: "72px 16px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(55,138,221,0.9)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>
            Agent-based evacuation model
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.5px", lineHeight: 1.2, marginBottom: 18 }}>
            How information flow shapes who evacuates — and when
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.85, opacity: 0.78, marginBottom: 32, maxWidth: 460, margin: "0 auto 32px" }}>
            An interactive simulation showing that evacuation failures are rarely about the will to leave. They happen when alerts arrive late, confirmations are scarce, and households with elders or young children can't keep pace.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={onLaunch} style={{
              padding: "10px 24px", fontSize: 13, fontWeight: 700, borderRadius: 8,
              border: "none", cursor: "pointer", background: "#378ADD", color: "#fff",
            }}>
              ▶ Open Simulation
            </button>
            <a href="#how-it-works" onClick={e => { e.preventDefault(); document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" }); }}
              style={{ padding: "10px 24px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", color: "rgba(255,255,255,0.85)", cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              Read the guide ↓
            </a>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div id="how-it-works">
        <StickyPhases />
      </div>
      <Channels />
      <PopulationFactors />
      <ScenariosSection />
      <HowToUse />
      <Research />

      {/* Final CTA */}
      <div style={{ background: "#0f1e36", padding: "56px 16px", textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginBottom: 20 }}>
          Ready to explore?
        </p>
        <button onClick={onLaunch} style={{
          padding: "11px 28px", fontSize: 13, fontWeight: 700, borderRadius: 8,
          border: "none", cursor: "pointer", background: "#378ADD", color: "#fff",
        }}>
          ▶ Open Simulation
        </button>
      </div>

    </div>
  );
}
