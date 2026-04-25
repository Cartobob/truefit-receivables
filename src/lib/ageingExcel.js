export async function generateAgeingExcel(salesmanName, dealers) {
  if (!window.XLSXStyle) {
    await loadScript("https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js");
  }

  const XLSX = window.XLSXStyle;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

  const paDealers = {};
  const tfDealers = {};

  for (const dealer of dealers) {
    const paBills = (dealer.bills || []).filter(b => Number(b.balance) > 0 && b.bill_no.startsWith("PA"));
    const tfBills = (dealer.bills || []).filter(b => Number(b.balance) > 0 && (b.bill_no.startsWith("TF") || b.bill_no.startsWith("GST")));
    if (paBills.length > 0) paDealers[dealer.name] = paBills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
    if (tfBills.length > 0) tfDealers[dealer.name] = tfBills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
  }

  const allDealerNames = [...new Set([...Object.keys(paDealers), ...Object.keys(tfDealers)])].sort();
  const rows = [];

  const monthYear = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const paHeader = `Padmavathi Agencies - ${monthYear}`;
  const tfHeader = `Truefit / Eshan - ${monthYear}`;

  rows.push([paHeader, "", "", "", "", tfHeader, "", "", "", ""]);
  rows.push(["Date", "Details", "Opening", "Pending", "Due", "Date", "Details", "Opening", "Pending", "Due"]);

  const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });

  for (const dealer of allDealerNames) {
    const paB = paDealers[dealer] || [];
    const tfB = tfDealers[dealer] || [];
    if (paB.length === 0 && tfB.length === 0) continue;

    rows.push(["", dealer, "", "", "", "", tfB.length > 0 ? dealer : "", "", "", ""]);

    const maxRows = Math.max(paB.length, tfB.length);
    for (let i = 0; i < maxRows; i++) {
      const pb = paB[i];
      const tb = tfB[i];
      rows.push([
        pb ? fmtDate(pb.bill_date) : "",
        pb ? pb.bill_no : "",
        pb ? pb.amount : "",
        pb ? pb.balance : "",
        pb ? Math.floor((Date.now() - new Date(pb.bill_date)) / 86400000) : "",
        tb ? fmtDate(tb.bill_date) : "",
        tb ? tb.bill_no : "",
        tb ? tb.amount : "",
        tb ? tb.balance : "",
        tb ? Math.floor((Date.now() - new Date(tb.bill_date)) / 86400000) : "",
      ]);
    }

    const paTotal   = paB.reduce((s, b) => s + Number(b.amount), 0);
    const paPending = paB.reduce((s, b) => s + Number(b.balance), 0);
    const tfTotal   = tfB.reduce((s, b) => s + Number(b.amount), 0);
    const tfPending = tfB.reduce((s, b) => s + Number(b.balance), 0);
    rows.push(["", "", paTotal || "", paPending || "", "", "", "", tfTotal || "", tfPending || "", ""]);
  }

  const grandPaAmt  = Object.values(paDealers).flat().reduce((s, b) => s + Number(b.amount), 0);
  const grandPaPend = Object.values(paDealers).flat().reduce((s, b) => s + Number(b.balance), 0);
  const grandTfAmt  = Object.values(tfDealers).flat().reduce((s, b) => s + Number(b.amount), 0);
  const grandTfPend = Object.values(tfDealers).flat().reduce((s, b) => s + Number(b.balance), 0);
  rows.push(["Grand Total", "", grandPaAmt, grandPaPend, "", "Grand Total", "", grandTfAmt, grandTfPend, ""]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Auto-fit based on data rows only (skip header row for width calc)
  const colWidths = Array(10).fill(0);
  for (let i = 1; i < rows.length; i++) {  // start from row index 1, skip header
    rows[i].forEach((cell, c) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      if (len > colWidths[c]) colWidths[c] = len;
    });
  }

  // Fixed widths per column type: date, details, amount, amount, days
  ws["!cols"] = [
    { wch: Math.max(colWidths[0] + 1, 10) },  // date
    { wch: Math.max(colWidths[1] + 1, 20) },  // details (bill no / dealer)
    { wch: Math.max(colWidths[2] + 1, 10) },  // opening
    { wch: Math.max(colWidths[3] + 1, 10) },  // pending
    { wch: Math.max(colWidths[4] + 1, 5)  },  // due days
    { wch: Math.max(colWidths[5] + 1, 10) },  // date TF
    { wch: Math.max(colWidths[6] + 1, 20) },  // details TF
    { wch: Math.max(colWidths[7] + 1, 10) },  // opening TF
    { wch: Math.max(colWidths[8] + 1, 10) },  // pending TF
    { wch: Math.max(colWidths[9] + 1, 5)  },  // due days TF
  ];

  XLSX.utils.book_append_sheet(wb, ws, salesmanName.substring(0, 31));

  const filename = `${salesmanName.replace(/\s+/g, "_")}_Ageing_${today.replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    con
