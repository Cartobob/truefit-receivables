import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const fmt = (n) => "Rs." + Number(n).toLocaleString("en-IN");
const fmtShort = (n) => {
  if (Math.abs(n) >= 100000) return "Rs." + (n / 100000).toFixed(1) + "L";
  if (Math.abs(n) >= 1000) return "Rs." + (n / 1000).toFixed(1) + "K";
  return "Rs." + Number(n).toLocaleString("en-IN");
};

const monthStart = (d) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
const monthEnd = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
const monthLabel = (d) => d.toLocaleString("en-IN", { month: "long", year: "numeric" });

export default function ProfitabilityView({ salesmen }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSalary, setShowSalary] = useState(null);
  const [showExpense, setShowExpense] = useState(null);
  const [salaryAmt, setSalaryAmt] = useState("");
  const [expenseAmt, setExpenseAmt] = useState("");
  const [expenseNote, setExpenseNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, [salesmen, selectedMonth]);

  const fetchData = async () => {
    setLoading(true);
    const start = monthStart(selectedMonth);
    const end = monthEnd(selectedMonth);

    // Bills raised this month (sales)
    const { data: allDealers } = await supabase
      .from("dealers")
      .select("id, salesman_id");

    const dealerToSalesman = {};
    (allDealers || []).forEach(d => { dealerToSalesman[d.id] = d.salesman_id; });

    const { data: bills } = await supabase
      .from("bills")
      .select("dealer_id, amount, bill_date")
      .gte("bill_date", start).lte("bill_date", end);

    // Payments received this month (collections)
    const { data: payments } = await supabase
      .from("payments")
      .select("dealer_id, amount, payment_date")
      .gte("payment_date", start).lte("payment_date", end);

    // Salary this month
    const { data: salaries } = await supabase
      .from("salesman_salary")
      .select("*")
      .eq("month", start);

    // Expenses this month
    const { data: expenses } = await supabase
      .from("salesman_expenses")
      .select("*")
      .gte("expense_date", start).lte("expense_date", end);

    // Combine per salesman
    const rows = salesmen.map(sm => {
      const smBills    = (bills    || []).filter(b => dealerToSalesman[b.dealer_id] === sm.id);
      const smPayments = (payments || []).filter(p => dealerToSalesman[p.dealer_id] === sm.id);
      const smSalary   = (salaries || []).find(s => s.salesman_id === sm.id);
      const smExpenses = (expenses || []).filter(e => e.salesman_id === sm.id);

      const sales       = smBills.reduce((s, b) => s + Number(b.amount), 0);
      const collections = smPayments.reduce((s, p) => s + Number(p.amount), 0);
      const salary      = smSalary ? Number(smSalary.amount) : 0;
      const expTotal    = smExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const totalCost   = salary + expTotal;
      const net         = collections - totalCost;

      return { sm, sales, collections, salary, expTotal, totalCost, net, smExpenses, salaryId: smSalary?.id };
    });

    setData(rows);
    setLoading(false);
  };

  const saveSalary = async (smId) => {
    if (!salaryAmt) return;
    setSaving(true);
    const start = monthStart(selectedMonth);
    await supabase.from("salesman_salary").upsert({
      salesman_id: smId, month: start, amount: parseFloat(salaryAmt)
    }, { onConflict: "salesman_id,month" });
    setSalaryAmt(""); setShowSalary(null); setSaving(false); fetchData();
  };

  const saveExpense = async (smId) => {
    if (!expenseAmt) return;
    setSaving(true);
    await supabase.from("salesman_expenses").insert({
      salesman_id: smId,
      amount: parseFloat(expenseAmt),
      note: expenseNote || null,
      expense_date: new Date().toISOString().split("T")[0]
    });
    setExpenseAmt(""); setExpenseNote(""); setShowExpense(null); setSaving(false); fetchData();
  };

  const deleteExpense = async (id) => {
    await supabase.from("salesman_expenses").delete().eq("id", id);
    fetchData();
  };

  const changeMonth = (delta) => {
    const d = new Date(selectedMonth);
    d.setMonth(d.getMonth() + delta);
    setSelectedMonth(d);
  };

  // Download CSV
  const downloadCSV = () => {
    const rows = [
      ["Salesman", "Sales", "Collections", "Salary", "Expenses", "Total Cost", "Net"],
      ...data.map(r => [r.sm.name, r.sales, r.collections, r.salary, r.expTotal, r.totalCost, r.net]),
      ["TOTAL",
        data.reduce((s, r) => s + r.sales, 0),
        data.reduce((s, r) => s + r.collections, 0),
        data.reduce((s, r) => s + r.salary, 0),
        data.reduce((s, r) => s + r.expTotal, 0),
        data.reduce((s, r) => s + r.totalCost, 0),
        data.reduce((s, r) => s + r.net, 0),
      ]
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Truefit_${monthLabel(selectedMonth).replace(" ", "_")}_Summary.csv`;
    a.click();
  };

  // Download PDF
  const downloadPDF = () => {
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const totalSales = data.reduce((s, r) => s + r.sales, 0);
    const totalColl  = data.reduce((s, r) => s + r.collections, 0);
    const totalCost  = data.reduce((s, r) => s + r.totalCost, 0);
    const totalNet   = data.reduce((s, r) => s + r.net, 0);

    const rows = data.map(r => `
      <tr>
        <td style="padding:8px 12px;font-weight:500;">${r.sm.name}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(r.sales)}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(r.collections)}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(r.salary)}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(r.expTotal)}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(r.totalCost)}</td>
        <td style="padding:8px 12px;text-align:right;font-weight:600;color:${r.net >= 0 ? '#166534' : '#8b1a1a'}">${fmt(r.net)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Monthly Summary — ${monthLabel(selectedMonth)}</title>
<style>
  body { font-family: 'IBM Plex Sans', sans-serif; padding: 32px 40px; color: #111; }
  @media print { @page { margin: 16mm; size: A4 landscape; } }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; }
  th { background: #f0f2f5; padding: 8px 12px; text-align: right; font-size: 11px; letter-spacing: 0.08em; color: #666; font-weight: 500; }
  th:first-child { text-align: left; }
  td { border-bottom: 1px solid #e2e8f0; font-size: 13px; }
  .total td { background: #fdf0e8; font-weight: 600; border-top: 2px solid #6b2f0a; }
</style>
</head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #6b2f0a;padding-bottom:12px;margin-bottom:8px;">
    <div>
      <div style="font-family:'IBM Plex Mono';font-size:13px;letter-spacing:0.2em;color:#6b2f0a;margin-bottom:4px;">TRUEFIT SKIM COAT PRODUCTS</div>
      <div style="font-size:22px;font-weight:600;">Monthly Summary — ${monthLabel(selectedMonth)}</div>
    </div>
    <div style="font-family:'IBM Plex Mono';font-size:11px;color:#888;">Generated ${today}</div>
  </div>
  <table>
    <thead><tr>
      <th style="text-align:left;">SALESMAN</th>
      <th>SALES</th><th>COLLECTIONS</th><th>SALARY</th><th>EXPENSES</th><th>TOTAL COST</th><th>NET</th>
    </tr></thead>
    <tbody>
      ${rows}
      <tr class="total">
        <td style="padding:8px 12px;">TOTAL</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(totalSales)}</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(totalColl)}</td>
        <td style="padding:8px 12px;text-align:right;">—</td>
        <td style="padding:8px 12px;text-align:right;">—</td>
        <td style="padding:8px 12px;text-align:right;">${fmt(totalCost)}</td>
        <td style="padding:8px 12px;text-align:right;color:${totalNet >= 0 ? '#166534' : '#8b1a1a'}">${fmt(totalNet)}</td>
      </tr>
    </tbody>
  </table>
</body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  const inp = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "9px 12px", fontSize: 14, color: "#6b2f0a", width: "100%", fontFamily: "'IBM Plex Sans'" };
  const btnP = { padding: "7px 14px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "none", background: "#6b2f0a", color: "#ffffff", letterSpacing: "0.08em", cursor: "pointer" };
  const btnG = { padding: "7px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0", background: "#ffffff", color: "#888", cursor: "pointer" };
  const btnAmber = { padding: "5px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 5, border: "1px solid #d4a820", background: "#fffbeb", color: "#92640a", cursor: "pointer" };
  const btnRed = { padding: "5px 10px", fontFamily: "'IBM Plex Mono'", fontSize: 10, borderRadius: 5, border: "1px solid #fecaca", background: "#fff5f5", color: "#dc2626", cursor: "pointer" };

  const totalSales = data.reduce((s, r) => s + r.sales, 0);
  const totalColl  = data.reduce((s, r) => s + r.collections, 0);
  const totalNet   = data.reduce((s, r) => s + r.net, 0);

  return (
    <div className="fade-in">

      {/* Month selector + downloads */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => changeMonth(-1)} style={btnG}>◀</button>
          <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, fontWeight: 500, color: "#6b2f0a", minWidth: 140, textAlign: "center" }}>{monthLabel(selectedMonth)}</span>
          <button onClick={() => changeMonth(1)} style={btnG}>▶</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadCSV} style={{ ...btnG, fontSize: 12 }}>⬇ CSV</button>
          <button onClick={downloadPDF} style={{ ...btnP, fontSize: 11 }}>⬇ PDF</button>
        </div>
      </div>

      {/* Summary totals */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { label: "TOTAL SALES", val: totalSales, color: "#6b2f0a" },
          { label: "COLLECTIONS", val: totalColl, color: "#166534" },
          { label: "NET P&L", val: totalNet, color: totalNet >= 0 ? "#166534" : "#8b1a1a" },
        ].map(s => (
          <div key={s.label} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.12em", color: "#888", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 18, fontWeight: 500, color: s.color }}>{fmtShort(s.val)}</div>
          </div>
        ))}
      </div>

      {/* Per salesman cards */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, fontFamily: "'IBM Plex Mono'", fontSize: 12, color: "#888" }}>LOADING...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {data.map(({ sm, sales, collections, salary, expTotal, totalCost, net, smExpenses }) => (
            <div key={sm.id} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", borderLeft: `3px solid ${net >= 0 ? '#6b2f0a' : '#dc2626'}` }}>

              {/* Salesman header */}
              <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#6b2f0a", marginBottom: 8 }}>{sm.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px" }}>
                    {[
                      { label: "Sales", val: sales },
                      { label: "Collections", val: collections },
                      { label: "Salary", val: salary },
                      { label: "Expenses", val: expTotal },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888" }}>{label.toUpperCase()} </span>
                        <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 13, color: "#6b2f0a" }}>{fmt(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#888", marginBottom: 4 }}>NET</div>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 22, fontWeight: 600, color: net >= 0 ? "#166534" : "#8b1a1a" }}>{fmt(net)}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, color: net >= 0 ? "#166534" : "#8b1a1a" }}>{net >= 0 ? "▲ PROFITABLE" : "▼ LOSS"}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ padding: "0 16px 12px", display: "flex", gap: 8 }}>
                <button onClick={() => { setShowSalary(sm.id); setShowExpense(null); setSalaryAmt(salary ? String(salary) : ""); }} style={btnP}>+ Salary</button>
                <button onClick={() => { setShowExpense(sm.id); setShowSalary(null); }} style={btnAmber}>+ Expense</button>
              </div>

              {/* Salary form */}
              {showSalary === sm.id && (
                <div style={{ padding: "12px 16px", background: "#fdf0e8", borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#6b2f0a", marginBottom: 8 }}>SALARY FOR {monthLabel(selectedMonth).toUpperCase()}</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="number" style={{ ...inp, flex: 1 }} placeholder="Amount" value={salaryAmt} onChange={e => setSalaryAmt(e.target.value)} />
                    <button onClick={() => saveSalary(sm.id)} disabled={saving} style={btnP}>SAVE</button>
                    <button onClick={() => setShowSalary(null)} style={btnG}>✕</button>
                  </div>
                </div>
              )}

              {/* Expense form */}
              {showExpense === sm.id && (
                <div style={{ padding: "12px 16px", background: "#fffbeb", borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 9, letterSpacing: "0.1em", color: "#92640a", marginBottom: 8 }}>ADD EXPENSE</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <input type="number" style={inp} placeholder="Amount" value={expenseAmt} onChange={e => setExpenseAmt(e.target.value)} />
                    <input style={inp} placeholder="Note (optional)" value={expenseNote} onChange={e => setExpenseNote(e.target.value)} />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => saveExpense(sm.id)} disabled={saving} style={{ ...btnP, flex: 1 }}>SAVE</button>
                      <button onClick={() => setShowExpense(null)} style={btnG}>✕</button>
                    </div>
                  </div>
                  {/* Expense list */}
                  {smExpenses.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      {smExpenses.map(e => (
                        <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f0e8d0", fontSize: 13 }}>
                          <span style={{ color: "#6b2f0a" }}>{e.note || "Expense"}</span>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 12 }}>{fmt(e.amount)}</span>
                            <button onClick={() => deleteExpense(e.id)} style={{ ...btnRed, padding: "2px 7px" }}>✕</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
