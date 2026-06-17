import { supabase } from "./supabase";

// Log an admin action to the activity_log table
export async function logActivity(action, description, dealerName = null, amount = null) {
  try {
    await supabase.from("activity_log").insert({
      action,
      description,
      dealer_name: dealerName,
      amount: amount != null ? Number(amount) : null,
    });
  } catch (e) {
    console.warn("Activity log failed:", e);
  }
}

// Fetch all entries and build one complete markdown file (newest day first, numbered per day)
export async function downloadActivityLog() {
  const { data: rows } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) {
    alert("No activity logged yet.");
    return;
  }

  // Group by date (local)
  const groups = {};
  for (const r of rows) {
    const d = new Date(r.created_at);
    const dateKey = d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(r);
  }

  // Build markdown — newest day first; within a day, oldest action first (numbered 1..n)
  let md = `# Truefit Receivables — Activity Log\n\n_Generated ${new Date().toLocaleString("en-IN")}_\n\n`;

  for (const dateKey of Object.keys(groups)) {
    md += `## ${dateKey}\n\n`;
    const dayRows = groups[dateKey].slice().reverse(); // oldest first within the day
    dayRows.forEach((r, i) => {
      const time = new Date(r.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      md += `${i + 1}. ${time} — ${r.description}\n`;
    });
    md += `\n`;
  }

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `activity-log-${new Date().toISOString().split("T")[0]}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// Fetch entries grouped for on-screen display (newest day first)
export async function fetchActivityGrouped() {
  const { data: rows } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false });

  const groups = {};
  for (const r of rows || []) {
    const d = new Date(r.created_at);
    const dateKey = d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(r);
  }
  return groups;
}
