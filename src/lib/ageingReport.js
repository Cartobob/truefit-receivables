import { fmt, fmtDate, ageDays, ageBucket, totalBalance, pendingCheques, totalPendingCheques } from "./helpers";

export function generateAgeingReport(salesman, dealers, allBills = false) {
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });

  // Compute summary
  const activeDealers = dealers.filter(d => totalBalance(d.bills) > 0 || pendingCheques(d.cheques || []).length > 0);
  const grandTotal = activeDealers.reduce((s, d) => s + totalBalance(d.bills), 0);
  const grandCheque = activeDealers.reduce((s, d) => s + totalPendingCheques(d.cheques), 0);
  const b30  = activeDealers.reduce((s, d) => s + (d.bills||[]).filter(b => Number(b.balance) > 0 && ageDays(b.bill_date) <= 30).reduce((x, b) => x + Number(b.balance), 0), 0);
  const b60  = activeDealers.reduce((s, d) => s + (d.bills||[]).filter(b => Number(b.balance) > 0 && ageDays(b.bill_date) > 30 && ageDays(b.bill_date) <= 60).reduce((x, b) => x + Number(b.balance), 0), 0);
  const b60p = activeDealers.reduce((s, d) => s + (d.bills||[]).filter(b => Number(b.balance) > 0 && ageDays(b.bill_date) > 60).reduce((x, b) => x + Number(b.balance), 0), 0);

  const dealerRows = activeDealers.map(dealer => {
    const bal = totalBalance(dealer.bills);
    const pending = pendingCheques(dealer.cheques || []);
    const activeBills = (dealer.bills || []).filter(b => Number(b.balance) > 0).sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));

    const billRows = activeBills.map(bill => {
      const days = ageDays(bill.bill_date);
      const bkt = ageBucket(days);
      return `
        <tr>
          <td style="padding:6px 10px;font-family:monospace;font-size:12px;color:#444;">${bill.bill_no}</td>
          <td style="padding:6px 10px;font-size:12px;color:#666;">${fmtDate(bill.bill_date)}</td>
          <td style="padding:6px 10px;font-size:12px;text-align:right;color:#666;">${fmt(bill.amount)}</td>
          <td style="padding:6px 10px;font-size:12px;font-weight:600;text-align:right;">${fmt(bill.balance)}</td>
          <td style="padding:6px 10px;text-align:center;">
            <span style="font-size:11px;padding:2px 8px;border-radius:3px;background:${bkt.bg};color:${bkt.color};border:1px solid ${bkt.border};">${days}d</span>
          </td>
        </tr>`;
    }).join("");

    const chequeRows = pending.map(c => `
      <tr style="background:#fffbeb;">
        <td colspan="3" style="padding:5px 10px;font-size:11px;font-family:monospace;color:#92640a;">
          🟡 CHQ · ${fmtDate(c.cheque_date)}${c.bank_name ? " · " + c.bank_name : ""}
        </td>
        <td style="padding:5px 10px;font-size:12px;font-weight:600;text-align:right;color:#92640a;">${fmt(c.amount)}</td>
        <td style="padding:5px 10px;font-size:11px;text-align:center;color:#92640a;">PENDING</td>
      </tr>`).join("");

    return `
      <div style="margin-bottom:20px;break-inside:avoid;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:1.5px solid #1c1612;padding-bottom:4px;margin-bottom:0;">
          <span style="font-size:14px;font-weight:600;color:#1c1612;">${dealer.name}</span>
          <span style="font-family:monospace;font-size:14px;font-weight:700;color:#8b1a1a;">${fmt(bal)}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-top:0;">
          <thead>
            <tr style="background:#f0ede8;">
              <th style="padding:5px 10px;font-size:10px;text-align:left;letter-spacing:0.08em;color:#888;font-weight:500;">BILL NO</th>
              <th style="padding:5px 10px;font-size:10px;text-align:left;letter-spacing:0.08em;color:#888;font-weight:500;">DATE</th>
              <th style="padding:5px 10px;font-size:10px;text-align:right;letter-spacing:0.08em;color:#888;font-weight:500;">AMOUNT</th>
              <th style="padding:5px 10px;font-size:10px;text-align:right;letter-spacing:0.08em;color:#888;font-weight:500;">BALANCE</th>
              <th style="padding:5px 10px;font-size:10px;text-align:center;letter-spacing:0.08em;color:#888;font-weight:500;">AGE</th>
            </tr>
          </thead>
          <tbody>
            ${billRows}
            ${chequeRows}
          </tbody>
        </table>
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ageing Report — ${salesman} — ${today}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500&family=DM+Mono&family=DM+Sans:wght@400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'IBM Plex Sans', sans-serif; color: #1c1612; background: #fff; padding: 32px 40px; font-size: 14px; }
    @media print {
      body { padding: 16px 24px; }
      @page { margin: 16mm; size: A4; }
    }
    table { border-collapse: collapse; }
    tr:nth-child(even) { background: #faf7f2; }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1c1612;padding-bottom:16px;margin-bottom:24px;">
    <div>
      <div style="font-family:'Playfair Display';font-size:26px;font-weight:500;color:#1c1612;margin-bottom:2px;">Truefit Skim Coat Products</div>
      <div style="font-family:'IBM Plex Mono';font-size:10px;letter-spacing:0.18em;color:#8a7d6e;">DEBTORS AGEING REPORT</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:13px;font-weight:600;color:#1c1612;">${salesman}</div>
      <div style="font-family:'IBM Plex Mono';font-size:10px;color:#8a7d6e;margin-top:2px;">As on ${today}</div>
    </div>
  </div>

  <!-- Summary boxes -->
  <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:28px;">
    ${[
      { label: "TOTAL OUTSTANDING", val: fmt(grandTotal), color: "#8b1a1a" },
      { label: "CHQ PENDING", val: fmt(grandCheque), color: "#92640a" },
      { label: "0–30 DAYS", val: fmt(b30), color: "#3a5c2a" },
      { label: "31–60 DAYS", val: fmt(b60), color: "#7a5200" },
      { label: "60+ DAYS", val: fmt(b60p), color: "#8b1a1a" },
    ].map(s => `
      <div style="border:1px solid #ddd5c8;border-radius:6px;padding:12px 14px;background:#faf7f2;">
        <div style="font-family:'IBM Plex Mono';font-size:8px;letter-spacing:0.12em;color:#8a7d6e;margin-bottom:4px;">${s.label}</div>
        <div style="font-family:'IBM Plex Mono';font-size:14px;font-weight:500;color:${s.color};">${s.val}</div>
      </div>`).join("")}
  </div>

  <!-- Dealer detail -->
  <div style="font-family:'IBM Plex Mono';font-size:9px;letter-spacing:0.14em;color:#8a7d6e;margin-bottom:14px;border-bottom:1px solid #ddd5c8;padding-bottom:6px;">
    DEALER-WISE DETAIL · ${activeDealers.length} DEALERS
  </div>

  ${dealerRows}

  <!-- Footer -->
  <div style="margin-top:32px;border-top:1px solid #ddd5c8;padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
    <div style="font-family:'IBM Plex Mono';font-size:9px;color:#aaa;letter-spacing:0.1em;">TRUEFIT SKIM COAT PRODUCTS · 25/1 AUT NAGAR, TIRUVANAIKOIL, TRICHY 620005</div>
    <div style="font-family:'IBM Plex Mono';font-size:9px;color:#aaa;">Generated ${today}</div>
  </div>

</body>
</html>`;

  // Open in new tab for print/save as PDF
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  win.onload = () => win.print();
}
