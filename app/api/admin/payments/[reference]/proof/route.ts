import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";
import { PaymentService } from "@/lib/services/payment-service";

// Proof-of-payment files live in a PRIVATE bucket — this is the only way an
// admin sees one: a 10-minute signed URL minted on demand for a payment's
// recorded proof_path. The path itself is never treated as user input (it
// comes from our own metadata write at upload time).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { reference } = await params;
  const payment = await PaymentService.getPayment(reference);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const proofPath = payment.metadata?.proof_path as string | undefined;
  if (!proofPath) {
    return NextResponse.json({ error: "No proof of payment uploaded" }, { status: 404 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(proofPath, 600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not open proof of payment" }, { status: 500 });
  }

  return NextResponse.json({
    url: data.signedUrl,
    filename: (payment.metadata?.proof_filename as string) || "proof",
  });
}
