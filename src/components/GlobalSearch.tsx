import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Building2, Briefcase } from "lucide-react";

interface ResultRow {
  id: string;
  label: string;
  sublabel: string;
}

type ResultBucket = "candidates" | "clients" | "jobs";

const BUCKET_META: Record<ResultBucket, { heading: string; icon: typeof Users; path: string }> = {
  candidates: { heading: "Candidates", icon: Users, path: "/candidates" },
  clients: { heading: "Clients", icon: Building2, path: "/clients" },
  jobs: { heading: "Job Openings", icon: Briefcase, path: "/jobs" },
};

const EMPTY_RESULTS: Record<ResultBucket, ResultRow[]> = { candidates: [], clients: [], jobs: [] };

// App-wide quick search (⌘K / Ctrl+K, or the header search icon). Queries
// candidates/clients/jobs directly — same tables and RLS the rest of the
// app already reads through, no new Supabase resources of any kind. Landing
// on a result takes you to that module's list; it doesn't (yet) deep-link
// into the exact filtered row, since that needs a small opt-in addition to
// CrudModule's search state that's easy to add later if this proves useful.
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<ResultBucket, ResultRow[]>>(EMPTY_RESULTS);
  const navigate = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults(EMPTY_RESULTS); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${q}%`;
      const [candidatesRes, clientsRes, jobsRes] = await Promise.all([
        supabase.from("candidates")
          .select("id, full_name, candidate_code, position_applied")
          .or(`full_name.ilike.${like},candidate_code.ilike.${like},email.ilike.${like},mobile.ilike.${like}`)
          .limit(6),
        supabase.from("clients")
          .select("id, company_name, contact_person")
          .or(`company_name.ilike.${like},contact_person.ilike.${like}`)
          .limit(6),
        supabase.from("job_openings")
          .select("id, job_title, location")
          .or(`job_title.ilike.${like},location.ilike.${like}`)
          .limit(6),
      ]);
      if (cancelled) return;
      setLoading(false);
      setResults({
        candidates: (candidatesRes.data ?? []).map((c: any) => ({
          id: c.id, label: c.full_name, sublabel: [c.candidate_code, c.position_applied].filter(Boolean).join(" · "),
        })),
        clients: (clientsRes.data ?? []).map((c: any) => ({
          id: c.id, label: c.company_name, sublabel: c.contact_person ?? "",
        })),
        jobs: (jobsRes.data ?? []).map((j: any) => ({
          id: j.id, label: j.job_title, sublabel: j.location ?? "",
        })),
      });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const goTo = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  const buckets = Object.entries(results) as [ResultBucket, ResultRow[]][];
  const hasAny = buckets.some(([, rows]) => rows.length > 0);
  const showingResults = query.trim().length >= 2;

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search" title="Search (⌘K)" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search candidates, clients, jobs…" value={query} onValueChange={setQuery} />
        <CommandList>
          {!showingResults ? (
            <CommandEmpty>Type at least 2 characters…</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : !hasAny ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : (
            buckets.map(([bucket, rows]) => {
              if (rows.length === 0) return null;
              const meta = BUCKET_META[bucket];
              return (
                <CommandGroup key={bucket} heading={meta.heading}>
                  {rows.map((r) => (
                    <CommandItem key={r.id} value={`${bucket}-${r.id}-${r.label}`} onSelect={() => goTo(meta.path)}>
                      <meta.icon className="mr-2 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate">{r.label}</div>
                        {r.sublabel && <div className="truncate text-xs text-muted-foreground">{r.sublabel}</div>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}