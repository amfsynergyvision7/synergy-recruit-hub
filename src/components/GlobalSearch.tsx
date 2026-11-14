import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildSafeGlobalSearchOr, safeGlobalSearchTerm } from "@/lib/safe-global-search";
import { decodeSearchBuckets, MAX_SEARCH_PREVIEW_ROWS } from "@/lib/global-search-results";
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
  const [failed, setFailed] = useState(false);
  const [snapshot, setSnapshot] = useState<{term: string; results: Record<ResultBucket, ResultRow[]>} | null>(null);
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

  // Query-scoped snapshots avoid flashing the previous candidate's data.
  // Every pending network call is cancelled on close or input change.
  useEffect(() => {
    const term = safeGlobalSearchTerm(query);
    if (!open || !term) {
      setSnapshot(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setSnapshot(null);
    setFailed(false);
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [candidatesRes, clientsRes, jobsRes] = await Promise.all([
          supabase.from("candidates")
            .select("id, full_name, candidate_code, position_applied")
            .or(buildSafeGlobalSearchOr(term, "candidates"))
            .order("id", { ascending: true }).limit(MAX_SEARCH_PREVIEW_ROWS).abortSignal(controller.signal),
          supabase.from("clients")
            .select("id, company_name, contact_person")
            .or(buildSafeGlobalSearchOr(term, "clients"))
            .order("id", { ascending: true }).limit(MAX_SEARCH_PREVIEW_ROWS).abortSignal(controller.signal),
          supabase.from("job_openings")
            .select("id, job_title, location")
            .or(buildSafeGlobalSearchOr(term, "jobs"))
            .order("id", { ascending: true }).limit(MAX_SEARCH_PREVIEW_ROWS).abortSignal(controller.signal),
        ]);
        if (!active) return;
        if (candidatesRes.error || clientsRes.error || jobsRes.error) {
          setFailed(true);
          return;
        }
        // Decode all three RLS-visible buckets in one atomic boundary.
        // A malformed row in any module invalidates the whole preview.
        const results = decodeSearchBuckets({
          candidates: candidatesRes.data,
          clients: clientsRes.data,
          jobs: jobsRes.data,
        });
        if (!active || controller.signal.aborted) return;
        setSnapshot({ term, results });
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const goTo = (path: string) => {
    setOpen(false);
    navigate({ to: path });
  };

  const term = safeGlobalSearchTerm(query);
  const visibleResults = open && term && snapshot?.term === term
    ? snapshot.results : EMPTY_RESULTS;
  const buckets = Object.entries(visibleResults) as [ResultBucket, ResultRow[]][];
  const hasAny = buckets.some(([, rows]) => rows.length > 0);
  const invalidQuery = query.trim().length >= 2 && !term;
  const showingResults = !!term && open;

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search" title="Search (⌘K)" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search candidates, clients, jobs…" value={query} onValueChange={setQuery} />
        <CommandList>
          {invalidQuery ? (
            <CommandEmpty>Search accepts 2–80 letters, numbers, spaces, apostrophes and . @ + - only.</CommandEmpty>
          ) : !showingResults ? (
            <CommandEmpty>Type at least 2 characters…</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : failed ? (
            <CommandEmpty>Search is temporarily unavailable.</CommandEmpty>
          ) : !hasAny ? (
            <CommandEmpty>No matches in the first six RLS-visible suggestions per category. Open a CRM module for a complete list.</CommandEmpty>
          ) : (
            <>
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Showing up to {MAX_SEARCH_PREVIEW_ROWS} matches per category; open a module for complete results.
            </div>
            {buckets.map(([bucket, rows]) => {
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
            })}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}