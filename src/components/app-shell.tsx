import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, MessageCircleHeart, Salad, ShoppingBasket,
  FileHeart, Activity, LogOut, Menu, X,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/coach", label: "AI Coach", icon: MessageCircleHeart },
  { to: "/meals", label: "Meal Plan", icon: Salad },
  { to: "/grocery", label: "Grocery", icon: ShoppingBasket },
  { to: "/tracking", label: "Tracking", icon: Activity },
  { to: "/reports", label: "Reports", icon: FileHeart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen warm-gradient">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-background/80 backdrop-blur border-b border-border">
        <Link to="/dashboard" className="flex items-center gap-2">
          <img src={logo} alt="" className="h-7 w-7" />
          <span className="font-display text-lg">Flomo</span>
        </Link>
        <button onClick={() => setOpen(o => !o)} aria-label="Menu" className="p-2 rounded-full hover:bg-muted">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      <div className="md:flex">
        {/* Sidebar */}
        <aside className={cn(
          "md:sticky md:top-0 md:h-screen md:w-64 md:flex md:flex-col md:border-r md:border-border md:bg-sidebar md:py-6 md:px-4",
          open ? "block fixed inset-x-0 top-14 bottom-0 z-20 bg-sidebar border-b border-border p-4 overflow-auto" : "hidden md:flex"
        )}>
          <Link to="/dashboard" className="hidden md:flex items-center gap-2 px-2 mb-8">
            <img src={logo} alt="" className="h-8 w-8" />
            <div>
              <div className="font-display text-xl leading-none">Flomo</div>
              <div className="text-[11px] text-muted-foreground tracking-wide uppercase">Health AI</div>
            </div>
          </Link>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                  pathname.startsWith(to)
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto pt-6">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-10 max-w-5xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
