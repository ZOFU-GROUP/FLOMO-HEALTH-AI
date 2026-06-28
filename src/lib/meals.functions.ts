import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export const generateMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { kimiChat, buildHealthSystemPrompt } = await import("@/lib/kimi.server");
    const [{ data: profile }, { data: meds }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("medications").select("name,dosage,frequency").eq("user_id", userId).eq("active", true),
    ]);

    const sys = buildHealthSystemPrompt(profile ?? {}, meds ?? []);
    const prompt = [
      "Generate a one-day Indian-friendly meal plan tailored to the user's conditions, goals, allergies, and preferences.",
      "Respond as STRICT JSON only (no fences) matching:",
      "{ totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };",
      "  meals: { name: 'Breakfast'|'Mid-morning'|'Lunch'|'Snack'|'Dinner'; title: string; description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; ingredients: string[] }[];",
      "  grocery: { name: string; quantity: string; category: 'Produce'|'Pantry'|'Dairy'|'Protein'|'Spices'|'Other' }[] }",
    ].join("\n");

    const raw = await kimiChat([
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ], { temperature: 0.5, max_tokens: 1800 });

    let plan: Json;
    try {
      const cleaned = raw.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
      plan = JSON.parse(cleaned) as Json;
    } catch {
      throw new Error("AI returned an invalid plan. Please try again.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: inserted, error: insErr } = await supabase
      .from("meal_plans")
      .insert({ user_id: userId, plan_date: today, plan })
      .select()
      .single();
    if (insErr) console.error(insErr);

    return { plan, id: inserted?.id ?? null };
  });

export const addPlanToGrocery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const arr = (d as { items: Array<{ name: string; quantity?: string; category?: string }> }).items;
    if (!Array.isArray(arr)) throw new Error("items required");
    return { items: arr.slice(0, 100) };
  })
  .handler(async ({ data, context }) => {
    const rows = data.items
      .filter(i => i.name && i.name.trim())
      .map(i => ({
        user_id: context.userId,
        name: i.name.trim().slice(0, 120),
        quantity: i.quantity?.slice(0, 60) ?? null,
        category: i.category?.slice(0, 40) ?? "Other",
        checked: false,
      }));
    if (!rows.length) return { inserted: 0 };
    const { error } = await context.supabase.from("grocery_items").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });
