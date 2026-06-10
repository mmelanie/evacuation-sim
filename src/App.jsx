import { useState } from "react";
import EvacuationSim from "./EvacuationSim.jsx";
import AboutPage from "./AboutPage.jsx";

const NAV = [
  { id: "about", label: "About & Guide" },
  { id: "sim",   label: "Simulation"    },
];

export default function App() {
  const [page, setPage] = useState("about");

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", background: "#f8f7f4" }}>

      {/* ── Navigation bar ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,0.1)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto", padding: "0 16px",
          display: "flex", alignItems: "center", gap: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#185FA5", marginRight: 20, letterSpacing: "-0.3px" }}>
            EvacSim
          </span>
          {NAV.map(({ id, label }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                aria-label={label}
                style={{
                  padding: "11px 16px",
                  fontSize: 12,
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  borderBottom: active ? "2px solid #185FA5" : "2px solid transparent",
                  color: active ? "#185FA5" : "#737069",
                  fontWeight: active ? 600 : 400,
                  transition: "color 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Page content ── */}
      {page === "sim"   && <EvacuationSim />}
      {page === "about" && <AboutPage onLaunch={() => setPage("sim")} />}
    </div>
  );
}
