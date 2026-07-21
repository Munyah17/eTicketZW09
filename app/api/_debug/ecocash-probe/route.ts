import { NextResponse } from "next/server";

// Temporary diagnostic route — not linked from anywhere, deleted once the
// EcoCash Cloudflare-block investigation is done.
export async function GET() {
  const username = process.env.ECOCASH_EIP_USERNAME || "";
  const password = process.env.ECOCASH_EIP_PASSWORD || "";
  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  const body = {
    clientCorrelator: `PROBE-${Date.now()}`,
    notifyUrl: "",
    referenceCode: `PROBE-${Date.now()}`,
    tranType: "MER",
    endUserId: "773909307",
    remarks: "Probe",
    transactionOperationStatus: "Charged",
    paymentAmount: {
      charginginformation: { amount: 2, currency: "USD", description: "UAT STORE 3" },
      chargeMetaData: { channel: "POS" },
    },
    merchantCode: process.env.ECOCASH_MERCHANT_CODE,
    merchantPin: process.env.ECOCASH_MERCHANT_PIN,
    merchantNumber: process.env.ECOCASH_MERCHANT_NUMBER,
    countryCode: "ZW",
    terminalID: process.env.ECOCASH_TERMINAL_ID,
    location: "Harare",
    superMerchantName: "ECOCASH",
    merchantName: "UAT STORE 3",
  };

  try {
    const res = await fetch(`${process.env.ECOCASH_EIP_BASE_URL}/transactions/amount/`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: "https://developers.ecocash.co.zw",
        Referer: "https://developers.ecocash.co.zw/",
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    return NextResponse.json({
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      bodyPreview: text.slice(0, 1500),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
