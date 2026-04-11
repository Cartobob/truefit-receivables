import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { fmt, fmtDate, ageDays, ageBucket, worstBucket, totalBalance, stripColor, pendingCheques, totalPendingCheques } from "../lib/helpers";
import { getBillPDFUrl } from "../lib/pdfStorage";
import { generateAgeingReport } from "../lib/ageingReport";

export default function SalesmanView({ salesman }) {
  const [dealers, setDealers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewingPDF, setViewingPDF] = useState(null);

  useEffect(() => { fetchDealers(); }, [salesman.id]);

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

  const card = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "0 2px 12px rgba(28,22,18,0.06)" };
  const visibleDealers = dealers.filter(d => totalBalance(d.bills) > 0 && d.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in">

      {/* PDF Viewer Modal */}
      {viewingPDF && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "#1e1c2e", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "var(--border)" }}>{viewingPDF.bill_no}</span>
            <button onClick={() => setViewingPDF(null)} style={{ padding: "6px 12px", fontFamily: "'DM Mono'", fontSize: 13, borderRadius: 4, border: "1px solid #444", background: "transparent", color: "#ccc", cursor: "pointer" }}>✕ Close</button>
          </div>
          <iframe src={viewingPDF.url} style={{ flex: 1, border: "none" }} title="Bill PDF" />
        </div>
      )}

      {/* Outstanding header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono'", fontSize: 13, letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 4 }}>TOTAL OUTSTANDING</div>
          <div style={{ fontFamily: "'DM Mono'", fontSize: 28, fontWeight: 500, color: totalOut > 0 ? "#a32d2d" : "#2d6a2d" }}>{fmt(totalOut)}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => generateAgeingReport(salesman.name, dealers)} style={{
            padding: "6px 12px", fontSize: 12, borderRadius: 4,
            border: "1px solid var(--border)", background: "var(--ink)", color: "var(--paper)",
            fontFamily: "'DM Mono'", letterSpacing: "0.08em"
          }}>⬇ Report</button>
          <button onClick={fetchDealers} style={{ padding: "6px 12px", fontSize: 13, borderRadius: 4, border: "1px solid #dddbe8", background: "#ffffff", color: "var(--mid)" }}>&#8635;</button>
        </div>
      </div>

      {/* Cheque float */}
      {totalChq > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <span>🟡</span>
          <span style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "#92640a", fontWeight: 600 }}>CHQ PENDING · {fmt(totalChq)}</span>
        </div>
      )}

      {/* Ageing buckets */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[{ label: "0-30 DAYS", val: b30, color: "#2d6a2d" }, { label: "31-60 DAYS", val: b60, color: "#7a4500" }, { label: "60+ DAYS", val: b60p, color: "#a32d2d" }].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 14px" }}>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 13, letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 17, fontWeight: 500, color: s.color }}>{fmt(s.val)}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: "'DM Mono'", fontSize: 13, letterSpacing: "0.12em", color: "var(--accent)", marginBottom: 10 }}>DEALERS ({visibleDealers.length})</div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 17, color: "#aaa" }}>🔍</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dealer name..."
          style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #dddbe8", borderRadius: 8, fontSize: 17, background: "#ffffff", color: "var(--ink)", outline: "none" }} />
        {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 17, color: "#aaa" }}>✕</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'DM Mono'", fontSize: 13, color: "var(--mid)" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleDealers.length === 0 && search ? (
            <div style={{ textAlign: "center", padding: 40, fontFamily: "'DM Mono'", fontSize: 13, color: "#aaa" }}>No dealers matching "{search}"</div>
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
                      <div style={{ fontSize: 17, fontWeight: 500, color: "var(--ink)", marginBottom: 2 }}>{dealer.name}</div>
                      {dealer.area && <div style={{ fontSize: 13, color: "var(--mid)" }}>{dealer.area}</div>}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Mono'", fontSize: 17, fontWeight: 500, color: "var(--ink)" }}>{fmt(bal)}</div>
                      <span style={{ fontSize: 13, padding: "2px 8px", borderRadius: 4, background: bucket.bg, color: bucket.color, border: "1px solid " + bucket.border }}>{bucket.label}</span>
                    </div>
                  </div>

                  {/* Pending cheques — read only */}
                  {pending.length > 0 && (
                    <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {pending.map(c => (
                        <span key={c.id} style={{ background: "#fffbeb", border: "1px solid #d4a820", borderRadius: 4, padding: "2px 8px", fontSize: 13, color: "#92640a", fontFamily: "'DM Mono'", display: "inline-block" }}>
                          🟡 {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bank_name ? " · " + c.bank_name : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Bounced cheques — read only */}
                  {bounced.length > 0 && (
                    <div style={{ marginBottom: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                      {bounced.map(c => (
                        <span key={c.id} style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 4, padding: "2px 8px", fontSize: 13, color: "#dc2626", fontFamily: "'DM Mono'", display: "inline-block" }}>
                          ❌ BOUNCED · {fmt(c.amount)} · {fmtDate(c.cheque_date)}{c.bounce_note ? " — " + c.bounce_note : ""}
                        </span>
                      ))}
                    </div>
                  )}

                  <button onClick={() => toggle(dealer.id)}
                    style={{ padding: "6px 12px", fontSize: 13, borderRadius: 4, border: "1px solid #dddbe8", background: "var(--paper)", color: "var(--ink)" }}>
                    {dealer.bills.length} bill{dealer.bills.length !== 1 ? "s" : ""} {isOpen ? "▲" : "▼"}
                  </button>
                </div>

                {isOpen && (
                  <div className="slide-in" style={{ borderTop: "1px solid #e5e3f0" }}>
                    {dealer.bills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date)).map((bill, idx) => {
                      const days = ageDays(bill.bill_date);
                      const bkt = ageBucket(days);
                      return (
                        <div key={bill.id} style={{ padding: "10px 16px 10px 40px", borderBottom: idx < dealer.bills.length - 1 ? "1px solid #f0eef8" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--card)", flexWrap: "wrap", gap: 6 }}>
                          <div>
                            <div style={{ fontFamily: "'DM Mono'", fontSize: 13, color: "var(--ink)" }}>
                              {bill.bill_no}
                              {bill.pdf_path && (
                                <button onClick={() => viewPDF(bill)} style={{ marginLeft: 8, background: "none", border: "none", cursor: "pointer", fontSize: 13 }} title="View Bill PDF">📄</button>
                              )}
                            </div>
                            <div style={{ fontSize: 13, color: "var(--mid)" }}>{fmtDate(bill.bill_date)}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "'DM Mono'", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{fmt(bill.balance)}</span>
                            <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 4, background: bkt.bg, color: bkt.color, border: "1px solid " + bkt.border }}>{days}d</span>
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
