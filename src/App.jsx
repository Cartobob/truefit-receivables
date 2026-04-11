import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import Login from "./views/Login";
import SalesmanView from "./views/SalesmanView";
import AdminView from "./views/AdminView";

const ADMIN_PIN = "0000";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [salesmen, setSalesmen] = useState([]);

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
  };

  const logout = () => {
    setAuth(null);
    sessionStorage.removeItem("rx_auth");
  };

  if (!auth) return <Login salesmen={salesmen} adminPin={ADMIN_PIN} onLogin={login} />;

  return (
    <div style={{ background: "var(--paper)", minHeight: "100vh", color: "var(--ink)" }}>
      {/* Header */}
      <div style={{
        borderBottom: "2px solid var(--ink)",
        padding: "0 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "stretch",
        position: "sticky",
        top: 0,
        background: "var(--ink)",
        zIndex: 100,
        gap: 8
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0" }}>
          <div style={{ width: 8, height: 8, background: "var(--accent-light)", borderRadius: "50%", flexShrink: 0 }} />
          <span style={{
            fontFamily: "'IBM Plex Mono'",
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "var(--paper)",
            whiteSpace: "nowrap"
          }}>TRUEFIT SKIM COAT · RECEIVABLES</span>
          {auth.role === "admin" && (
            <span style={{
              fontFamily: "'IBM Plex Mono'",
              fontSize: 9,
              padding: "2px 7px",
              borderRadius: 2,
              background: "var(--accent)",
              color: "var(--paper)",
              letterSpacing: "0.08em"
            }}>ADMIN</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {auth.role === "salesman" && (
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--light)", letterSpacing: "0.02em" }}>
              {auth.salesman.name}
            </span>
          )}
          <button onClick={logout} style={{
            fontFamily: "'IBM Plex Mono'",
            fontSize: 10,
            padding: "6px 12px",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.08em"
          }}>EXIT</button>
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 16px" }}>
        {auth.role === "admin"
          ? <AdminView salesmen={salesmen} onRefresh={fetchSalesmen} />
          : <SalesmanView salesman={auth.salesman} />
        }
      </div>
    </div>
  );
}
