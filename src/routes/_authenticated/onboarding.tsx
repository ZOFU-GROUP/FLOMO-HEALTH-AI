import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const CONDITIONS = ["Diabetes", "PCOS", "Hypertension", "Thyroid", "Fatty Liver", "Kidney Disease", "Heart Disease", "High Cholesterol", "None"];
const GOALS = ["Lose weight", "Manage condition", "Build muscle", "More energy", "Better sleep", "Heart health", "Manage blood sugar"];
const DIETS = ["Vegetarian", "Vegan", "Eggetarian", "Non-vegetarian", "Jain", "Gluten-free", "Low-carb"];
const ACTIVITY = ["Sedentary", "Lightly active", "Moderately active", "Very active"];
const REGIONS = ["Tamil Nadu","Kerala","Karnataka","Andhra Pradesh","Telangana","Maharashtra","Gujarat","Rajasthan","Punjab","Haryana","Delhi","Uttar Pradesh","Bihar","Jharkhand","West Bengal","Odisha","Madhya Pradesh","Chhattisgarh","Goa","Kashmir","Himachal Pradesh","Uttarakhand","Assam","Northeast","Other"];
const TASTES = ["Mild","Medium spicy","Very spicy","Sweet-leaning","Tangy","Balanced"];

function Onboarding() {
  const navigate = useNavigate();
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

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", gender: "",
    height_cm: "", weight_kg: "", activity_level: "Lightly active",
    region: "", cuisine_taste: "Balanced",
    chronic_conditions: [] as string[],
    health_goals: [] as string[],
    dietary_preferences: [] as string[],
    allergies: "",
  });

  useEffect(() => {
    if (profile) {
      setForm(f => ({
        ...f,
        full_name: profile.full_name ?? "",
        date_of_birth: profile.date_of_birth ?? "",
        gender: profile.gender ?? "",
        height_cm: profile.height_cm ? String(profile.height_cm) : "",
        weight_kg: profile.weight_kg ? String(profile.weight_kg) : "",
        activity_level: profile.activity_level ?? "Lightly active",
        chronic_conditions: profile.chronic_conditions ?? [],
        health_goals: profile.health_goals ?? [],
        dietary_preferences: profile.dietary_preferences ?? [],
        allergies: (profile.allergies ?? []).join(", "),
      }));
    }
  }, [profile]);

  const toggle = (key: "chronic_conditions" | "health_goals" | "dietary_preferences", v: string) => {
    setForm(f => ({ ...f, [key]: f[key].includes(v) ? f[key].filter(x => x !== v) : [...f[key], v] }));
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      id: user.id,
      full_name: form.full_name || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      activity_level: form.activity_level,
      chronic_conditions: form.chronic_conditions,
      health_goals: form.health_goals,
      dietary_preferences: form.dietary_preferences,
      allergies: form.allergies.split(",").map(s => s.trim()).filter(Boolean),
      onboarded: true,
    };
    const { error } = await supabase.from("profiles").upsert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
    navigate({ to: "/dashboard" });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">← Back</Link>
        <h1 className="font-display text-3xl sm:text-4xl mt-2">Tell Flomo about you</h1>
        <p className="text-muted-foreground mt-1">This helps your coach personalize every recommendation. Step {step} of 3.</p>

        <div className="soft-card p-6 sm:p-8 mt-6 space-y-5">
          {step === 1 && (
            <>
              <div>
                <Label>Full name</Label>
                <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                </div>
                <div>
                  <Label>Gender</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Select…</option>
                    <option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>Height (cm)</Label>
                  <Input type="number" value={form.height_cm} onChange={e => setForm({ ...form, height_cm: e.target.value })} />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input type="number" value={form.weight_kg} onChange={e => setForm({ ...form, weight_kg: e.target.value })} />
                </div>
                <div>
                  <Label>Activity</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.activity_level} onChange={e => setForm({ ...form, activity_level: e.target.value })}>
                    {ACTIVITY.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <ChipGroup label="Chronic conditions" options={CONDITIONS} value={form.chronic_conditions} onToggle={v => toggle("chronic_conditions", v)} />
              <ChipGroup label="Health goals" options={GOALS} value={form.health_goals} onToggle={v => toggle("health_goals", v)} />
            </>
          )}

          {step === 3 && (
            <>
              <ChipGroup label="Dietary preferences" options={DIETS} value={form.dietary_preferences} onToggle={v => toggle("dietary_preferences", v)} />
              <div>
                <Label>Allergies / intolerances</Label>
                <Textarea rows={3} placeholder="e.g. peanuts, shellfish, lactose" value={form.allergies}
                  onChange={e => setForm({ ...form, allergies: e.target.value })} />
                <p className="text-xs text-muted-foreground mt-1">Comma-separated</p>
              </div>
            </>
          )}

          <div className="flex justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>Back</Button>
            {step < 3
              ? <Button onClick={() => setStep(s => s + 1)} className="rounded-full">Continue</Button>
              : <Button onClick={save} className="rounded-full">Save & continue</Button>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ChipGroup({ label, options, value, onToggle }: { label: string; options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => {
          const active = value.includes(o);
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              className={"rounded-full border px-3.5 py-1.5 text-sm transition " +
                (active ? "bg-primary text-primary-foreground border-primary" : "border-border bg-background hover:bg-muted")}>
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
