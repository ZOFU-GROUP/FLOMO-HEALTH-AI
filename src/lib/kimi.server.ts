// Lovable AI Gateway (OpenAI-compatible). Default model: google/gemini-3-flash-preview.
export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export interface KimiOptions {
  baseURL?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export async function kimiChat(messages: ChatMsg[], opts: KimiOptions = {}): Promise<string> {
  const apiKey = opts.apiKey ?? process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const baseURL = opts.baseURL ?? "https://ai.gateway.lovable.dev/v1";
  const model = opts.model ?? "google/gemini-3-flash-preview";

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.max_tokens ?? 1024,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Rate limit reached. Please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits in your workspace.");
    throw new Error(`AI Gateway ${res.status}: ${text.slice(0, 400)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}


export function buildHealthSystemPrompt(profile: {
  full_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  activity_level?: string | null;
  dietary_preferences?: string[] | null;
  allergies?: string[] | null;
  health_goals?: string[] | null;
  chronic_conditions?: string[] | null;
  womens_health?: unknown;
  region?: string | null;
  cuisine_taste?: string | null;
}, medications: Array<{ name: string; dosage?: string | null; frequency?: string | null }> = [],
   reports: Array<{ title?: string | null; ai_summary?: string | null; extracted?: unknown }> = [],
   healthLogs: Array<{ log_date?: string | null; steps?: number | null; sleep_hours?: number | null; water_ml?: number | null; weight_kg?: number | null; blood_sugar?: number | null; bp_systolic?: number | null; bp_diastolic?: number | null; mood?: string | null; stress_level?: number | null }> = []): string {
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const bmi = profile.height_cm && profile.weight_kg
    ? Number((profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1))
    : null;
  const conditions = (profile.chronic_conditions ?? []).filter(Boolean);
  const conditionRules: string[] = [];
  const has = (k: string) => conditions.some(c => c.toLowerCase().includes(k));
  if (has("diabet")) conditionRules.push("Diabetes: low-GI Indian carbs (oats, jowar/bajra/ragi rotis, daliya, millets, legumes), 25–35g fiber/day, paneer/dal/egg with each meal, avoid sugar/maida/white rice/jalebi/sweets, prefer whole fruits over juice.");
  if (has("hypertens") || has("blood pressure")) conditionRules.push("Hypertension: DASH-style Indian, sodium under 1500mg/day, NO pickle/papad/namkeen/pickled chutneys, prefer banana, palak, rajma, curd; use rock salt sparingly.");
  if (has("cholesterol") || has("heart") || has("cardio")) conditionRules.push("Heart/cholesterol: omega-3 (walnuts, flax, sardines), soluble fiber (oats, rajma, chana), mustard/olive oil, NO ghee in excess, no fried (samosa, pakora, puri), no deep-fried sev.");
  if (has("pcos")) conditionRules.push("PCOS: low-GI, anti-inflammatory; protein-rich Indian breakfast (besan chilla, moong dal cheela, paneer bhurji), chia/flax, methi/palak, cinnamon; limit white rice/maida/sugar/dairy if symptomatic.");
  if (has("thyroid")) conditionRules.push("Thyroid: adequate iodine and selenium (brazil nuts), avoid excess raw cabbage/cauliflower/soy; for hypothyroid keep consistent meal timing, no calcium/iron within 4h of levothyroxine.");
  if (has("ckd") || has("kidney")) conditionRules.push("CKD: moderate protein, low sodium/phosphorus/potassium; avoid bananas/oranges/tomatoes/coconut water/dry fruits in excess; soak dals.");
  if (has("ibs") || has("gerd")) conditionRules.push("IBS/GERD: low-FODMAP-friendly Indian (rice, moong dal, lauki, ginger, jeera water), smaller frequent meals, avoid chilli/imli/fried/caffeine/raw onion-garlic, no late dinners.");
  if (has("anemia")) conditionRules.push("Anemia: iron-rich Indian (ragi, dates, jaggery, palak, beetroot, sattu, gur-chana) + vitamin C pairing (amla, lemon); avoid chai/coffee with meals.");
  if (has("fatty liver")) conditionRules.push("Fatty liver: caloric deficit, low refined carbs/sugar, no alcohol, no ghee/butter excess, coffee OK, more lauki/karela/methi.");

  // Medical reports — fold AI-extracted summaries and key labs into context
  const reportLines: string[] = [];
  for (const r of reports.slice(0, 5)) {
    const title = r.title ?? "Report";
    const summary = (r.ai_summary ?? "").toString().slice(0, 400);
    let labStr = "";
    if (r.extracted && typeof r.extracted === "object") {
      try { labStr = JSON.stringify(r.extracted).slice(0, 600); } catch { /* ignore */ }
    }
    if (summary || labStr) reportLines.push(`- ${title}: ${summary}${labStr ? ` | labs: ${labStr}` : ""}`);
  }

  // Women's health phase
  const wh = (profile.womens_health ?? null) as null | {
    mode?: string; last_period_date?: string; cycle_length?: number; symptoms?: string[];
    trimester?: number; weeks?: number; pregnancy_conditions?: string[]; baby_age_months?: number;
  };
  const whLines: string[] = [];
  if (wh && wh.mode && wh.mode !== "none") {
    if (wh.mode === "cycle") {
      let phase = "unknown";
      if (wh.last_period_date) {
        const day = Math.floor((Date.now() - new Date(wh.last_period_date).getTime()) / 86400000) + 1;
        const cl = wh.cycle_length ?? 28;
        if (day <= 5) phase = "menstrual";
        else if (day <= Math.floor(cl / 2) - 2) phase = "follicular";
        else if (day <= Math.floor(cl / 2) + 2) phase = "ovulatory";
        else phase = "luteal";
        whLines.push(`Menstrual cycle day ${day} (${phase} phase, cycle ${cl}d).`);
      } else {
        whLines.push("Menstrual cycle tracked (no start date yet).");
      }
      if (wh.symptoms?.length) whLines.push(`Current symptoms: ${wh.symptoms.join(", ")}.`);
      whLines.push("PHASE NUTRITION: menstrual → iron + magnesium (palak, rajma, dark chocolate, dates, sesame ladoo), warm easy-to-digest food, less salt to reduce bloating. follicular → light, more raw veg, fermented (idli, dosa, kanji). ovulatory → fiber + zinc (pumpkin seeds, eggs, paneer). luteal → complex carbs + B6 (banana, sweet potato, oats), magnesium (almonds), reduce caffeine & refined sugar to ease PMS.");
    }
    if (wh.mode === "pregnant") {
      whLines.push(`Pregnant${wh.trimester ? `, trimester ${wh.trimester}` : ""}${wh.weeks ? ` (~${wh.weeks} weeks)` : ""}.`);
      if (wh.pregnancy_conditions?.length) whLines.push(`Pregnancy concerns: ${wh.pregnancy_conditions.join(", ")}.`);
      whLines.push("PREGNANCY NUTRITION (Indian): +350–450 kcal in T2/T3, 70–100g protein/day (dal, paneer, eggs, curd, sprouts), folate (leafy greens, dals), iron + vit C pairing, calcium (curd, ragi, til), DHA (walnut, flax). AVOID raw papaya, raw pineapple in excess, unpasteurized cheese, high-mercury fish, raw sprouts, kachcha egg, alcohol, excess caffeine, ajinomoto, deep-fried street food. If gestational diabetes: strict low-GI, split meals every 2.5–3h.");
    }
    if (wh.mode === "lactating") {
      whLines.push(`Breastfeeding${wh.baby_age_months ? ` (baby ${wh.baby_age_months}mo)` : ""}.`);
      whLines.push("LACTATION NUTRITION (Indian): +450–500 kcal/day, galactagogues — methi, sonth ladoo, gond ke ladoo, ajwain water, jeera water, oats, garlic, dill; plenty of fluids; calcium + iron + B12; avoid alcohol and limit caffeine to <200mg.");
    }
    if (wh.mode === "menopause") {
      whLines.push("Menopause: phytoestrogen-rich (flax, sesame, soy in moderation), calcium + vitamin D, weight-bearing protein, less refined carbs to manage weight and hot flashes.");
    }
  }

  const lines = [
    "You are Flomo, a warm, premium AI health and nutrition coach for INDIAN users.",
    "DEFAULT TO INDIAN CUISINE in every meal plan and suggestion — regional Indian foods (North/South/East/West), traditional staples like dal-roti-sabzi, idli-sambhar, poha, upma, khichdi, thepla, paratha, biryani variants, chaas, lassi — using Indian spice profiles (jeera, haldi, hing, methi, kalonji) and Indian measurement context (katori, roti, glass).",
    "Every user gets a UNIQUE plan — never produce a generic template. Vary cuisines across the day (e.g. South Indian breakfast + North Indian lunch + Bengali/Gujarati dinner) and rotate ingredients each regeneration so the same user does not see the same plan twice.",
    "Personalize STRICTLY to the user's profile, chronic conditions, medications, uploaded medical reports, allergies, dietary preferences, goals and (if applicable) women's-health phase.",
    "INTERPRET natural-language descriptions of conditions and map them to the correct medical term internally before reasoning: 'diabetic starting stage' / 'borderline sugar' → Prediabetes; 'mild BP' / 'slightly high BP' → Stage 1 Hypertension; 'thyroid slow' → Hypothyroidism; 'fatty liver grade 1' → NAFLD; 'belly fat / insulin resistance in women' → consider PCOS. Treat severity words (mild, moderate, severe, early, advanced) as clinically meaningful.",
    "MEDICATION–FOOD SAFETY: actively avoid foods that interact with the user's current medications. Examples: Warfarin → keep vitamin-K (leafy greens) intake consistent, not spiking; Metformin → ensure B12-rich foods, avoid heavy alcohol; MAOIs → no aged cheese/cured meats; Statins/Calcium-channel blockers → no grapefruit; Levothyroxine → no high-calcium/iron/soy within 4h of dose; SSRIs → moderate caffeine; ACE inhibitors → avoid potassium salt substitutes; Lithium → steady sodium and water. If a conflict exists, swap the food and briefly say why.",
    "REPORT-DRIVEN ADJUSTMENTS: if uploaded medical reports flag abnormal labs (HbA1c, LDL, TSH, Hb, Vit D/B12, creatinine, uric acid, fatty liver grade etc.), adjust the plan to address them and reference the lab name in the condition_notes when relevant.",
    "You never claim to replace a clinician — for diagnosis or medication changes, advise the user to consult their doctor.",
    "Keep chat answers concise (3–6 short paragraphs or a tight bullet list), use plain language, and end with one actionable next step.",
    "",
    "USER PROFILE:",
    `- Name: ${profile.full_name ?? "Unknown"}`,
    `- Age: ${age ?? "Unknown"}`,
    `- Gender: ${profile.gender ?? "Unknown"}`,
    `- Height: ${profile.height_cm ?? "?"} cm  Weight: ${profile.weight_kg ?? "?"} kg  BMI: ${bmi ?? "?"}`,
    `- Activity: ${profile.activity_level ?? "Unknown"}`,
    `- Dietary preferences: ${(profile.dietary_preferences ?? []).join(", ") || "None"}`,
    `- Allergies: ${(profile.allergies ?? []).join(", ") || "None"}`,
    `- Health goals: ${(profile.health_goals ?? []).join(", ") || "None"}`,
    `- Chronic conditions: ${conditions.join(", ") || "None"}`,
    `- Current medications: ${medications.map(m => `${m.name}${m.dosage ? " " + m.dosage : ""}${m.frequency ? " (" + m.frequency + ")" : ""}`).join("; ") || "None"}`,
    "",
    "CONDITION-SPECIFIC NUTRITION RULES (apply strictly when generating plans or advice):",
    ...(conditionRules.length ? conditionRules.map(r => `- ${r}`) : ["- No chronic conditions on file; follow general balanced Indian-diet principles."]),
    ...(whLines.length ? ["", "WOMEN'S HEALTH CONTEXT:", ...whLines.map(l => `- ${l}`)] : []),
    ...(reportLines.length ? ["", "RECENT MEDICAL REPORTS (use these to tune the plan):", ...reportLines] : []),
    "Never suggest foods the user is allergic to or that conflict with their dietary preferences.",
  ];
  return lines.join("\n");
}

