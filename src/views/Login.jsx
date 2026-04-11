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
    background: "var(--light)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    padding: "11px 14px",
    color: "var(--ink)",
    fontSize: 15,
    marginBottom: 14
  };

  return (
    <div style={{
      background: "var(--paper)",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <div style={{ width: 340 }}>

        {/* Logo block */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontFamily: "'Playfair Display'",
            fontSize: 28,
            fontWeight: 500,
            color: "var(--ink)",
            letterSpacing: "0.02em",
            marginBottom: 4
          }}>Truefit</div>
          <div style={{
            fontFamily: "'DM Mono'",
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "var(--mid)",
            marginBottom: 16
          }}>RECEIVABLES TRACKER</div>
          <div style={{ width: 40, height: 2, background: "var(--accent)", margin: "0 auto", borderRadius: 1 }} />
        </div>

        {/* Card */}
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "28px 24px",
          boxShadow: "0 4px 24px rgba(28,22,18,0.08)"
        }}>
          {/* Tab switcher */}
          <div style={{
            display: "flex",
            marginBottom: 24,
            border: "1px solid var(--border)",
            borderRadius: 4,
            overflow: "hidden"
          }}>
            {["salesman", "admin"].map(m => (
              <button key={m} onClick={() => { setMode(m); setPassword(""); setError(""); }}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  fontFamily: "'DM Mono'",
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  border: "none",
                  borderRight: m === "salesman" ? "1px solid var(--border)" : "none",
                  background: mode === m ? "var(--ink)" : "transparent",
                  color: mode === m ? "var(--paper)" : "var(--mid)",
                  transition: "all 0.15s"
                }}>{m.toUpperCase()}</button>
            ))}
          </div>

          {mode === "salesman" && (
            <>
              <div style={{ fontFamily: "'DM Mono'", fontSize: 9, letterSpacing: "0.14em", color: "var(--mid)", marginBottom: 6 }}>YOUR NAME</div>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ ...inp }}>
                <option value="">— Select —</option>
                {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}

          <div style={{ fontFamily: "'DM Mono'", fontSize: 9, letterSpacing: "0.14em", color: "var(--mid)", marginBottom: 6 }}>
            {mode === "salesman" ? "PASSWORD" : "ADMIN PIN"}
          </div>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder={mode === "salesman" ? "Enter password" : "Enter PIN"}
            style={{ ...inp }}
          />

          {error && (
            <div style={{ fontSize: 12, color: "var(--red)", marginBottom: 12, fontFamily: "'DM Mono'" }}>{error}</div>
          )}

          <button onClick={handleLogin} style={{
            width: "100%",
            padding: "12px 0",
            background: "var(--ink)",
            border: "none",
            borderRadius: 4,
            color: "var(--paper)",
            fontSize: 11,
            fontFamily: "'DM Mono'",
            letterSpacing: "0.14em",
            transition: "background 0.15s"
          }}
            onMouseOver={e => e.currentTarget.style.background = "var(--accent)"}
            onMouseOut={e => e.currentTarget.style.background = "var(--ink)"}
          >ENTER →</button>
        </div>
      </div>
    </div>
  );
}
