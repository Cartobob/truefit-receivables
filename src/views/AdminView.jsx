import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { fmt, fmtDate, totalBalance, worstBucket, ageDays, ageBucket, stripColor, pendingCheques, totalPendingCheques } from "../lib/helpers";

export default function AdminView({ salesmen, onRefresh }) {
  const [data, setData] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [expandedDealer, setExpandedDealer] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const [showAddSalesman, setShowAddSalesman] = useState(false);
  const [showAddDealer, setShowAddDealer] = useState(null);
  const [showAddBill, setShowAddBill] = useState(null);
  const [showAddCheque, setShowAddCheque] = useState(null);
  const [showPayment, setShowPayment] = useState(null);
  const [showBounceNote, setShowBounceNote] = useState(null);

  const [newSalesman, setNewSalesman] = useState({ name: "", password: "" });
  const [newDealer, setNewDealer] = useState({ name: "", area: "" });
  const [newBill, setNewBill] = useState({ bill_no: "", amount: "", bill_date: "" });
  const [newCheque, setNewCheque] = useState({ amount: "", cheque_date: "", bank_name: "" });
  const [payAmount, setPayAmount] = useState("");
  const [bounceNote, setBounceNote] = useState("");

  useEffect(() => { fetchAll(); }, [salesmen]);

  const fetchAll = async () => {
    setLoading(true);
    const { data: dealers } = await supabase
      .from("dealers")
      .select("*, bills(*), cheques(*)")
      .order("name");
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

  const deleteSalesman = async (id) => {
    if (!window.confirm("Delete this salesman and all their data?")) return;
    await supabase.from("salesmen").delete().eq("id", id);
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

  const addCheque = async (dealerId) => {
    if (!newCheque.amount || !newCheque.cheque_date) return;
    setSaving(true);
    await supabase.from("cheques").insert({
      dealer_id: dealerId,
      amount: parseFloat(newCheque.amount),
      cheque_date: newCheque.cheque_date,
      bank_name: newCheque.bank_name || null,
      status: "pending"
    });
    setNewCheque({ amount: "", cheque_date: "", bank_name: "" });
    setShowAddCheque(null);
    setSaving(false);
    fetchAll();
  };

  const clearCheque = async (cheque, dealer) => {
    if (!window.confirm(`Mark cheque of ${fmt(cheque.amount)} as CLEARED? This will reduce the dealer's balance.`)) return;
    setSaving(true);
    await supabase.from("cheques").update({ status: "cleared" }).eq("id", cheque.id);
    const { data: payment } = await supabase.from("payments").insert({
      dealer_id: dealer.id,
      amount: cheque.amount,
      payment_date: new Date().toISOString().split("T")[0],
      note: ("Cheque cleared" + (cheque.bank_name ? " — " + cheque.bank_name : "")).trim()
    }).select().single();
    if (payment) {
      let remaining = Number(cheque.amount);
      const sorted = [...(dealer.bills || [])].filter(b => Number(b.balance) > 0).sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
      for (const bill of sorted) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, Number(bill.balance));
        await supabase.from("payment_allocations").insert({ payment_id: payment.id, bill_id: bill.id, amount_applied: apply });
        await supabase.from("bills").update({ balance: Number(bill.balance) - apply }).eq("id", bill.id);
        remaining -= apply;
      }
    }
    setSaving(false);
    fetchAll();
  };

  const bounceCheque = async (chequeId) => {
    setSaving(true);
    await supabase.from("cheques").update({ status: "bounced", bounce_note: bounceNote || null }).eq("id", chequeId);
    setShowBounceNote(null);
    setBounceNote("");
    setSaving(false);
    fetchAll();
  };

  const recordPayment = async (dealer) => {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) return;
    setSaving(true);
    const { data: payment } = await supabase.from("payments").insert({
      dealer_id: dealer.id, amount, payment_date: new Date().toISOString().split("T")[0]
    }).select().single();
    if (payment) {
      let remaining = amount;
      const sorted = [...(dealer.bills || [])].filter(b => Number(b.balance) > 0).sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
      for (const bill of sorted) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, Number(bill.balance));
        await supabase.from("payment_allocations").insert({ payment_id: payment.id, bill_id: bill.id, amount_applied: apply });
        await supabase.from("bills").update({ balance: Number(bill.balance) - apply }).eq("id", bill.id);
        remaining -= apply;
      }
    }
    setPayAmount("");
    setShowPayment(null);
    setSaving(false);
    fetchAll();
  };

  const card = { background: "#ffffff", border: "1px solid #e5e3f0", borderRadius: 10, boxShadow: "0 1px 4px rgba(100,90,150,0.06)" };
  const inp = { background: "#f4f3f8", border: "1px solid #dddbe8", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#2d2d3d", width: "100%" };
  const btnP = { padding: "7px 14px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "none", background: "#8b7ec8", color: "#ffffff", letterSpacing: "0.06em", cursor: "pointer" };
  const btnG = { padding: "7px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "1px solid #dddbe8", background: "#ffffff", color: "#666", cursor: "pointer" };
  const btnAmber = { padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 5, border: "1px solid #d4a820", background: "#fffbeb", color: "#92640a", cursor: "pointer" };
  const btnGreen = { padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 5, border: "1px solid #86c896", background: "#f0faf0", color: "#1a5c1a", cursor: "pointer" };
  const btnRed = { padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 5, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", cursor: "pointer" };

  const allDealers = data.flatMap(sm => sm.dealers);
  const grandTotal = allDealers.reduce((s, d) => s + totalBalance(d.bills), 0);
  const grandCheque = allDealers.reduce((s, d) => s + totalPendingCheques(d.cheques), 0);
  const chequeDealerCount = allDealers.filter(d => pendingCheques(d.cheques).length > 0).length;

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 4 }}>TOTAL OUTSTANDING</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 28, fontWeight: 500, color: "#a32d2d" }}>{fmt(grandTotal)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={fetchAll} style={btnG}>&#8635; Refresh</button>
          <button onClick={() => setShowAddSalesman(true)} style={btnP}>+ Salesman</button>
        </div>
      </div>

      {grandCheque > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🟡</span>
          <div>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#92640a", fontWeight: 600 }}>CHQ PENDING · {fmt(grandCheque)}</span>
            <span style={{ fontSize: 12, color: "#a07020", marginLeft: 8 }}>across {chequeDealerCount} dealer{chequeDealerCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      {showAddSalesman && (
        <div className="slide-in" style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, letterSpacing: "0.12em", color: "#8b7ec8", marginBottom: 10 }}>NEW SALESMAN</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: 2 }} placeholder="Name" value={newSalesman.name} onChange={e => setNewSalesman(n => ({ ...n, name: e.target.value }))} />
            <input style={{ ...inp, flex: 1 }} placeholder="Password" value={newSalesman.password} onChange={e => setNewSalesman(n => ({ ...n, password: e.target.value }))} />
            <button onClick={addSalesman} disabled={saving} style={btnP}>SAVE</button>
            <button onClick={() => setShowAddSalesman(false)} style={btnG}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#888" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#aaa" }}>🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dealer name..."
              style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #dddbe8", borderRadius: 8, fontSize: 14, background: "#ffffff", color: "#2d2d3d", outline: "none" }} />
            {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#aaa" }}>✕</button>}
          </div>

          {data.map((sm, i) => {
            const filteredDealers = sm.dealers.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));
            if (search && filteredDealers.length === 0) return null;
            const smTotal = filteredDealers.reduce((s, d) => s + totalBalance(d.bills), 0);
            const smCheque = filteredDealers.reduce((s, d) => s + totalPendingCheques(d.cheques), 0);
            const isOpen = expanded[sm.id] || !!search;

            return (
              <div key={sm.id} className="fade-in" style={{ ...card, overflow: "hidden", animationDelay: i * 40 + "ms" }}>
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", cursor: "pointer" }} onClick={() => toggle(sm.id)}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dddbe8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 500, color: "#4a3f6b", flexShrink: 0 }}>
                    {sm.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "#2d2d3d" }}>{sm.name}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {filteredDealers.length} dealer{filteredDealers.length !== 1 ? "s" : ""}
                      {smCheque > 0 && <span style={{ marginLeft: 8, color: "#92640a" }}>· 🟡 {fmt(smCheque)} CHQ</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: smTotal > 0 ? "#a32d2d" : "#2d6a2d" }}>{fmt(smTotal)}</div>
                  <span style={{ fontSize: 12, color: "#888" }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="slide-in" style={{ borderTop: "1px solid #e5e3f0" }}>
                    <div style={{ padding: "10px 16px", background: "#f8f7fc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#8b7ec8" }}>DEALERS</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setShowAddDealer(sm.id)} style={{ ...btnP, padding: "5px 10px", fontSize: 10 }}>+ Dealer</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteSalesman(sm.id); }} style={{ ...btnRed, padding: "5px 10px" }}>Delete</button>
                      </div>
                    </div>

                    {showAddDealer === sm.id && (
                      <div style={{ padding: "12px 16px", background: "#f0eef8", borderBottom: "1px solid #e5e3f0" }}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <input style={{ ...inp, flex: 2 }} placeholder="Dealer name" value={newDealer.name} onChange={e => setNewDealer(n => ({ ...n, name: e.target.value }))} />
                          <input style={{ ...inp, flex: 1 }} placeholder="Area (optional)" value={newDealer.area} onChange={e => setNewDealer(n => ({ ...n, area: e.target.value }))} />
                          <button onClick={() => addDealer(sm.id)} disabled={saving} style={btnP}>SAVE</button>
                          <button onClick={() => setShowAddDealer(null)} style={btnG}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {filteredDealers.map((dealer, di) => {
                      const bal = totalBalance(dealer.bills);
                      const bucket = worstBucket(dealer.bills);
                      const sc = bal > 0 ? stripColor(dealer.bills) : "#c8c4e0";
                      const isDealerOpen = expandedDealer[dealer.id];
                      const pending = pendingCheques(dealer.cheques || []);
                      const bounced = (dealer.cheques || []).filter(c => c.status === "bounced");

                      return (
                        <div key={dealer.id} style={{ borderBottom: di < filteredDealers.length - 1 ? "1px solid #f0eef8" : "none", borderLeft: "3px solid " + sc }}>
                          <div style={{ padding: "12px 16px 12px 20px", display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 500, color: "#2d2d3d" }}>{dealer.name}</div>
                              {dealer.area && <div style={{ fontSize: 11, color: "#888" }}>{dealer.area}</div>}

                              {pending.length > 0 && (
                                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                  {pending.map(c => (
                                    <div key={c.id}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <span style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#92640a", fontFamily: "'IBM Plex Mono'" }}>
                                          🟡 {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bank_name ? " · " + c.bank_name : ""}
                                        </span>
                                        <button onClick={() => clearCheque(c, dealer)} style={btnGreen} disabled={saving}>Cleared</button>
                                        <button onClick={() => setShowBounceNote(c.id)} style={btnRed}>Bounced</button>
                                      </div>
                                      {showBounceNote === c.id && (
                                        <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                          <input style={{ ...inp, flex: 1, fontSize: 12 }} placeholder="Bounce reason (optional)" value={bounceNote} onChange={e => setBounceNote(e.target.value)} />
                                          <button onClick={() => bounceCheque(c.id)} disabled={saving} style={btnRed}>CONFIRM</button>
                                          <button onClick={() => setShowBounceNote(null)} style={btnG}>✕</button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {bounced.length > 0 && (
                                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                                  {bounced.map(c => (
                                    <span key={c.id} style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#dc2626", fontFamily: "'IBM Plex Mono'" }}>
                                      ❌ BOUNCED · {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bounce_note ? " — " + c.bounce_note : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, fontWeight: 500, color: "#2d2d3d" }}>{fmt(bal)}</span>
                                {bal > 0 && <div><span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: bucket.bg, color: bucket.color, border: "1px solid " + bucket.border }}>{bucket.label}</span></div>}
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <button onClick={() => { setShowPayment(dealer.id); setShowAddBill(null); setShowAddCheque(null); }} style={{ ...btnP, padding: "4px 10px", fontSize: 10 }}>+ Payment</button>
                                <button onClick={() => { setShowAddCheque(dealer.id); setShowAddBill(null); setShowPayment(null); }} style={btnAmber}>+ Cheque</button>
                                <button onClick={() => { setShowAddBill(dealer.id); setShowAddCheque(null); setShowPayment(null); }} style={{ ...btnG, padding: "4px 8px", fontSize: 10 }}>+ Bill</button>
                                <button onClick={() => toggleDealer(dealer.id)} style={{ ...btnG, padding: "4px 8px", fontSize: 11 }}>
                                  {dealer.bills.length} bills {isDealerOpen ? "▲" : "▼"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {showPayment === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f0eef8", borderTop: "1px solid #e5e3f0" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#8b7ec8", marginBottom: 8 }}>RECORD PAYMENT (FIFO)</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount received" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                <button onClick={() => recordPayment(dealer)} disabled={saving} style={btnP}>CONFIRM</button>
                                <button onClick={() => setShowPayment(null)} style={btnG}>✕</button>
                              </div>
                              <div style={{ fontSize: 11, color: "#8b7ec8", marginTop: 6 }}>Applied to oldest bill first</div>
                            </div>
                          )}

                          {showAddCheque === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#fffbeb", borderTop: "1px solid #f0d860" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#92640a", marginBottom: 8 }}>LOG CHEQUE</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount" value={newCheque.amount} onChange={e => setNewCheque(n => ({ ...n, amount: e.target.value }))} />
                                <input type="date" style={{ ...inp, flex: 1 }} value={newCheque.cheque_date} onChange={e => setNewCheque(n => ({ ...n, cheque_date: e.target.value }))} />
                                <input style={{ ...inp, flex: 1 }} placeholder="Bank (optional)" value={newCheque.bank_name} onChange={e => setNewCheque(n => ({ ...n, bank_name: e.target.value }))} />
                                <button onClick={() => addCheque(dealer.id)} disabled={saving} style={btnP}>SAVE</button>
                                <button onClick={() => setShowAddCheque(null)} style={btnG}>✕</button>
                              </div>
                            </div>
                          )}

                          {showAddBill === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f0eef8", borderTop: "1px solid #e5e3f0" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#8b7ec8", marginBottom: 8 }}>ADD BILL</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <input style={{ ...inp, flex: 1 }} placeholder="Bill no." value={newBill.bill_no} onChange={e => setNewBill(n => ({ ...n, bill_no: e.target.value }))} />
                                <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount" value={newBill.amount} onChange={e => setNewBill(n => ({ ...n, amount: e.target.value }))} />
                                <input type="date" style={{ ...inp, flex: 1 }} value={newBill.bill_date} onChange={e => setNewBill(n => ({ ...n, bill_date: e.target.value }))} />
                                <button onClick={() => addBill(dealer.id)} disabled={saving} style={btnP}>SAVE</button>
                                <button onClick={() => setShowAddBill(null)} style={btnG}>✕</button>
                              </div>
                            </div>
                          )}

                          {isDealerOpen && dealer.bills.length > 0 && (
                            <div style={{ background: "#faf9fd" }}>
                              {dealer.bills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map((bill) => {
                                const days = ageDays(bill.bill_date);
                                const bkt = ageBucket(days);
                                return (
                                  <div key={bill.id} style={{ padding: "8px 16px 8px 36px", borderTop: "1px solid #f0eef8", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                    <div>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#4a3f6b" }}>{bill.bill_no}</span>
                                      <span style={{ fontSize: 11, color: "#888", marginLeft: 8 }}>{fmtDate(bill.bill_date)}</span>
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
