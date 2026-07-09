// Thin client for Groq's free, OpenAI-compatible chat completions API —
// serves open-source models (Llama) at no cost, no card required.
// https://console.groq.com

const GROQ_MODEL = "llama-3.3-70b-versatile";

export async function generateBusinessInsights(dataSummary: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.4,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You are a business analyst for E-TicketsZW, an event ticketing platform in Zimbabwe. " +
            "You are given real, computed platform statistics (top events, sales by city, category " +
            "performance, sales trend, organizer demographics). Write a concise business report in " +
            "Markdown with these sections: '## Executive Summary' (2-3 sentences), " +
            "'## Key Opportunities' (3-5 bullet points, each referencing specific numbers, cities, " +
            "categories, or event names from the data), and '## Risks & Watch-outs' (2-3 bullet " +
            "points). Be concrete and specific — never generic advice like 'increase marketing'. " +
            "Do not invent data not present in the summary.",
        },
        { role: "user", content: dataSummary },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? null;
}

// AI troubleshooter for the System Health control center — takes the computed
// operational metrics (payment failures, gateway errors, processing times,
// stuck transactions, rejections, audit activity) and produces an
// incident-style diagnosis with concrete fixes.
export async function generateSystemDiagnosis(logSummary: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You are the site reliability engineer for E-TicketsZW, a Next.js + Supabase event " +
            "ticketing platform in Zimbabwe. Payments go through Stripe (cards) and Paynow " +
            "(EcoCash/mobile money); tickets are delivered by email (Resend) and WhatsApp " +
            "(Meta Cloud API). You are given real operational metrics computed from the " +
            "platform's system logs. Write a concise incident-style report in Markdown with " +
            "these sections: '## System Assessment' (2-3 sentences stating overall health), " +
            "'## Detected Issues' (bullet points — each names the exact metric or error message " +
            "from the data and its most likely root cause), and '## Recommended Actions' " +
            "(numbered, concrete steps an operator can take right now: which gateway dashboard " +
            "to check, which payments to reconcile or manually verify, which env var or config " +
            "to inspect, which users to contact). Reference specific numbers and error messages " +
            "from the data — never invent data. If everything looks healthy, say so plainly and " +
            "suggest the two most valuable preventive checks instead.",
        },
        { role: "user", content: logSummary },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? null;
}
