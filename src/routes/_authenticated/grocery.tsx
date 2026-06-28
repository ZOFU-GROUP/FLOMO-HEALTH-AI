import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/grocery")({
  component: Grocery,
});

const PROVIDERS = ["Swiggy Instamart", "Blinkit", "Zepto", "BigBasket", "Amazon Fresh"];

function Grocery() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["grocery"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("grocery_items").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("grocery_items").insert({ user_id: user.id, name: name.trim(), quantity: qty.trim() || null, category: "Other" });
    if (error) { toast.error(error.message); return; }
    setName(""); setQty("");
    qc.invalidateQueries({ queryKey: ["grocery"] });
  };

  const toggle = async (id: string, checked: boolean) => {
    await supabase.from("grocery_items").update({ checked: !checked }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["grocery"] });
  };

  const remove = async (id: string) => {
    await supabase.from("grocery_items").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["grocery"] });
  };

  const order = (provider: string) => {
    toast.success(`Sending your list to ${provider}…`, { description: "Provider integration coming soon — list is ready." });
  };

  const groups = items.reduce<Record<string, typeof items>>((acc, it) => {
    const c = it.category ?? "Other"; (acc[c] ??= []).push(it); return acc;
  }, {});

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Grocery</h1>
          <p className="text-muted-foreground text-sm mt-1">Smart list, ready for 1-click ordering.</p>
        </div>
      </div>

      <form onSubmit={add} className="soft-card p-3 mt-5 flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[140px]" value={name} onChange={e => setName(e.target.value)} placeholder="Add item" maxLength={120} />
        <Input className="w-32" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" maxLength={40} />
        <Button type="submit" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </form>

      {items.length === 0 ? (
        <div className="soft-card p-10 mt-6 text-center">
          <ShoppingBasket className="h-8 w-8 text-primary mx-auto" />
          <h2 className="font-display text-2xl mt-3">Your basket is empty</h2>
          <p className="text-sm text-muted-foreground mt-2">Generate a meal plan and add all its ingredients here in one tap.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            {Object.entries(groups).map(([cat, list]) => (
              <div key={cat} className="soft-card p-5">
                <h3 className="font-display text-lg mb-2">{cat}</h3>
                <ul className="divide-y divide-border/50">
                  {list.map(it => (
                    <li key={it.id} className="flex items-center gap-3 py-2">
                      <button onClick={() => toggle(it.id, it.checked)}
                        className={"h-5 w-5 shrink-0 rounded-full border flex items-center justify-center " +
                          (it.checked ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                        {it.checked && <Check className="h-3 w-3" />}
                      </button>
                      <div className={"flex-1 text-sm " + (it.checked ? "line-through text-muted-foreground" : "")}>
                        {it.name} {it.quantity && <span className="text-muted-foreground">· {it.quantity}</span>}
                      </div>
                      <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="soft-card p-6 mt-5">
            <h3 className="font-display text-xl">1-click order</h3>
            <p className="text-sm text-muted-foreground mt-1">Send your list to your preferred partner.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PROVIDERS.map(p => (
                <button key={p} onClick={() => order(p)}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-muted">
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
