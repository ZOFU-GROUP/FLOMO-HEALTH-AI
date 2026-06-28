import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, MessageCircleHeart, Salad, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import hero from "@/assets/hero.jpg";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flomo Health AI — Your premium AI nutrition & wellness companion" },
      { name: "description", content: "Personalized meal plans, chronic disease guidance, daily tracking, and an AI health coach grounded in your medical reality." },
      { property: "og:title", content: "Flomo Health AI" },
      { property: "og:description", content: "Your premium AI nutrition & wellness companion." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen warm-gradient">
      <header className="px-6 sm:px-10 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="" className="h-8 w-8" />
          <span className="font-display text-xl">Flomo</span>
          <span className="text-xs uppercase tracking-widest text-muted-foreground ml-1">Health AI</span>
        </Link>
        <Link to="/auth" className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90">
          Sign in
        </Link>
      </header>

      <section className="px-6 sm:px-10 pt-8 pb-20 max-w-7xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Powered by Kimi K2 AI
          </span>
          <h1 className="mt-5 font-display text-5xl sm:text-6xl lg:text-7xl leading-[1.02]">
            Your calm, intelligent <span className="text-primary">health companion.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl">
            Flomo turns your health profile, conditions and daily habits into personalized
            nutrition, smart grocery plans, and gentle guidance from an AI coach that
            actually knows you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" className="rounded-full bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:opacity-90">
              Start free
            </Link>
            <a href="#features" className="rounded-full border border-border bg-background px-6 py-3 text-sm font-medium hover:bg-muted">
              Explore features
            </a>
          </div>
          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Private by default. Your data stays yours.
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 bg-coral/30 blur-3xl rounded-full -z-10" />
          <img src={hero} alt="Flomo wellness illustration" width={1024} height={1024}
               className="rounded-3xl border border-border shadow-[0_20px_60px_-30px_oklch(0.4_0.05_40_/_0.35)] w-full" />
        </div>
      </section>

      <section id="features" className="px-6 sm:px-10 pb-24 max-w-7xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl mb-2">Built for how you actually live.</h2>
        <p className="text-muted-foreground max-w-2xl">
          Every feature is tuned to your conditions, medications, and goals — so guidance feels
          like it comes from someone who knows your story.
        </p>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="soft-card p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-xl">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 sm:px-10 py-8 max-w-7xl mx-auto flex flex-col sm:flex-row gap-3 justify-between text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} Flomo Health AI. Wellness, simplified.</span>
        <span>Not a substitute for professional medical advice.</span>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: MessageCircleHeart, title: "AI Health Coach", body: "Conversational, context-aware guidance that adapts to your conditions and goals." },
  { icon: Salad, title: "Personalized Meal Plans", body: "Daily plans with macros, micros and recipes — built around your allergies and preferences." },
  { icon: Stethoscope, title: "Chronic Care", body: "Tailored support for diabetes, PCOS, hypertension, thyroid, kidney, heart and more." },
  { icon: Activity, title: "Daily Tracking", body: "Steps, sleep, water, BP, sugar, mood and weight — with a clear daily health score." },
  { icon: ShieldCheck, title: "Smart Reports", body: "Upload labs. Flomo extracts the key values and explains them in plain language." },
  { icon: Sparkles, title: "1-Click Grocery", body: "Your meal plan becomes a grocery list, ready for Instamart, Blinkit, Zepto and more." },
];
