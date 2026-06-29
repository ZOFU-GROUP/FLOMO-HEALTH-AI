ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS plan_date date;
CREATE INDEX IF NOT EXISTS grocery_items_user_source_idx ON public.grocery_items (user_id, source, checked);