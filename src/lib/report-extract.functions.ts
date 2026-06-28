import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";

const ExtractInput = z.object({
  report_id: z.string().uuid(),
  notes: z.string().trim().min(10).max(8000),
});

export const extractReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ExtractInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { kimiChat } = await import("@/lib/kimi.server");

    const system = [
      "You are a clinical lab-report extractor.",
      "From the raw text of a medical report or lab result, produce a concise plain-language summary and a structured JSON of key labs.",
      "Output STRICT JSON only matching this TypeScript type:",
      "{ summary: string; labs: { name: string; value: string; unit?: string; flag?: 'low'|'normal'|'high'|'critical' }[]; recommendations: string[] }",
      "Do not include code fences. Do not include any text outside the JSON.",
    ].join("\n");

    const raw = await kimiChat([
      { role: "system", content: system },
      { role: "user", content: data.notes },
    ], { temperature: 0.2, max_tokens: 1200 });

    let parsed: Json;
    try {
      const cleaned = raw.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
      parsed = JSON.parse(cleaned) as Json;
    } catch {
      parsed = { summary: raw, labs: [], recommendations: [] } as Json;
    }

    const summary = (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as { summary?: unknown }).summary === "string")
      ? (parsed as { summary: string }).summary
      : "";
    const { error } = await supabase
      .from("medical_reports")
      .update({ ai_summary: summary, extracted: parsed, status: "ready" })
      .eq("id", data.report_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { ok: true, extracted: parsed };
  });
