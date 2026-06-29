import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flower2 } from "lucide-react";
import { toast } from "sonner";

type WH = {
  mode?: "cycle" | "pregnant" | "lactating" | "menopause" | "none";
  last_period_date?: string;
  cycle_length?: number;
  period_length?: number;
  symptoms?: string[];
  trimester?: 1 | 2 | 3;
  weeks?: number;
  pregnancy_conditions?: string[];
  baby_age_months?: number;
};

const SYMPTOMS = ["Cramps", "Bloating", "Fatigue", "Headache", "Low iron", "Cravings", "Mood swings", "Acne"];
const PREG = ["Gestational diabetes", "Anemia", "High BP", "Nausea", "Heartburn", "Constipation"];

export function WomensHealthEditor() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const initial = (profile?.womens_health as WH | null) ?? { mode: "none" };
  const [wh, setWh] = useState<WH>(initial);
  useEffect(() => { setWh((profile?.womens_health as WH | null) ?? { mode: "none" }); }, [profile?.id]);

  // Only show for women / non-binary; hide for explicit male
  const gender = (profile?.gender ?? "").toLowerCase();
  if (gender === "male" || gender === "m") return null;

  const save = async (next: WH) => {
    setWh(next);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ womens_health: next }).eq("id", user.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["meal_plan_latest"] });
  };

  const toggleSym = (key: "symptoms" | "pregnancy_conditions", v: string) => {
    const arr = wh[key] ?? [];
    const next = arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    save({ ...wh, [key]: next });
  };

  return (
    <>
      <h2 className="font-display text-2xl mt-10 flex items-center gap-2">
        <Flower2 className="h-5 w-5 text-primary" /> Women's health
      </h2>
      <p className="text-sm text-muted-foreground mt-1">
        Tell Flomo where you are right now — meals adapt to your cycle, pregnancy or post-partum needs.
      </p>

      <div className="soft-card p-5 mt-3 space-y-4">
        <div className="flex flex-wrap gap-2">
          {([
            ["none", "Not now"],
            ["cycle", "Menstrual cycle"],
            ["pregnant", "Pregnant"],
            ["lactating", "Breastfeeding"],
            ["menopause", "Menopause"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => save({ ...wh, mode: k })}
              className={
                "rounded-full px-3 py-1.5 text-xs border " +
                (wh.mode === k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:bg-muted")
              }
            >
              {label}
            </button>
          ))}
        </div>

        {wh.mode === "cycle" && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Last period start</Label>
              <Input
                type="date"
                value={wh.last_period_date ?? ""}
                onChange={e => save({ ...wh, last_period_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Cycle length (days)</Label>
              <Input
                type="number"
                value={wh.cycle_length ?? ""}
                onChange={e => save({ ...wh, cycle_length: Number(e.target.value) || undefined })}
              />
            </div>
            <div>
              <Label>Period length (days)</Label>
              <Input
                type="number"
                value={wh.period_length ?? ""}
                onChange={e => save({ ...wh, period_length: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="sm:col-span-3">
              <Label>Today's symptoms</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {SYMPTOMS.map(s => {
                  const active = (wh.symptoms ?? []).includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSym("symptoms", s)}
                      className={"text-xs rounded-full px-2.5 py-1 border " + (active ? "bg-secondary text-secondary-foreground border-secondary" : "border-border bg-background hover:bg-muted")}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {wh.mode === "pregnant" && (
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Trimester</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={wh.trimester ?? ""}
                onChange={e => save({ ...wh, trimester: (Number(e.target.value) || undefined) as 1 | 2 | 3 | undefined })}
              >
                <option value="">—</option>
                <option value={1}>1st</option><option value={2}>2nd</option><option value={3}>3rd</option>
              </select>
            </div>
            <div>
              <Label>Weeks pregnant</Label>
              <Input
                type="number"
                value={wh.weeks ?? ""}
                onChange={e => save({ ...wh, weeks: Number(e.target.value) || undefined })}
              />
            </div>
            <div className="sm:col-span-3">
              <Label>Pregnancy conditions / symptoms</Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {PREG.map(s => {
                  const active = (wh.pregnancy_conditions ?? []).includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSym("pregnancy_conditions", s)}
                      className={"text-xs rounded-full px-2.5 py-1 border " + (active ? "bg-secondary text-secondary-foreground border-secondary" : "border-border bg-background hover:bg-muted")}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {wh.mode === "lactating" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Baby's age (months)</Label>
              <Input
                type="number"
                value={wh.baby_age_months ?? ""}
                onChange={e => save({ ...wh, baby_age_months: Number(e.target.value) || undefined })}
              />
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => toast.success("Saved — regenerate your meal plan to refresh suggestions.")}
        >
          Done
        </Button>
      </div>
    </>
  );
}
