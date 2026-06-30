import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ExternalLink, Plus, ShoppingBasket, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PARTNERS, getFavoritePartner, setFavoritePartner } from "@/lib/grocery-partners";

export const Route = createFileRoute("/_authenticated/grocery")({
  component: Grocery,
});

function Grocery() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [fav, setFav] = useState<string | null>(() => getFavoritePartner());

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

  const openOn = (partnerId: string, query: string) => {
    const p = PARTNERS.find(x => x.id === partnerId);
    if (!p) return;
    window.open(p.search(query), "_blank", "noopener,noreferrer");
  };

  const groups = items.reduce<Record<string, typeof items>>((acc, it) => {
    const c = it.category ?? "Other"; (acc[c] ??= []).push(it); return acc;
  }, {});

  const allList = items.filter(i => !i.checked).map(i => i.name).join(", ");

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Grocery</h1>
          <p className="text-muted-foreground text-sm mt-1">Tap any item to order it from your favourite quick-commerce app. Plan-sourced items reset daily — manual items stay.</p>
        </div>
      </div>

      {/* Favourite partner picker */}
      <div className="soft-card p-4 mt-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Star className="h-3.5 w-3.5" /> Favourite partner
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {PARTNERS.map(p => (
            <button
              key={p.id}
              onClick={() => { setFavoritePartner(p.id); setFav(p.id); toast.success(`${p.name} set as favourite`); }}
              className={
                "rounded-full px-3 py-1.5 text-xs border transition " +
                (fav === p.id ? `${p.color} border-transparent` : "border-border bg-background hover:bg-muted")
              }
            >
              {p.name}<span className="opacity-70 ml-1.5">· {p.short}</span>
            </button>
          ))}
        </div>
        {fav && (
          <p className="text-xs text-muted-foreground mt-2">
            Single tap on an item opens it on {PARTNERS.find(p => p.id === fav)?.name}. Long-press / use the chevron to choose a different one per item.
          </p>
        )}
      </div>

      <form onSubmit={add} className="soft-card p-3 mt-4 flex flex-wrap gap-2">
        <Input className="flex-1 min-w-[140px]" value={name} onChange={e => setName(e.target.value)} placeholder="Add item" maxLength={120} />
        <Input className="w-32" value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty" maxLength={40} />
        <Button type="submit" className="rounded-full"><Plus className="h-4 w-4 mr-1" /> Add</Button>
      </form>

      {items.length === 0 ? (
        <div className="soft-card p-10 mt-6 text-center">
          <ShoppingBasket className="h-8 w-8 text-primary mx-auto" />
          <h2 className="font-display text-2xl mt-3">Your basket is empty</h2>
          <p className="text-sm text-muted-foreground mt-2">Generate a meal plan and its ingredients land here automatically.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-4">
            {Object.entries(groups).map(([cat, list]) => (
              <div key={cat} className="soft-card p-5">
                <h3 className="font-display text-lg mb-2">{cat}</h3>
                <ul className="divide-y divide-border/50">
                  {list.map(it => {
                    const query = [it.name, it.quantity].filter(Boolean).join(" ");
                    return (
                      <li key={it.id} className="flex items-center gap-2 py-2">
                        <button onClick={() => toggle(it.id, it.checked)}
                          className={"h-5 w-5 shrink-0 rounded-full border flex items-center justify-center " +
                            (it.checked ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
                          {it.checked && <Check className="h-3 w-3" />}
                        </button>
                        <button
                          onClick={() => fav ? openOn(fav, query) : toast.info("Pick a favourite partner above first")}
                          className={"flex-1 text-left text-sm group " + (it.checked ? "line-through text-muted-foreground" : "")}
                          title={fav ? `Order on ${PARTNERS.find(p => p.id === fav)?.name}` : "Tap to order"}
                        >
                          <span className="group-hover:underline">{it.name}</span>
                          {it.quantity && <span className="text-muted-foreground"> · {it.quantity}</span>}
                          {fav && !it.checked && <ExternalLink className="inline h-3 w-3 ml-1.5 opacity-50 group-hover:opacity-100" />}
                        </button>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted">
                              Order on…
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-56 p-2">
                            <p className="text-xs text-muted-foreground px-2 pb-1">Open "{it.name}" on:</p>
                            <div className="flex flex-col">
                              {PARTNERS.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => openOn(p.id, query)}
                                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted text-left"
                                >
                                  <span>{p.name}</span>
                                  <span className="text-xs text-muted-foreground">{p.short}</span>
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <button onClick={() => remove(it.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div className="soft-card p-6 mt-5">
            <h3 className="font-display text-xl">Order the whole list</h3>
            <p className="text-sm text-muted-foreground mt-1">Opens a search for all unchecked items on your chosen partner.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PARTNERS.map(p => (
                <button key={p.id} onClick={() => allList ? openOn(p.id, allList) : toast.info("Nothing to order")}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm hover:bg-muted">
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
