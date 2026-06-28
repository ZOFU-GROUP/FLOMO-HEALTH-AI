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
}, medications: Array<{ name: string; dosage?: string | null; frequency?: string | null }> = []): string {
  const age = profile.date_of_birth
    ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  const bmi = profile.height_cm && profile.weight_kg
    ? Number((profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1))
    : null;
  const lines = [
    "You are Flomo, a warm, premium AI health and nutrition coach.",
    "You give personalized, practical, evidence-based guidance, in a calm, encouraging tone.",
    "You ALWAYS personalize to the user's profile, conditions, medications, allergies and goals.",
    "You never claim to replace a clinician — for diagnosis or medication changes, advise the user to consult their doctor.",
    "Keep answers concise (3–6 short paragraphs or a tight bullet list), use plain language, and end with one actionable next step.",
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
    `- Chronic conditions: ${(profile.chronic_conditions ?? []).join(", ") || "None"}`,
    `- Current medications: ${medications.map(m => `${m.name}${m.dosage ? " " + m.dosage : ""}${m.frequency ? " (" + m.frequency + ")" : ""}`).join("; ") || "None"}`,
  ];
  return lines.join("\n");
}
