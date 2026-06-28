import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { generateMealPlan, addPlanToGrocery } from "@/lib/meals.functions";
import { Loader2, Salad, ShoppingBasket, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/meals")({
  component: Meals,
});

type Meal = { name: string; title: string; description: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; ingredients: string[]; condition_notes?: string };
type GroceryItem = { name: string; quantity: string; category: string; necessary?: boolean };
type Plan = {
  totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number };
  meals: Meal[];
  grocery: GroceryItem[];
};

function Meals() {
  const qc = useQueryClient();
  const gen = useServerFn(generateMealPlan);
  const addAll = useServerFn(addPlanToGrocery);
  const [loading, setLoading] = useState(false);
  const [showAllGrocery, setShowAllGrocery] = useState(false);

  const { data: latest } = useQuery({
    queryKey: ["meal_plan_latest"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("meal_plans").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const plan = (latest?.plan ?? null) as Plan | null;

  const generate = async () => {
    setLoading(true);
    try {
      await gen({ data: undefined });
      await qc.invalidateQueries({ queryKey: ["meal_plan_latest"] });
      toast.success("Fresh plan ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate plan");
    } finally { setLoading(false); }
  };

  const pushGrocery = async () => {
    if (!plan?.grocery?.length) return;
    const items = showAllGrocery ? plan.grocery : plan.grocery.filter(g => g.necessary !== false);
    if (!items.length) { toast.info("Nothing essential to add."); return; }
    const { inserted } = await addAll({ data: { items } });
    toast.success(`${inserted} items added to grocery`);
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Your meal plan</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-built around your conditions, allergies and goals.</p>
        </div>
        <Button onClick={generate} disabled={loading} className="rounded-full">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {plan ? "Regenerate" : "Generate plan"}
        </Button>
      </div>

      {!plan && !loading && (
        <div className="soft-card p-10 mt-8 text-center">
          <Salad className="h-8 w-8 text-primary mx-auto" />
          <h2 className="font-display text-2xl mt-3">No plan yet</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto mt-2">
            Tap Generate to let Flomo build today's meals based on your profile.
          </p>
        </div>
      )}

      {plan && (
        <>
          <div className="soft-card p-6 mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {[
              ["Calories", plan.totals.calories, "kcal"],
              ["Protein", plan.totals.protein_g, "g"],
              ["Carbs", plan.totals.carbs_g, "g"],
              ["Fat", plan.totals.fat_g, "g"],
              ["Fiber", plan.totals.fiber_g, "g"],
            ].map(([l, v, u]) => (
              <div key={l as string}>
                <div className="font-display text-2xl">{v}<span className="text-xs text-muted-foreground ml-0.5">{u}</span></div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {plan.meals?.map((m, i) => (
              <div key={i} className="soft-card p-5">
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <span className="text-xs uppercase tracking-wide text-primary font-medium">{m.name}</span>
                    <h3 className="font-display text-xl mt-0.5">{m.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div className="font-display text-lg text-foreground">{m.calories}<span className="text-xs"> kcal</span></div>
                    <div>P {m.protein_g}g · C {m.carbs_g}g · F {m.fat_g}g</div>
                  </div>
                </div>
                {m.ingredients?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.ingredients.map((ing, j) => (
                      <span key={j} className="text-xs bg-muted px-2 py-1 rounded-full">{ing}</span>
                    ))}
                  </div>
                )}
                {m.condition_notes && (
                  <div className="mt-3 rounded-xl bg-secondary/40 px-3 py-2 text-xs text-secondary-foreground">
                    <span className="font-medium">Why this works for you: </span>{m.condition_notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {plan.grocery?.length > 0 && (() => {
            const visible = showAllGrocery ? plan.grocery : plan.grocery.filter(g => g.necessary !== false);
            const hiddenCount = plan.grocery.length - visible.length;
            return (
              <div className="soft-card p-6 mt-5">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div>
                    <h3 className="font-display text-xl">Grocery for this plan</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Showing {showAllGrocery ? "all items" : "only what you need to buy"}
                      {!showAllGrocery && hiddenCount > 0 ? ` · ${hiddenCount} pantry staples hidden` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {hiddenCount > 0 && (
                      <Button size="sm" variant="outline" onClick={() => setShowAllGrocery(v => !v)} className="rounded-full">
                        {showAllGrocery ? "Hide staples" : "Show all"}
                      </Button>
                    )}
                    <Button size="sm" onClick={pushGrocery} className="rounded-full">
                      <ShoppingBasket className="h-4 w-4 mr-2" /> Add {showAllGrocery ? "all" : "essentials"}
                    </Button>
                  </div>
                </div>
                <ul className="mt-3 grid sm:grid-cols-2 gap-y-1 text-sm">
                  {visible.map((g, i) => (
                    <li key={i} className="flex justify-between gap-2 py-1 border-b border-border/40">
                      <span>{g.name}</span>
                      <span className="text-muted-foreground">{g.quantity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </>
      )}
    </AppShell>
  );
}
