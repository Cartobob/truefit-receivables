import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const fmt = (n) => "Rs." + Number(n).toLocaleString("en-IN");
const fmtShort = (n) => {
  if (Math.abs(n) >= 100000) return "Rs." + (n / 100000).toFixed(1) + "L";
  if (Math.abs(n) >= 1000) return "Rs." + (n / 1000).toFixed(1) + "K";
  return "Rs." + Number(n).toLocaleString("en-IN");
};
const ageDaysSimple = (bill) => {
  if (!bill.bill_date) return 0;
  return Math.floor((Date.now() - new Date(bill.bill_date).getTime()) / (1000 * 60 * 60 * 24));
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

    const { data: allDealers } = await supabase.from("dealers").select("id, salesman_id");
    const dealerToSalesman = {};
    (allDealers || []).forEach(d => { dealerToSalesman[d.id] = d.salesman_id; });

    const { data: bills } = await supabase.from("bills").select("dealer_id, amount, bill_date").gte("bill_date", start).lte("bill_date", end);
    const { data: payments } = await supabase.from("payments").select("dealer_id, amount, payment_date").gte("payment_date", start).lte("payment_date", end);
    const { data: salaries } = await supabase.from("salesman_salary").select("*").eq("month", start);
    const { data: expenses } = await supabase.from("salesman_expenses").select("*").gte("expense_date", start).lte("expense_date", end);
    const { data: allBills } = await supabase.from("bills").select("dealer_id, balance, bill_date");

    const rows = salesmen.map(sm => {
      const smBills    = (bills    || []).filter(b => dealerToSalesman[b.dealer_id] === sm.id);
      const smPayments = (payments || []).filter(p => dealerToSalesman[p.dealer_id] === sm.id);
      const smSalary   = (salaries || []).find(s => s.salesman_id === sm.id);
      const smExpenses = (expenses || []).filter(e => e.salesman_id === sm.id);
      const smOutBills = (allBills || []).filter(b => dealerToSalesman[b.dealer_id] === sm.id);

      const sales        = smBills.reduce((s, b) => s + Number(b.amount), 0);
      const collections  = smPayments.reduce((s, p) => s + Number(p.amount), 0);
      const salary       = smSalary ? Number(smSalary.amount) : 0;
      const expTotal     = smExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const outstanding  = smOutBills.reduce((s, b) => s + Number(b.balance), 0);
      const interestCost = Math.round(outstanding * 0.01);
      const totalCost    = salary + expTotal + interestCost;
      const net          = collections - totalCost;
      const collectionEfficiency = outstanding > 0 ? (collections / outstanding * 100) : 0;
      const overdue60    = smOutBills.filter(b => ageDaysSimple(b) > 60).reduce((s, b) => s + Number(b.balance), 0);
      const overdue60Ratio = outstanding > 0 ? (overdue60 / outstanding * 100) : 0;
      const costPerRupee = collections > 0 ? ((salary + expTotal) / collections * 100) : 0;

      return { sm, sales, collections, salary, expTotal, outstanding, interestCost, totalCost, net, collectionEfficiency, overdue60Ratio, costPerRupee, smExpenses };
    });

    setData(rows);
    setLoading(false);
  };

  const saveSalary = async (smId) => {
    if (!salaryAmt) return;
    setSaving(true);
    await supabase.from("salesman_salary").upsert({ salesman_id: smId, month: monthStart(selectedMonth), amount: parseFloat(salaryAmt) }, { onConflict: "salesman_id,month" });
    setSalaryAmt(""); setShowSalary(null); setSaving(false); fetchData();
  };

  const saveExpense = async (smId) => {
    if (!expenseAmt) return;
    setSaving(true);
    await supabase.from("salesman_expenses").insert({ salesman_id: smId, amount: parseFloat(expenseAmt), note: expenseNote || null, expense_date: new Date().toISOString().split("T")[0] });
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

  const downloadCSV = () => {
    const rows = [
      ["Salesman","Sales","Collections","Outstanding","Interest(1%)","Salary","Expenses","Total Cost","Net","Coll Eff%","60d+%","Cost/Rs%"],
      ...data.map(r => [r.sm.name,r.sales,r.collections,r.outstanding,r.interestCost,r.salary,r.expTotal,r.totalCost,r.net,r.collectionEfficiency.toFixed(1),r.overdue60Ratio.toFixed(1),r.costPerRupee.toFixed(1)]),
      ["TOTAL",data.reduce((s,r)=>s+r.sales,0),data.reduce((s,r)=>s+r.collections,0),data.reduce((s,r)=>s+r.outstanding,0),data.reduce((s,r)=>s+r.interestCost,0),data.reduce((s,r)=>s+r.salary,0),data.reduce((s,r)=>s+r.expTotal,0),data.reduce((s,r)=>s+r.totalCost,0),data.reduce((s,r)=>s+r.net,0),"—","—","—"]
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Truefit_${monthLabel(selectedMonth).replace(" ","_")}_Summary.csv`;
    a.click();
  };

  const downloadPDF = () => {
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const tSales = data.reduce((s,r)=>s+r.sales,0);
    const tColl  = data.reduce((s,r)=>s+r.collections,0);
    const tCost  = data.reduce((s,r)=>s+r.totalCost,0);
    const tNet   = data.reduce((s,r)=>s+r.net,0);
    const rowsHtml = data.map(r => `<tr>
      <td style="padding:8px 12px;font-weight:500">${r.sm.name}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.sales)}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.collections)}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.outstanding)}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.interestCost)}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.salary)}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.expTotal)}</td>
      <td style="padding:8px 12px;text-align:right">${fmt(r.totalCost)}</td>
      <td style="padding:8px 12px;text-align:right;font-weight:600;color:${r.net>=0?'#166534':'#ea580c'}">${fmt(r.net)}</td>
      <td style="padding:8px 12px;text-align:right">${r.collectionEfficiency.toFixed(1)}%</td>
      <td style="padding:8px 12px;text-align:right;color:${r.overdue60Ratio<=30?'#166534':'#ea580c'}">${r.overdue60Ratio.toFixed(1)}%</td>
    </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Monthly Summary</title>
