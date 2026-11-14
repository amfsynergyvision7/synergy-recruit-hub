import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, canEdit } from "@/hooks/use-auth";
import { LEGACY_CANDIDATE_WRITES_PAUSED, CANDIDATE_MUTATION_HOLD_REASON } from "@/lib/release-safety";
import { changeCandidateStage, isReviewableStageTarget } from "@/lib/candidate-stage";
import { TONE_VAR, type PillTone } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { toast } from "sonner";

interface StageDef {
  value: string;
  label: string;
}

interface CandidateBoardProps {
  stages: StageDef[];
  stageTone: Record<string, PillTone>;
  recruiters: { value: string; label: string }[];
}

interface CandidateRow {
  id: string;
  candidate_code: string | null;
  full_name: string;
  position_applied: string | null;
  assigned_recruiter: string | null;
  stage: string;
}

// Standalone board view, deliberately not built on CrudModule — it needs its
// own data flow entirely (grouped-by-stage rendering, drag-and-drop) rather
// than a row-per-line table, and keeping it separate means it can't regress
// the other seven modules that share CrudModule's generic engine. Same
// realtime-subscription pattern CrudModule itself uses, just scoped to the
// handful of fields the board actually displays.
export function CandidateBoard({ stages, stageTone, recruiters }: CandidateBoardProps) {
  const { role } = useAuth();
  const editable = canEdit(role, "candidates") && !LEGACY_CANDIDATE_WRITES_PAUSED;
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const recruiterName = useMemo(() => {
    const map: Record<string, string> = {};
    recruiters.forEach((r) => { map[r.value] = r.label; });
    return map;
  }, [recruiters]);

  const [loadFailed, setLoadFailed] = useState(false);
  const loadEpoch = useRef(0);
  const requestController = useRef<AbortController | null>(null);
  const load = async () => {
    const epoch = ++loadEpoch.current;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;
    setRows([]);
    setLoading(true);
    setLoadFailed(false);
    try {
      // Do not show apparently complete stage totals from capped Data API
      // responses. Refuse a partial board until server aggregates are approved.
      const { data, error, count } = await supabase.from("candidates")
        .select("id, candidate_code, full_name, position_applied, assigned_recruiter, stage", { count: "exact" })
        .order("id", { ascending: true }).limit(250)
        .abortSignal(controller.signal);
      if (controller.signal.aborted || epoch !== loadEpoch.current) return;
      if (error || !data || !Number.isSafeInteger(count) || count! > 250 ||
          data.length !== count || new Set(data.map(row => row.id)).size !== data.length) {
        setLoadFailed(true);
        return;
      }
      setRows(data as CandidateRow[]);
    } catch {
      if (!controller.signal.aborted && epoch === loadEpoch.current) setLoadFailed(true);
    } finally {
      if (!controller.signal.aborted && epoch === loadEpoch.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Never subscribe to unfiltered candidate INSERT/UPDATE/DELETE events.
    // Account changes unmount the keyed board and abort its pending requests.
    return () => { loadEpoch.current++; requestController.current?.abort(); };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      [r.full_name, r.candidate_code, r.position_applied].some((v) => (v ?? "").toLowerCase().includes(s)),
    );
  }, [rows, search]);

  const grouped = useMemo(() => {
    const g: Record<string, CandidateRow[]> = {};
    for (const r of filtered) {
      (g[r.stage] ??= []).push(r);
    }
    return g;
  }, [filtered]);

  const moveCandidate = async (candidateId: string, newStage: string) => {
    if (LEGACY_CANDIDATE_WRITES_PAUSED) { toast.error(CANDIDATE_MUTATION_HOLD_REASON); return; }
    const candidate = rows.find((r) => r.id === candidateId);
    if (!candidate || candidate.stage === newStage) return;
    setRows((prev) => prev.map((r) => (r.id === candidateId ? { ...r, stage: newStage } : r)));
    const { error } = await changeCandidateStage({ candidateId, expectedStage: candidate.stage, newStage });
    if (error) {
      toast.error("Candidate stage change could not be verified.");
      load(); // roll back the optimistic move
      return;
    }
    await load(); // read server result rather than trusting optimistic UI state
    toast.success(`Moved to ${newStage.replace(/_/g, " ")}`);
  };

  return (
    <div className="space-y-3">
      {loadFailed && <p className="text-sm text-destructive">Candidate board data is incomplete or unavailable. No partial pipeline is displayed.</p>}
      <div className="relative w-64">
        <Search
          className="pointer-events-none absolute text-muted-foreground"
          style={{ left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: "1rem", height: "1rem" }}
        />
        <Input
          style={{ paddingLeft: "2.5rem" }}
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {LEGACY_CANDIDATE_WRITES_PAUSED ? (
        <p className="text-xs text-muted-foreground">{CANDIDATE_MUTATION_HOLD_REASON}</p>
      ) : !editable && <p className="text-xs text-muted-foreground">Read-only — drag-to-advance is disabled for your role.</p>}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const tone = stageTone[stage.value] ?? "neutral";
          const cards = grouped[stage.value] ?? [];
          const isDragOver = dragOverStage === stage.value;
          return (
            <div
              key={stage.value}
              onDragOver={(e) => { if (editable && isReviewableStageTarget(stage.value)) e.preventDefault(); }}
              onDragEnter={() => editable && isReviewableStageTarget(stage.value) && setDragOverStage(stage.value)}
              onDragLeave={() => setDragOverStage((s) => (s === stage.value ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStage(null);
                const id = e.dataTransfer.getData("text/plain");
                if (id && editable && isReviewableStageTarget(stage.value)) moveCandidate(id, stage.value);
              }}
              className={`flex w-64 shrink-0 flex-col rounded-lg border bg-muted/20 transition-colors ${
                isDragOver ? "border-primary ring-2 ring-primary/30" : "border-border"
              }`}
            >
              <div
                className="flex items-center justify-between gap-2 rounded-t-lg border-b border-border px-3 py-2"
                style={{ borderTop: `3px solid var(${TONE_VAR[tone]})` }}
              >
                <span className="truncate text-sm font-medium capitalize">{stage.label}</span>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{cards.length}</Badge>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 340px)", minHeight: "120px" }}>
                {loading ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
                ) : cards.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No candidates</p>
                ) : (
                  cards.map((c) => (
                    <div
                      key={c.id}
                      draggable={editable}
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); setDraggingId(c.id); }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`rounded-md border border-border bg-card p-2.5 text-xs shadow-sm transition-opacity ${
                        editable ? "cursor-grab active:cursor-grabbing" : ""
                      } ${draggingId === c.id ? "opacity-40" : ""}`}
                    >
                      <div className="truncate font-medium">{c.full_name}</div>
                      <div className="truncate text-muted-foreground">
                        {[c.candidate_code, c.position_applied].filter(Boolean).join(" · ") || "—"}
                      </div>
                      {c.assigned_recruiter && recruiterName[c.assigned_recruiter] && (
                        <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
                          {recruiterName[c.assigned_recruiter]}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}