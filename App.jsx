import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Login from "./views/Login";
import SalesmanView from "./views/SalesmanView";
import AdminView from "./views/AdminView";
import ProfitabilityView from "./views/ProfitabilityView";

const ADMIN_PIN = "0000";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [salesmen, setSalesmen] = useState([]);
  const [view, setView] = useState("dashboard");

  useEffect(() => {
    const saved = sessionStorage.getItem("rx_auth");
    if (saved) setAuth(JSON.parse(saved));
    fetchSalesmen();
  }, []);

  const fetchSalesmen = async () => {
    const { data } = await supabase.from("salesmen").select("*").order("name");
    setSalesmen(data || []);
  };

  const login = (authObj) => {
    setAuth(authObj);
    sessionStorage.setItem("rx_auth", JSON.stringify(authObj));
    setView("dashboard");
  };

  const logout = () => {
    setAuth(null);
    sessionStorage.removeItem("rx_auth");
    setView("dashboard");
  };

  if (!auth) return <Login salesmen={salesmen} adminPin={ADMIN_PIN} onLogin={login} />;

  const isAdmin = auth.role === "admin";

  const tabs = isAdmin
    ? [
        { id: "dashboard", label: "DEALERS" },
        { id: "profitability", label: "P&L" },
        { id: "admin", label: "ADMIN" },
      ]
    : [{ id: "dashboard", label: "MY DEALERS" }];

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#f1f5f9", minHeight: "100vh", color: "#334155" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #e2e8f0", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#ffffff", zIndex: 100, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", flexWrap: "nowrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ea580c", flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, letterSpacing: "0.12em", color: "#334155", whiteSpace: "nowrap" }}>TRUEFIT · RECEIVABLES</span>
          {isAdmin && (
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#fff7ed", color: "#ea580c", border: "1px solid #fdba74" }}>ADMIN</span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {!isAdmin && (
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#888", marginRight: 4 }}>{auth.salesman.name}</span>
          )}
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setView(tab.id)}
              style={{
                fontFamily: "'IBM Plex Mono'", fontSize: 12, letterSpacing: "0.08em",
                padding: "6px 10px", borderRadius: 4, border: "1px solid", transition: "all 0.15s", whiteSpace: "nowrap",
                background: view === tab.id ? "#334155" : "transparent",
                borderColor: view === tab.id ? "#334155" : "#e2e8f0",
                color: view === tab.id ? "#ffffff" : "#334155"
              }}>
              {tab.label}
            </button>
          ))}
          <button onClick={logout}
            style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, padding: "6px 8px", borderRadius: 4, border: "1px solid #e2e8f0", background: "transparent", color: "#888", whiteSpace: "nowrap" }}>
            EXIT
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px" }}>
        {view === "dashboard" && (isAdmin
          ? <AdminView salesmen={salesmen} onRefresh={fetchSalesmen} />
          : <SalesmanView salesman={auth.salesman} />
        )}
        {view === "profitability" && isAdmin && <ProfitabilityView salesmen={salesmen} />}
        {view === "admin" && isAdmin && <AdminView salesmen={salesmen} onRefresh={fetchSalesmen} />}
      </div>
    </div>
  );
}
