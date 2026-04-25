import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { fmt, fmtDate, ageDays, ageBucket, worstBucket, totalBalance, stripColor, pendingCheques, totalPendingCheques } from "../lib/helpers";
import { getBillPDFUrl } from "../lib/pdfStorage";
import { generateAgeingReport } from "../lib/ageingReport";
import { generateAgeingExcel } from "../lib/ageingExcel";

export default function SalesmanView({ salesman }) {
  const [dealers, setDealers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewingPDF, setViewingPDF] = useState(null);
  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyCollections, setMonthlyCollections] = useState(0);

  useEffect(() => { fetchDealers(); fetchMonthly(); }, [salesman.id]);

  const fetchDealers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("dealers")
      .select("*, bills(*), cheques(*)")
      .eq("salesman_id", salesman.id)
      .order("name");
    setDealers((data || []).map(d => ({
      ...d,
      bills: (d.bills || []).filter(b => Number(b.balance) > 0)
    })));
    setLoading(false);
  };

  const fetchMonthly = async () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Get all dealer ids for this salesman
    const { data: dealerIds } = await supabase
      .from("dealers")
      .select("id")
      .eq("salesman_id", salesman.id);

    if (!dealerIds || dealerIds.length === 0) return;
    const ids = dealerIds.map(d => d.id);

    // Bills raised this month
    const { data: bills } = await supabase
      .from("bills")
      .select("amount")
      .in("dealer_id", ids)
      .gte("bill_date", start)
      .lte("bill_date", end);

    // Payments received this month
    const { data: payments } = await supabase
      .from("payments")
      .select("amount")
      .in("dealer_id", ids)
      .gte("payment_date", start)
      .lte("payment_date", end);

    setMonthlySales((bills || []).reduce((s, b) => s + Number(b.amount), 0));
    setMonthlyCollections((payments || []).reduce((s, p) => s + Number(p.amount), 0));
  };

  const toggle = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const viewPDF = async (bill) => {
    if (!bill.pdf_path) return;
    try {
      const url = await getBillPDFUrl(bill.pdf_path);
      setViewingPDF({ url, bill_no: bill.bill_no });
    } catch { alert("Could not load PDF."); }
  };

  const totalOut = dealers.reduce((s, d) => s + totalBalance(d.bills), 0);
  const totalChq = dealers.reduce((s, d) => s + totalPendingCheques(d.cheques), 0);
  const b30  = dealers.reduce((s, d) => s + (d.bills||[]).filter(b => ageDays(b.bill_date) <= 30).reduce((x, b) => x + Number(b.balance), 0), 0);
  const b60  = dealers.reduce((s, d) => s + (d.bills||[]).filter(b => ageDays(b.bill_date) > 30 && ageDays(b.bill_date) <= 60).reduce((x, b) => x + Number(b.balance), 0), 0);
  const b60p = dealers.reduce((s, d) => s + (d.bills||[]).filter(b => ageDays(b.bill_date) > 60).reduce((x, b) => x + Number(b.balance), 0), 0);

  const now = new Date();
  const monthLabel = now.toLocaleString("en-IN", { month: "long", year: "numeric" });

  const card = { background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const visibleDealers = dealers.filter(d => totalBalance(d.bills) > 0 && d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in">

      {/* PDF Viewer Modal */}
      {viewingPDF && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1e1c2e", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#c8c4e0" }}>{viewingPDF.bill_no}</span>
            <button onClick={() => setViewingPDF(null)} style={{ padding: "6px 12px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "1px solid #444", background: "transparent", color: "#ccc", cursor: "pointer" }}>✕ Close</button>
          </div>
          <iframe src={viewingPDF.url} style={{ flex: 1, border: "none" }} title="Bill PDF" />
        </div>
      )}

      {/* Current month sales & collections */}
      <div style={{ ...card, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.14em", color: "#888", marginBottom: 10 }}>{monthLabel.toUpperCase()}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 4 }}>SALES</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 600, color: "#6b2f0a" }}>{fmt(monthlySales)}</div>
          </div>
          <div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 4 }}>COLLECTIONS</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 600, color: "#166534" }}>{fmt(monthlyCollections)}</div>
          </div>
        </div>
      </div>

      {/* Outstanding header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 4 }}>TOTAL OUTSTANDING</div>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 28, fontWeight: 500, color: totalOut > 0 ? "#8b1a1a" : "#166534" }}>{fmt(totalOut)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => generateAgeingReport(salesman.name, dealers)} style={{
            padding: "6px 12px", fontSize: 12, borderRadius: 4,
            border: "1px solid #e2e8f0", background: "#6b2f0a", color: "#ffffff",
            fontFamily: "'IBM Plex Mono'", letterSpacing: "0.08em"
          }}>⬇ PDF</button>
          <button onClick={() => generateAgeingExcel(salesman.name, dealers)} style={{
            padding: "6px 12px", fontSize: 12, borderRadius: 4,
            border: "1px solid #6b2f0a", background: "#ffffff", color: "#6b2f0a",
            fontFamily: "'IBM Plex Mono'", letterSpacing: "0.08em"
          }}>⬇ Excel</button>
          <button onClick={() => { fetchDealers(); fetchMonthly(); }} style={{ padding: "6px 12px", fontSize: 13, borderRadius: 4, border: "1px solid #e2e8f0", background: "#ffffff", color: "#888" }}>&#8635;</button>
        </div>
      </div>

      {/* Cheque float */}
      {totalChq > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🟡</span>
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: "#92640a", fontWeight: 600 }}>CHQ PENDING · {fmt(totalChq)}</span>
        </div>
      )}

      {/* Ageing buckets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[{ label: "0-30 DAYS", val: b30, color: "#166534" }, { label: "31-60 DAYS", val: b60, color: "#7a5200" }, { label: "60+ DAYS", val: b60p, color: "#8b1a1a" }].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: s.color }}>{fmt(s.val)}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 10 }}>DEALERS ({visibleDealers.length})</div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#aaa" }}>🔍</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dealer name..."
          style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, background: "#ffffff", color: "#6b2f0a", outline: "none" }} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 16, color: "#aaa" }}>✕</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#888" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleDealers.length === 0 && search ? (
            <div style={{ textAlign: "center", padding: 40, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#aaa" }}>No dealers matching "{search}"</div>
          ) : visibleDealers.map((dealer, i) => {
            const bal = totalBalance(dealer.bills);
            const bucket = worstBucket(dealer.bills);
            const sc = stripColor(dealer.bills);
            const isOpen = expanded[dealer.id];
            const pending = pendingCheques(dealer.cheques || []);
            const bounced = (dealer.cheques || []).filter(c => c.status === "bounced");

            return (
              <div key={dealer.id} className="fade-in" style={{ ...card, overflow: "hidden", borderLeft: "3px solid " + sc, animationDelay: i * 40 + "ms" }}>
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: "#6b2f0a", marginBottom: 2 }}>{dealer.name}</div>
                      {dealer.area && <div style={{ fontSize: 12, color: "#888" }}>{dealer.area}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 16, fontWeight: 500, color: "#6b2f0a" }}>{fmt(bal)}</div>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: bucket.bg, color: bucket.color, border: "1px solid " + bucket.border }}>{bucket.label}</span>
                    </div>
                  </div>

                  {pending.length > 0 && (
                    <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {pending.map(c => (
                        <span key={c.id} style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#92640a", fontFamily: "'IBM Plex Mono'", display: "inline-block" }}>
                          🟡 {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bank_name ? " · " + c.bank_name : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {bounced.length > 0 && (
                    <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {bounced.map(c => (
                        <span key={c.id} style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 4, padding: "2px 8px", fontSize: 11, color: "#dc2626", fontFamily: "'IBM Plex Mono'", display: "inline-block" }}>
                          ❌ BOUNCED · {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bounce_note ? " — " + c.bounce_note : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <button onClick={() => toggle(dealer.id)}
                    style={{ padding: "6px 12px", fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#6b2f0a" }}>
                    {dealer.bills.length} bill{dealer.bills.length !== 1 ? "s" : ""} {isOpen ? "▲" : "▼"}
                  </button>
                </div>

                {isOpen && (
                  <div className="slide-in" style={{ borderTop: "1px solid #e2e8f0" }}>
                    {dealer.bills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map((bill, idx) => {
                      const days = ageDays(bill.bill_date);
                      const bkt = ageBucket(days);
                      return (
                        <div key={bill.id} style={{ padding: "10px 16px 10px 40px", borderBottom: idx < dealer.bills.length - 1 ? "1px solid #f1f5f9" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafbfc", flexWrap: "wrap", gap: 6 }}>
                          <div>
                            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#6b2f0a" }}>
                              {bill.bill_no}
                              {bill.pdf_path && (
                                <button onClick={() => viewPDF(bill)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontSize: 13 }} title="View Bill PDF">📄</button>
                              )}
                            </div>
                            <div style={{ fontSize: 11, color: "#888" }}>{fmtDate(bill.bill_date)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 500, color: "#6b2f0a" }}>{fmt(bill.balance)}</span>
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
