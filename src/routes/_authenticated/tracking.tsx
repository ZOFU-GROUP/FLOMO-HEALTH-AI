import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pill, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tracking")({
  component: Tracking,
});

function Tracking() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: log } = useQuery({
    queryKey: ["health_log", today],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("health_logs").select("*").eq("user_id", user.id).eq("log_date", today).maybeSingle();
      return data;
    },
  });

  const { data: meds = [] } = useQuery({
    queryKey: ["meds"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("medications").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    steps: "", sleep_hours: "", water_ml: "", weight_kg: "",
    blood_sugar: "", bp_systolic: "", bp_diastolic: "", mood: "", stress_level: "",
  });

  const fromLog = (k: keyof typeof form) => {
    if (form[k] !== "") return form[k];
    const v = log ? (log as Record<string, unknown>)[k] : undefined;
    return (v ?? "") as string | number;
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const num = (v: string | number) => v === "" || v === null ? null : Number(v);
    const payload = {
      user_id: user.id, log_date: today,
      steps: num(fromLog("steps")),
      sleep_hours: num(fromLog("sleep_hours")),
      water_ml: num(fromLog("water_ml")),
      weight_kg: num(fromLog("weight_kg")),
      blood_sugar: num(fromLog("blood_sugar")),
      bp_systolic: num(fromLog("bp_systolic")),
      bp_diastolic: num(fromLog("bp_diastolic")),
      mood: (fromLog("mood") || null) as string | null,
      stress_level: num(fromLog("stress_level")),
    };
    const { error } = await supabase.from("health_logs").upsert(payload, { onConflict: "user_id,log_date" });
    if (error) { toast.error(error.message); return; }
    toast.success("Logged for today");
    qc.invalidateQueries({ queryKey: ["health_log", today] });
  };

  const [med, setMed] = useState({ name: "", dosage: "", frequency: "", time_of_day: "" });
  const addMed = async () => {
    if (!med.name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("medications").insert({ user_id: user.id, ...med });
    if (error) { toast.error(error.message); return; }
    setMed({ name: "", dosage: "", frequency: "", time_of_day: "" });
    qc.invalidateQueries({ queryKey: ["meds"] });
  };
  const delMed = async (id: string) => {
    await supabase.from("medications").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["meds"] });
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl sm:text-4xl">Daily tracking</h1>
      <p className="text-muted-foreground text-sm mt-1">Log today's metrics. Your dashboard score updates instantly.</p>

      <div className="soft-card p-6 mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Steps" v={form.steps || (log?.steps ?? "")} onChange={v => setForm({ ...form, steps: v })} />
        <Field label="Sleep (hours)" v={form.sleep_hours || (log?.sleep_hours ?? "")} onChange={v => setForm({ ...form, sleep_hours: v })} />
        <Field label="Water (ml)" v={form.water_ml || (log?.water_ml ?? "")} onChange={v => setForm({ ...form, water_ml: v })} />
        <Field label="Weight (kg)" v={form.weight_kg || (log?.weight_kg ?? "")} onChange={v => setForm({ ...form, weight_kg: v })} />
        <Field label="Blood sugar (mg/dL)" v={form.blood_sugar || (log?.blood_sugar ?? "")} onChange={v => setForm({ ...form, blood_sugar: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="BP systolic" v={form.bp_systolic || (log?.bp_systolic ?? "")} onChange={v => setForm({ ...form, bp_systolic: v })} />
          <Field label="BP diastolic" v={form.bp_diastolic || (log?.bp_diastolic ?? "")} onChange={v => setForm({ ...form, bp_diastolic: v })} />
        </div>
        <div>
          <Label>Mood</Label>
          <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={(form.mood || log?.mood) ?? ""}
                  onChange={e => setForm({ ...form, mood: e.target.value })}>
            <option value="">—</option>
            <option>Calm</option><option>Energized</option><option>Tired</option><option>Stressed</option><option>Anxious</option><option>Happy</option>
          </select>
        </div>
        <Field label="Stress (1–10)" v={form.stress_level || (log?.stress_level ?? "")} onChange={v => setForm({ ...form, stress_level: v })} />
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} className="rounded-full">Save today</Button>
      </div>

      <h2 className="font-display text-2xl mt-10 flex items-center gap-2"><Pill className="h-5 w-5 text-primary" /> Medications</h2>
      <div className="soft-card p-5 mt-3 space-y-2">
        {meds.length === 0 && <p className="text-sm text-muted-foreground">No medications tracked yet.</p>}
        {meds.map(m => (
          <div key={m.id} className="flex items-center justify-between gap-3 py-2 border-b border-border/50 last:border-0">
            <div>
              <div className="text-sm font-medium">{m.name}</div>
              <div className="text-xs text-muted-foreground">
                {[m.dosage, m.frequency, m.time_of_day].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
            <button onClick={() => delMed(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
      <div className="soft-card p-5 mt-3 grid sm:grid-cols-4 gap-2">
        <Input placeholder="Name" value={med.name} onChange={e => setMed({ ...med, name: e.target.value })} />
        <Input placeholder="Dosage" value={med.dosage} onChange={e => setMed({ ...med, dosage: e.target.value })} />
        <Input placeholder="Frequency" value={med.frequency} onChange={e => setMed({ ...med, frequency: e.target.value })} />
        <div className="flex gap-2">
          <Input placeholder="Time" value={med.time_of_day} onChange={e => setMed({ ...med, time_of_day: e.target.value })} />
          <Button onClick={addMed} size="icon" className="rounded-full shrink-0"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, v, onChange }: { label: string; v: string | number; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" value={v ?? ""} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
