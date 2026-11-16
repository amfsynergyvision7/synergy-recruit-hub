/**
 * Build133: strictly read-only workflow audit.
 *
 * A configurable trigger can update candidate/billing state or send in-app
 * notifications. Configuration, activation, deactivation and deletion are
 * held until independently accepted permissions, trigger effects, and
 * finance release gates exist. This page performs NO mutation.
 */
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { canReadPrivateUserDirectory } from "@/lib/crm-sensitive-route-access";
import { readCompleteCrmRows, CRM_MAX_ROWS } from "@/lib/bounded-crm-read";
import {
  WORKFLOW_RULE_MUTATIONS_HELD, validateWorkflowReviewRows,
  type WorkflowReviewRow,
} from "@/lib/workflow-rules-review";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/workflow-rules")({ component: Page });

function Page() {
  const { user, profile, role, loading } = useAuth();
  // Do not mount private hooks or cached rule state during an unknown role.
  if (loading || !canReadPrivateUserDirectory(user?.id, profile, role))
    return <p className="text-sm text-muted-foreground">Workflow review requires a verified, approved administrator account.</p>;
  // Switching accounts or roles remounts all private rows and requests.
  return <AdminWorkflowReview key={user!.id + ":" + role} />;
}

function AdminWorkflowReview() {
  const [rows, setRows] = useState<WorkflowReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setRows([]);
    setFailed(false);
    setLoading(true);

    const load = async () => {
      try {
        // Explicit column projection: do not download notification message
        // templates, creator identities or any unrelated workflow metadata.
        // Page by unique ID with exact RLS-visible counts, up to 2,500.
        const data = await readCompleteCrmRows<WorkflowReviewRow>(
          async (from, to, signal) => {
            const result = await supabase.from("workflow_rules")
              .select("id, name, table_name, field_name, field_value, action_type, notify_target, update_field_name, update_field_value, is_active, created_at", { count: "exact" })
              .order("id", { ascending: true }).range(from, to).abortSignal(signal);
            return {
              data: validateWorkflowReviewRows(result.data),
              count: result.count,
              error: result.error,
            };
          }, controller.signal);
        if (active && !controller.signal.aborted) setRows(data);
      } catch {
        if (active && !controller.signal.aborted) {
          setRows([]);
          setFailed(true);
        }
      } finally {
        if (active && !controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => { active = false; controller.abort(); };
  }, [reloadKey]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Workflow Rules — Review Only</h1>
        <p className="text-sm text-muted-foreground">
          Inspect stored automation conditions and whether they are currently marked active.
          Existing server-side rules may still execute independently of this page.
        </p>
      </div>

      {WORKFLOW_RULE_MUTATIONS_HELD && (
        <div role="status" className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Rule creation, editing, activation, deactivation and deletion are held pending
            independent hosted access, trigger-impact and financial approval. This screen
            cannot change existing rules or stop server-side triggers.
          </span>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">
              {loading ? "Verifying authorized workflow rules…" :
                failed ? "Workflow data unavailable" : `${rows.length} verified workflow rule(s)`}
            </CardTitle>
            <CardDescription>
              Read-only; exact-count bounded review (maximum {CRM_MAX_ROWS} rules).
              No background subscriptions or rule writes.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" disabled={loading}
            onClick={() => setReloadKey(k => k + 1)}>
            <RefreshCw className="mr-1.5 h-4 w-4"/>Refresh
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {failed ? (
            <p className="text-sm text-destructive">
              Authorized workflow source could not be verified. No partial rules are shown.
            </p>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Checking complete records…</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No role-visible rules were returned by a verified complete read.
            </p>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Rule name</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>When field</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Stored status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell>{rule.table_name}</TableCell>
                    <TableCell>{rule.field_name}</TableCell>
                    <TableCell>{rule.field_value}</TableCell>
                    <TableCell>
                      {rule.action_type === "notify"
                        ? `Notify ${rule.notify_target ?? "configured target"}`
                        : `Update ${rule.update_field_name ?? "field"} to ${rule.update_field_value ?? "configured value"}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.is_active ? "destructive" : "secondary"}>
                        {rule.is_active ? "Marked active" : "Marked inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
