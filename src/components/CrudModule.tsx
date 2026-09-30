import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth, canEdit, canDelete } from "@/hooks/use-auth";
import { Check, ChevronsUpDown, Download, FilterX, ListFilter, Plus, Pencil, Trash2, Search, Inbox, Eye, Mail } from "lucide-react";
import { EmailComposeDialog } from "@/components/EmailComposeDialog";
import { rowsToCsv, downloadCsv, todayStamp } from "@/lib/csv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_ROW_WIDTHS = ["100%", "92%", "85%", "95%", "80%", "90%"];

export type FieldType = "text" | "email" | "tel" | "number" | "date" | "time" | "textarea" | "select" | "relation";

interface RelationDef {
  table: string;
  label: (row: any) => string;
  description?: (row: any) => string;
  select?: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type?: FieldType;
  options?: { label: string; value: string }[];
  required?: boolean;
  hideInTable?: boolean;
  hideInForm?: boolean;
  render?: (row: any) => ReactNode;
  default?: any;
  relation?: RelationDef;
  /** Keep this column visible on phone-width screens. The first table column
   * is always visible (it's pinned), everything else collapses below `md`
   * unless marked essential — this is what lets a module choose its own 2-3
   * most useful mobile columns instead of a table full of columns nobody can
   * read without endless swiping. Still fully editable via the Add/Edit
   * dialog regardless of this flag; it only affects the table view. */
  essential?: boolean;
}

interface Props {
  title: string;
  description?: string;
  table: string;
  module: string;
  fields: FieldDef[];
  searchFields?: string[];
  orderBy?: { column: string; ascending?: boolean };
  /** Opt-in, off by default so every other module keeps behaving exactly as
   * before. When true, an extra "eye" button appears in Actions that opens a
   * read-only side panel listing every field (including ones hidden from the
   * table via hideInTable) plus Edit/Delete — meant for a module whose table
   * has been trimmed down to just a few glanceable columns, with the rest of
   * the record still one click away instead of crowding the table itself. */
  detailView?: boolean;
  /** Name of the field holding an email address (e.g. "email"). When set, a
   * Mail icon appears in row actions (desktop table, mobile card, and the
   * detail-view sheet if that's also on) for any row where that field is
   * non-empty, opening a compose dialog that sends via Resend and logs the
   * result to email_log. Only "candidates" and "clients" are wired up to
   * this today (see EmailComposeDialog's relatedTable allowlist) — passing
   * it for another table would need that allowlist extended first. */
  emailField?: string;
}

const ALL_FILTER = "__all__";
const DISCRETE_FILTER_MAX = 20;
const DISCRETE_FIELD_NAMES = new Set([
  "stage",
  "source",
  "status",
  "offer_status",
  "joining_status",
  "payment_status",
  "priority",
  "mode",
  "round",
  "agreement_type",
  "billing_model",
]);

function cellDisplayValue(row: any, field: FieldDef, relationOptions: Record<string, any[]>) {
  if (field.relation) {
    const related = relationOptions[field.name]?.find((r) => r.id === row[field.name]);
    return related ? String(field.relation.label(related)) : "";
  }
  const raw = row[field.name];
  if (raw == null || raw === "") return "";
  const option = field.options?.find((o) => o.value === raw);
  return option ? option.label : String(raw);
}

function isDiscreteFilterField(field: FieldDef, distinctCount: number) {
  if (field.type === "select" || (field.options && field.options.length > 0)) return true;
  if (DISCRETE_FIELD_NAMES.has(field.name)) return true;
  if (
    field.type === "relation" ||
    field.type === "number" ||
    field.type === "date" ||
    field.type === "time" ||
    field.type === "email" ||
    field.type === "tel" ||
    field.type === "textarea"
  ) {
    return false;
  }
  return distinctCount > 0 && distinctCount <= DISCRETE_FILTER_MAX;
}

