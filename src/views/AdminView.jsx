import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { fmt, totalBalance, worstBucket, ageDays, ageBucket, stripColor } from "../lib/helpers";

export default function AdminView({ salesmen, onRefresh }) {
  const [data, setData] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [expandedDealer, setExpandedDealer] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddSalesman, setShowAddSalesman] = useState(false);
  const [showAddDealer, setShowAddDealer] = useState(null);
  const [showAddBill, setShowAddBill] = useState(null);
  const [newSalesman, setNewSalesman] = useState({ name: "", password: "" });
  const [newDealer, setNewDealer] = useState({ name: "", area: "" });
  const [newBill, setNewBill] = useState({ bill_no: "", amount: "", bill_date: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchAll(); }, [salesmen]);

  const fetchAll = async () => {
    setLoading(true);
    const { data: dealers } = await supabase.from("dealers").select("*, bills(*), salesmen(name)").order("name");
    const grouped = salesmen.map(s => ({
      ...s,
      dealers: (dealers || []).filter(d => d.salesman_id === s.id)
    }));
    setData(grouped);
    setLoading(false);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const toggleDealer = (id) => setExpandedDealer(e => ({ ...e, [id]: !e[id] }));

  const addSalesman = async () => {
    if (!newSalesman.name || !newSalesman.password) return;
    setSaving(true);
    await supabase.from("salesmen").insert(newSalesman);
    setNewSalesman({ name: "", password: "" });
    setShowAddSalesman(false);
    setSaving(false);
    onRefresh();
  };

  const addDealer = async (salesmanId) => {
    if (!newDealer.name) return;
    setSaving(true);
    await supabase.from("dealers").insert({ ...newDealer, salesman_id: salesmanId });
    setNewDealer({ name: "", area: "" });
    setShowAddDealer(null);
    setSaving(false);
    fetchAll();
  };

  const addBill = async (dealerId) => {
    if (!newBill.bill_no || !newBill.amount || !newBill.bill_date) return;
    setSaving(true);
    await supabase.from("bills").insert({ ...newBill, amount: parseFloat(newBill.amount), balance: parseFloat(newBill.amount), dealer_id: dealerId });
    setNewBill({ bill_no: "", amount: "", bill_date: "" });
    setShowAddBill(null);
    setSaving(false);
    fetchAll();
  };

  const deleteSalesman = async (id) => {
    if (!window.confirm("Delete this salesman and all their data?")) return;
    await supabase.from("salesmen").delete().eq("id", id);
    onRefresh();
  };

  const card = { background: "#ffffff", border: "1px solid #e5e3f0", borderRadius: 10, boxShadow: "0 1px 4px rgba(100,90,150,0.06)" };
  const input = { background: "#f4f3f8", border: "1px solid #dddbe8", borderRadius: 6, padding: "8px 12px", fontSize: 14, color: "#2d2d3d", width: "100%" };
  const btnPurple = { padding: "8px 16px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "none", background: "#8b7ec8", color: "#ffffff", letterSpacing: "0.06em" };
  const btnGhost = { padding: "8px 12px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "1px solid #dddbe8", background: "#ffffff", color: "#666" };

  const grandTotal = data.reduce((s, sm) => s + sm.dealers.reduce((ds, d) => ds + totalBalance(d.bills), 0), 0);

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 4 }}>TOTAL OUTSTANDING</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 28, fontWeight: 500, color: "#a32d2d" }}>{fmt(grandTotal)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchAll} style={{ ...btnGhost }}>&#8635; Refresh</button>
          <button onClick={() => setShowAddSalesman(true)} style={{ ...btnPurple }}>+ Add Salesman</button>
        </div>
      </div>

      {showAddSalesman && (
        <div className="slide-in" style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 12 }}>NEW SALESMAN</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ ...input, flex: 2 }} placeholder="Name" value={newSalesman.name} onChange={e => setNewSalesman(n => ({ ...n, name: e.target.value }))} />
            <input style={{ ...input, flex: 1 }} placeholder="Password" value={newSalesman.password} onChange={e => setNewSalesman(n => ({ ...n, password: e.target.value }))} />
            <button onClick={addSalesman} disabled={saving} style={{ ...btnPurple }}>SAVE</button>
            <button onClick={() => setShowAddSalesman(false)} style={{ ...btnGhost }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#888" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map((sm, i) => {
            const smTotal = sm.dealers.reduce((s, d) => s + totalBalance(d.bills), 0);
            const isOpen = expanded[sm.id];
            return (
              <div key={sm.id} className="fade-in" style={{ ...card, overflow: "hidden", animationDelay: i * 40 + "ms" }}>
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" }} onClick={() => toggle(sm.id)}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dddbe8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 500, color: "#4a3f6b", flexShrink: 0 }}>
                    {sm.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#2d2d3d" }}>{sm.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{sm.dealers.length} dealer{sm.dealers.length !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: smTotal > 0 ? "#a32d2d" : "#2d6a2d" }}>{fmt(smTotal)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "#888" }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="slide-in" style={{ borderTop: "1px solid #e5e3f0" }}>
                    <div style={{ padding: "10px 16px", background: "#f8f7fc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#8b7ec8" }}>DEALERS</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setShowAddDealer(sm.id)} style={{ ...btnPurple, padding: "5px 10px", fontSize: 10 }}>+ Add Dealer</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteSalesman(sm.id); }} style={{ padding: "5px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 6, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626" }}>Delete</button>
                      </div>
                    </div>

                    {showAddDealer === sm.id && (
                      <div style={{ padding: "12px 16px", background: "#f0eef8", borderBottom: "1px solid #e5e3f0" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input style={{ ...input, flex: 2 }} placeholder="Dealer name" value={newDealer.name} onChange={e => setNewDealer(n => ({ ...n, name: e.target.value }))} />
                          <input style={{ ...input, flex: 1 }} placeholder="Area (optional)" value={newDealer.area} onChange={e => setNewDealer(n => ({ ...n, area: e.target.value }))} />
                          <button onClick={() => addDealer(sm.id)} disabled={saving} style={{ ...btnPurple }}>SAVE</button>
                          <button onClick={() => setShowAddDealer(null)} style={{ ...btnGhost }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {sm.dealers.map((dealer, di) => {
                      const bal = totalBalance(dealer.bills);
                      const bucket = worstBucket(dealer.bills);
                      const sc = bal > 0 ? stripColor(dealer.bills) : "#c8c4e0";
                      const isDealerOpen = expandedDealer[dealer.id];

                      return (
                        <div key={dealer.id} style={{ borderBottom: di < sm.dealers.length - 1 ? "1px solid #f0eef8" : "none", borderLeft: "3px solid " + sc }}>
                          <div style={{ padding: "12px 16px 12px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "#2d2d3d" }}>{dealer.name}</div>
                              {dealer.area && <div style={{ fontSize: 11, color: "#888" }}>{dealer.area}</div>}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, fontWeight: 500, color: "#2d2d3d" }}>{fmt(bal)}</span>
                              {bal > 0 && <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: bucket.bg, color: bucket.color, border: "1px solid " + bucket.border }}>{bucket.label}</span>}
                              <button onClick={() => setShowAddBill(dealer.id)} style={{ ...btnPurple, padding: "4px 10px", fontSize: 10 }}>+ Bill</button>
                              <button onClick={() => toggleDealer(dealer.id)} style={{ ...btnGhost, padding: "4px 8px", fontSize: 11 }}>
                                {dealer.bills.length} bills {isDealerOpen ? "▲" : "▼"}
                              </button>
                            </div>
                          </div>

                          {showAddBill === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f0eef8", borderTop: "1px solid #e5e3f0" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#8b7ec8", marginBottom: 8 }}>ADD BILL</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <input style={{ ...input, flex: 1 }} placeholder="Bill no." value={newBill.bill_no} onChange={e => setNewBill(n => ({ ...n, bill_no: e.target.value }))} />
                                <input style={{ ...input, flex: 1 }} type="number" placeholder="Amount" value={newBill.amount} onChange={e => setNewBill(n => ({ ...n, amount: e.target.value }))} />
                                <input style={{ ...input, flex: 1 }} type="date" value={newBill.bill_date} onChange={e => setNewBill(n => ({ ...n, bill_date: e.target.value }))} />
                                <button onClick={() => addBill(dealer.id)} disabled={saving} style={{ ...btnPurple }}>SAVE</button>
                                <button onClick={() => setShowAddBill(null)} style={{ ...btnGhost }}>Cancel</button>
                              </div>
                            </div>
                          )}

                          {isDealerOpen && dealer.bills.length > 0 && (
                            <div style={{ background: "#faf9fd" }}>
                              {dealer.bills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map((bill, bi) => {
                                const days = ageDays(bill.bill_date);
                                const bkt = ageBucket(days);
                                return (
                                  <div key={bill.id} style={{ padding: "8px 16px 8px 36px", borderTop: "1px solid #f0eef8", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                    <div>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#4a3f6b" }}>{bill.bill_no}</span>
                                      <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>{new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>Bal: {fmt(bill.balance)}</span>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#888" }}>/ {fmt(bill.amount)}</span>
                                      <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: bkt.bg, color: bkt.color, border: "1px solid " + bkt.border }}>{days}d</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
