import { useState } from "react";

export default function Login({ salesmen, adminPin, onLogin }) {
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    setError("");
    if (selected === "admin") {
      if (password === adminPin) {
        onLogin({ role: "admin" });
      } else {
        setError("Incorrect admin PIN");
      }
      return;
    }
    const salesman = salesmen.find(s => s.id === selected);
    if (!salesman) { setError("Please select a user"); return; }
    if (password === salesman.password) {
      onLogin({ role: "salesman", salesman });
    } else {
      setError("Incorrect password");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        {/* Logo / Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "#334155", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 16, boxShadow: "0 4px 12px rgba(51,65,85,0.3)" }}>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 700, color: "#ea580c" }}>T</span>
          </div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, letterSpacing: "0.2em", color: "#334155", marginBottom: 4 }}>TRUEFIT SKIM COAT</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.12em", color: "#ea580c", fontWeight: 600 }}>RECEIVABLES</div>
        </div>

        {/* Card */}
        <div style={{ background: "#ffffff", borderRadius: 16, padding: 28, boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.1em", color: "#888", marginBottom: 6 }}>SELECT USER</label>
            <select value={selected} onChange={e => setSelected(e.target.value)}
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#f8fafc", color: "#334155", fontFamily: "'IBM Plex Sans'", outline: "none" }}>
              <option value="">— Choose —</option>
              <option value="admin">Admin</option>
              {salesmen.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.1em", color: "#888", marginBottom: 6 }}>PASSWORD / PIN</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Enter password"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#f8fafc", color: "#334155", fontFamily: "'IBM Plex Sans'", outline: "none" }} />
          </div>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#dc2626", marginBottom: 14, fontFamily: "'IBM Plex Mono'" }}>
              {error}
            </div>
          )}

          <button onClick={handleLogin}
            style={{ width: "100%", padding: "12px", background: "#334155", color: "#ffffff", border: "none", borderRadius: 8, fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", cursor: "pointer" }}>
            ENTER →
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "#aaa", letterSpacing: "0.08em" }}>v7</div>
      </div>
    </div>
  );
}
