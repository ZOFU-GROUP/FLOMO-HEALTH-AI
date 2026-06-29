// Quick-commerce partner deep links. We use search URLs so any item the user
// taps opens the partner site/app with that item pre-searched.
export type Partner = {
  id: string;
  name: string;
  short: string;
  color: string;
  search: (q: string) => string;
};

const enc = (q: string) => encodeURIComponent(q.trim());

export const PARTNERS: Partner[] = [
  {
    id: "blinkit",
    name: "Blinkit",
    short: "10-min",
    color: "bg-yellow-400 text-black",
    search: q => `https://blinkit.com/s/?q=${enc(q)}`,
  },
  {
    id: "zepto",
    name: "Zepto",
    short: "10-min",
    color: "bg-purple-500 text-white",
    search: q => `https://www.zeptonow.com/search?query=${enc(q)}`,
  },
  {
    id: "instamart",
    name: "Swiggy Instamart",
    short: "15-min",
    color: "bg-orange-500 text-white",
    search: q => `https://www.swiggy.com/instamart/search?custom_back=true&query=${enc(q)}`,
  },
  {
    id: "bigbasket",
    name: "BigBasket",
    short: "Same-day",
    color: "bg-emerald-600 text-white",
    search: q => `https://www.bigbasket.com/ps/?q=${enc(q)}`,
  },
  {
    id: "amazon",
    name: "Amazon Fresh",
    short: "Prime",
    color: "bg-slate-900 text-white",
    search: q => `https://www.amazon.in/s?k=${enc(q)}&i=nowstore`,
  },
];

const KEY = "flomo:favorite_partner";
export function getFavoritePartner(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}
export function setFavoritePartner(id: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, id);
}
