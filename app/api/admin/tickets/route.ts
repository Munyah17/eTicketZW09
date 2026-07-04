import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/server-auth";

const PAGE_SIZE = 25;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const supabase = createAdminClient();

  // Parallel: aggregate stats + paginated ticket list
  const [
    { count: totalCount },
    { count: validCount },
    { count: usedCount },
    { data: revenueRows },
    listResult,
  ] = await Promise.all([
    supabase.from("tickets").select("*", { count: "exact", head: true }),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("payment_status", "completed")
      .eq("validated", false),
    supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("validated", true),
    supabase.from("tickets").select("total_paid").eq("payment_status", "completed"),
    (() => {
      let q = supabase
        .from("tickets")
        .select(
          "id, event_title, event_date, ticket_type_name, buyer_name, buyer_display_name, buyer_contact, total_paid, currency, payment_status, validated, sale_type, purchased_at",
          { count: "exact" }
        )
        .order("purchased_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (search) {
        q = q.or(
          `event_title.ilike.%${search}%,buyer_name.ilike.%${search}%,buyer_email.ilike.%${search}%,id.ilike.%${search}%`
        );
      }

      return q;
    })(),
  ]);

  const revenue = (revenueRows ?? []).reduce((s, r) => s + Number(r.total_paid), 0);

  return NextResponse.json({
    stats: {
      total: totalCount ?? 0,
      valid: validCount ?? 0,
      used: usedCount ?? 0,
      revenue,
    },
    tickets: listResult.data ?? [],
    total: listResult.count ?? 0,
    page,
    pages: Math.ceil((listResult.count ?? 0) / PAGE_SIZE),
  });
}
