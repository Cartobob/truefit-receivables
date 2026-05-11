export const fmt = (n) => "Rs." + Number(n).toLocaleString("en-IN");

export const ageDays = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const ageBucket = (days) => {
  if (days <= 30) return { label: "0-30 days", color: "#3a5c2a", bg: "#edf4e4", border: "#c0d4a8" };
  if (days <= 60) return { label: "31-60 days", color: "#7a5200", bg: "#fdf4e0", border: "#e8d090" };
  return { label: "60+ days", color: "#8b1a1a", bg: "#fdf0f0", border: "#e8c0b0" };
};

export const worstBucket = (bills) => {
  if (!bills || bills.length === 0) return ageBucket(0);
  const activeBills = bills.filter(b => Number(b.balance) > 0);
  if (activeBills.length === 0) return ageBucket(0);
  const maxDays = Math.max(...activeBills.map(b => ageDays(b.bill_date)));
  return ageBucket(maxDays);
};

export const totalBalance = (bills) => {
  if (!bills) return 0;
  return bills.reduce((sum, b) => sum + Number(b.balance), 0);
};

export const stripColor = (bills) => {
  const bucket = worstBucket(bills);
  if (bucket.label === "0-30 days") return "#6b9a4a";
  if (bucket.label === "31-60 days") return "#c8943a";
  return "#b84040";
};

export const weightedAvgAge = (bills) => {
  const active = (bills || []).filter(b => Number(b.balance) > 0);
  if (active.length === 0) return 0;
  const totalBal = active.reduce((s, b) => s + Number(b.balance), 0);
  if (totalBal === 0) return 0;
  const weightedSum = active.reduce((s, b) => s + Number(b.balance) * ageDays(b.bill_date), 0);
  return weightedSum / totalBal;
};

export const paymentDot = (bills) => {
  const active = (bills || []).filter(b => Number(b.balance) > 0);
  if (active.length === 0) return { color: "#16a34a", title: "Fully paid" };
  const avg = weightedAvgAge(active);
  if (avg < 30)  return { color: "#16a34a", title: `Avg age ${Math.round(avg)}d — good payer` };
  if (avg < 60)  return { color: "#ca8a04", title: `Avg age ${Math.round(avg)}d — slow payer` };
  if (avg < 90)  return { color: "#ea580c", title: `Avg age ${Math.round(avg)}d — overdue` };
  return { color: "#dc2626", title: `Avg age ${Math.round(avg)}d — bad payer` };
};

export const pendingCheques = (cheques) => {
  if (!cheques) return [];
  return cheques.filter(c => c.status === "pending");
};

export const totalPendingCheques = (cheques) => {
  return pendingCheques(cheques).reduce((s, c) => s + Number(c.amount), 0);
};

export const fmtDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
