import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { sendCoachMessage, clearCoachHistory } from "@/lib/coach.functions";
import { Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/coach")({
  component: Coach,
});

function Coach() {
  const qc = useQueryClient();
  const send = useServerFn(sendCoachMessage);
  const clear = useServerFn(clearCoachHistory);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat_messages"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("chat_messages").select("*").eq("user_id", user.id).order("created_at");
      return data ?? [];
    },
  });

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, pending]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const msg = input.trim();
    if (!msg || pending) return;
    setInput("");
    setPending(true);
    try {
      await send({ data: { message: msg } });
      await qc.invalidateQueries({ queryKey: ["chat_messages"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coach is unavailable");
    } finally {
      setPending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const onClear = async () => {
    await clear({ data: undefined });
    await qc.invalidateQueries({ queryKey: ["chat_messages"] });
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">AI Health Coach</h1>
          <p className="text-muted-foreground text-sm mt-1">Personalized to your profile, conditions and goals.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Trash2 className="h-3.5 w-3.5" /> Clear chat
          </button>
        )}
      </div>

      <div ref={scrollRef} className="mt-6 h-[60vh] overflow-y-auto pr-1 space-y-4">
        {messages.length === 0 && (
          <div className="soft-card p-8 text-center">
            <Sparkles className="h-6 w-6 text-primary mx-auto" />
            <h2 className="font-display text-2xl mt-3">How are you feeling today?</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Ask about your blood sugar, what to eat, sleep, medications, or anything bothering you.
              Flomo knows your profile.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 justify-center">
              {["What should I eat for breakfast?", "How can I lower my fasting sugar?", "Plan my week of meals", "Is my BP normal?"].map(s => (
                <button key={s} onClick={() => setInput(s)}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={
              m.role === "user"
                ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm shadow-sm"
                : "max-w-[92%] text-foreground text-[15px] leading-relaxed whitespace-pre-wrap"
            }>
              {m.content}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Flomo is thinking…
          </div>
        )}
      </div>

      <form onSubmit={submit} className="mt-4 soft-card p-2 flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          rows={2}
          maxLength={4000}
          placeholder="Ask anything about your health…"
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm focus:outline-none"
        />
        <Button type="submit" disabled={pending || !input.trim()} size="icon" className="rounded-full h-10 w-10 shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </AppShell>
  );
}
