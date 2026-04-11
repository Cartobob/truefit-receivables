export const fmt = (n) => "Rs." + Number(n).toLocaleString("en-IN");

export const ageDays = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

export const ageBucket = (days) => {
  if (days <= 30) return { label: "0-30 days", color: "#1a5c1a", bg: "#d4f0d4", border: "#a8dca8" };
  if (days <= 60) return { label: "31-60 days", color: "#7a3d00", bg: "#fde8d0", border: "#f0c090" };
  return { label: "60+ days", color: "#7a1a1a", bg: "#fdd8d8", border: "#f0a0a0" };
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
  if (bucket.label === "0-30 days") return "#5cb87c";
  if (bucket.label === "31-60 days") return "#f0b870";
  return "#e87878";
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