<style>body{font-family:'IBM Plex Sans',sans-serif;padding:32px 40px;color:#111}
@media print{@page{margin:16mm;size:A4 landscape}}
table{width:100%;border-collapse:collapse;margin-top:24px}
th{background:#f0f2f5;padding:8px 12px;text-align:right;font-size:11px;letter-spacing:.08em;color:#666;font-weight:500}
th:first-child{text-align:left}td{border-bottom:1px solid #e2e8f0;font-size:13px}
.tot td{background:#f1f5f9;font-weight:600;border-top:2px solid #334155}</style></head><body>
<div style="display:flex;justify-content:space-between;border-bottom:3px solid #334155;padding-bottom:12px;margin-bottom:8px">
<div><div style="font-family:'IBM Plex Mono';font-size:13px;letter-spacing:.2em;color:#334155;margin-bottom:4px">TRUEFIT SKIM COAT PRODUCTS</div>
<div style="font-size:22px;font-weight:600">Monthly Summary — ${monthLabel(selectedMonth)}</div></div>
<div style="font-family:'IBM Plex Mono';font-size:11px;color:#888">${today}</div></div>
<table><thead><tr>
<th style="text-align:left">SALESMAN</th><th>SALES</th><th>COLLECTIONS</th><th>OUTSTANDING</th><th>INTEREST</th><th>SALARY</th><th>EXPENSES</th><th>TOTAL COST</th><th>NET</th><th>COLL EFF%</th><th>60d+%</th>
</tr></thead><tbody>${rowsHtml}
<tr class="tot"><td style="padding:8px 12px">TOTAL</td>
<td style="padding:8px 12px;text-align:right">${fmt(tSales)}</td>
<td style="padding:8px 12px;text-align:right">${fmt(tColl)}</td>
<td style="padding:8px 12px;text-align:right">—</td><td style="padding:8px 12px;text-align:right">—</td>
<td style="padding:8px 12px;text-align:right">—</td><td style="padding:8px 12px;text-align:right">—</td>
<td style="padding:8px 12px;text-align:right">${fmt(tCost)}</td>
<td style="padding:8px 12px;text-align:right;color:${tNet>=0?'#166534':'#ea580c'}">${fmt(tNet)}</td>
<td style="padding:8px 12px;text-align:right">—</td><td style="padding:8px 12px;text-align:right">—</td>
</tr></tbody></table></body></html>`;
    const win = window.open("","_blank");
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

  const inp = { background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:6,padding:"9px 12px",fontSize:14,color:"#334155",width:"100%",fontFamily:"'IBM Plex Sans'" };
  const btnP = { padding:"7px 14px",fontFamily:"'IBM Plex Mono'",fontSize:11,borderRadius:6,border:"none",background:"#334155",color:"#ffffff",letterSpacing:"0.08em",cursor:"pointer" };
  const btnG = { padding:"7px 10px",fontFamily:"'IBM Plex Mono'",fontSize:11,borderRadius:6,border:"1px solid #e2e8f0",background:"#ffffff",color:"#888",cursor:"pointer" };
  const btnAmber = { padding:"5px 10px",fontFamily:"'IBM Plex Mono'",fontSize:10,borderRadius:5,border:"1px solid #d4a820",background:"#fffbeb",color:"#92640a",cursor:"pointer" };
  const btnRed = { padding:"5px 10px",fontFamily:"'IBM Plex Mono'",fontSize:10,borderRadius:5,border:"1px solid #fecaca",background:"#fff5f5",color:"#dc2626",cursor:"pointer" };

  const totalSales = data.reduce((s,r)=>s+r.sales,0);
  const totalColl  = data.reduce((s,r)=>s+r.collections,0);
  const totalNet   = data.reduce((s,r)=>s+r.net,0);

  return (
    <div className="fade-in">
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <button onClick={() => changeMonth(-1)} style={btnG}>◀</button>
          <span style={{ fontFamily:"'IBM Plex Mono'",fontSize:13,fontWeight:500,color:"#334155",minWidth:140,textAlign:"center" }}>{monthLabel(selectedMonth)}</span>
          <button onClick={() => changeMonth(1)} style={btnG}>▶</button>
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={downloadCSV} style={{ ...btnG,fontSize:12 }}>⬇ CSV</button>
          <button onClick={downloadPDF} style={{ ...btnP,fontSize:11 }}>⬇ PDF</button>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20 }}>
        {[
          { label:"TOTAL SALES",val:totalSales,color:"#334155" },
          { label:"COLLECTIONS",val:totalColl,color:"#166534" },
          { label:"NET P&L",val:totalNet,color:totalNet>=0?"#166534":"#ea580c" },
        ].map(s => (
          <div key={s.label} style={{ background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:9,letterSpacing:"0.12em",color:"#888",marginBottom:4 }}>{s.label}</div>
            <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:18,fontWeight:500,color:s.color }}>{fmtShort(s.val)}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:"center",padding:60,fontFamily:"'IBM Plex Mono'",fontSize:12,color:"#888" }}>LOADING...</div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {data.map(({ sm,sales,collections,salary,expTotal,outstanding,interestCost,totalCost,net,collectionEfficiency,overdue60Ratio,costPerRupee,smExpenses }) => (
            <div key={sm.id} style={{ background:"#ffffff",border:"1px solid #e2e8f0",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)",borderLeft:`3px solid ${net>=0?'#334155':'#dc2626'}` }}>
              <div style={{ padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:15,fontWeight:600,color:"#334155",marginBottom:10 }}>{sm.name}</div>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 24px",marginBottom:10 }}>
                    {[
                      { label:"Sales",val:fmt(sales) },
                      { label:"Collections",val:fmt(collections) },
                      { label:"Outstanding",val:fmt(outstanding) },
                      { label:"Interest (1%/mo)",val:fmt(interestCost),dim:true },
                      { label:"Salary",val:fmt(salary) },
                      { label:"Expenses",val:fmt(expTotal) },
                    ].map(({ label,val,dim }) => (
                      <div key={label}>
                        <span style={{ fontFamily:"'IBM Plex Mono'",fontSize:9,letterSpacing:"0.1em",color:"#888" }}>{label.toUpperCase()} </span>
                        <span style={{ fontFamily:"'IBM Plex Mono'",fontSize:13,color:dim?"#aaa":"#334155" }}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderTop:"1px solid #f1f5f9",paddingTop:8,display:"flex",gap:12,flexWrap:"wrap" }}>
                    {[
                      { label:"Collection Eff.",val:collectionEfficiency.toFixed(1)+"%",good:collectionEfficiency>=60 },
                      { label:"60d+ Ratio",val:overdue60Ratio.toFixed(1)+"%",good:overdue60Ratio<=30 },
                      { label:"Cost/₹ Collected",val:costPerRupee>0?costPerRupee.toFixed(1)+"%":"—",good:costPerRupee<=6&&costPerRupee>0 },
                    ].map(({ label,val,good }) => (
                      <div key={label} style={{ background:collections>0?(good?"#f0fdf4":"#fdf0f0"):"#f8fafc",border:`1px solid ${collections>0?(good?"#bbf7d0":"#fecaca"):"#e2e8f0"}`,borderRadius:6,padding:"4px 10px" }}>
                        <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:8,letterSpacing:"0.1em",color:"#888" }}>{label.toUpperCase()}</div>
                        <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:13,fontWeight:600,color:collections>0?(good?"#166534":"#ea580c"):"#aaa" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:9,letterSpacing:"0.1em",color:"#888",marginBottom:4 }}>NET</div>
                  <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:22,fontWeight:600,color:net>=0?"#166534":"#ea580c" }}>{fmt(net)}</div>
                  <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:9,color:net>=0?"#166534":"#ea580c" }}>{net>=0?"▲ PROFITABLE":"▼ LOSS"}</div>
                </div>
              </div>
              <div style={{ padding:"0 16px 12px",display:"flex",gap:8 }}>
                <button onClick={() => { setShowSalary(sm.id); setShowExpense(null); setSalaryAmt(salary?String(salary):""); }} style={btnP}>+ Salary</button>
                <button onClick={() => { setShowExpense(sm.id); setShowSalary(null); }} style={btnAmber}>+ Expense</button>
              </div>
              {showSalary===sm.id && (
                <div style={{ padding:"12px 16px",background:"#f1f5f9",borderTop:"1px solid #e2e8f0" }}>
                  <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:9,letterSpacing:"0.1em",color:"#334155",marginBottom:8 }}>SALARY FOR {monthLabel(selectedMonth).toUpperCase()}</div>
                  <div style={{ display:"flex",gap:8 }}>
                    <input type="number" style={{ ...inp,flex:1 }} placeholder="Amount" value={salaryAmt} onChange={e=>setSalaryAmt(e.target.value)} />
                    <button onClick={()=>saveSalary(sm.id)} disabled={saving} style={btnP}>SAVE</button>
                    <button onClick={()=>setShowSalary(null)} style={btnG}>✕</button>
                  </div>
                </div>
              )}
              {showExpense===sm.id && (
                <div style={{ padding:"12px 16px",background:"#fffbeb",borderTop:"1px solid #e2e8f0" }}>
                  <div style={{ fontFamily:"'IBM Plex Mono'",fontSize:9,letterSpacing:"0.1em",color:"#92640a",marginBottom:8 }}>ADD EXPENSE</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                    <input type="number" style={inp} placeholder="Amount" value={expenseAmt} onChange={e=>setExpenseAmt(e.target.value)} />
                    <input style={inp} placeholder="Note (optional)" value={expenseNote} onChange={e=>setExpenseNote(e.target.value)} />
                    <div style={{ display:"flex",gap:8 }}>
                      <button onClick={()=>saveExpense(sm.id)} disabled={saving} style={{ ...btnP,flex:1 }}>SAVE</button>
                      <button onClick={()=>setShowExpense(null)} style={btnG}>✕</button>
                    </div>
                  </div>
                  {smExpenses.length>0 && (
                    <div style={{ marginTop:10 }}>
                      {smExpenses.map(e => (
                        <div key={e.id} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f0e8d0",fontSize:13 }}>
                          <span style={{ color:"#334155" }}>{e.note||"Expense"}</span>
                          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                            <span style={{ fontFamily:"'IBM Plex Mono'",fontSize:12 }}>{fmt(e.amount)}</span>
                            <button onClick={()=>deleteExpense(e.id)} style={{ ...btnRed,padding:"2px 7px" }}>✕</button>
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
