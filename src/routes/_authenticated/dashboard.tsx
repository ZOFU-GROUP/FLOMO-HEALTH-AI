import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ArrowRight, Droplets, Footprints, Heart, Moon, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: todayLog } = useQuery({
    queryKey: ["health_log", today],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("health_logs").select("*").eq("user_id", user.id).eq("log_date", today).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!isLoading && profile && !profile.onboarded) navigate({ to: "/onboarding" });
  }, [isLoading, profile, navigate]);

  const bmi = profile?.height_cm && profile?.weight_kg
    ? Number((profile.weight_kg / Math.pow(profile.height_cm / 100, 2)).toFixed(1))
    : null;

  const score = computeHealthScore(todayLog);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="font-display text-3xl sm:text-4xl">
            Hello, {profile?.full_name?.split(" ")[0] ?? "friend"}.
          </h1>
        </div>
        <Link to="/coach" className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
          <Sparkles className="h-4 w-4" /> Ask Flomo
        </Link>
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-5">
        <div className="soft-card p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-coral/40 blur-3xl" />
          <p className="text-sm text-muted-foreground">Daily Health Score</p>
          <div className="flex items-end gap-2 mt-1">
            <span className="font-display text-6xl">{score}</span>
            <span className="text-muted-foreground mb-2">/ 100</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${score}%` }} />
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {score >= 75 ? "You're doing beautifully. Keep the rhythm going." :
             score >= 50 ? "Solid day. A glass of water and a short walk can lift this." :
             "Let's start small — log one thing today and Flomo will guide the rest."}
          </p>
          <Link to="/tracking" className="mt-5 inline-flex items-center text-sm font-medium text-primary hover:underline">
            Log today's habits <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </div>

        <div className="soft-card p-6">
          <p className="text-sm text-muted-foreground">Your body</p>
          <div className="mt-2 space-y-1.5 text-sm">
            <Row label="Weight" value={profile?.weight_kg ? `${profile.weight_kg} kg` : "—"} />
            <Row label="Height" value={profile?.height_cm ? `${profile.height_cm} cm` : "—"} />
            <Row label="BMI" value={bmi ? `${bmi} (${bmiCategory(bmi)})` : "—"} />
          </div>
          <Link to="/onboarding" className="mt-4 text-sm text-primary hover:underline inline-block">Edit profile →</Link>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={Footprints} label="Steps" value={todayLog?.steps ?? 0} unit="" />
        <Stat icon={Droplets} label="Water" value={todayLog?.water_ml ?? 0} unit="ml" />
        <Stat icon={Moon} label="Sleep" value={todayLog?.sleep_hours ?? 0} unit="h" />
        <Stat icon={Heart} label="BP" value={todayLog?.bp_systolic && todayLog?.bp_diastolic ? `${todayLog.bp_systolic}/${todayLog.bp_diastolic}` : "—"} unit="" />
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-5">
        <Tile to="/meals" title="Today's meal plan" body="Generate a plan tailored to your conditions, allergies and goals." cta="Open meals" />
        <Tile to="/reports" title="Medical reports" body="Upload labs and let Flomo translate the numbers into plain English." cta="Open reports" />
      </div>

      {profile?.chronic_conditions && profile.chronic_conditions.length > 0 && (
        <div className="mt-5 soft-card p-6">
          <p className="text-sm text-muted-foreground">Conditions Flomo is supporting</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {profile.chronic_conditions.map(c => (
              <span key={c} className="rounded-full bg-secondary/70 text-secondary-foreground px-3 py-1 text-xs font-medium">{c}</span>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}

function Stat({ icon: Icon, label, value, unit }: { icon: typeof Heart; label: string; value: string | number; unit: string }) {
  return (
    <div className="soft-card p-4">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 font-display text-2xl">{value}<span className="text-sm text-muted-foreground font-sans ml-1">{unit}</span></div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Tile({ to, title, body, cta }: { to: string; title: string; body: string; cta: string }) {
  return (
    <Link to={to} className="soft-card p-6 block hover:translate-y-[-2px] transition">
      <h3 className="font-display text-xl">{title}</h3>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">{cta} <ArrowRight className="h-3.5 w-3.5 ml-1" /></span>
    </Link>
  );
}

function bmiCategory(b: number) {
  if (b < 18.5) return "underweight";
  if (b < 25) return "normal";
  if (b < 30) return "overweight";
  return "obese";
}

function computeHealthScore(log: { steps?: number | null; sleep_hours?: number | null; water_ml?: number | null; mood?: string | null } | null | undefined) {
  if (!log) return 40;
  let s = 0;
  s += Math.min(30, Math.round(((log.steps ?? 0) / 10000) * 30));
  s += Math.min(25, Math.round(((log.sleep_hours ?? 0) / 8) * 25));
  s += Math.min(25, Math.round(((log.water_ml ?? 0) / 2000) * 25));
  s += log.mood ? 20 : 0;
  return Math.max(0, Math.min(100, s));
}
