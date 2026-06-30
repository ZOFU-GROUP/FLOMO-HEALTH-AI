import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export const generateMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { kimiChat, buildHealthSystemPrompt } = await import("@/lib/kimi.server");
    const [{ data: profile }, { data: meds }, { data: reports }, { data: logs }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("medications").select("name,dosage,frequency").eq("user_id", userId).eq("active", true),
      supabase.from("medical_reports").select("title,ai_summary,extracted").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(5),
      supabase.from("health_logs").select("log_date,steps,sleep_hours,water_ml,weight_kg,blood_sugar,bp_systolic,bp_diastolic,mood,stress_level")
        .eq("user_id", userId).order("log_date", { ascending: false }).limit(10),
    ]);

    const sys = buildHealthSystemPrompt(profile ?? {}, meds ?? [], reports ?? [], logs ?? []);
    const seed = Math.random().toString(36).slice(2, 8);
    const prompt = [
      "Generate a one-day INDIAN meal plan tailored to this user's conditions, medications, reports, allergies, goals and (if present) women's-health phase.",
      "Mix regions across the day (e.g. South Indian breakfast, Punjabi lunch, Gujarati/Bengali dinner) and pick everyday Indian dishes — no generic 'grilled chicken salad' style placeholders.",
      `Variation seed: ${seed} — make today's plan visibly different from a previous one for this user (different dishes, grains, dals, vegetables).`,
      "Every meal MUST visibly respect the user's chronic conditions, medications and any women's-health phase noted in the system prompt.",
      "Respond as STRICT JSON only (no fences) matching:",
      "{ totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };",
      "  meals: { name: 'Breakfast'|'Mid-morning'|'Lunch'|'Snack'|'Dinner'; title: string; description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; ingredients: string[]; condition_notes: string }[];",
      "  grocery: { name: string; quantity: string; category: 'Produce'|'Pantry'|'Dairy'|'Protein'|'Spices'|'Other'; necessary: boolean }[] }",
      "condition_notes: one short sentence (max 22 words) explaining WHY this dish fits this user's specific conditions / meds / cycle / pregnancy / reports.",
      "necessary: true only when the item is required to cook this plan AND is not a basic pantry staple (salt, oil, common Indian spices, water). Mark staples as false.",
    ].join("\n");

    const raw = await kimiChat([
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ], { temperature: 0.8, max_tokens: 2400 });


    let plan: Json;
    let parsed: { grocery?: Array<{ name: string; quantity?: string; category?: string; necessary?: boolean }> } = {};
    try {
      const cleaned = raw.replace(/^```json\s*|^```\s*|\s*```$/gm, "").trim();
      parsed = JSON.parse(cleaned);
      plan = parsed as Json;
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

    // Daily grocery reset: wipe ALL plan-sourced items from previous days,
    // and any unchecked plan-sourced items from today. Manual items are kept.
    await supabase.from("grocery_items").delete()
      .eq("user_id", userId).eq("source", "plan").lt("plan_date", today);
    await supabase.from("grocery_items").delete()
      .eq("user_id", userId).eq("source", "plan").eq("checked", false);

    const necessary = (parsed.grocery ?? []).filter(g => g && g.name && g.necessary !== false);
    if (necessary.length) {
      const rows = necessary.slice(0, 100).map(g => ({
        user_id: userId,
        name: g.name.trim().slice(0, 120),
        quantity: g.quantity?.slice(0, 60) ?? null,
        category: (g.category ?? "Other").slice(0, 40),
        checked: false,
        source: "plan",
        plan_date: today,
      }));
      const { error: gErr } = await supabase.from("grocery_items").insert(rows);
      if (gErr) console.error("grocery insert", gErr);
    }

    return { plan, id: inserted?.id ?? null, groceryAdded: necessary.length };
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
