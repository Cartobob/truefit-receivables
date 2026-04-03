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
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "#f4f3f8", minHeight: "100vh", color: "#2d2d3d" }}>
      <div style={{ borderBottom: "1px solid #dddbe8", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#ffffff", zIndex: 100, boxShadow: "0 1px 3px rgba(100,90,150,0.08)", flexWrap: "nowrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#8b7ec8", flexShrink: 0 }} />
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, letterSpacing: "0.12em", color: "#2d2d3d", whiteSpace: "nowrap" }}>TRUEFIT SKIM COAT · RECEIVABLES</span>
          {auth.role === "admin" && (
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, padding: "2px 6px", borderRadius: 3, background: "#dddbe8", color: "#4a3f6b", border: "1px solid #c8c4e0" }}>ADMIN</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {auth.role === "salesman" && (
            <span style={{ fontSize: 13, fontWeight: 500, color: "#4a3f6b" }}>{auth.salesman.name}</span>
          )}
          <button onClick={logout}
            style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, padding: "6px 8px", borderRadius: 4, border: "1px solid #dddbe8", background: "transparent", color: "#888" }}>
            EXIT
          </button>
        </div>
      </div>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
        {auth.role === "admin"
          ? <AdminView salesmen={salesmen} onRefresh={fetchSalesmen} />
          : <SalesmanView salesman={auth.salesman} />
        }
      </div>
    </div>
  );
}
