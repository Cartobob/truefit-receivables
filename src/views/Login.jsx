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
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#f0f2f5", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 320 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, letterSpacing: "0.2em", color: "#111111", marginBottom: 6 }}>TRUEFIT SKIM COAT</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 20, letterSpacing: "0.12em", color: "#000000" }}>RECEIVABLES</div>
          <div style={{ width: 32, height: 2, background: "#8b4513", margin: "14px auto 0", borderRadius: 1 }} />
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #cccccc", borderRadius: 12, padding: 24, boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {["salesman", "admin"].map(m => (
              <button key={m} onClick={() => { setMode(m); setPassword(""); setError(""); }}
                style={{ flex: 1, padding: "7px 0", fontFamily: "'IBM Plex Mono'", fontSize: 16, letterSpacing: "0.1em", borderRadius: 5, border: "1px solid", transition: "all 0.15s",
                  background: mode === m ? "#8b4513" : "#f8fafc",
                  borderColor: mode === m ? "#8b4513" : "#cccccc",
                  color: mode === m ? "#ffffff" : "#111111"
                }}>{m.toUpperCase()}</button>
            ))}
          </div>
          {mode === "salesman" && (
            <>
              <div style={{ marginBottom: 8, fontFamily: "'IBM Plex Mono'", fontSize: 15, letterSpacing: "0.12em", color: "#111111" }}>YOUR NAME</div>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                style={{ width: "100%", background: "#f8fafc", border: "1px solid #cccccc", borderRadius: 6, padding: "10px 14px", color: "#000000", fontSize: 16, fontFamily: "'IBM Plex Sans'", marginBottom: 12 }}>
                <option value="">— Select —</option>
                {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}
          <div style={{ marginBottom: 8, fontFamily: "'IBM Plex Mono'", fontSize: 15, letterSpacing: "0.12em", color: "#111111" }}>
            {mode === "salesman" ? "PASSWORD" : "ADMIN PIN"}
          </div>
          <input type="password" value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder={mode === "salesman" ? "Enter password" : "Enter PIN"}
            style={{ width: "100%", background: "#f8fafc", border: "1px solid #cccccc", borderRadius: 6, padding: "10px 14px", color: "#000000", fontSize: 16, fontFamily: "'IBM Plex Sans'", marginBottom: 12 }}
          />
          {error && <div style={{ fontSize: 15, color: "#dc2626", marginBottom: 10, fontFamily: "'IBM Plex Mono'" }}>{error}</div>}
          <button onClick={handleLogin}
            style={{ width: "100%", padding: "10px 0", background: "#000000", border: "none", borderRadius: 6, color: "#ffffff", fontSize: 16, fontFamily: "'IBM Plex Mono'", letterSpacing: "0.1em", transition: "background 0.15s" }}
            onMouseOver={e => e.currentTarget.style.background = "#8b4513"}
            onMouseOut={e => e.currentTarget.style.background = "#000000"}>
            ENTER →
          </button>
        </div>
        <div style={{ textAlign: "center", marginTop: 18, fontFamily: "'IBM Plex Mono'", fontSize: 15, color: "#cbd5e0", letterSpacing: "0.08em" }}>
          receivables.truefit.in
        </div>
      </div>
    </div>
  );
}
