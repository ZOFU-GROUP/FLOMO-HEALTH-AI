import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  message: z.string().trim().min(1).max(4000),
});

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ChatInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { kimiChat, buildHealthSystemPrompt } = await import("@/lib/kimi.server");

    const [{ data: profile }, { data: meds }, { data: history }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("medications").select("name,dosage,frequency").eq("user_id", userId).eq("active", true),
      supabase.from("chat_messages").select("role,content").eq("user_id", userId).order("created_at", { ascending: true }).limit(40),
    ]);

    const system = buildHealthSystemPrompt(profile ?? {}, meds ?? []);
    const messages = [
      { role: "system" as const, content: system },
      ...(history ?? []).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user" as const, content: data.message },
    ];

    const reply = await kimiChat(messages);

    const { error: insertErr } = await supabase.from("chat_messages").insert([
      { user_id: userId, role: "user", content: data.message },
      { user_id: userId, role: "assistant", content: reply },
    ]);
    if (insertErr) console.error("chat insert", insertErr);

    return { reply };
  });

export const clearCoachHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
