import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractReport } from "@/lib/report-extract.functions";
import { FileHeart, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  component: Reports,
});

function Reports() {
  const qc = useQueryClient();
  const extract = useServerFn(extractReport);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: reports = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("medical_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && notes.trim().length < 10) {
      toast.error("Upload a file or paste at least a few values from your report.");
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      let storage_path = "";
      let file_type: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop() ?? "bin";
        storage_path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        file_type = file.type || ext;
        const { error: upErr } = await supabase.storage.from("medical-reports").upload(storage_path, file);
        if (upErr) throw upErr;
      }
      const { data: inserted, error } = await supabase.from("medical_reports")
        .insert({ user_id: user.id, title: title.trim() || "Untitled report", storage_path: storage_path || "(text-only)", file_type, status: "processing" })
        .select().single();
      if (error) throw error;

      if (notes.trim().length >= 10) {
        await extract({ data: { report_id: inserted.id, notes: notes.trim() } });
      } else {
        await supabase.from("medical_reports").update({ status: "ready", ai_summary: "Stored — paste report text to get AI extraction." }).eq("id", inserted.id);
      }
      toast.success("Report saved");
      setTitle(""); setFile(null); setNotes("");
      qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally { setBusy(false); }
  };

  const remove = async (id: string, path: string) => {
    await supabase.from("medical_reports").delete().eq("id", id);
    if (path && path !== "(text-only)") await supabase.storage.from("medical-reports").remove([path]);
    qc.invalidateQueries({ queryKey: ["reports"] });
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl sm:text-4xl">Medical reports</h1>
      <p className="text-muted-foreground text-sm mt-1">Upload labs or paste values — Flomo turns them into plain English.</p>

      <form onSubmit={submit} className="soft-card p-6 mt-6 space-y-4">
        <div>
          <Label>Report title</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fasting blood work — June" maxLength={120} />
        </div>
        <div>
          <Label>Upload file (PDF, image, doc) — optional</Label>
          <label className="mt-1 flex items-center justify-center gap-2 cursor-pointer rounded-xl border-2 border-dashed border-border bg-background px-4 py-6 text-sm text-muted-foreground hover:bg-muted">
            <Upload className="h-4 w-4" />
            {file ? file.name : "Click to choose a file"}
            <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div>
          <Label>Paste report values / notes (for AI extraction)</Label>
          <Textarea rows={6} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Fasting glucose 128 mg/dL, HbA1c 6.8%, LDL 142, HDL 38, Triglycerides 210, TSH 4.5 …"
            maxLength={8000} />
          <p className="text-xs text-muted-foreground mt-1">Type or paste lab values for Flomo to summarize and flag.</p>
        </div>
        <Button type="submit" disabled={busy} className="rounded-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {busy ? "Processing…" : "Save & extract"}
        </Button>
      </form>

      <div className="mt-8 space-y-4">
        {reports.length === 0 && (
          <div className="soft-card p-10 text-center">
            <FileHeart className="h-8 w-8 text-primary mx-auto" />
            <h2 className="font-display text-2xl mt-3">No reports yet</h2>
            <p className="text-sm text-muted-foreground mt-2">Your uploaded labs will appear here with AI summaries.</p>
          </div>
        )}
        {reports.map(r => {
          const ex = (r.extracted ?? null) as null | { labs?: { name: string; value: string; unit?: string; flag?: string }[]; recommendations?: string[] };
          return (
            <div key={r.id} className="soft-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl">{r.title}</h3>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleDateString()} · {r.status}
                  </div>
                </div>
                <button onClick={() => remove(r.id, r.storage_path)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {r.ai_summary && <p className="text-sm mt-3 leading-relaxed">{r.ai_summary}</p>}
              {ex?.labs && ex.labs.length > 0 && (
                <div className="mt-4 grid sm:grid-cols-2 gap-2">
                  {ex.labs.map((l, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-border/50">
                      <span>{l.name}</span>
                      <span className={"font-medium " + flagClass(l.flag)}>{l.value}{l.unit ? ` ${l.unit}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              {ex?.recommendations && ex.recommendations.length > 0 && (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {ex.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2"><span className="text-primary">•</span>{rec}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function flagClass(flag?: string) {
  switch (flag) {
    case "high": case "critical": return "text-destructive";
    case "low": return "text-amber-600 dark:text-amber-400";
    default: return "text-foreground";
  }
}
