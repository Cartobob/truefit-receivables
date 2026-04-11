// Extracts bill fields from a Tally invoice PDF
// Calls our Vercel serverless proxy which forwards to Anthropic API

export async function extractInvoiceFromPDF(file) {
  const base64 = await fileToBase64(file);

  let response;
  try {
    response = await fetch("/api/extract-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: `You are extracting fields from a Tally-generated tax invoice PDF for Truefit Skim Coat Products / Padmavathi Agencies.
Extract exactly these fields and return ONLY valid JSON, no other text:
{
  "bill_no": "e.g. PA/26-27/060 or TF/26-27/123",
  "bill_date": "YYYY-MM-DD format",
  "amount": 15800.00,
  "buyer": "buyer name as written"
}
The amount is the final bill total (from the New Ref line or Total line, inclusive of GST).
The bill_no starts with PA/ or TF/.
Return ONLY the JSON object, nothing else.`,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 }
              },
              { type: "text", text: "Extract the invoice fields from this PDF." }
            ]
          }
        ]
      })
    });
  } catch (fetchErr) {
    throw new Error("Network error: " + fetchErr.message);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${data.error?.message || JSON.stringify(data)}`);
  }

  const text = data.content?.find(b => b.type === "text")?.text || "";

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (!parsed.bill_no || !parsed.amount) throw new Error("Missing required fields");
    return parsed;
  } catch {
    throw new Error("Could not parse invoice: " + text);
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
