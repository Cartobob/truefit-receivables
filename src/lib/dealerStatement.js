import { supabase } from "./supabase";

const fmt = (n) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

export async function generateDealerStatement(dealer, startDate, endDate) {
  // Load jsPDF + autotable
  if (!window.jspdf) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
  }
  if (!window.jspdf?.jsPDF?.API?.autoTable) {
    await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js");
  }

  // Fetch data
  const { data: bills } = await supabase.from("bills").select("*").eq("dealer_id", dealer.id).gte("bill_date", startDate).lte("bill_date", endDate).order("bill_date");
  const { data: payments } = await supabase.from("payments").select("*").eq("dealer_id", dealer.id).gte("payment_date", startDate).lte("payment_date", endDate).order("payment_date");
  let creditNotes = [];
  try {
    const { data: cn } = await supabase.from("credit_notes").select("*").eq("dealer_id", dealer.id).gte("credit_date", startDate).lte("credit_date", endDate).order("credit_date");
    creditNotes = cn || [];
  } catch {}

  // Opening balance
  const { data: prevBills } = await supabase.from("bills").select("amount").eq("dealer_id", dealer.id).lt("bill_date", startDate);
  const { data: prevPayments } = await supabase.from("payments").select("amount").eq("dealer_id", dealer.id).lt("payment_date", startDate);
  let prevCredits = [];
  try {
    const { data: pc } = await supabase.from("credit_notes").select("amount").eq("dealer_id", dealer.id).lt("credit_date", startDate);
    prevCredits = pc || [];
  } catch {}

  const prevDebit = (prevBills || []).reduce((s, b) => s + Number(b.amount), 0);
  const prevCredit = (prevPayments || []).reduce((s, p) => s + Number(p.amount), 0) + prevCredits.reduce((s, c) => s + Number(c.amount), 0);
  const openingBalance = prevDebit - prevCredit;

  // Merge transactions
  const transactions = [
    ...(bills || []).map(b => ({ date: b.bill_date, particulars: "Sales GST", ref: b.bill_no, debit: Number(b.amount), credit: 0 })),
    ...(payments || []).map(p => ({ date: p.payment_date, particulars: "Receipt", ref: p.note || "Payment", debit: 0, credit: Number(p.amount) })),
    ...creditNotes.map(c => ({ date: c.credit_date, particulars: "Credit Note", ref: c.cn_no || c.note || "CN", debit: 0, credit: Number(c.amount) })),
  ].sort((a, b) => new Date(a.date) - new Date(b.date));

  let balance = openingBalance;
  const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
  const totalCredit = transactions.reduce((s, t) => s + t.credit, 0);
  const closingBalance = openingBalance + totalDebit - totalCredit;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(51, 65, 85);
  doc.text("Padmavathi Agencies", 40, 50);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text("No.25/1, AUT Nagar, Tiruvanaikovil, Trichy - 620005", 40, 66);
  doc.text("Mobile: 6382591155  |  G-Pay: 6382591155", 40, 79);

  // Dealer
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(51, 65, 85);
  doc.text(dealer.name, pageWidth - 40, 50, { align: "right" });
  if (dealer.area) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(dealer.area, pageWidth - 40, 64, { align: "right" });
  }

  // Divider
  doc.setDrawColor(234, 88, 12);
  doc.setLineWidth(2);
  doc.line(40, 90, pageWidth - 40, 90);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(51, 65, 85);
  doc.text("Ledger Account Statement", pageWidth / 2, 110, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`${fmtDate(startDate)} to ${fmtDate(endDate)}`, pageWidth / 2, 124, { align: "center" });

  // Table rows
  const body = [];
  body.push([fmtDate(startDate), "Opening Balance", "", "", "", `${fmt(Math.abs(openingBalance))} ${openingBalance >= 0 ? "Dr" : "Cr"}`]);
  let runBal = openingBalance;
  for (const t of transactions) {
    runBal += t.debit - t.credit;
    body.push([
      fmtDate(t.date), t.particulars, t.ref,
      t.debit > 0 ? fmt(t.debit) : "",
      t.credit > 0 ? fmt(t.credit) : "",
      `${fmt(Math.abs(runBal))} ${runBal >= 0 ? "Dr" : "Cr"}`
    ]);
  }

  doc.autoTable({
    startY: 140,
    head: [["Date", "Particulars", "Vch No.", "Debit", "Credit", "Balance"]],
    body,
    foot: [
      ["", "", "Total", fmt(totalDebit), fmt(totalCredit), ""],
      ["", "", "Closing Balance", "", "", `${fmt(Math.abs(closingBalance))} ${closingBalance >= 0 ? "Dr" : "Cr"}`]
    ],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: [40, 40, 40] },
    headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    footStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 110 },
      2: { cellWidth: 90 },
      3: { halign: "right", cellWidth: 75 },
      4: { halign: "right", cellWidth: 75 },
      5: { halign: "right" }
    },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  const finalY = doc.lastAutoTable.finalY || 140;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })} · Truefit Skim Coat Products`, pageWidth - 40, finalY + 24, { align: "right" });

  // Save directly as PDF
  doc.save(`Statement_${dealer.name.replace(/\s+/g, "_")}_${startDate}_to_${endDate}.pdf`);
}
