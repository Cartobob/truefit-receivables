import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { fmt, fmtDate, totalBalance, worstBucket, ageDays, ageBucket, stripColor, pendingCheques, totalPendingCheques, paymentDot } from "../lib/helpers";
import { extractInvoiceFromPDF } from "../lib/extractInvoice";
import { uploadBillPDF, getBillPDFUrl, cleanupSettledBillPDFs } from "../lib/pdfStorage";
import { generateAgeingReport } from "../lib/ageingReport";
import { generateDealerStatement } from "../lib/dealerStatement";
import { AdminWeeklyLeaderboard } from "../lib/WeeklyStats";

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
  const [payMode, setPayMode] = useState("fifo");
  const [billAllocations, setBillAllocations] = useState({});
  const [showTransfer, setShowTransfer] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [showCreditNote, setShowCreditNote] = useState(null);
  const [newCreditNote, setNewCreditNote] = useState({ cn_no: "", amount: "", note: "", credit_date: "" });
  const [showStatement, setShowStatement] = useState(null);
  const [stmtRange, setStmtRange] = useState({ start: "", end: "" });
  const [editBillData, setEditBillData] = useState({});
  const [showBounceNote, setShowBounceNote] = useState(null);
  const [newSalesman, setNewSalesman] = useState({ name: "", password: "" });
  const [newDealer, setNewDealer] = useState({ name: "", area: "" });
  const [newBill, setNewBill] = useState({ bill_no: "", amount: "", bill_date: "" });
  const [pendingPDF, setPendingPDF] = useState(null);
  const [newCheque, setNewCheque] = useState({ amount: "", cheque_date: "", bank_name: "" });
  const [payAmount, setPayAmount] = useState("");
  const [bounceNote, setBounceNote] = useState("");
  const [viewingPDF, setViewingPDF] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => { fetchAll(); cleanupSettledBillPDFs(); }, [salesmen]);

  const fetchAll = async () => {
    setLoading(true);
    const { data: dealers } = await supabase.from("dealers").select("*, bills(*), cheques(*)").order("name");
    setData(salesmen.map(s => ({ ...s, dealers: (dealers || []).filter(d => d.salesman_id === s.id) })));
    setLoading(false);
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const toggleDealer = (id) => setExpandedDealer(e => ({ ...e, [id]: !e[id] }));

  const handlePDFSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingPDF({ file, extracting: true, error: null });
    setNewBill({ bill_no: "", amount: "", bill_date: "" });
    try {
      const fields = await extractInvoiceFromPDF(file);
      setNewBill({ bill_no: fields.bill_no || "", amount: fields.amount ? String(fields.amount) : "", bill_date: fields.bill_date || "" });
      setPendingPDF({ file, extracting: false, error: null });
    } catch (err) { setPendingPDF({ file, extracting: false, error: err.message }); }
  };

  const openAddBill = (dealerId) => {
    setShowAddBill(dealerId); setShowAddCheque(null); setShowPayment(null);
    setPendingPDF(null); setNewBill({ bill_no: "", amount: "", bill_date: "" });
  };

  const addSalesman = async () => {
    if (!newSalesman.name || !newSalesman.password) return;
    setSaving(true);
    await supabase.from("salesmen").insert(newSalesman);
    setNewSalesman({ name: "", password: "" }); setShowAddSalesman(false); setSaving(false); onRefresh();
  };

  const deleteSalesman = async (id) => {
    if (!window.confirm("Delete this salesman and all their data?")) return;
    await supabase.from("salesmen").delete().eq("id", id); onRefresh();
  };

  const addDealer = async (salesmanId) => {
    if (!newDealer.name) return;
    setSaving(true);
    await supabase.from("dealers").insert({ ...newDealer, salesman_id: salesmanId });
    setNewDealer({ name: "", area: "" }); setShowAddDealer(null); setSaving(false); fetchAll();
  };

  const addBill = async (dealerId) => {
    if (!newBill.bill_no || !newBill.amount || !newBill.bill_date) return;
    setSaving(true);
    try {
      const { data: inserted } = await supabase.from("bills").insert({
        bill_no: newBill.bill_no, amount: parseFloat(newBill.amount),
        balance: parseFloat(newBill.amount), bill_date: newBill.bill_date, dealer_id: dealerId
      }).select().single();
      if (inserted && pendingPDF?.file) {
        try {
          const pdfPath = await uploadBillPDF(pendingPDF.file, inserted.id);
          await supabase.from("bills").update({ pdf_path: pdfPath }).eq("id", inserted.id);
        } catch (err) { console.warn("PDF upload failed:", err); }
      }
      setNewBill({ bill_no: "", amount: "", bill_date: "" }); setPendingPDF(null); setShowAddBill(null);
    } finally { setSaving(false); fetchAll(); }
  };

  const markSettledIfDone = async (bill) => {
    if (Number(bill.balance) === 0 && !bill.settled_at)
      await supabase.from("bills").update({ settled_at: new Date().toISOString() }).eq("id", bill.id);
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
        const nb = Number(bill.balance) - apply;
        await supabase.from("bills").update({ balance: nb }).eq("id", bill.id);
        if (nb === 0) await markSettledIfDone({ ...bill, balance: nb });
        remaining -= apply;
      }
    }
    setPayAmount(""); setShowPayment(null); setSaving(false); fetchAll();
  };

  const recordManualPayment = async (dealer) => {
    const allocations = Object.entries(billAllocations).map(([id, amt]) => ({ id, amount: parseFloat(amt) || 0 })).filter(a => a.amount > 0);
    if (allocations.length === 0) return;
    const totalAmount = allocations.reduce((s, a) => s + a.amount, 0);
    setSaving(true);
    const { data: payment } = await supabase.from("payments").insert({
      dealer_id: dealer.id, amount: totalAmount, payment_date: new Date().toISOString().split("T")[0]
    }).select().single();
    if (payment) {
      for (const alloc of allocations) {
        const bill = dealer.bills.find(b => b.id === alloc.id);
        if (!bill) continue;
        const apply = Math.min(alloc.amount, Number(bill.balance));
        await supabase.from("payment_allocations").insert({ payment_id: payment.id, bill_id: bill.id, amount_applied: apply });
        const nb = Number(bill.balance) - apply;
        await supabase.from("bills").update({ balance: nb }).eq("id", bill.id);
        if (nb === 0) await markSettledIfDone({ ...bill, balance: nb });
      }
    }
    setBillAllocations({}); setShowPayment(null); setSaving(false); fetchAll();
  };

  const addCheque = async (dealerId) => {
    if (!newCheque.amount || !newCheque.cheque_date) return;
    setSaving(true);
    await supabase.from("cheques").insert({ dealer_id: dealerId, amount: parseFloat(newCheque.amount), cheque_date: newCheque.cheque_date, bank_name: newCheque.bank_name || null, status: "pending" });
    setNewCheque({ amount: "", cheque_date: "", bank_name: "" }); setShowAddCheque(null); setSaving(false); fetchAll();
  };

  const clearCheque = async (cheque, dealer) => {
    if (!window.confirm(`Mark cheque of ${fmt(cheque.amount)} as CLEARED?`)) return;
    setSaving(true);
    await supabase.from("cheques").update({ status: "cleared" }).eq("id", cheque.id);
    const { data: payment } = await supabase.from("payments").insert({
      dealer_id: dealer.id, amount: cheque.amount, payment_date: new Date().toISOString().split("T")[0],
      note: ("Cheque cleared" + (cheque.bank_name ? " — " + cheque.bank_name : "")).trim()
    }).select().single();
    if (payment) {
      let remaining = Number(cheque.amount);
      const sorted = [...(dealer.bills || [])].filter(b => Number(b.balance) > 0).sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
      for (const bill of sorted) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, Number(bill.balance));
        await supabase.from("payment_allocations").insert({ payment_id: payment.id, bill_id: bill.id, amount_applied: apply });
        const nb = Number(bill.balance) - apply;
        await supabase.from("bills").update({ balance: nb }).eq("id", bill.id);
        if (nb === 0) await markSettledIfDone({ ...bill, balance: nb });
        remaining -= apply;
      }
    }
    setSaving(false); fetchAll();
  };

  const bounceCheque = async (chequeId) => {
    setSaving(true);
    await supabase.from("cheques").update({ status: "bounced", bounce_note: bounceNote || null }).eq("id", chequeId);
    setShowBounceNote(null); setBounceNote(""); setSaving(false); fetchAll();
  };

  const transferDealer = async (dealerId, newSalesmanId) => {
    if (!newSalesmanId) return;
    setSaving(true);
    await supabase.from("dealers").update({ salesman_id: newSalesmanId }).eq("id", dealerId);
    setShowTransfer(null); setSaving(false); fetchAll();
  };

  const saveBill = async (billId) => {
    setSaving(true);
    await supabase.from("bills").update({
      bill_no: editBillData.bill_no, amount: parseFloat(editBillData.amount),
      balance: parseFloat(editBillData.balance), bill_date: editBillData.bill_date,
    }).eq("id", billId);
    setEditingBill(null); setEditBillData({}); setSaving(false); fetchAll();
  };

  const deleteBill = async (billId) => {
    if (!window.confirm("Delete this bill permanently?")) return;
    setSaving(true);
    await supabase.from("bills").delete().eq("id", billId);
    setSaving(false); fetchAll();
  };

  const addCreditNote = async (dealerId) => {
    if (!newCreditNote.amount || !newCreditNote.credit_date || !newCreditNote.cn_no) return;
    setSaving(true);
    await supabase.from("credit_notes").insert({
      dealer_id: dealerId,
      cn_no: newCreditNote.cn_no,
      amount: parseFloat(newCreditNote.amount),
      note: newCreditNote.note || null,
      credit_date: newCreditNote.credit_date
    });
    setNewCreditNote({ cn_no: "", amount: "", note: "", credit_date: "" });
    setShowCreditNote(null);
    setSaving(false);
    fetchAll();
  };

  const viewPDF = async (bill) => {
    if (!bill.pdf_path) return;
    try {
      const url = await getBillPDFUrl(bill.pdf_path);
      setViewingPDF({ url, bill_no: bill.bill_no });
    } catch { alert("Could not load PDF."); }
  };

  const card = { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const inp = { background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, padding: "9px 12px", fontSize: 16, color: "#334155", width: "100%" };
  const btnP = { padding: "7px 14px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 6, border: "none", background: "#334155", color: "#ffffff", letterSpacing: "0.06em", cursor: "pointer" };
  const btnG = { padding: "7px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 6, border: "1px solid #e2e8f0", background: "#ffffff", color: "#888", cursor: "pointer" };
  const btnAmber = { padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 5, border: "1px solid #d4a820", background: "#fffbeb", color: "#92640a", cursor: "pointer" };
  const btnGreen = { padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 5, border: "1px solid #86c896", background: "#f0faf0", color: "var(--olive)", cursor: "pointer" };
  const btnRed = { padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 5, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", cursor: "pointer" };

  const allDealers = data.flatMap(sm => sm.dealers);
  const grandTotal = allDealers.reduce((s, d) => s + totalBalance(d.bills), 0);
  const grandCheque = allDealers.reduce((s, d) => s + totalPendingCheques(d.cheques), 0);
  const chequeDealerCount = allDealers.filter(d => pendingCheques(d.cheques).length > 0).length;

  return (
    <div className="fade-in">

      {viewingPDF && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1e1c2e", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, color: "#e2e8f0" }}>{viewingPDF.bill_no}</span>
            <button onClick={() => setViewingPDF(null)} style={{ ...btnG, background: "transparent", border: "1px solid #444", color: "#ccc" }}>✕ Close</button>
          </div>
          <iframe src={viewingPDF.url} style={{ flex: 1, border: "none" }} title="Bill PDF" />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.12em", color: "#334155", marginBottom: 4 }}>TOTAL OUTSTANDING</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 30, fontWeight: 500, color: "#ea580c" }}>{fmt(grandTotal)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => generateAgeingReport("All Salesmen", allDealers)} style={{ padding: "7px 14px", fontFamily: "'IBM Plex Mono'", fontSize: 13, borderRadius: 6, border: "1px solid var(--border)", background: "#ffffff", color: "#334155", letterSpacing: "0.08em", cursor: "pointer" }}>⬇ Full Report</button>
          <button onClick={fetchAll} style={btnG}>&#8635; Refresh</button>
          <button onClick={() => setShowAddSalesman(true)} style={btnP}>+ Salesman</button>
        </div>
      </div>

      {grandCheque > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🟡</span>
          <div>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, color: "#92640a", fontWeight: 600 }}>CHQ PENDING · {fmt(grandCheque)}</span>
            <span style={{ fontSize: 14, color: "#a07020", marginLeft: 8 }}>across {chequeDealerCount} dealer{chequeDealerCount !== 1 ? "s" : ""}</span>
          </div>
        </div>
      )}

      <AdminWeeklyLeaderboard salesmen={salesmen} />

      {showAddSalesman && (
        <div className="slide-in" style={{ ...card, padding: 16, marginBottom: 16 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.12em", color: "#334155", marginBottom: 10 }}>NEW SALESMAN</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: 2 }} placeholder="Name" value={newSalesman.name} onChange={e => setNewSalesman(n => ({ ...n, name: e.target.value }))} />
            <input style={{ ...inp, flex: 1 }} placeholder="Password" value={newSalesman.password} onChange={e => setNewSalesman(n => ({ ...n, password: e.target.value }))} />
            <button onClick={addSalesman} disabled={saving} style={btnP}>SAVE</button>
            <button onClick={() => setShowAddSalesman(false)} style={btnG}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 14, color: "#888" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "#aaa" }}>🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dealer name..."
              style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #dddbe8", borderRadius: 10, fontSize: 16, background: "#ffffff", color: "#334155", outline: "none" }} />
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
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Mono'", fontSize: 14, fontWeight: 500, color: "#334155", flexShrink: 0 }}>
                    {sm.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 500, color: "#334155" }}>{sm.name}</div>
                    <div style={{ fontSize: 14, color: "#888" }}>
                      {filteredDealers.length} dealer{filteredDealers.length !== 1 ? "s" : ""}
                      {smCheque > 0 && <span style={{ marginLeft: 8, color: "#92640a" }}>· 🟡 {fmt(smCheque)} CHQ</span>}
                    </div>
                  </div>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: smTotal > 0 ? "#ea580c" : "#2d6a2d" }}>{fmt(smTotal)}</div>
                  <button onClick={(e) => { e.stopPropagation(); generateAgeingReport(sm.name, sm.dealers); }} style={{ padding: "4px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 4, border: "1px solid #e2e8f0", background: "#ffffff", color: "#888", cursor: "pointer" }}>⬇</button>
                  <span style={{ fontSize: 14, color: "#888" }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {isOpen && (
                  <div className="slide-in" style={{ borderTop: "1px solid #e5e3f0" }}>
                    <div style={{ padding: "10px 16px", background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.12em", color: "#334155" }}>DEALERS</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => setShowAddDealer(sm.id)} style={{ ...btnP, padding: "5px 10px", fontSize: 10 }}>+ Dealer</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteSalesman(sm.id); }} style={{ ...btnRed, padding: "5px 10px" }}>Delete</button>
                      </div>
                    </div>

                    {showAddDealer === sm.id && (
                      <div style={{ padding: "12px 16px", background: "#f8fafc", borderBottom: "1px solid #e5e3f0" }}>
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
                      const sc = bal > 0 ? stripColor(dealer.bills) : "#e2e8f0";
                      const isDealerOpen = expandedDealer[dealer.id];
                      const pending = pendingCheques(dealer.cheques || []);
                      const bounced = (dealer.cheques || []).filter(c => c.status === "bounced");
                      const dot = paymentDot(dealer.bills);

                      return (
                        <div key={dealer.id} style={{ borderBottom: di < filteredDealers.length - 1 ? "1px solid #f0eef8" : "none", borderLeft: "3px solid " + sc }}>
                          <div style={{ padding: "12px 16px 12px 20px", display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: dealer.area ? 2 : 0 }}>
                                <div style={{ width: 16, height: 16, borderRadius: "50%", background: dot.color, flexShrink: 0 }} title={dot.title} />
                                <div style={{ fontSize: 16, fontWeight: 500, color: "#334155" }}>{dealer.name}</div>
                              </div>
                              {dealer.area && <div style={{ fontSize: 14, color: "#888" }}>{dealer.area}</div>}

                              {pending.length > 0 && (
                                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                  {pending.map(c => (
                                    <div key={c.id}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        <span style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 6, padding: "2px 8px", fontSize: 14, color: "#92640a", fontFamily: "'IBM Plex Mono'" }}>
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
                                    <span key={c.id} style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 6, padding: "2px 8px", fontSize: 14, color: "#dc2626", fontFamily: "'IBM Plex Mono'" }}>
                                      ❌ BOUNCED · {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bounce_note ? " — " + c.bounce_note : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: "#334155" }}>{fmt(bal)}</span>
                                {bal > 0 && <div><span style={{ fontSize: 14, padding: "2px 7px", borderRadius: 6, background: bucket.bg, color: bucket.color, border: "1px solid " + bucket.border }}>{bucket.label}</span></div>}
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <button onClick={() => { setShowPayment(dealer.id); setShowAddBill(null); setShowAddCheque(null); setShowTransfer(null); setShowCreditNote(null); setShowStatement(null); }} style={{ ...btnP, padding: "4px 10px", fontSize: 10 }}>+ Payment</button>
                                <button onClick={() => { setShowAddCheque(dealer.id); setShowAddBill(null); setShowPayment(null); setShowTransfer(null); setShowCreditNote(null); setShowStatement(null); }} style={btnAmber}>+ Cheque</button>
                                <button onClick={() => { setShowCreditNote(dealer.id); setShowAddBill(null); setShowPayment(null); setShowAddCheque(null); setShowTransfer(null); setShowStatement(null); setNewCreditNote({ amount: "", note: "", credit_date: "" }); }} style={{ ...btnG, padding: "4px 8px", fontSize: 11, color: "#dc2626", borderColor: "#fecaca" }}>− Credit</button>
                                <button onClick={() => { setShowStatement(dealer.id); setShowAddBill(null); setShowPayment(null); setShowAddCheque(null); setShowTransfer(null); setShowCreditNote(null); const today = new Date().toISOString().split("T")[0]; const start = new Date(new Date().getFullYear(), 3, 1).toISOString().split("T")[0]; setStmtRange({ start, end: today }); }} style={{ ...btnG, padding: "4px 8px", fontSize: 10 }}>📄 Stmt</button>
                                <button onClick={() => { setShowTransfer(showTransfer === dealer.id ? null : dealer.id); setShowAddBill(null); setShowAddCheque(null); setShowPayment(null); setShowCreditNote(null); setShowStatement(null); }} style={{ ...btnG, padding: "4px 8px", fontSize: 10 }}>⇄ Transfer</button>
                                <button onClick={() => openAddBill(dealer.id)} style={{ ...btnG, padding: "4px 8px", fontSize: 10 }}>+ Bill</button>
                                <button onClick={() => toggleDealer(dealer.id)} style={{ ...btnG, padding: "4px 8px", fontSize: 11 }}>
                                  {dealer.bills.filter(b => Number(b.balance) > 0).length} bills {isDealerOpen ? "▲" : "▼"}
                                </button>
                              </div>
                            </div>
                          </div>

                          {showPayment === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f8fafc", borderTop: "1px solid #e5e3f0" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                                <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.1em", color: "#334155" }}>RECORD PAYMENT</div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {["fifo", "manual"].map(m => (
                                    <button key={m} onClick={() => setPayMode(m)} style={{
                                      padding: "3px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 4, border: "1px solid",
                                      background: payMode === m ? "#334155" : "#ffffff",
                                      borderColor: payMode === m ? "#334155" : "#e2e8f0",
                                      color: payMode === m ? "#ffffff" : "#888", cursor: "pointer"
                                    }}>{m === "fifo" ? "AUTO" : "MANUAL"}</button>
                                  ))}
                                </div>
                              </div>
                              {payMode === "fifo" ? (
                                <>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount received" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                                    <button onClick={() => recordPayment(dealer)} disabled={saving} style={btnP}>CONFIRM</button>
                                    <button onClick={() => setShowPayment(null)} style={btnG}>✕</button>
                                  </div>
                                  <div style={{ fontSize: 13, color: "#334155", marginTop: 6 }}>Applied to oldest bill first</div>
                                </>
                              ) : (
                                <>
                                  <div style={{ marginBottom: 8 }}>
                                    {dealer.bills.filter(b => Number(b.balance) > 0).sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map(bill => (
                                      <div key={bill.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <div style={{ flex: 1 }}>
                                          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#334155" }}>{bill.bill_no}</div>
                                          <div style={{ fontSize: 12, color: "#888" }}>Balance: {fmt(bill.balance)}</div>
                                        </div>
                                        <input type="number" placeholder="0" style={{ ...inp, width: 110, fontSize: 13 }}
                                          value={billAllocations[bill.id] || ""}
                                          onChange={e => setBillAllocations(a => ({ ...a, [bill.id]: e.target.value }))} />
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "1px solid #e2e8f0" }}>
                                    <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#334155" }}>
                                      TOTAL: {fmt(Object.values(billAllocations).reduce((s, v) => s + (parseFloat(v) || 0), 0))}
                                    </div>
                                    <div style={{ display: "flex", gap: 8 }}>
                                      <button onClick={() => recordManualPayment(dealer)} disabled={saving} style={btnP}>CONFIRM</button>
                                      <button onClick={() => { setShowPayment(null); setBillAllocations({}); }} style={btnG}>✕</button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}

                          {showAddCheque === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#fffbeb", borderTop: "1px solid #f0d860" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.1em", color: "#92640a", marginBottom: 8 }}>LOG CHEQUE</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount" value={newCheque.amount} onChange={e => setNewCheque(n => ({ ...n, amount: e.target.value }))} />
                                <input type="date" style={{ ...inp, flex: 1 }} value={newCheque.cheque_date} onChange={e => setNewCheque(n => ({ ...n, cheque_date: e.target.value }))} />
                                <input style={{ ...inp, flex: 1 }} placeholder="Bank (optional)" value={newCheque.bank_name} onChange={e => setNewCheque(n => ({ ...n, bank_name: e.target.value }))} />
                                <button onClick={() => addCheque(dealer.id)} disabled={saving} style={btnP}>SAVE</button>
                                <button onClick={() => setShowAddCheque(null)} style={btnG}>✕</button>
                              </div>
                            </div>
                          )}

                          {showTransfer === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f0f7ff", borderTop: "1px solid #e2e8f0" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.1em", color: "#1d4ed8", marginBottom: 8 }}>TRANSFER TO SALESMAN</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <select id={`transfer-${dealer.id}`} style={{ ...inp, flex: 1 }} defaultValue="">
                                  <option value="">— Select salesman —</option>
                                  {salesmen.filter(s => !data.find(d => d.id === s.id && d.dealers.find(dl => dl.id === dealer.id))).map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                                <button disabled={saving} style={{ ...btnP, background: "#1d4ed8" }}
                                  onClick={() => { const sel = document.getElementById(`transfer-${dealer.id}`); if (sel?.value) transferDealer(dealer.id, sel.value); }}>MOVE</button>
                                <button onClick={() => setShowTransfer(null)} style={btnG}>✕</button>
                              </div>
                            </div>
                          )}

                          {showCreditNote === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#fff5f5", borderTop: "1px solid #fecaca" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.1em", color: "#dc2626", marginBottom: 8 }}>ADD CREDIT NOTE</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <input style={{ padding: "9px 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 15, background: "#ffffff", color: "#111", width: "100%" }} placeholder="Credit Note No. (e.g. CN/26-27/001)" value={newCreditNote.cn_no} onChange={e => setNewCreditNote(n => ({ ...n, cn_no: e.target.value }))} />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <input type="number" style={{ flex: 1, padding: "9px 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 15, background: "#ffffff", color: "#111" }} placeholder="Amount" value={newCreditNote.amount} onChange={e => setNewCreditNote(n => ({ ...n, amount: e.target.value }))} />
                                  <input type="date" style={{ flex: 1, padding: "9px 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 15, background: "#ffffff", color: "#111" }} value={newCreditNote.credit_date} onChange={e => setNewCreditNote(n => ({ ...n, credit_date: e.target.value }))} />
                                </div>
                                <input style={{ padding: "9px 12px", border: "1px solid #fecaca", borderRadius: 6, fontSize: 15, background: "#ffffff", color: "#111", width: "100%" }} placeholder="Reason (e.g. return, discount)" value={newCreditNote.note} onChange={e => setNewCreditNote(n => ({ ...n, note: e.target.value }))} />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => addCreditNote(dealer.id)} disabled={saving} style={{ padding: "7px 14px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 6, border: "none", background: "#dc2626", color: "#ffffff", flex: 1, cursor: "pointer" }}>SAVE</button>
                                  <button onClick={() => setShowCreditNote(null)} style={{ padding: "7px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 14, borderRadius: 6, border: "1px solid #e2e8f0", background: "#ffffff", color: "#888", cursor: "pointer" }}>✕</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {showStatement === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f0fdf4", borderTop: "1px solid #86efac" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.1em", color: "#166534", marginBottom: 8 }}>DEALER STATEMENT</div>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "#888", marginBottom: 3 }}>FROM</div>
                                  <input type="date" style={inp} value={stmtRange.start} onChange={e => setStmtRange(r => ({ ...r, start: e.target.value }))} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: "#888", marginBottom: 3 }}>TO</div>
                                  <input type="date" style={inp} value={stmtRange.end} onChange={e => setStmtRange(r => ({ ...r, end: e.target.value }))} />
                                </div>
                                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                                  <button onClick={() => generateDealerStatement(dealer, stmtRange.start, stmtRange.end)} style={{ ...btnP, background: "#166534" }}>⬇ SAVE AS PDF</button>
                                  <button onClick={() => setShowStatement(null)} style={btnG}>✕</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {showAddBill === dealer.id && (
                            <div style={{ padding: "12px 16px 12px 20px", background: "#f8fafc", borderTop: "1px solid #e5e3f0" }}>
                              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, letterSpacing: "0.1em", color: "#334155", marginBottom: 10 }}>ADD BILL</div>
                              <div onClick={() => fileInputRef.current?.click()} style={{ border: "2px dashed #c8c4e0", borderRadius: 10, padding: "14px", textAlign: "center", cursor: "pointer", background: pendingPDF?.file ? "#f8fafc" : "#ffffff", marginBottom: 10 }}>
                                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePDFSelect} />
                                {!pendingPDF && <div style={{ fontSize: 14, color: "#888" }}>📄 Upload Tally Invoice PDF to auto-fill fields</div>}
                                {pendingPDF?.extracting && <div style={{ fontSize: 14, color: "#334155", fontFamily: "'IBM Plex Mono'" }}>⏳ Extracting fields...</div>}
                                {pendingPDF?.file && !pendingPDF.extracting && (
                                  <div style={{ fontSize: 14, color: "#334155" }}>
                                    📄 {pendingPDF.file.name}
                                    {pendingPDF.error && <div style={{ color: "#dc2626", marginTop: 4 }}>{pendingPDF.error}</div>}
                                    {!pendingPDF.error && <div style={{ color: "#2d6a2d", marginTop: 2 }}>✓ Fields extracted — check and save</div>}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <input style={inp} placeholder="Bill no." value={newBill.bill_no} onChange={e => setNewBill(n => ({ ...n, bill_no: e.target.value }))} />
                                <input type="number" style={inp} placeholder="Amount" value={newBill.amount} onChange={e => setNewBill(n => ({ ...n, amount: e.target.value }))} />
                                <input type="date" style={inp} value={newBill.bill_date} onChange={e => setNewBill(n => ({ ...n, bill_date: e.target.value }))} />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button onClick={() => addBill(dealer.id)} disabled={saving || pendingPDF?.extracting} style={{ ...btnP, flex: 1 }}>SAVE</button>
                                  <button onClick={() => { setShowAddBill(null); setPendingPDF(null); }} style={btnG}>✕</button>
                                </div>
                              </div>
                            </div>
                          )}

                          {isDealerOpen && dealer.bills.length > 0 && (
                            <div style={{ background: "#ffffff" }}>
                              {dealer.bills.filter(b => Number(b.balance) > 0).sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map((bill) => {
                                const days = ageDays(bill.bill_date);
                                const bkt = ageBucket(days);
                                const isEditing = editingBill === bill.id;

                                if (isEditing) return (
                                  <div key={bill.id} style={{ padding: "10px 16px 10px 36px", borderTop: "1px solid #f0eef8", background: "#fdf0e8" }}>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <input style={{ ...inp, flex: 2, fontSize: 12 }} placeholder="Bill no." value={editBillData.bill_no || ""} onChange={e => setEditBillData(d => ({ ...d, bill_no: e.target.value }))} />
                                        <input type="date" style={{ ...inp, flex: 1, fontSize: 12 }} value={editBillData.bill_date || ""} onChange={e => setEditBillData(d => ({ ...d, bill_date: e.target.value }))} />
                                      </div>
                                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        <input type="number" style={{ ...inp, flex: 1, fontSize: 12 }} placeholder="Amount" value={editBillData.amount || ""} onChange={e => setEditBillData(d => ({ ...d, amount: e.target.value }))} />
                                        <input type="number" style={{ ...inp, flex: 1, fontSize: 12 }} placeholder="Balance" value={editBillData.balance || ""} onChange={e => setEditBillData(d => ({ ...d, balance: e.target.value }))} />
                                      </div>
                                      <div style={{ display: "flex", gap: 6 }}>
                                        <button onClick={() => saveBill(bill.id)} disabled={saving} style={{ ...btnP, flex: 1, fontSize: 11 }}>SAVE</button>
                                        <button onClick={() => deleteBill(bill.id)} disabled={saving} style={{ ...btnRed, fontSize: 11 }}>DELETE</button>
                                        <button onClick={() => { setEditingBill(null); setEditBillData({}); }} style={{ ...btnG, fontSize: 11 }}>✕</button>
                                      </div>
                                    </div>
                                  </div>
                                );

                                return (
                                  <div key={bill.id} style={{ padding: "8px 16px 8px 36px", borderTop: "1px solid #f0eef8", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                    <div>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, color: "#334155" }}>{bill.bill_no}</span>
                                      <span style={{ fontSize: 14, color: "#888", marginLeft: 8 }}>{fmtDate(bill.bill_date)}</span>
                                      {bill.pdf_path && <button onClick={() => viewPDF(bill)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontSize: 13 }} title="View PDF">📄</button>}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>Bal: {fmt(bill.balance)}</span>
                                      <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 14, color: "#888" }}>/ {fmt(bill.amount)}</span>
                                      <span style={{ fontSize: 14, padding: "2px 7px", borderRadius: 6, background: bkt.bg, color: bkt.color, border: "1px solid " + bkt.border }}>{days}d</span>
                                      <button onClick={() => { setEditingBill(bill.id); setEditBillData({ bill_no: bill.bill_no, amount: bill.amount, balance: bill.balance, bill_date: bill.bill_date }); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#888" }} title="Edit bill">✏️</button>
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
