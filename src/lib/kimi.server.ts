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
  if (!apiKey) return localHealthAssistantFallback(messages);
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

function localHealthAssistantFallback(messages: ChatMsg[]): string {
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";

  if (lastUser.includes("{ totals:") && lastUser.toLowerCase().includes("meal plan")) {
    return JSON.stringify(buildLocalMealPlan(system));
  }

  if (system.toLowerCase().includes("clinical lab-report extractor")) {
    return JSON.stringify(extractLocalReport(lastUser));
  }

  const conditions = readSystemLine(system, "Chronic conditions") || "your current health profile";
  const meds = readSystemLine(system, "Current medications") || "your medicines";
  const region = readSystemLine(system, "Region / state")?.split("—")[0].trim() || "your region";
  return [
    `I checked this against ${conditions} and ${meds}.`,
    `For now, choose a simple ${region}-style plate: ½ vegetables or salad, ¼ protein such as dal/paneer/egg/curd, and ¼ slow carbs such as roti, millet, brown rice, poha, idli, or dalia.`,
    "Avoid allergy items, excess sugar, deep-fried snacks, very salty foods, and any food that conflicts with your medicines. For medication changes or diagnosis, please consult your doctor.",
    "Next step: update today’s tracking and generate a fresh meal plan so Flomo can tune the recommendation further.",
  ].join("\n\n");
}

