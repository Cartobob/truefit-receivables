import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const fmt = (n) => "Rs." + Number(n || 0).toLocaleString("en-IN");
const fmtShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 100000) return "Rs." + (v / 100000).toFixed(1) + "L";
  if (Math.abs(v) >= 1000) return "Rs." + (v / 1000).toFixed(1) + "K";
  return "Rs." + v.toLocaleString("en-IN");
};

const displayName = (name) => {
  const map = { "Chitrasan Debtors": "Chitrasan", "Vijay Sir": "Vijayakumar" };
  return map[name] || name;
};

function toISO(d) { return d.toISOString().split("T")[0]; }

function getLastWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const lastMon = new Date(today);
  lastMon.setDate(today.getDate() - ((day + 6) % 7) - 7);
  lastMon.setHours(0,0,0,0);
  const lastSat = new Date(lastMon);
  lastSat.setDate(lastMon.getDate() + 5);
  return { start: lastMon, end: lastSat };
}

function getCurrentMonthRange() {
  const today = new Date();
  return {
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: new Date(today.getFullYear(), today.getMonth() + 1, 0)
  };
}

function isFirstMondayOfMonth() {
  const today = new Date();
  return today.getDay() === 1 && today.getDate() <= 7;
}

function weekLabel(start, end) {
  const opts = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("en-IN", opts)} – ${end.toLocaleDateString("en-IN", opts)}`;
}

function monthLabel(d) {
  return d.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

async function fetchStats(dealerIds, start, end) {
  if (!dealerIds || dealerIds.length === 0) return { sales: 0, collections: 0 };
  const [{ data: bills }, { data: payments }] = await Promise.all([
    supabase.from("bills").select("amount").in("dealer_id", dealerIds)
      .gte("bill_date", toISO(start)).lte("bill_date", toISO(end)),
    supabase.from("payments").select("amount").in("dealer_id", dealerIds)
      .gte("payment_date", toISO(start)).lte("payment_date", toISO(end))
  ]);
  return {
    sales: (bills || []).reduce((s, b) => s + Number(b.amount || 0), 0),
    collections: (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
  };
}

// ── Salesman weekly card ──
export function SalesmanWeeklyCard({ salesmanId }) {
  const [weekStats, setWeekStats] = useState(null);
  const [monthStats, setMonthStats] = useState(null);

  useEffect(() => {
    if (!salesmanId) return;
    async function load() {
      const { data: dealers } = await supabase.from("dealers").select("id").eq("salesman_id", salesmanId);
      const ids = (dealers || []).map(d => d.id);
      const { start: wStart, end: wEnd } = getLastWeekRange();
      const { start: mStart, end: mEnd } = getCurrentMonthRange();
      const firstMonday = isFirstMondayOfMonth();
      let wLabel, wData;
      if (firstMonday) {
        const lms = new Date(mStart); lms.setMonth(lms.getMonth() - 1);
        const lme = new Date(mStart); lme.setDate(0);
        wLabel = monthLabel(lms); wData = await fetchStats(ids, lms, lme);
      } else {
        wLabel = weekLabel(wStart, wEnd); wData = await fetchStats(ids, wStart, wEnd);
      }
      const mData = await fetchStats(ids, mStart, mEnd);
      setWeekStats({ label: wLabel, ...wData, isMonth: firstMonday });
      setMonthStats({ label: monthLabel(mStart), ...mData });
    }
    load();
  }, [salesmanId]);

  if (!weekStats || !monthStats) return null;

  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.14em", color: "#888", marginBottom: 8 }}>
          {weekStats.isMonth ? "LAST MONTH" : "LAST WEEK"} · {weekStats.label.toUpperCase()}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginBottom: 2 }}>SALES</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 24, fontWeight: 700, color: "#6b2f0a" }}>{fmtShort(weekStats.sales)}</div>
          </div>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginBottom: 2 }}>COLLECTIONS</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 24, fontWeight: 700, color: "#166534" }}>{fmtShort(weekStats.collections)}</div>
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.14em", color: "#888", marginBottom: 8 }}>
          THIS MONTH · {monthStats.label.toUpperCase()}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginBottom: 2 }}>SALES</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18, fontWeight: 600, color: "#6b2f0a" }}>{fmtShort(monthStats.sales)}</div>
          </div>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginBottom: 2 }}>COLLECTIONS</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18, fontWeight: 600, color: "#166534" }}>{fmtShort(monthStats.collections)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Admin leaderboard ──
export function AdminWeeklyLeaderboard({ salesmen }) {
  const [weekData, setWeekData] = useState([]);
  const [monthData, setMonthData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekLabel2, setWeekLabel2] = useState("");
  const [monthLabel2, setMonthLabel2] = useState("");

  useEffect(() => {
    if (!salesmen || salesmen.length === 0) { setLoading(false); return; }
    setLoading(true);
    async function load() {
      const { data: allDealers } = await supabase.from("dealers").select("id, salesman_id");
      const dealerMap = {};
      (allDealers || []).forEach(d => {
        if (!dealerMap[d.salesman_id]) dealerMap[d.salesman_id] = [];
        dealerMap[d.salesman_id].push(d.id);
      });

      const { start: wStart, end: wEnd } = getLastWeekRange();
      const { start: mStart, end: mEnd } = getCurrentMonthRange();
      const firstMonday = isFirstMondayOfMonth();

      let wS = wStart, wE = wEnd, wLbl;
      if (firstMonday) {
        const lms = new Date(mStart); lms.setMonth(lms.getMonth() - 1);
        const lme = new Date(mStart); lme.setDate(0);
        wS = lms; wE = lme;
        wLbl = "LAST MONTH · " + monthLabel(lms).toUpperCase();
      } else {
        wLbl = "LAST WEEK · " + weekLabel(wStart, wEnd).toUpperCase();
      }
      setWeekLabel2(wLbl);
      setMonthLabel2("THIS MONTH · " + monthLabel(mStart).toUpperCase());

      const wRows = await Promise.all(salesmen.map(async sm => {
        const ids = dealerMap[sm.id] || [];
        const stats = await fetchStats(ids, wS, wE);
        return { name: sm.name, sales: stats.sales || 0, collections: stats.collections || 0 };
      }));

      const mRows = await Promise.all(salesmen.map(async sm => {
        const ids = dealerMap[sm.id] || [];
        const stats = await fetchStats(ids, mStart, mEnd);
        return { name: sm.name, sales: stats.sales || 0, collections: stats.collections || 0 };
      }));

      setWeekData(wRows.sort((a, b) => b.sales - a.sales));
      setMonthData(mRows.sort((a, b) => b.sales - a.sales));
      setLoading(false);
    }
    load().catch(e => { console.error("Leaderboard error:", e); setLoading(false); });
  }, [salesmen]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: 20, fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#888" }}>Loading stats...</div>
  );

  const table = (rows, label) => {
    if (!rows || rows.length === 0) return null;
    const totalSales = rows.reduce((s, r) => s + (r.sales || 0), 0);
    const totalColl  = rows.reduce((s, r) => s + (r.collections || 0), 0);
    return (
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 16 }}>
        <div style={{ padding: "10px 16px", background: "#fdf0e8", borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#6b2f0a", fontWeight: 600 }}>{label}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "8px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["SALESMAN", "SALES", "COLLECTIONS"].map(h => (
            <div key={h} style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888", textAlign: h === "SALESMAN" ? "left" : "right" }}>{h}</div>
          ))}
        </div>
        {rows.map((r, i) => (
          <div key={r.name} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 16px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {i === 0 && <span style={{ fontSize: 14 }}>🥇</span>}
              {i === 1 && <span style={{ fontSize: 14 }}>🥈</span>}
              {i === 2 && <span style={{ fontSize: 14 }}>🥉</span>}
              {i > 2 && <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "#aaa", width: 22, textAlign: "center" }}>{i + 1}</span>}
              <span style={{ fontSize: 14, fontWeight: i === 0 ? 600 : 400, color: "#6b2f0a" }}>{displayName(r.name)}</span>
            </div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: "#6b2f0a", textAlign: "right" }}>{fmtShort(r.sales)}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: i === 0 ? 600 : 400, color: "#166534", textAlign: "right" }}>{fmtShort(r.collections)}</div>
          </div>
        ))}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", padding: "10px 16px", background: "#fdf0e8", borderTop: "2px solid #e2e8f0", alignItems: "center" }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, fontWeight: 600, color: "#6b2f0a", letterSpacing: "0.08em" }}>TOTAL</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 700, color: "#6b2f0a", textAlign: "right" }}>{fmtShort(totalSales)}</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 700, color: "#166534", textAlign: "right" }}>{fmtShort(totalColl)}</div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {table(weekData, weekLabel2)}
      {table(monthData, monthLabel2)}
    </div>
  );
}
