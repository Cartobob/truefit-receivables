export async function generateAgeingExcel(salesmanName, dealers) {
  try {
  if (!window.XLSXStyle) {
    await loadScript("https://unpkg.com/xlsx-js-style@1.2.0/dist/xlsx.bundle.js");
  }

  const XLSX = window.XLSXStyle;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  const monthYear = new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" });

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

  // Auto-fit column widths
  const colWidths = Array(10).fill(0);
  for (const row of rows) {
    row.forEach((cell, i) => {
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      if (len > colWidths[i]) colWidths[i] = len;
    });
  }
  ws["!cols"] = colWidths.map(w => ({ wch: Math.min(Math.max(w + 1, 8), 50) }));

  // Apply borders — thick for columns, thin for rows
  const thick = { style: "medium", color: { rgb: "888888" } };
  const thin  = { style: "thin",   color: { rgb: "CCCCCC" } };
  const cellBorder = { left: thick, right: thick, top: thin, bottom: thin };

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = { border: cellBorder };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, salesmanName.substring(0, 31));

  const filename = `${salesmanName.replace(/\s+/g, "_")}_Ageing_${today.replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
  } catch(e) {
    alert("Excel export failed: " + e.message);
    console.error(e);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
