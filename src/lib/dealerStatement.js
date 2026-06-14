import { supabase } from "./supabase";

const fmt = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export async function generateDealerStatement(dealer, startDate, endDate) {
  // Fetch all bills in range
  const { data: bills } = await supabase
    .from("bills")
    .select("*")
    .eq("dealer_id", dealer.id)
    .gte("bill_date", startDate)
    .lte("bill_date", endDate)
    .order("bill_date");

  // Fetch all payments in range
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("dealer_id", dealer.id)
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date");

  // Fetch all credit notes in range
  const { data: creditNotes } = await supabase
    .from("credit_notes")
    .select("*")
    .eq("dealer_id", dealer.id)
    .gte("credit_date", startDate)
    .lte("credit_date", endDate)
    .order("credit_date");

  // Fetch opening balance — sum of all bills before start date minus payments before start date
  const { data: prevBills } = await supabase
    .from("bills")
    .select("amount")
    .eq("dealer_id", dealer.id)
    .lt("bill_date", startDate);

  const { data: prevPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("dealer_id", dealer.id)
    .lt("payment_date", startDate);

  const { data: prevCredits } = await supabase
    .from("credit_notes")
    .select("amount")
    .eq("dealer_id", dealer.id)
    .lt("credit_date", startDate);

  const prevDebit = (prevBills || []).reduce((s, b) => s + Number(b.amount), 0);
  const prevCredit = (prevPayments || []).reduce((s, p) => s + Number(p.amount), 0)
    + (prevCredits || []).reduce((s, c) => s + Number(c.amount), 0);
  const openingBalance = prevDebit - prevCredit;

  // Merge all transactions and sort by date
  const transactions = [
    ...(bills || []).map(b => ({ date: b.bill_date, type: "bill", ref: b.bill_no, debit: Number(b.amount), credit: 0 })),
    ...(payments || []).map(p => ({ date: p.payment_date, type: "payment", ref: p.note || "Payment Received", debit: 0, credit: Number(p.amount) })),
    ...(creditNotes || []).map(c => ({ date: c.credit_date, type: "credit", ref: c.note || "Credit Note", debit: 0, credit: Number(c.amount) })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Build running balance
  let balance = openingBalance;
  const rows = transactions.map(t => {
    balance += t.debit - t.credit;
    return { ...t, balance };
  });

  const totalDebit  = transactions.reduce((s, t) => s + t.debit, 0);
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  // Generate PDF HTML
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const startFmt = new Date(startDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const endFmt   = new Date(endDate).toLocaleDateString("en-IN",   { day: "2-digit", month: "short", year: "numeric" });

  const rowsHtml = rows.map(r => `
    <tr>
      <td>${fmtDate(r.date)}</td>
      <td>${r.type === "bill" ? "Sales GST" : r.type === "credit" ? "Credit Note" : "Receipt"}</td>
      <td>${r.ref || ""}</td>
      <td style="text-align:right">${r.debit > 0 ? fmt(r.debit) : ""}</td>
      <td style="text-align:right">${r.credit > 0 ? fmt(r.credit) : ""}</td>
      <td style="text-align:right">${fmt(Math.abs(r.balance))} ${r.balance >= 0 ? "Dr" : "Cr"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>Statement — ${dealer.name}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 12px; color: #111; padding: 24px 32px; }
  @media print { @page { margin: 12mm; size: A4; } body { padding: 0; } }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #6b2f0a; padding-bottom: 12px; margin-bottom: 16px; }
  .company { font-size: 16px; font-weight: 700; color: #6b2f0a; margin-bottom: 4px; }
  .co-details { font-size: 11px; color: #555; line-height: 1.6; }
  .dealer-box { text-align: right; font-size: 11px; color: #333; line-height: 1.6; }
  .dealer-name { font-size: 14px; font-weight: 600; color: #6b2f0a; }
  .title { text-align: center; font-size: 13px; font-weight: 600; margin-bottom: 4px; letter-spacing: 0.05em; }
  .subtitle { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #fdf0e8; padding: 6px 8px; text-align: left; border: 1px solid #e2c8b0; font-weight: 600; color: #6b2f0a; font-size: 10px; letter-spacing: 0.04em; }
  th.num { text-align: right; }
  td { padding: 5px 8px; border: 1px solid #e8e8e8; vertical-align: top; }
  .opening { background: #f8f8f8; font-style: italic; color: #555; }
  .closing { background: #fdf0e8; font-weight: 600; }
  .totals { background: #f0f0f0; font-weight: 600; border-top: 2px solid #6b2f0a; }
  .footer { margin-top: 24px; font-size: 10px; color: #888; text-align: right; }
</style>
</head><body>

<div class="header">
  <div>
    <div class="company">Padmavathi Agencies</div>
    <div class="co-details">
      No.25/1, AUT Nagar, Tiruvanaikovil, Trichy - 620005<br>
      Mobile: 6382591155 &nbsp;|&nbsp; G-Pay: 6382591155
    </div>
  </div>
  <div class="dealer-box">
    <div class="dealer-name">${dealer.name}</div>
    ${dealer.area ? `<div>${dealer.area}</div>` : ""}
  </div>
</div>

<div class="title">Ledger Account Statement</div>
<div class="subtitle">${startFmt} to ${endFmt}</div>

<table>
  <thead>
    <tr>
      <th style="width:90px">Date</th>
      <th>Particulars</th>
      <th>Vch No.</th>
      <th class="num" style="width:90px">Debit</th>
      <th class="num" style="width:90px">Credit</th>
      <th class="num" style="width:110px">Balance</th>
    </tr>
  </thead>
  <tbody>
    <tr class="opening">
      <td>${startFmt}</td>
      <td colspan="2">${openingBalance >= 0 ? "Opening Balance (Dr)" : "Opening Balance (Cr)"}</td>
      <td></td><td></td>
      <td style="text-align:right">${fmt(Math.abs(openingBalance))} ${openingBalance >= 0 ? "Dr" : "Cr"}</td>
    </tr>
    ${rowsHtml}
    <tr class="totals">
      <td colspan="3" style="text-align:right">Total</td>
      <td style="text-align:right">${fmt(totalDebit)}</td>
      <td style="text-align:right">${fmt(totalCredit)}</td>
      <td></td>
    </tr>
    <tr class="closing">
      <td colspan="3" style="text-align:right">Closing Balance</td>
      <td></td><td></td>
      <td style="text-align:right">${fmt(Math.abs(closingBalance))} ${closingBalance >= 0 ? "Dr" : "Cr"}</td>
    </tr>
  </tbody>
</table>

<div class="footer">Generated on ${today} · Truefit Skim Coat Products</div>
</body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
