import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentService } from "@/lib/services/payment-service";
import { notifyBankTransferSubmitted } from "@/lib/bank-transfer-notifications";
import { logError } from "@/lib/error-logger";

// Buyer-side bank transfer submission: transaction reference + optional proof
// of payment file. The reference is the payment's secret (a UUID the buyer
// gets at checkout), same trust model as the confirmation/retrieve routes.
//
// Accepts multipart/form-data:
//   transaction_reference — the bank's txn ref from the deposit/transfer
//   proof                 — the proof file (any format: PDF, image, etc.)
//
// Either or both may arrive — the confirmation page also lets a buyer who
// skipped the upload at checkout (or was asked for more info) submit later.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const payment = await PaymentService.getPayment(reference);

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.provider !== "bank_transfer") {
    return NextResponse.json({ error: "Not a bank transfer payment" }, { status: 400 });
  }
  if (payment.status !== "on_hold") {
    return NextResponse.json(
      { error: "This order has already been reviewed" },
      { status: 409 }
    );
  }

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const txnRef = String(form.get("transaction_reference") ?? "").trim();
  const file = form.get("proof") as File | null;

  if (!txnRef && (!file || file.size === 0)) {
    return NextResponse.json(
      { error: "Provide a transaction reference and/or a proof of payment file" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const metadata = { ...(payment.metadata ?? {}) } as Record<string, unknown>;

  if (file && file.size > 0) {
    // ~20MB cap, matching the bucket limit — proof files are usually
    // screenshots or one-page PDFs, anything bigger is likely a mistake.
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "Proof file is too large (max 20MB)" }, { status: 400 });
    }
    // Keep the original extension for the admin's viewer; sanitize the name
    // part so it can't escape the reference folder.
    const rawName = (file.name || "proof").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `${reference}/${Date.now()}-${rawName}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(path, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      logError("bank_transfer_proof_upload", new Error(uploadError.message), { reference });
      return NextResponse.json({ error: "Failed to save proof of payment" }, { status: 500 });
    }

    metadata.proof_path = path;
    metadata.proof_filename = file.name || rawName;
    metadata.proof_uploaded_at = new Date().toISOString();
  }

  if (txnRef) {
    metadata.transaction_reference = txnRef;
  }

  // Any fresh submission after an info request sends the order back to
  // "awaiting review" — the admin queue is what matters, not which round.
  metadata.review_status = "awaiting_review";

  const { error: updateError } = await supabase
    .from("payments")
    .update({ metadata, review_status: "awaiting_review" })
    .eq("reference", reference);

  if (updateError) {
    logError("bank_transfer_submission_update", new Error(updateError.message), { reference });
    return NextResponse.json({ error: "Failed to record submission" }, { status: 500 });
  }

  const m = metadata;
  // System notification channels: super admin email + ops SMS. Fire-and-
  // forget — the submission is already recorded, a notification hiccup
  // must not fail the buyer's request.
  notifyBankTransferSubmitted({
    reference,
    eventTitle: m.eventTitle as string | undefined,
    buyerName: m.buyerName as string | undefined,
    buyerEmail: m.buyerEmail as string | undefined,
    buyerPhone: m.buyerPhone as string | undefined,
    amount: payment.amount,
    currency: payment.currency,
    transactionReference: (m.transaction_reference as string) || txnRef || undefined,
    hasProof: !!m.proof_path,
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
