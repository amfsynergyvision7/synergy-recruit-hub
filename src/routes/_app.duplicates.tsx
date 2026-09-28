import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { scanForDuplicateCandidates } from "@/lib/duplicates.functions";
import type { DuplicateCluster, DuplicateMatchReason } from "@/lib/duplicates.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft, TriangleAlert, RefreshCw, Users2, Copy, Trash2, ExternalLink, ShieldAlert,
} from "lucide-react";

export const Route = createFileRoute("/_app/duplicates")({ component: Page });

const REASON_LABEL: Record<DuplicateMatchReason, string> = {
  email: "Same email",
  phone: "Same phone",
  name: "Same name",
};

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function ClusterCard({
  cluster,
  selected,
  onToggleMember,
  onSelectAllButOldest,
  onDelete,
  deleting,
}: {
  cluster: DuplicateCluster;
  selected: Set<string>;
  onToggleMember: (id: string, clusterMemberIds: string[], checked: boolean) => void;
  onSelectAllButOldest: (cluster: DuplicateCluster) => void;
  onDelete: (cluster: DuplicateCluster) => void;
  deleting: boolean;
}) {
  const memberIds = cluster.members.map((m) => m.id);
  const selectedCount = memberIds.filter((id) => selected.has(id)).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{cluster.members[0]?.full_name || "Unnamed candidate"}</CardTitle>
            <Badge variant="secondary">{cluster.members.length} records</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cluster.matchedOn.map((reason) => (
              <Badge key={reason} variant="outline" className="text-muted-foreground">
                {REASON_LABEL[reason]}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onSelectAllButOldest(cluster)}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Keep oldest only
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedCount === 0 || deleting}
            onClick={() => onDelete(cluster)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete {selectedCount > 0 ? selectedCount : ""}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {cluster.members.map((m, i) => (
            <div key={m.id} className="flex gap-2 rounded-md border border-border p-3">
              <Checkbox
                className="mt-0.5"
                checked={selected.has(m.id)}
                onCheckedChange={(checked) => onToggleMember(m.id, memberIds, checked === true)}
              />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate font-medium">{m.full_name || "NA"}</span>
                  {m.candidate_code && <span className="text-xs text-muted-foreground">{m.candidate_code}</span>}
                  {i === 0 && <Badge variant="outline" className="text-[10px]">Oldest</Badge>}
                </div>
                <p className="truncate text-muted-foreground">{m.email || "NA"} · {m.mobile || "NA"}</p>
                <p className="truncate text-muted-foreground">{m.position_applied || "NA"}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] capitalize">{m.stage.replace(/_/g, " ")}</Badge>
                  <span>{m.source || "Manual"}</span>
                  <span>· Added {formatDate(m.created_at)}</span>
                </div>
                {m.resume_url && (
                  <a
                    href={m.resume_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary underline underline-offset-2"
                  >
                    Resume <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Page() {
  const { role } = useAuth();

  if (role && role !== "admin") {
    return (
      <div className="max-w-2xl">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Admin only</AlertTitle>
          <AlertDescription>The duplicate-candidate cleanup tool is restricted to administrators.</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/settings"><ArrowLeft className="h-4 w-4 mr-2" />Back to Settings</Link>
        </Button>
      </div>
    );
  }

  const qc = useQueryClient();
  const runScan = useServerFn(scanForDuplicateCandidates);
  const query = useQuery({
    queryKey: ["duplicate-candidates"],
    queryFn: () => runScan(),
    staleTime: 0,
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deletingClusterId, setDeletingClusterId] = useState<string | null>(null);

  const summary = query.data;
  const clusters = summary?.clusters ?? [];
  const totalSelected = useMemo(
    () => clusters.reduce((n, c) => n + c.members.filter((m) => selected.has(m.id)).length, 0),
    [clusters, selected],
  );

  const toggleMember = (id: string, clusterMemberIds: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        // Never allow every record in a cluster to end up selected — at
        // least one has to be kept, or there'd be nothing left to merge
        // history onto.
        const wouldSelectAll = clusterMemberIds.every((cid) => cid === id || next.has(cid));
        if (wouldSelectAll) {
          toast.error("Keep at least one record per group — unselect one before selecting the rest.");
          return prev;
        }
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const selectAllButOldest = (cluster: DuplicateCluster) => {
    setSelected((prev) => {
      const next = new Set(prev);
      cluster.members.forEach((m, i) => {
        if (i === 0) next.delete(m.id); // oldest — keep
        else next.add(m.id);
      });
      return next;
    });
  };

  const deleteCluster = async (cluster: DuplicateCluster) => {
    const ids = cluster.members.map((m) => m.id).filter((id) => selected.has(id));
    if (ids.length === 0) return;
    if (ids.length === cluster.members.length) {
      toast.error("At least one record in this group has to stay — unselect one first.");
      return;
    }
    const warning = `Delete ${ids.length} candidate record(s)? This will also permanently delete their linked submissions, interviews, offers, and stage history. This can't be undone.`;
    if (!confirm(warning)) return;

    setDeletingClusterId(cluster.clusterId);
    const { error } = await supabase.from("candidates").delete().in("id", ids);
    setDeletingClusterId(null);
    if (error) return toast.error(error.message);

    toast.success(`Deleted ${ids.length} duplicate record(s)`);
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    qc.invalidateQueries({ queryKey: ["duplicate-candidates"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users2 className="h-5 w-5 text-primary" />Duplicate Candidates
          </h1>
          <p className="text-sm text-muted-foreground">
            Scans every candidate in the CRM for likely duplicates — the same email, phone, or full name entered more than once, from any source. Nothing is deleted automatically; review each group and choose what to remove.
          </p>
        </div>
        <Button variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${query.isFetching ? "animate-spin" : ""}`} />
          {query.isFetching ? "Scanning…" : "Re-scan"}
        </Button>
      </div>

      {query.isPending && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            {[100, 90, 80].map((w, i) => <Skeleton key={i} className="h-24" style={{ width: `${w}%` }} />)}
          </CardContent>
        </Card>
      )}

      {query.isError && !query.isPending && (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Couldn't scan for duplicates</AlertTitle>
          <AlertDescription>{(query.error as any)?.message ?? "Unknown error."}</AlertDescription>
        </Alert>
      )}

      {summary && !query.isPending && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center gap-6 pt-6 text-sm">
              <div><span className="text-2xl font-semibold">{summary.totalCandidates}</span><p className="text-muted-foreground">Total candidates</p></div>
              <div><span className="text-2xl font-semibold">{clusters.length}</span><p className="text-muted-foreground">Duplicate group{clusters.length === 1 ? "" : "s"} found</p></div>
              <div><span className="text-2xl font-semibold">{summary.candidatesInvolved}</span><p className="text-muted-foreground">Records involved</p></div>
              {totalSelected > 0 && (
                <div className="ml-auto"><span className="text-2xl font-semibold text-destructive">{totalSelected}</span><p className="text-muted-foreground">Selected to delete</p></div>
              )}
            </CardContent>
          </Card>

          {clusters.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <Users2 className="h-8 w-8 opacity-40" />
                No likely duplicates found — every candidate has a distinct email, phone, and name.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {clusters.map((cluster) => (
                <ClusterCard
                  key={cluster.clusterId}
                  cluster={cluster}
                  selected={selected}
                  onToggleMember={toggleMember}
                  onSelectAllButOldest={selectAllButOldest}
                  onDelete={deleteCluster}
                  deleting={deletingClusterId === cluster.clusterId}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}