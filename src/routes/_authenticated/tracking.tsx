import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Footprints, Minus, Pill, Play, Plus, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStepCounter } from "@/hooks/use-step-counter";
import { ConditionsEditor } from "@/components/conditions-editor";

export const Route = createFileRoute("/_authenticated/tracking")({
  component: Tracking,
});

const CUP_ML = 240;

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

  // ----- Auto step counter (starts silently on mount; iOS still needs a tap for permission) -----
  const baseline = log?.steps ?? 0;
  const { steps, status, start, stop, setSteps } = useStepCounter(baseline);
  useEffect(() => { setSteps(baseline); }, [baseline, setSteps]);
  useEffect(() => {
    const DM = (typeof window !== "undefined" ? (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }) : null);
    const needsTap = DM && typeof DM.requestPermission === "function";
    if (!needsTap) { void start(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSteps = async (count: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("health_logs").upsert(
      { user_id: user.id, log_date: today, steps: count },
      { onConflict: "user_id,log_date" },
    );
    qc.invalidateQueries({ queryKey: ["health_log", today] });
  };

  // Persist steps every 30s while running.
  const lastSavedRef = useRef(steps);
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      if (steps !== lastSavedRef.current) {
        lastSavedRef.current = steps;
        saveSteps(steps);
      }
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, steps]);

  const handleStop = async () => {
    stop();
    await saveSteps(steps);
    toast.success(`Saved ${steps} steps for today`);
  };

  // ----- Cups of water -----
  const [cupsDelta, setCupsDelta] = useState(0);
  const baseCups = Math.round((log?.water_ml ?? 0) / CUP_ML);
  const cups = Math.max(0, baseCups + cupsDelta);
  const saveCups = async (next: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("health_logs").upsert(
      { user_id: user.id, log_date: today, water_ml: next * CUP_ML },
      { onConflict: "user_id,log_date" },
    );
    setCupsDelta(0);
    qc.invalidateQueries({ queryKey: ["health_log", today] });
  };

  // ----- Other metrics form -----
  const [form, setForm] = useState({
    sleep_hours: "", weight_kg: "",
    blood_sugar: "", bp_systolic: "", bp_diastolic: "", mood: "", stress_level: "",
  });

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const num = (v: string | number | null | undefined) => v === "" || v === null || v === undefined ? null : Number(v);
    const payload = {
      user_id: user.id, log_date: today,
      sleep_hours: num(form.sleep_hours || log?.sleep_hours),
      weight_kg: num(form.weight_kg || log?.weight_kg),
      blood_sugar: num(form.blood_sugar || log?.blood_sugar),
      bp_systolic: num(form.bp_systolic || log?.bp_systolic),
      bp_diastolic: num(form.bp_diastolic || log?.bp_diastolic),
      mood: (form.mood || log?.mood || null) as string | null,
      stress_level: num(form.stress_level || log?.stress_level),
    };
    const { error } = await supabase.from("health_logs").upsert(payload, { onConflict: "user_id,log_date" });
    if (error) { toast.error(error.message); return; }
    toast.success("Logged for today");
    qc.invalidateQueries({ queryKey: ["health_log", today] });
  };

  // ----- Medications -----
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

  const statusLabel: Record<typeof status, string> = {
    idle: "Tap Enable to allow your phone's motion sensor",
    running: "Auto-counting — keep your phone with you",
    denied: "Motion permission denied — enable it in your browser settings",
    unsupported: "Your device doesn't expose a motion sensor here",
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl sm:text-4xl">Daily tracking</h1>
      <p className="text-muted-foreground text-sm mt-1">Sensors and quick taps. Your dashboard score updates instantly.</p>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        {/* Step counter */}
        <div className="soft-card p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Footprints className="h-4 w-4 text-primary" /> Steps (auto)
          </div>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-display text-5xl">{steps}</span>
            <span className="text-xs text-muted-foreground mb-2">today</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{statusLabel[status]}</p>
          <div className="mt-4 flex gap-2">
            {status === "running" ? (
              <Button onClick={handleStop} variant="outline" className="rounded-full">
                <Square className="h-4 w-4 mr-2" /> Pause
              </Button>
            ) : (
              <Button onClick={start} className="rounded-full" disabled={status === "unsupported"}>
                <Play className="h-4 w-4 mr-2" /> Enable sensor
              </Button>
            )}
          </div>
        </div>

        {/* Water in cups */}
        <div className="soft-card p-6">
          <div className="text-sm text-muted-foreground">Water (cups)</div>
          <div className="mt-2 flex items-end gap-2">
            <span className="font-display text-5xl">{cups}</span>
            <span className="text-xs text-muted-foreground mb-2">{cups * CUP_ML} ml · target 8 cups</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {Array.from({ length: Math.max(8, cups) }).map((_, i) => (
              <span key={i} className={`h-2.5 w-6 rounded-full ${i < cups ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button size="icon" variant="outline" className="rounded-full" onClick={() => setCupsDelta(d => d - 1)} disabled={cups === 0}>
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="icon" className="rounded-full" onClick={() => setCupsDelta(d => d + 1)}>
              <Plus className="h-4 w-4" />
            </Button>
            {cupsDelta !== 0 && (
              <Button variant="secondary" className="rounded-full ml-auto" onClick={() => saveCups(cups)}>
                Save {cups} cups
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="soft-card p-6 mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="Sleep (hours)" v={form.sleep_hours || (log?.sleep_hours ?? "")} onChange={v => setForm({ ...form, sleep_hours: v })} />
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

      <ConditionsEditor />

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
