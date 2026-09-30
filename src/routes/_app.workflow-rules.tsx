// Zoho gap this closes: "Configurable workflow" — until now, every piece of
// automation in this app (on_interview_change advancing candidate stage,
// generate_reminders' four reminder kinds) was hardcoded in a migration.
// This page lets an admin define new "when a field changes to X, do Y" rules
// from the UI, backed by the generic run_workflow_rules() trigger added in
// 20260930060000_workflow_rules.sql — no deploy needed to add or change a rule.
//
// Deliberately a hand-built page, not a CrudModule instance: the Field and
// Value dropdowns depend on which Table is selected (candidates' "Stage" has
// a completely different option list than billing's "Payment Status"), and
// CrudModule's Add/Edit form has no concept of one field's options changing
// based on another field's current value.
//
// Admin-only end to end: gated here (role check below), in the sidebar
// (this route only appears under "Admin" — see AppSidebar.tsx), and for
// real in Postgres RLS (see the migration) — the same three-layer pattern
// Settings/Integrations already use.
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Workflow, Inbox, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_app/workflow-rules")({ component: WorkflowRulesPage });

type ActionType = "notify" | "update_field";

interface Option { value: string; label: string; }
interface FieldDef { value: string; label: string; options: Option[]; }

const TABLE_LABELS: Record<string, string> = {
  candidates: "Candidates",
  submissions: "Submissions",
  interviews: "Interviews",
  offers: "Offers & Joining",
  billing: "Billing & Invoices",
  clients: "Clients",
};

