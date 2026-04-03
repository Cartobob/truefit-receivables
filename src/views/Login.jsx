import { useState } from "react";

export default function Login({ salesmen, adminPin, onLogin }) {
  const [mode, setMode] = useState("salesman");
  const [selectedId, setSelectedId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    setError("");
    if (mode === "admin") {
      if (password === adminPin) { onLogin({ role: "admin" }); return; }
      setError("Incorrect PIN."); setPassword(""); return;
    }
    if (!selectedId) { setError("Please select your name."); return; }
    const salesman = salesmen.find(s => s.id === selectedId);
    if (!salesman) { setError("Not found."); return; }
    if (password === salesman.password) { onLogin({ role: "salesman", salesman }); return; }
    setError("Incorrect password."); setPassword("");
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#f4f3f8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 320 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, letterSpacing: "0.2em", color: "#8b7ec8", marginBottom: 6 }}>TRUEFIT SKIM COAT</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18, letterSpacing: "0.12em", color: "#2d2d3d" }}>RECEIVABLES</div>
          <div style={{ width: 32, height: 2, background: "#c8c4e0", margin: "14px auto 0", borderRadius: 1 }} />
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #dddbe8", borderRadius: 12, padding: 24, boxShadow: "0 4px 16px rgba(100,90,150,0.08)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {["salesman", "admin"].map(m => (
              <button key={m} onClick={() => { setMode(m); setPassword(""); setError(""); }}
                style={{ flex: 1, padding: "7px 0", fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.1em", borderRadius: 5, border: "1px solid", transition: "all 0.15s",
                  background: mode === m ? "#8b7ec8" : "#f4f3f8",
                  borderColor: mode === m ? "#8b7ec8" : "#dddbe8",
                  color: mode === m ? "#ffffff" : "#888"
                }}>{m.toUpperCase()}</button>
            ))}
          </div>
          {mode === "salesman" && (
            <>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 6 }}>SELECT YOUR NAME</div>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ width: "100%", background: "#f4f3f8", border: "1px solid #dddbe8", borderRadius: 6, padding: "10px 12px", color: "#2d2d3d", fontSize: 14, marginBottom: 12 }}>
                <option value="">-- Select --</option>
                {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 6 }}>
            {mode === "salesman" ? "PASSWORD" : "ADMIN PIN"}
          </div>
          <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder={mode === "salesman" ? "Enter password" : "Enter PIN"}
            style={{ width: "100%", background: "#f4f3f8", border: "1px solid #dddbe8", borderRadius: 6, padding: "10px 14px", color: "#2d2d3d", fontSize: 14, marginBottom: 12 }} />
          {error && <div style={{ fontSize: 11, color: "#a32d2d", marginBottom: 10, fontFamily: "'IBM Plex Mono'" }}>{error}</div>}
          <button onClick={handleLogin}
            style={{ width: "100%", padding: "10px 0", background: "#8b7ec8", border: "none", borderRadius: 6, color: "#ffffff", fontSize: 12, fontFamily: "'IBM Plex Mono'", letterSpacing: "0.1em", transition: "background 0.15s" }}
            onMouseOver={e => e.currentTarget.style.background = "#6b5eb8"}
            onMouseOut={e => e.currentTarget.style.background = "#8b7ec8"}>
            ENTER →
          </button>
        </div>
      </div>
    </div>
  );
}
