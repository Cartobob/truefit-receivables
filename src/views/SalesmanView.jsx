import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { fmt, ageDays, ageBucket, worstBucket, totalBalance, stripColor } from "../lib/helpers";

export default function SalesmanView({ salesman }) {
  const [dealers, setDealers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [paying, setPaying] = useState({});
  const [payAmount, setPayAmount] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchDealers(); }, [salesman.id]);

  const fetchDealers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dealers")
      .select("*, bills(*)")
      .eq("salesman_id", salesman.id)
      .order("name");
    setDealers((data || []).map(d => ({ ...d, bills: (d.bills || []).filter(b => Number(b.balance) > 0) })));
    setLoading(false);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const recordPayment = async (dealer) => {
    const amount = parseFloat(payAmount[dealer.id]);
    if (!amount || amount <= 0) return;
    setSaving(true);
    const { data: payment } = await supabase.from("payments").insert({
      dealer_id: dealer.id, amount, payment_date: new Date().toISOString().split("T")[0]
    }).select().single();
    if (payment) {
      let remaining = amount;
      const sorted = [...(dealer.bills || [])].sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
      for (const bill of sorted) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, Number(bill.balance));
        await supabase.from("payment_allocations").insert({ payment_id: payment.id, bill_id: bill.id, amount_applied: apply });
        await supabase.from("bills").update({ balance: Number(bill.balance) - apply }).eq("id", bill.id);
        remaining -= apply;
      }
    }
    setPaying(p => ({ ...p, [dealer.id]: false }));
    setPayAmount(p => ({ ...p, [dealer.id]: "" }));
    setSaving(false);
    fetchDealers();
  };

  const totalOut = dealers.reduce((s, d) => s + totalBalance(d.bills), 0);
  const b30 = dealers.reduce((s, d) => s + (d.bills||[]).filter(b => ageDays(b.bill_date) <= 30).reduce((x, b) => x + Number(b.balance), 0), 0);
  const b60 = dealers.reduce((s, d) => s + (d.bills||[]).filter(b => ageDays(b.bill_date) > 30 && ageDays(b.bill_date) <= 60).reduce((x, b) => x + Number(b.balance), 0), 0);
  const b60p = dealers.reduce((s, d) => s + (d.bills||[]).filter(b => ageDays(b.bill_date) > 60).reduce((x, b) => x + Number(b.balance), 0), 0);

  const card = { background: "#ffffff", border: "1px solid #e5e3f0", borderRadius: 10, boxShadow: "0 1px 4px rgba(100,90,150,0.06)" };

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 4 }}>TOTAL OUTSTANDING</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 28, fontWeight: 500, color: totalOut > 0 ? "#a32d2d" : "#2d6a2d" }}>{fmt(totalOut)}</div>
        </div>
        <button onClick={fetchDealers} style={{ padding: "6px 12px", fontSize: 13, borderRadius: 4, border: "1px solid #dddbe8", background: "#ffffff", color: "#888" }}>&#8635;</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[{ label: "0-30 DAYS", val: b30, color: "#2d6a2d" }, { label: "31-60 DAYS", val: b60, color: "#7a4500" }, { label: "60+ DAYS", val: b60p, color: "#a32d2d" }].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: s.color }}>{fmt(s.val)}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 12 }}>DEALERS ({dealers.filter(d => totalBalance(d.bills) > 0).length})</div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#888" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dealers.filter(d => totalBalance(d.bills) > 0).map((dealer, i) => {
            const bal = totalBalance(dealer.bills);
            const bucket = worstBucket(dealer.bills);
            const sc = stripColor(dealer.bills);
            const isOpen = expanded[dealer.id];
            const isPaying = paying[dealer.id];

            return (
              <div key={dealer.id} className="fade-in" style={{ ...card, overflow: "hidden", borderLeft: "3px solid " + sc, animationDelay: i * 40 + "ms" }}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: "#2d2d3d", marginBottom: 2 }}>{dealer.name}</div>
                      {dealer.area && <div style={{ fontSize: 12, color: "#888" }}>{dealer.area}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: "#2d2d3d" }}>{fmt(bal)}</div>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: bucket.bg, color: bucket.color, border: "1px solid " + bucket.border }}>{bucket.label}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => toggle(dealer.id)}
                      style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #dddbe8", background: "#f4f3f8", color: "#4a3f6b" }}>
                      {dealer.bills.length} bill{dealer.bills.length !== 1 ? "s" : ""} {isOpen ? "▲" : "▼"}
                    </button>
                    <button onClick={() => setPaying(p => ({ ...p, [dealer.id]: !p[dealer.id] }))}
                      style={{ padding: "6px 14px", fontSize: 12, borderRadius: 6, border: "1px solid #8b7ec8", background: "#f0eef8", color: "#4a3f6b", fontWeight: 500 }}>
                      + Record payment
                    </button>
                  </div>
                </div>

                {isPaying && (
                  <div className="slide-in" style={{ padding: "12px 16px", borderTop: "1px solid #e5e3f0", background: "#f8f7fc" }}>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 6, fontFamily: "'IBM Plex Mono'" }}>PAYMENT AMOUNT (Rs.)</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="number" value={payAmount[dealer.id] || ""} onChange={e => setPayAmount(p => ({ ...p, [dealer.id]: e.target.value }))}
                        placeholder="e.g. 50000"
                        style={{ flex: 1, background: "#ffffff", border: "1px solid #dddbe8", borderRadius: 6, padding: "8px 12px", fontSize: 14, color: "#2d2d3d" }} />
                      <button onClick={() => recordPayment(dealer)} disabled={saving}
                        style={{ padding: "8px 16px", fontFamily: "'IBM Plex Mono'", fontSize: 12, borderRadius: 6, border: "none", background: "#8b7ec8", color: "#ffffff", fontWeight: 500 }}>
                        {saving ? "..." : "CONFIRM"}
                      </button>
                      <button onClick={() => setPaying(p => ({ ...p, [dealer.id]: false }))}
                        style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #dddbe8", background: "#ffffff", color: "#888" }}>✕</button>
                    </div>
                    <div style={{ fontSize: 11, color: "#8b7ec8", marginTop: 6 }}>Applied oldest bill first (FIFO)</div>
                  </div>
                )}

                {isOpen && (
                  <div className="slide-in" style={{ borderTop: "1px solid #e5e3f0" }}>
                    {dealer.bills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map((bill, idx) => {
                      const days = ageDays(bill.bill_date);
                      const bkt = ageBucket(days);
                      return (
                        <div key={bill.id} style={{ padding: "10px 16px 10px 40px", borderBottom: idx < dealer.bills.length - 1 ? "1px solid #f0eef8" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#faf9fd", flexWrap: "wrap", gap: 6 }}>
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#4a3f6b" }}>{bill.bill_no}</div>
                            <div style={{ fontSize: 11, color: "#888" }}>{new Date(bill.bill_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 500, color: "#2d2d3d" }}>{fmt(bill.balance)}</span>
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
}