// Only the genuinely status/enum-like columns on each table are offered —
// the ones meaningful as a workflow *condition*. Every value list here
// mirrors the exact options already used in that module's own Add/Edit form
// (_app.candidates.tsx, _app.billing.tsx, etc.) so a rule reads using the
// same vocabulary a recruiter already sees in the table.
const TABLE_FIELDS: Record<string, FieldDef[]> = {
  candidates: [
    {
      value: "stage", label: "Stage", options: [
        "lead_received", "contacted", "interested", "resume_collected", "submitted_to_client",
        "interview_scheduled", "interview_completed", "selected", "offer_released", "joined", "rejected", "dropped",
      ].map((v) => ({ value: v, label: v.replace(/_/g, " ") })),
    },
  ],
  submissions: [
    {
      value: "status", label: "Status", options: [
        { value: "submitted", label: "Submitted" }, { value: "shortlisted", label: "Shortlisted" },
        { value: "rejected", label: "Rejected" }, { value: "on_hold", label: "On Hold" },
      ],
    },
  ],
  interviews: [
    {
      value: "status", label: "Status", options: [
        { value: "awaiting_candidate", label: "Awaiting Candidate" }, { value: "scheduled", label: "Scheduled" },
        { value: "completed", label: "Completed" }, { value: "selected", label: "Selected" },
        { value: "rejected", label: "Rejected" }, { value: "no_show", label: "No Show" },
      ],
    },
  ],
  offers: [
    {
      value: "offer_status", label: "Offer Status", options: [
        { value: "pending", label: "Pending" }, { value: "released", label: "Released" },
        { value: "accepted", label: "Accepted" }, { value: "declined", label: "Declined" },
      ],
    },
    {
      value: "joining_status", label: "Joining Status", options: [
        { value: "pending", label: "Pending" }, { value: "joined", label: "Joined" }, { value: "no_show", label: "No Show" },
      ],
    },
  ],
  billing: [
    {
      value: "payment_status", label: "Payment Status", options: [
        { value: "unpaid", label: "Unpaid" }, { value: "partial", label: "Partial" },
        { value: "paid", label: "Paid" }, { value: "overdue", label: "Overdue" },
      ],
    },
  ],
  clients: [
    {
      value: "status", label: "Status", options: [
        { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" },
      ],
    },
  ],
};

const ROLE_TARGETS: Option[] = [
  { value: "role:admin", label: "All Admins" },
  { value: "role:recruiter", label: "All Recruiters" },
  { value: "role:operations", label: "All Operations" },
  { value: "role:finance", label: "All Finance" },
];

function notifyTargetOptions(table: string): Option[] {
  // Clients have no "assigned recruiter" concept — the recruiter link only
  // exists via a candidate — so that target is hidden for that one table
  // rather than silently doing nothing when picked (run_workflow_rules
  // would just never find a recruiter_id and skip the insert).
  return table === "clients" ? ROLE_TARGETS : [{ value: "assigned_recruiter", label: "Assigned Recruiter" }, ...ROLE_TARGETS];
}

function fieldsFor(table: string): FieldDef[] {
  return TABLE_FIELDS[table] ?? [];
}

function emptyForm(defaultTable = "candidates") {
  const fields = fieldsFor(defaultTable);
  return {
    name: "",
    table_name: defaultTable,
    field_name: fields[0]?.value ?? "",
    field_value: fields[0]?.options[0]?.value ?? "",
    action_type: "notify" as ActionType,
    notify_target: notifyTargetOptions(defaultTable)[0].value,
    notify_title: "",
    notify_message: "",
    update_field_name: fields[0]?.value ?? "",
    update_field_value: fields[0]?.options[0]?.value ?? "",
    is_active: true,
  };
}

function conditionLabel(rule: any): string {
  const field = fieldsFor(rule.table_name).find((f) => f.value === rule.field_name);
  const valueLabel = field?.options.find((o) => o.value === rule.field_value)?.label ?? rule.field_value;
  return `${field?.label ?? rule.field_name} = ${valueLabel}`;
}

function actionLabel(rule: any): string {
  if (rule.action_type === "notify") {
    const target = [...ROLE_TARGETS, { value: "assigned_recruiter", label: "Assigned Recruiter" }].find((t) => t.value === rule.notify_target);
    return `Notify ${target?.label ?? rule.notify_target}`;
  }
  const field = fieldsFor(rule.table_name).find((f) => f.value === rule.update_field_name);
  const valueLabel = field?.options.find((o) => o.value === rule.update_field_value)?.label ?? rule.update_field_value;
  return `Set ${field?.label ?? rule.update_field_name} = ${valueLabel}`;
}

function WorkflowRulesPage() {
  const { role } = useAuth();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("workflow_rules" as any).select("*").order("created_at", { ascending: false });
    setLoading(false);
    if (error) toast.error(error.message);
    else setRules(data ?? []);
  };

  useEffect(() => {
    if (role !== "admin") { setLoading(false); return; }
    load();
  }, [role]);

  if (role && role !== "admin") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Workflow Rules</h1>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <p className="text-sm">Workflow automation is configured by admins only.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openCreate = () => { setForm(emptyForm()); setEditing(null); setOpen(true); };
  const openEdit = (rule: any) => {
    setForm({
      name: rule.name,
      table_name: rule.table_name,
      field_name: rule.field_name,
      field_value: rule.field_value,
      action_type: rule.action_type,
      notify_target: rule.notify_target ?? notifyTargetOptions(rule.table_name)[0].value,
      notify_title: rule.notify_title ?? "",
      notify_message: rule.notify_message ?? "",
      update_field_name: rule.update_field_name ?? fieldsFor(rule.table_name)[0]?.value ?? "",
      update_field_value: rule.update_field_value ?? fieldsFor(rule.table_name)[0]?.options[0]?.value ?? "",
      is_active: rule.is_active,
    });
    setEditing(rule);
    setOpen(true);
  };

  const onTableChange = (table: string) => {
    const fields = fieldsFor(table);
    setForm((f) => ({
      ...f,
      table_name: table,
      field_name: fields[0]?.value ?? "",
      field_value: fields[0]?.options[0]?.value ?? "",
      notify_target: notifyTargetOptions(table)[0].value,
      update_field_name: fields[0]?.value ?? "",
      update_field_value: fields[0]?.options[0]?.value ?? "",
    }));
  };

  const onFieldChange = (fieldName: string) => {
    const fields = fieldsFor(form.table_name);
    const field = fields.find((f) => f.value === fieldName);
    setForm((f) => ({ ...f, field_name: fieldName, field_value: field?.options[0]?.value ?? "" }));
  };

  const onUpdateFieldChange = (fieldName: string) => {
    const fields = fieldsFor(form.table_name);
    const field = fields.find((f) => f.value === fieldName);
    setForm((f) => ({ ...f, update_field_name: fieldName, update_field_value: field?.options[0]?.value ?? "" }));
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Give the rule a name.");
    if (form.action_type === "notify" && !form.notify_message.trim()) return toast.error("Write a notification message.");

    setSaving(true);
    const payload: any = {
      name: form.name.trim(),
      table_name: form.table_name,
      field_name: form.field_name,
      field_value: form.field_value,
      action_type: form.action_type,
      is_active: form.is_active,
      notify_target: form.action_type === "notify" ? form.notify_target : null,
      notify_title: form.action_type === "notify" ? (form.notify_title.trim() || form.name.trim()) : null,
      notify_message: form.action_type === "notify" ? form.notify_message.trim() : null,
      update_field_name: form.action_type === "update_field" ? form.update_field_name : null,
      update_field_value: form.action_type === "update_field" ? form.update_field_value : null,
    };

    if (editing) {
      const { error } = await supabase.from("workflow_rules" as any).update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Rule updated");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) payload.created_by = u.user.id;
      const { error } = await supabase.from("workflow_rules" as any).insert(payload);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Rule created");
    }
    setOpen(false);
    load();
  };

  const toggleActive = async (rule: any) => {
    const { error } = await supabase.from("workflow_rules" as any).update({ is_active: !rule.is_active }).eq("id", rule.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (rule: any) => {
    if (!confirm(`Delete "${rule.name}"? This stops it from firing immediately.`)) return;
    const { error } = await supabase.from("workflow_rules" as any).delete().eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Rule deleted");
    load();
  };

  const fields = fieldsFor(form.table_name);
  const selectedFieldOptions = fields.find((f) => f.value === form.field_name)?.options ?? [];
  const selectedUpdateFieldOptions = fields.find((f) => f.value === form.update_field_name)?.options ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workflow Rules</h1>
          <p className="text-sm text-muted-foreground">
            When a field changes to a value, automatically notify someone or update another field — no deploy required.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit" : "New"} Workflow Rule</DialogTitle>
              <DialogDescription>
                {`When `}<strong>{TABLE_LABELS[form.table_name]}</strong>{`'s field below changes to the chosen value, the action runs automatically.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[65vh] overflow-auto pr-2">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g. Notify recruiter when candidate is rejected"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>When Table</Label>
                  <Select value={form.table_name} onValueChange={onTableChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TABLE_LABELS).map(([v, label]) => <SelectItem key={v} value={v}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Field</Label>
                  <Select value={form.field_name} onValueChange={onFieldChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Changes To</Label>
                <Select value={form.field_value} onValueChange={(v) => setForm((f) => ({ ...f, field_value: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {selectedFieldOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Then</Label>
                <Select value={form.action_type} onValueChange={(v: ActionType) => setForm((f) => ({ ...f, action_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notify">Send an in-app notification</SelectItem>
                    <SelectItem value="update_field">Update another field on the same record</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.action_type === "notify" ? (
                <>
                  <div className="space-y-2">
                    <Label>Notify</Label>
                    <Select value={form.notify_target} onValueChange={(v) => setForm((f) => ({ ...f, notify_target: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {notifyTargetOptions(form.table_name).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title <span className="text-xs text-muted-foreground font-normal">(optional — defaults to the rule name)</span></Label>
                    <Input
                      placeholder="e.g. Candidate rejected: {{full_name}}"
                      value={form.notify_title}
                      onChange={(e) => setForm((f) => ({ ...f, notify_title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      placeholder="{{full_name}} was moved to {{value}}. {{company_name}} may need a follow-up."
                      value={form.notify_message}
                      onChange={(e) => setForm((f) => ({ ...f, notify_message: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Placeholders: <code>{"{{full_name}}"}</code>, <code>{"{{company_name}}"}</code>, <code>{"{{value}}"}</code> (the value it changed to).
                    </p>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Set Field</Label>
                    <Select value={form.update_field_name} onValueChange={onUpdateFieldChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>To Value</Label>
                    <Select value={form.update_field_value} onValueChange={(v) => setForm((f) => ({ ...f, update_field_value: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {selectedUpdateFieldOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <Label className="font-normal">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create rule"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            {loading ? "Loading…" : `${rules.length} rule(s)`}
          </CardTitle>
          <CardDescription>Rules run automatically the moment a matching record is created or updated — no action needed once saved.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-10">
              <Inbox className="h-6 w-6 opacity-50" />
              <div className="text-sm">No workflow rules yet — create one above.</div>
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Then</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell><Badge variant="secondary">{TABLE_LABELS[rule.table_name] ?? rule.table_name}</Badge></TableCell>
                    <TableCell>{conditionLabel(rule)}</TableCell>
                    <TableCell>{actionLabel(rule)}</TableCell>
                    <TableCell><Switch checked={rule.is_active} onCheckedChange={() => toggleActive(rule)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(rule)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
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