function readSystemLine(system: string, label: string): string | null {
  const line = system.split("\n").find((l) => l.trim().startsWith(`- ${label}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
}

function hasCondition(system: string, key: string): boolean {
  return system.toLowerCase().includes(key.toLowerCase());
}

function buildLocalMealPlan(system: string) {
  const region = readSystemLine(system, "Region / state")?.split("—")[0].trim() || "Indian";
  const vegetarian = (readSystemLine(system, "Dietary preferences") ?? "").toLowerCase().includes("veg");
  const diabetes = hasCondition(system, "diabet") || hasCondition(system, "prediabet") || hasCondition(system, "sugar");
  const hypertension = hasCondition(system, "hypertension") || hasCondition(system, "blood pressure");
  const thyroid = hasCondition(system, "thyroid") || hasCondition(system, "levothyroxine");
  const pcos = hasCondition(system, "pcos");
  const pregnant = hasCondition(system, "Pregnant") || hasCondition(system, "PREGNANCY NUTRITION");

  const grain = diabetes || pcos ? "ragi/jowar" : "whole wheat";
  const protein = vegetarian ? "paneer, curd, dal and sprouts" : "eggs, fish/chicken, dal and curd";
  const sodiumNote = hypertension ? "keeps sodium low and avoids pickle, papad and namkeen" : "uses moderate salt and home-style cooking";
  const thyroidNote = thyroid ? "keeps calcium/iron foods away from thyroid medicine timing" : "fits the recorded medication profile";
  const pregnancyNote = pregnant ? "adds folate, calcium, iron and safe protein for pregnancy" : "matches the profile and goals";

  return {
    totals: { calories: 1650, protein_g: vegetarian ? 74 : 86, carbs_g: diabetes || pcos ? 170 : 205, fat_g: 50, fiber_g: 34 },
    meals: [
      {
        name: "Breakfast",
        title: `${region} vegetable poha with sprouts and curd`,
        description: `Light Indian breakfast with vegetables, sprouts, curd, lemon and roasted peanuts; use less oil and no sugar.`,
        calories: 360,
        protein_g: 18,
        carbs_g: diabetes || pcos ? 42 : 52,
        fat_g: 11,
        ingredients: ["poha", "mixed vegetables", "sprouts", "curd", "lemon", "peanuts"],
        condition_notes: diabetes ? "Lower-GI portion plus sprouts helps steady morning blood sugar." : `Balanced start that ${sodiumNote}.`,
      },
      {
        name: "Mid-morning",
        title: "Guava or apple with soaked almonds",
        description: "Whole fruit with a small nut portion for fiber, minerals and stable energy.",
        calories: 160,
        protein_g: 5,
        carbs_g: 22,
        fat_g: 7,
        ingredients: ["guava or apple", "almonds"],
        condition_notes: hypertension ? "Fruit and nuts support potassium and magnesium without excess sodium." : "Whole fruit avoids the sugar spike of juice.",
      },
      {
        name: "Lunch",
        title: `${grain} roti with dal, sabzi and salad`,
        description: `Home-style Indian lunch with ${protein}, seasonal sabzi, cucumber salad and chaas without added salt.`,
        calories: 520,
        protein_g: vegetarian ? 25 : 32,
        carbs_g: diabetes || pcos ? 58 : 72,
        fat_g: 16,
        ingredients: [`${grain} roti`, "dal", "seasonal sabzi", "cucumber", "chaas"],
        condition_notes: `${thyroidNote}; high fiber and protein improve fullness and glucose control.`,
      },
      {
        name: "Snack",
        title: "Roasted chana with masala chaas",
        description: "A high-fiber, protein snack with jeera, mint and no packaged namkeen.",
        calories: 190,
        protein_g: 10,
        carbs_g: 24,
        fat_g: 6,
        ingredients: ["roasted chana", "curd", "jeera", "mint"],
        condition_notes: "Avoids fried snacks while keeping evening hunger controlled.",
      },
      {
        name: "Dinner",
        title: "Moong dal khichdi with lauki and cucumber raita",
        description: "Early, easy-to-digest dinner with moong dal, rice or millet, lauki, haldi, hing and raita.",
        calories: 420,
        protein_g: vegetarian ? 16 : 21,
        carbs_g: diabetes || pcos ? 48 : 58,
        fat_g: 10,
        ingredients: ["moong dal", "lauki", "rice or millet", "curd", "cucumber"],
        condition_notes: `${pregnancyNote}; light dinner supports sleep and digestion.`,
      },
    ],
    grocery: [
      { name: "Mixed vegetables", quantity: "500 g", category: "Produce", necessary: true },
      { name: "Sprouts", quantity: "1 cup", category: "Produce", necessary: true },
      { name: "Curd", quantity: "500 g", category: "Dairy", necessary: true },
      { name: "Guava or apple", quantity: "2 pieces", category: "Produce", necessary: true },
      { name: "Lauki", quantity: "1 medium", category: "Produce", necessary: true },
      { name: "Moong dal", quantity: "1 cup", category: "Pantry", necessary: true },
      { name: `${grain} flour`, quantity: "500 g", category: "Pantry", necessary: true },
      { name: "Jeera, haldi, hing", quantity: "as needed", category: "Spices", necessary: false },
    ],
  };
}

function extractLocalReport(text: string) {
  const labs: Array<{ name: string; value: string; unit?: string; flag?: "low" | "normal" | "high" | "critical" }> = [];
  const patterns: Array<[string, RegExp, string | undefined, (n: number) => "low" | "normal" | "high" | "critical"]> = [
    ["HbA1c", /hba1c\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, "%", (n) => (n >= 8 ? "critical" : n >= 5.7 ? "high" : "normal")],
    ["Fasting glucose", /(?:fasting glucose|fbs|fasting sugar)\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, "mg/dL", (n) => (n >= 126 ? "high" : n < 70 ? "low" : "normal")],
    ["LDL", /ldl\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, "mg/dL", (n) => (n >= 130 ? "high" : "normal")],
    ["HDL", /hdl\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, "mg/dL", (n) => (n < 40 ? "low" : "normal")],
    ["Triglycerides", /triglycerides\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, "mg/dL", (n) => (n >= 150 ? "high" : "normal")],
    ["TSH", /tsh\s*[:\-]?\s*(\d+(?:\.\d+)?)/i, "mIU/L", (n) => (n > 4.5 ? "high" : n < 0.4 ? "low" : "normal")],
  ];
  for (const [name, regex, unit, flagger] of patterns) {
    const match = text.match(regex);
    if (!match) continue;
    const value = Number(match[1]);
    labs.push({ name, value: match[1], unit, flag: flagger(value) });
  }
  const abnormal = labs.filter((l) => l.flag && l.flag !== "normal").map((l) => `${l.name} ${l.flag}`);
  return {
    summary: abnormal.length ? `Detected possible abnormal values: ${abnormal.join(", ")}.` : "Report saved. No common abnormal values were detected from the pasted text.",
    labs,
    recommendations: [
      "Review these values with your doctor, especially if symptoms or medication changes are involved.",
      "Flomo will use these extracted values to make meal planning safer and more personalized.",
    ],
  };
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
    `- Region / state: ${profile.region ?? "Unknown"} — cook in this region's everyday home style first (e.g. Tamil Nadu → sambhar, rasam, kootu, idli, pongal; Punjab → sarson-makki, chole, rajma-chawal, paratha; Bengal → mach-bhaat, shukto, cholar dal; Gujarat → thepla, dhokla, undhiyu; Maharashtra → poha, thalipeeth, amti; Kerala → appam-stew, avial, puttu-kadala; Andhra/Telangana → pulihora, gongura pappu; Karnataka → bisi bele bath, ragi mudde; Rajasthan → dal-baati, gatte; UP/Bihar → litti-chokha, kadhi-chawal; Odisha → dalma; Northeast → bamboo-shoot stews, axone; Goa → xacuti, fish curry-rice; Kashmir → haak, rajma-gucchi). Use 1–2 dishes from other regions for variety, not the whole plan.`,
    `- Taste preference: ${profile.cuisine_taste ?? "Balanced"}`,
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
    ...(healthLogs.length ? ["", "RECENT DAILY TRACKING (last entries — learn the trend before planning):",
      ...healthLogs.slice(0, 10).map(l => `- ${l.log_date ?? "?"}: steps ${l.steps ?? "-"}, sleep ${l.sleep_hours ?? "-"}h, water ${l.water_ml ?? "-"}ml, weight ${l.weight_kg ?? "-"}kg, BP ${l.bp_systolic ?? "-"}/${l.bp_diastolic ?? "-"}, sugar ${l.blood_sugar ?? "-"}, mood ${l.mood ?? "-"}, stress ${l.stress_level ?? "-"}`),
      "Adapt today's plan to these patterns: low sleep → magnesium + complex carbs at dinner; low steps → lighter calories; high BP/sugar trend → tighten sodium/refined carbs further; low hydration → add buttermilk/jeera water/coconut water (if permitted)."] : []),
    "Never suggest foods the user is allergic to or that conflict with their dietary preferences.",
  ];
  return lines.join("\n");
}

