import { supabase } from "./supabase";

const BUCKET = "bill-pdfs";

// Upload a PDF and return its storage path
export async function uploadBillPDF(file, billId) {
  const ext = file.name.split(".").pop();
  const path = `${billId}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: "application/pdf"
  });
  if (error) throw new Error("Upload failed: " + error.message);
  return path;
}

// Get a short-lived signed URL to view a PDF
export async function getBillPDFUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error) throw new Error("Could not get PDF URL");
  return data.signedUrl;
}

// Delete a PDF from storage
export async function deleteBillPDF(path) {
  await supabase.storage.from(BUCKET).remove([path]);
}

// Delete PDFs for all bills that were settled more than 2 days ago
export async function cleanupSettledBillPDFs() {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data: settled } = await supabase
    .from("bills")
    .select("id, pdf_path, settled_at")
    .not("pdf_path", "is", null)
    .lt("settled_at", twoDaysAgo);

  if (!settled || settled.length === 0) return 0;

  const paths = settled.map(b => b.pdf_path);
  await supabase.storage.from(BUCKET).remove(paths);

  // Clear pdf_path from bills
  for (const bill of settled) {
    await supabase.from("bills").update({ pdf_path: null }).eq("id", bill.id);
  }

  return settled.length;
}
