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

  const inp = {
    width: "100%",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    padding: "10px 12px",
    color: "#111111",
    fontSize: 14,
    marginBottom: 12,
    fontFamily: "'IBM Plex Sans', sans-serif"
  };

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 320 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'Playfair Display'", fontSize: 26, fontWeight: 500, color: "#111111", marginBottom: 4 }}>Truefit</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.22em", color: "#888888", marginBottom: 16 }}>RECEIVABLES TRACKER</div>
          <div style={{ width: 36, height: 2, background: "#8b4513", margin: "0 auto", borderRadius: 1 }} />
        </div>

        {/* Card */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {["salesman", "admin"].map(m => (
              <button key={m} onClick={() => { setMode(m); setPassword(""); setError(""); }}
                style={{
                  flex: 1, padding: "7px 0",
                  fontFamily: "'IBM Plex Mono'", fontSize: 11, letterSpacing: "0.1em",
                  borderRadius: 4, border: "1px solid", transition: "all 0.15s",
                  background: mode === m ? "#8b4513" : "transparent",
                  borderColor: mode === m ? "#8b4513" : "#e2e8f0",
                  color: mode === m ? "#ffffff" : "#888888"
                }}>{m.toUpperCase()}</button>
            ))}
          </div>

          {mode === "salesman" && (
            <>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.14em", color: "#888", marginBottom: 6 }}>YOUR NAME</div>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...inp }}>
                <option value="">— Select —</option>
                {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}

          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.14em", color: "#888", marginBottom: 6 }}>
            {mode === "salesman" ? "PASSWORD" : "ADMIN PIN"}
          </div>
          <input type="password" value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder={mode === "salesman" ? "Enter password" : "Enter PIN"}
            style={{ ...inp }} />

          {error && <div style={{ fontSize: 12, color: "#8b1a1a", marginBottom: 10, fontFamily: "'IBM Plex Mono'" }}>{error}</div>}

          <button onClick={handleLogin} style={{
            width: "100%", padding: "10px 0",
            background: "#111111", border: "none", borderRadius: 6,
            color: "#ffffff", fontSize: 12,
            fontFamily: "'IBM Plex Mono'", letterSpacing: "0.1em",
            transition: "background 0.15s"
          }}
            onMouseOver={e => e.currentTarget.style.background = "#8b4513"}
            onMouseOut={e => e.currentTarget.style.background = "#111111"}>
            ENTER →
          </button>
        </div>
      </div>
    </div>
  );
}
