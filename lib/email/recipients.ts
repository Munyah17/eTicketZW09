import { createAdminClient } from "@/lib/supabase/admin";

// Owner super admin — hard fallback so notifications still reach someone
// even if the profiles query fails or returns nothing.
const OWNER_FALLBACK = "munyah777@gmail.com";

// Every notification email replies to the super admin(s), per platform
// policy — replies land with a human, not the sending mailbox.
export async function getSuperAdminEmails(): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("role", "super_admin");
    const emails = (data ?? [])
      .map((p) => p.email as string | null)
      .filter((e): e is string => !!e);
    return emails.length > 0 ? emails : [OWNER_FALLBACK];
  } catch {
    return [OWNER_FALLBACK];
  }
}
