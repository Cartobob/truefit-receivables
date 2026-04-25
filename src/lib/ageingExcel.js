// Generates a Tally-style two-column ageing report Excel file
// Left: PA bills, Right: TF bills
// Uses SheetJS (XLSX) loaded from CDN

export async function generateAgeingExcel(salesmanName, dealers) {
  // Dynamically load SheetJS if not already loaded
  if (!window.XLSX) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
  }

  const XLSX = window.XLSX;
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Separate PA and TF bills per dealer
  const paDealers = {};
  const tfDealers = {};

  for (const dealer of dealers) {
    const paBills = (dealer.bills || []).filter(b => Number(b.balance) > 0 && b.bill_no.startsWith("PA"));
    const tfBills = (dealer.bills || []).filter(b => Number(b.balance) > 0 && b.bill_no.startsWith("TF") || b.bill_no.startsWith("GST"));

    if (paBills.length > 0) paDealers[dealer.name] = paBills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
    if (tfBills.length > 0) tfDealers[dealer.name] = tfBills.sort((a, b) => new Date(a.bill_date) - new Date(b.bill_date));
  }

  // Build rows — two sections side by side
  const allDealerNames = [...new Set([...Object.keys(paDealers), ...Object.keys(tfDealers)])].sort();

  const rows = [];

  // Header row 1
  rows.push([
    `${salesmanName}-Padmavathi Agencies Ageing as on ${today}`, "", "", "", "",
    `${salesmanName}-TRUEFIT-ESHAN Ageing as on ${today}`, "", "", "", ""
  ]);

  // Header row 2
  rows.push(["Date", "Details", "Opening", "Pending", "Due", "Date", "Details", "Opening", "Pending", "Due"]);

  const fmtDate = (d) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  };

  const fmt = (n) => Number(n).toLocaleString("en-IN");

  // For each dealer that has PA bills, emit rows
  // TF dealers that align with PA dealers appear on the same rows
  // TF-only dealers appear after all PA dealers

  const paNames = Object.keys(paDealers).sort();
  const tfNames = Object.keys(tfDealers).sort();
  const tfOnlyNames = tfNames.filter(n => !paDealers[n]);

  // Track which TF dealers have been emitted alongside PA
  const tfEmitted = new Set();

  for (const dealer of allDealerNames) {
    const paB = paDealers[dealer] || [];
    const tfB = tfDealers[dealer] || [];

    if (paB.length === 0 && tfB.length === 0) continue;

    // Dealer name row
    const maxRows = Math.max(paB.length, tfB.length);
    const dealerRow = ["", dealer, "", "", "", "", tfB.length > 0 ? dealer : "", "", "", ""];
    rows.push(dealerRow);

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

    // Subtotal row
    const paTotal = paB.reduce((s, b) => s + Number(b.amount), 0);
    const paPending = paB.reduce((s, b) => s + Number(b.balance), 0);
    const tfTotal = tfB.reduce((s, b) => s + Number(b.amount), 0);
    const tfPending = tfB.reduce((s, b) => s + Number(b.balance), 0);

    rows.push([
      "",
      "",
      paTotal || "",
      paPending || "",
      "",
      "",
      "",
      tfTotal || "",
      tfPending || "",
      ""
    ]);

    rows.push(["", "", "", "", "", "", "", "", "", ""]); // spacer
  }

  // Grand totals
  const grandPaAmt = Object.values(paDealers).flat().reduce((s, b) => s + Number(b.amount), 0);
  const grandPaPend = Object.values(paDealers).flat().reduce((s, b) => s + Number(b.balance), 0);
  const grandTfAmt = Object.values(tfDealers).flat().reduce((s, b) => s + Number(b.amount), 0);
  const grandTfPend = Object.values(tfDealers).flat().reduce((s, b) => s + Number(b.balance), 0);

  rows.push(["Grand Total", "", grandPaAmt, grandPaPend, "", "Grand Total", "", grandTfAmt, grandTfPend, ""]);

  // Create workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 6 },
    { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 6 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, salesmanName);

  // Download
  const filename = `${salesmanName.replace(/\s+/g, "_")}_Ageing_${today.replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
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
