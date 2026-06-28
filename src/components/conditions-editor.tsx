import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HeartPulse, Plus, X } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = [
  "Diabetes", "Hypertension", "High Cholesterol", "PCOS", "Hypothyroidism",
  "Hyperthyroidism", "Asthma", "IBS", "GERD", "Heart disease", "CKD", "Fatty liver",
  "Anemia", "Arthritis", "Migraine",
];

export function ConditionsEditor() {
  const qc = useQueryClient();
  const [input, setInput] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const conditions: string[] = profile?.chronic_conditions ?? [];

  const save = async (next: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles")
      .update({ chronic_conditions: next })
      .eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["meal_plan_latest"] });
    toast.success("Conditions updated — regenerate your meal plan to refresh suggestions.");
  };

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (conditions.some(c => c.toLowerCase() === v.toLowerCase())) return;
    save([...conditions, v]);
    setInput("");
  };
  const remove = (c: string) => save(conditions.filter(x => x !== c));

  const remaining = SUGGESTIONS.filter(s => !conditions.some(c => c.toLowerCase() === s.toLowerCase()));

  return (
    <>
      <h2 className="font-display text-2xl mt-10 flex items-center gap-2">
        <HeartPulse className="h-5 w-5 text-primary" /> Chronic conditions
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Flomo uses these to personalize your meal plan and coach. Edit anytime.
      </p>

      <div className="soft-card p-5 mt-3">
        {conditions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No conditions added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {conditions.map(c => (
              <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 text-secondary-foreground px-3 py-1 text-xs font-medium">
                {c}
                <button onClick={() => remove(c)} className="hover:text-destructive" aria-label={`Remove ${c}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Add a condition (e.g. Diabetes)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(input); } }}
          />
          <Button onClick={() => add(input)} size="icon" className="rounded-full shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {remaining.length > 0 && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Common</p>
            <div className="flex flex-wrap gap-1.5">
              {remaining.slice(0, 10).map(s => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  className="text-xs rounded-full border border-border bg-background px-2.5 py-1 hover:bg-muted"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