export function CrudModule({ title, description, table, module, fields, searchFields, orderBy, detailView, emailField }: Props) {
  const { role } = useAuth();
  const editable = canEdit(role, module);
  const deletable = canDelete(role);
  const [mailingRow, setMailingRow] = useState<any | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [relationOptions, setRelationOptions] = useState<Record<string, any[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditField, setBulkEditField] = useState("");
  const [bulkEditValue, setBulkEditValue] = useState<any>("");
  const [bulkEditSaving, setBulkEditSaving] = useState(false);

  const tableFields = useMemo(() => fields.filter((f) => !f.hideInTable), [fields]);
  const formFields = useMemo(() => fields.filter((f) => !f.hideInForm), [fields]);
  // What "select some rows, then change one field on all of them at once"
  // (e.g. filter Candidates down to one recruiter's list, select the batch,
  // reassign every one to a different recruiter in a single action) is
  // allowed to touch. Free-text fields work here too (a Select or an Input,
  // same as the Add/Edit form), but a textarea is excluded — overwriting
  // Notes with identical text across many records in one click is much more
  // likely to be a mistake than something intended.
  const bulkEditableFields = useMemo(() => formFields.filter((f) => f.type !== "textarea"), [formFields]);
  const activeBulkEditField = bulkEditableFields.find((f) => f.name === bulkEditField);
  // Actions column widens as more icons stack up: Edit+Delete alone (w-20),
  // one extra (Eye from detailView, or Mail from emailField) needs w-28, and
  // Candidates today uses both at once (Eye+Mail+Edit+Delete) so it needs w-36.
  const actionsColWidth = detailView && emailField ? "w-36" : detailView || emailField ? "w-28" : "w-20";

  // Mobile strategy: a real <table> just doesn't work on a phone — squeezing
  // even 4-5 columns (plus Actions) into ~360px of width forces every cell so
  // narrow that names wrap one character per line and anything with its own
  // width (the call/WhatsApp icons on a phone number, a status pill) gets cut
  // off or overlaps its neighbor. An earlier version tried to fix this by
  // hiding non-essential columns below 768px and hoping the rest fit — it
  // didn't hold up once a cell held more than plain text.
  //
  // Below `md`, this renders a stacked card per record instead: the table is
  // wrapped in `hidden md:block` and a separate `md:hidden` card list (below)
  // takes over. A card has no column-width problem — every field gets its
  // own full-width row — so it shows ALL of `tableFields`, not just the ones
  // marked `essential`. `essential` (and the `max-md:hidden` it used to add
  // to table cells) is now a no-op kept only so existing module configs
  // don't need to change; the table itself is desktop/tablet-only now, so
  // nothing below `md` ever reads it.
  //
  // One deliberate gap: the per-column filter row (the "Filter…" inputs
  // under each header) only exists in the desktop table — the mobile card
  // list relies on the global Search box at the top instead. Column filters
  // are a power-user feature that's awkward to fit onto a phone screen
  // anyway; Search covers the common "find this one candidate" case.

  const load = async () => {
    setLoading(true);
    const q = supabase.from(table as any).select("*");
    const { data, error } = await (orderBy
      ? q.order(orderBy.column, { ascending: orderBy.ascending ?? false })
      : q.order("created_at", { ascending: false }));
    setLoading(false);
    if (error) toast.error(error.message);
    else setRows(data || []);
  };

  const loadRelations = async () => {
    const relationFields = fields.filter((f) => f.relation);
    const entries = await Promise.all(relationFields.map(async (f) => {
      const { data } = await supabase.from(f.relation!.table as any).select(f.relation!.select ?? "*").limit(500);
      return [f.name, data ?? []] as const;
    }));
    setRelationOptions(Object.fromEntries(entries));
  };

  useEffect(() => {
    setSelected(new Set());
    setColumnFilters({});
    load();
    loadRelations();
    const ch = supabase.channel(`rt-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table]);

  const handleFieldChange = async (name: string, value: any) => {
    const next = { ...form, [name]: value };
    if (name === "candidate_uuid") next.candidate_id = value;
    if (name === "client_uuid") next.client_id = value;
    if (name === "job_uuid") next.job_id = value;
    if (module === "offers" && name === "candidate_uuid" && value) {
      const candidate = relationOptions[name]?.find((r) => r.id === value);
      next.salary = next.salary ?? candidate?.expected_salary ?? candidate?.current_salary ?? null;
      next.ctc = next.ctc ?? candidate?.expected_salary ?? candidate?.current_salary ?? null;
      const interviewResult = await supabase.from("interviews" as any).select("id, client_uuid, client_id, submission_uuid").eq("candidate_uuid", value).eq("status", "selected").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const interview: any = interviewResult.data;
      const submissionResult = interview?.submission_uuid
        ? { data: null as any }
        : await supabase.from("submissions" as any).select("id, client_uuid, client_id").eq("candidate_uuid", value).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const submission: any = submissionResult.data;
      next.interview_uuid = next.interview_uuid ?? interview?.id ?? null;
      next.submission_uuid = next.submission_uuid ?? interview?.submission_uuid ?? submission?.id ?? null;
      next.client_uuid = next.client_uuid ?? interview?.client_uuid ?? interview?.client_id ?? submission?.client_uuid ?? submission?.client_id ?? null;
      next.client_id = next.client_uuid;
    }
    setForm(next);
  };

  const openCreate = () => {
    const init: any = {};
    fields.forEach((f) => { if (f.default !== undefined) init[f.name] = f.default; });
    setForm(init); setEditing(null); setOpen(true);
  };
  const openEdit = (row: any) => { setForm(row); setEditing(row); setOpen(true); };
  const openView = (row: any) => setViewing(row);

  const save = async () => {
    // Catch an empty required field here, with a message naming the actual
    // field, instead of letting it reach Supabase and come back as a raw
    // Postgres "null value in column ... violates not-null constraint" —
    // technically correct, but meaningless to whoever's filling out the form.
    const missing = formFields.filter((f) => {
      if (!f.required) return false;
      const v = form[f.name];
      return v === undefined || v === null || String(v).trim() === "";
    });
    if (missing.length > 0) {
      toast.error(`${missing.map((f) => f.label).join(", ")} ${missing.length > 1 ? "are" : "is"} required.`);
      return;
    }

    const payload: any = {};
    formFields.forEach((f) => {
      let v = form[f.name];
      if (v === "" || v === undefined) v = null;
      if (f.type === "number" && v !== null) v = Number(v);
      payload[f.name] = v;
    });
    if (form.candidate_uuid) payload.candidate_id = form.candidate_uuid;
    if (form.client_uuid !== undefined) payload.client_id = form.client_uuid || null;
    if (form.job_uuid !== undefined) payload.job_id = form.job_uuid || null;
    if (editing) {
      const { error } = await supabase.from(table as any).update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Updated");
    } else {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) payload.created_by = u.user.id;
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Created");
    }
    setOpen(false); load();
  };

  const remove = async (row: any) => {
    if (!confirm("Delete this record?")) return;
    const { error } = await supabase.from(table as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  };

  // Filtering used to be scoped to `tableFields` — whatever columns the
  // table happened to show — so a field hidden from the table to declutter
  // it (like Assigned Recruiter here) had no filter at all, on desktop or
  // mobile, even though it was still a perfectly normal field on every
  // record. `formFields` is the right superset: every field the user can
  // see and edit via Add/Edit, table-visible or not. Only `hideInForm`
  // fields (e.g. the read-only candidate_code) stay out of this — nothing
  // truly hidden from the user is filterable.
  const columnFilterMeta = useMemo(() => {
    const discrete = new Set<string>();
    const options: Record<string, string[]> = {};
    for (const field of formFields) {
      const distinct = Array.from(
        new Set(
          rows
            .map((r) => cellDisplayValue(r, field, relationOptions).trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      if (isDiscreteFilterField(field, distinct.length)) {
        discrete.add(field.name);
        options[field.name] = distinct;
      }
    }
    return { discrete, options };
  }, [formFields, rows, relationOptions]);

  const filtered = rows.filter((r) => {
    if (search) {
      const s = search.toLowerCase();
      const sf = searchFields ?? tableFields.map((f) => f.name);
      if (!sf.some((k) => String(r[k] ?? "").toLowerCase().includes(s))) return false;
    }
    for (const field of formFields) {
      const query = columnFilters[field.name]?.trim();
      if (!query) continue;
      const cell = cellDisplayValue(r, field, relationOptions).toLowerCase();
      if (columnFilterMeta.discrete.has(field.name)) {
        if (cell !== query.toLowerCase()) return false;
      } else if (!cell.includes(query.toLowerCase())) {
        return false;
      }
    }
    return true;
  });

  // Exports exactly what's on screen: whatever survived Search + the column
  // Filters panel (`filtered`), using the same column set and value
  // formatting the table itself uses (tableFields + cellDisplayValue) so a
  // relation shows its label, a select shows its option label, etc. rather
  // than a raw UUID or DB code. This means the export is scoped by
  // construction — filter Candidates down to one recruiter's "joined" stage
  // before exporting, and only those rows come out — with zero extra UI.
  const exportCsv = () => {
    const headers = tableFields.map((f) => f.label);
    const dataRows = filtered.map((r) => tableFields.map((f) => cellDisplayValue(r, f, relationOptions)));
    const csv = rowsToCsv(headers, dataRows);
    downloadCsv(`${module}-${todayStamp()}.csv`, csv);
  };

  const hasColumnFilters = Object.values(columnFilters).some((v) => v.trim());
  const setColumnFilter = (name: string, value: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!value) delete next[name];
      else next[name] = value;
      return next;
    });
  };

  const filteredIds = filtered.map((r) => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = !allSelected && filteredIds.some((id) => selected.has(id));

  const toggleAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      filteredIds.forEach((id) => (checked ? next.add(id) : next.delete(id)));
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const bulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const warning =
      module === "candidates"
        ? `Delete ${ids.length} candidate(s)? This will also permanently delete their linked submissions, interviews, offers, and stage history.`
        : `Delete ${ids.length} selected record(s)? This cannot be undone.`;
    if (!confirm(warning)) return;
    setBulkDeleting(true);
    const { error } = await supabase.from(table as any).delete().in("id", ids);
    setBulkDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${ids.length} record(s)`);
    setSelected(new Set());
    load();
  };

  const closeBulkEdit = () => {
    setBulkEditOpen(false);
    setBulkEditField("");
    setBulkEditValue("");
  };

  const applyBulkEdit = async () => {
    const field = activeBulkEditField;
    const ids = Array.from(selected);
    if (!field || !ids.length) return;
    let v = bulkEditValue;
    if (v === "" || v === undefined) v = null;
    if (field.type === "number" && v !== null) v = Number(v);
    setBulkEditSaving(true);
    const { error } = await supabase.from(table as any).update({ [field.name]: v }).in("id", ids);
    setBulkEditSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Updated ${field.label} for ${ids.length} record(s)`);
    setSelected(new Set());
    closeBulkEdit();
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* w-full below sm: this row now wraps (flex-wrap above) instead of
              being forced onto one line and clipped at the screen edge, and a
              fixed w-64 search box would still overflow a ~360px phone width
              on its own — sm:w-64 only kicks in once there's room for it. */}
          {/* One "Filters" button now covers every field the record has —
              not just whichever columns the table happens to show — and
              opens the same panel at every screen width. It's placed before
              Search in source order so that when this row wraps on a narrow
              screen (flex-wrap above), it lands on its own line above the
              search box rather than being buried after it. This replaces
              both the old desktop per-column filter row baked into the
              table header (which only covered visible columns, so a field
              like Assigned Recruiter — hidden from the table to declutter
              it — had no filter at all) and the mobile-only version of this
              same button. */}
          <Button
            variant="outline"
            onClick={() => setFiltersOpen(true)}
          >
            <ListFilter className="h-4 w-4 mr-2"/>
            Filters{hasColumnFilters ? ` (${Object.keys(columnFilters).length})` : ""}
          </Button>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute text-muted-foreground"
              style={{ left: "0.75rem", top: "50%", transform: "translateY(-50%)", width: "1rem", height: "1rem" }}
            />
            <Input
              className="w-full"
              style={{ paddingLeft: "2.5rem" }}
              placeholder="Search…"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setColumnFilters({})}
            disabled={!hasColumnFilters}
          >
            <FilterX className="h-4 w-4 mr-2"/>
            Clear filters
          </Button>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2"/>
            Export CSV
          </Button>
          {editable && selected.size > 0 && bulkEditableFields.length > 0 && (
            <Dialog open={bulkEditOpen} onOpenChange={(v) => (v ? setBulkEditOpen(true) : closeBulkEdit())}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Pencil className="h-4 w-4 mr-2"/>
                  Bulk edit ({selected.size})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Bulk edit {selected.size} {title.toLowerCase()}</DialogTitle>
                </DialogHeader>
                {/* Two steps: which field, then what to set it to — the second
                    control reuses the exact same per-type renderer as the
                    Add/Edit form (Select for a field with options, the
                    search-and-select combobox for a relation, a plain input
                    otherwise) so this behaves the way editing already does,
                    just applied to every selected record in one write. */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Field to update</Label>
                    <Select
                      value={bulkEditField}
                      onValueChange={(v) => { setBulkEditField(v); setBulkEditValue(""); }}
                    >
                      <SelectTrigger><SelectValue placeholder="Choose a field…" /></SelectTrigger>
                      <SelectContent>
                        {bulkEditableFields.map((f) => (
                          <SelectItem key={f.name} value={f.name}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeBulkEditField && (
                    <div className="space-y-2">
                      <Label>New {activeBulkEditField.label}</Label>
                      {activeBulkEditField.type === "select" ? (
                        <Select value={bulkEditValue ?? ""} onValueChange={(v) => setBulkEditValue(v)}>
                          <SelectTrigger><SelectValue placeholder="Select…"/></SelectTrigger>
                          <SelectContent>
                            {activeBulkEditField.options?.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : activeBulkEditField.type === "relation" && activeBulkEditField.relation ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                              <span className="truncate">
                                {relationOptions[activeBulkEditField.name]?.find((r) => r.id === bulkEditValue)
                                  ? activeBulkEditField.relation.label(relationOptions[activeBulkEditField.name].find((r) => r.id === bulkEditValue))
                                  : "Search and select…"}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder={`Search ${activeBulkEditField.label.toLowerCase()}…`} />
                              <CommandList>
                                <CommandEmpty>No match found.</CommandEmpty>
                                <CommandGroup>
                                  {(relationOptions[activeBulkEditField.name] ?? []).map((option) => (
                                    <CommandItem
                                      key={option.id}
                                      value={`${activeBulkEditField.relation!.label(option)} ${activeBulkEditField.relation!.description?.(option) ?? ""}`}
                                      onSelect={() => setBulkEditValue(option.id)}
                                    >
                                      <Check className={cn("mr-2 h-4 w-4", bulkEditValue === option.id ? "opacity-100" : "opacity-0")} />
                                      <div className="min-w-0">
                                        <div className="truncate">{activeBulkEditField.relation!.label(option)}</div>
                                        {activeBulkEditField.relation!.description && <div className="truncate text-xs text-muted-foreground">{activeBulkEditField.relation!.description(option)}</div>}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Input
                          type={activeBulkEditField.type ?? "text"}
                          value={bulkEditValue ?? ""}
                          onChange={(e) => setBulkEditValue(e.target.value)}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">
                        Leaving this blank will clear {activeBulkEditField.label.toLowerCase()} on all {selected.size} selected record(s).
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeBulkEdit}>Cancel</Button>
                  <Button onClick={applyBulkEdit} disabled={!bulkEditField || bulkEditSaving}>
                    {bulkEditSaving ? "Updating…" : `Update ${selected.size} record(s)`}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {deletable && selected.size > 0 && (
            <Button variant="destructive" onClick={bulkDelete} disabled={bulkDeleting}>
              <Trash2 className="h-4 w-4 mr-2"/>
              {bulkDeleting ? "Deleting…" : `Delete Selected (${selected.size})`}
            </Button>
          )}
          {editable && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2"/>Add</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editing ? "Edit" : "Create"} {title.replace(/s$/, "")}</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-auto pr-2">
                  {formFields.map((f) => (
                    <div key={f.name} className={`space-y-2 ${f.type==="textarea"?"sm:col-span-2":""}`}>
                      <Label>{f.label}{f.required && " *"}</Label>
                      {f.type === "textarea" ? (
                        <Textarea value={form[f.name] ?? ""} onChange={(e)=>handleFieldChange(f.name, e.target.value)}/>
                      ) : f.type === "select" ? (
                        <Select value={form[f.name] ?? ""} onValueChange={(v)=>handleFieldChange(f.name, v)}>
                          <SelectTrigger><SelectValue placeholder="Select…"/></SelectTrigger>
                          <SelectContent>{f.options?.map(o=>(<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                        </Select>
                      ) : f.type === "relation" && f.relation ? (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                              <span className="truncate">{relationOptions[f.name]?.find((r) => r.id === form[f.name]) ? f.relation.label(relationOptions[f.name].find((r) => r.id === form[f.name])) : "Search and select…"}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                              <CommandInput placeholder={`Search ${f.label.toLowerCase()}…`} />
                              <CommandList>
                                <CommandEmpty>No match found.</CommandEmpty>
                                <CommandGroup>
                                  {(relationOptions[f.name] ?? []).map((option) => (
                                    <CommandItem key={option.id} value={`${f.relation!.label(option)} ${f.relation!.description?.(option) ?? ""}`} onSelect={() => handleFieldChange(f.name, option.id)}>
                                      <Check className={cn("mr-2 h-4 w-4", form[f.name] === option.id ? "opacity-100" : "opacity-0")} />
                                      <div className="min-w-0">
                                        <div className="truncate">{f.relation!.label(option)}</div>
                                        {f.relation!.description && <div className="truncate text-xs text-muted-foreground">{f.relation!.description(option)}</div>}
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Input type={f.type ?? "text"} value={form[f.name] ?? ""} onChange={(e)=>handleFieldChange(f.name, e.target.value)}/>
                      )}
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
                  <Button onClick={save}>{editing ? "Save changes" : "Create"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {!editable && (
        <Badge variant="secondary">Read-only access</Badge>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{loading ? "Loading…" : `${filtered.length} record(s)`}</CardTitle></CardHeader>
        <CardContent className="overflow-x-hidden">
          {/* Desktop/tablet only — see the mobile-strategy note above
              tableFields. The mobile card list is the sibling block below. */}
          <div className="hidden md:block">
          <Table className="w-full table-fixed text-xs">
            <TableHeader>
              <TableRow>
                {deletable && (
                  <TableHead className="w-8 px-1 py-1.5 text-xs whitespace-nowrap">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(!!v)}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {tableFields.map((f) => (
                  <TableHead key={f.name} className="h-auto min-w-0 px-1.5 py-1.5 text-xs font-medium whitespace-normal break-words">
                    {f.label}
                  </TableHead>
                ))}
                <TableHead className={`${actionsColWidth} px-1 py-1.5 text-right text-xs whitespace-nowrap`}>Actions</TableHead>
              </TableRow>
              {/* The old per-column filter row (a Select or Input squeezed into
                  every visible column's header) lived here. It's gone — it
                  only ever covered whatever fields happened to be shown in
                  the table, which is exactly why filtering by Assigned
                  Recruiter had no control at all once that column was hidden
                  from the table to declutter it. The single "Filters" button
                  in the toolbar above now opens a panel covering every
                  field, table-visible or not. */}
            </TableHeader>
            <TableBody>
              {/* Only the true first load (no rows cached yet) gets skeleton rows —
                  a later background reload (realtime update, save, delete) keeps
                  showing the existing rows until fresh data replaces them, exactly
                  as before, so normal edits never flicker. This just replaces the
                  moment where a fresh page load used to flash "No records" before
                  the real data arrived. */}
              {loading && rows.length === 0 ? (
                SKELETON_ROW_WIDTHS.map((w, i) => (
                  <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                    <TableCell colSpan={tableFields.length+1+(deletable?1:0)} className="px-1.5 py-1.5">
                      <Skeleton className="h-4" style={{ width: w }} />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.map((row) => (
                <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                  {deletable && (
                    <TableCell className="w-8 px-1 py-1.5 whitespace-nowrap">
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(v) => toggleRow(row.id, !!v)}
                        aria-label="Select row"
                      />
                    </TableCell>
                  )}
                  {tableFields.map((f) => (
                    <TableCell key={f.name} className="min-w-0 px-1.5 py-1.5 text-xs whitespace-normal break-words">
                      {f.render ? f.render(row) : (cellDisplayValue(row, f, relationOptions) || "—")}
                    </TableCell>
                  ))}
                  <TableCell className={`${actionsColWidth} px-1 py-1.5 text-right whitespace-nowrap space-x-0`}>
                    {detailView && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>openView(row)}><Eye className="h-3.5 w-3.5"/></Button>}
                    {emailField && row[emailField] && editable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>setMailingRow(row)}><Mail className="h-3.5 w-3.5"/></Button>}
                    {editable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>openEdit(row)}><Pencil className="h-3.5 w-3.5"/></Button>}
                    {deletable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>remove(row)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && !filtered.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={tableFields.length+1+(deletable?1:0)} className="py-10">
                    <div className="flex flex-col items-center justify-center gap-1.5 text-center">
                      <Inbox className="h-7 w-7 text-muted-foreground/40 mb-1" />
                      <div className="text-sm font-medium">
                        {hasColumnFilters || search ? "No matching records" : "No records yet"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {hasColumnFilters || search
                          ? "Try adjusting your search or filters."
                          : "Get started by adding your first one."}
                      </div>
                      {editable && !hasColumnFilters && !search && (
                        <Button size="sm" className="mt-2" onClick={openCreate}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add {title.replace(/s$/, "")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>

          {/* Mobile: one card per record instead of a squeezed table row —
              see the mobile-strategy note above tableFields. Shows every
              field in tableFields (not just `essential` ones), since a
              stacked card has no column-width limit to work around. */}
          <div className="space-y-2 md:hidden">
            {deletable && filtered.length > 0 && (
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => toggleAll(!!v)}
                  aria-label="Select all"
                />
                <span>Select all ({filtered.length})</span>
              </div>
            )}

            {loading && rows.length === 0 ? (
              SKELETON_ROW_WIDTHS.slice(0, 4).map((w, i) => (
                <div key={`mskel-${i}`} className="rounded-lg border border-border p-3">
                  <Skeleton className="h-4" style={{ width: w }} />
                </div>
              ))
            ) : filtered.map((row) => (
              <div
                key={row.id}
                data-state={selected.has(row.id) ? "selected" : undefined}
                className="rounded-lg border border-border bg-card p-3 data-[state=selected]:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {deletable && (
                      <Checkbox
                        className="mt-0.5 shrink-0"
                        checked={selected.has(row.id)}
                        onCheckedChange={(v) => toggleRow(row.id, !!v)}
                        aria-label="Select row"
                      />
                    )}
                    <div className="min-w-0 break-words font-medium">
                      {tableFields[0]?.render ? tableFields[0].render(row) : (cellDisplayValue(row, tableFields[0], relationOptions) || "—")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    {detailView && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>openView(row)}><Eye className="h-3.5 w-3.5"/></Button>}
                    {emailField && row[emailField] && editable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>setMailingRow(row)}><Mail className="h-3.5 w-3.5"/></Button>}
                    {editable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>openEdit(row)}><Pencil className="h-3.5 w-3.5"/></Button>}
                    {deletable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>remove(row)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>}
                  </div>
                </div>
                {tableFields.length > 1 && (
                  <div className="mt-2 space-y-2 border-t border-border pt-2 text-sm">
                    {tableFields.slice(1).map((f) => (
                      <div key={f.name}>
                        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</div>
                        <div className="mt-0.5 break-words">{f.render ? f.render(row) : (cellDisplayValue(row, f, relationOptions) || "—")}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {!loading && !filtered.length && (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border py-10 text-center">
                <Inbox className="h-7 w-7 text-muted-foreground/40 mb-1" />
                <div className="text-sm font-medium">
                  {hasColumnFilters || search ? "No matching records" : "No records yet"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {hasColumnFilters || search
                    ? "Try adjusting your search or filters."
                    : "Get started by adding your first one."}
                </div>
                {editable && !hasColumnFilters && !search && (
                  <Button size="sm" className="mt-2" onClick={openCreate}>
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Add {title.replace(/s$/, "")}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Filter {title}</SheetTitle>
            <SheetDescription>Narrow the list down by any field — not just the ones shown in the table. Combine with Search for free text.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {formFields.filter((f) => columnFilterMeta.discrete.has(f.name)).map((f) => (
              <div key={f.name} className="space-y-1.5">
                <Label>{f.label}</Label>
                <Select
                  value={columnFilters[f.name] || ALL_FILTER}
                  onValueChange={(v) => setColumnFilter(f.name, v === ALL_FILTER ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>All</SelectItem>
                    {(columnFilterMeta.options[f.name] ?? []).map((value) => (
                      <SelectItem key={value} value={value}>{value}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {formFields.filter((f) => columnFilterMeta.discrete.has(f.name)).length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing filterable on this list beyond Search.</p>
            )}
          </div>
          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setColumnFilters({})} disabled={!hasColumnFilters}>Clear all</Button>
            <Button onClick={() => setFiltersOpen(false)}>Done</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {detailView && (
        <Sheet open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            {viewing && (
              <>
                <SheetHeader>
                  <SheetTitle>
                    {(tableFields[0]?.render ? tableFields[0].render(viewing) : cellDisplayValue(viewing, tableFields[0], relationOptions)) || title.replace(/s$/, "")}
                  </SheetTitle>
                  <SheetDescription>{title.replace(/s$/, "")} details — everything on record, in one place.</SheetDescription>
                </SheetHeader>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</div>
                      <div className="mt-1 break-words text-sm">
                        {f.render ? f.render(viewing) : (cellDisplayValue(viewing, f, relationOptions) || "—")}
                      </div>
                    </div>
                  ))}
                </div>
                {(editable || deletable) && (
                  <SheetFooter className="mt-6">
                    {emailField && viewing[emailField] && editable && (
                      <Button variant="outline" onClick={() => { const row = viewing; setViewing(null); setMailingRow(row); }}>
                        <Mail className="h-3.5 w-3.5 mr-2" />Email
                      </Button>
                    )}
                    {editable && (
                      <Button variant="outline" onClick={() => { const row = viewing; setViewing(null); openEdit(row); }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                      </Button>
                    )}
                    {deletable && (
                      <Button variant="destructive" onClick={async () => { const row = viewing; setViewing(null); await remove(row); }}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                      </Button>
                    )}
                  </SheetFooter>
                )}
              </>
            )}
          </SheetContent>
        </Sheet>
      )}

      {emailField && (
        <EmailComposeDialog
          open={!!mailingRow}
          onOpenChange={(v) => !v && setMailingRow(null)}
          relatedTable={table as any}
          relatedId={mailingRow?.id}
          toEmail={mailingRow?.[emailField] ?? ""}
          toName={mailingRow ? (String(cellDisplayValue(mailingRow, tableFields[0], relationOptions) || "")) : ""}
        />
      )}
    </div>
  );
}