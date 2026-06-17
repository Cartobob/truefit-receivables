import { useState, useEffect } from "react";
import { fetchActivityGrouped, downloadActivityLog } from "../lib/activityLog";

export default function ActivityLogView() {
  const [groups, setGroups] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const g = await fetchActivityGrouped();
    setGroups(g);
    setLoading(false);
  };

  const dateKeys = Object.keys(groups);

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.12em", color: "#ea580c", marginBottom: 4 }}>ACTIVITY LOG</div>
          <div style={{ fontSize: 13, color: "#888" }}>All admin actions, newest first</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ padding: "8px 12px", fontFamily: "'IBM Plex Mono'", fontSize: 13, borderRadius: 6, border: "1px solid #e2e8f0", background: "#ffffff", color: "#888", cursor: "pointer" }}>↻ Refresh</button>
          <button onClick={downloadActivityLog} style={{ padding: "8px 14px", fontFamily: "'IBM Plex Mono'", fontSize: 13, borderRadius: 6, border: "none", background: "#334155", color: "#ffffff", letterSpacing: "0.06em", cursor: "pointer" }}>⬇ Download .md</button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#888" }}>LOADING...</div>
      ) : dateKeys.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#888" }}>No activity logged yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {dateKeys.map(dateKey => {
            const dayRows = groups[dateKey].slice().reverse(); // oldest first, numbered
            return (
              <div key={dateKey} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "10px 16px", background: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                  <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, letterSpacing: "0.08em", color: "#334155", fontWeight: 600 }}>{dateKey}</span>
                  <span style={{ fontSize: 12, color: "#888", marginLeft: 8 }}>{dayRows.length} {dayRows.length === 1 ? "entry" : "entries"}</span>
                </div>
                <div>
                  {dayRows.map((r, i) => {
                    const time = new Date(r.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={r.id} style={{ padding: "9px 16px", borderBottom: i < dayRows.length - 1 ? "1px solid #f1f5f9" : "none", display: "flex", gap: 10, alignItems: "baseline" }}>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#94a3b8", minWidth: 22 }}>{i + 1}.</span>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#ea580c", minWidth: 54 }}>{time}</span>
                        <span style={{ fontSize: 14, color: "#334155" }}>{r.description}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
