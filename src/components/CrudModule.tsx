import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth, canEdit, canDelete } from "@/hooks/use-auth";
import { Check, ChevronsUpDown, FilterX, Plus, Pencil, Trash2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

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
}

interface Props {
  title: string;
  description?: string;
  table: string;
  module: string;
  fields: FieldDef[];
  searchFields?: string[];
  orderBy?: { column: string; ascending?: boolean };
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

export function CrudModule({ title, description, table, module, fields, searchFields, orderBy }: Props) {
  const { role } = useAuth();
  const editable = canEdit(role, module);
  const deletable = canDelete(role);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({});
  const [relationOptions, setRelationOptions] = useState<Record<string, any[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const tableFields = useMemo(() => fields.filter((f) => !f.hideInTable), [fields]);
  const formFields = useMemo(() => fields.filter((f) => !f.hideInForm), [fields]);

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

  const save = async () => {
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

  const columnFilterMeta = useMemo(() => {
    const discrete = new Set<string>();
    const options: Record<string, string[]> = {};
    for (const field of tableFields) {
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
  }, [tableFields, rows, relationOptions]);

  const filtered = rows.filter((r) => {
    if (search) {
      const s = search.toLowerCase();
      const sf = searchFields ?? tableFields.map((f) => f.name);
      if (!sf.some((k) => String(r[k] ?? "").toLowerCase().includes(s))) return false;
    }
    for (const field of tableFields) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-10 w-64" placeholder="Search…" value={search} onChange={(e)=>setSearch(e.target.value)}/>
          </div>
          <Button
            variant="outline"
            onClick={() => setColumnFilters({})}
            disabled={!hasColumnFilters}
          >
            <FilterX className="h-4 w-4 mr-2"/>
            Clear filters
          </Button>
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
                <TableHead className="w-20 px-1 py-1.5 text-right text-xs whitespace-nowrap">Actions</TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                {deletable && <TableHead className="w-8 h-auto px-1 py-1" />}
                {tableFields.map((f) => (
                  <TableHead key={`${f.name}-filter`} className="h-auto min-w-0 px-1.5 py-1 font-medium">
                    {columnFilterMeta.discrete.has(f.name) ? (
                      <Select
                        value={columnFilters[f.name] || ALL_FILTER}
                        onValueChange={(v) => setColumnFilter(f.name, v === ALL_FILTER ? "" : v)}
                      >
                        <SelectTrigger
                          aria-label={`Filter ${f.label}`}
                          className="h-7 w-full min-w-0 px-1.5 text-xs font-medium text-muted-foreground shadow-none"
                        >
                          <SelectValue placeholder="All" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ALL_FILTER}>All</SelectItem>
                          {(columnFilterMeta.options[f.name] ?? []).map((value) => (
                            <SelectItem key={value} value={value}>{value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        aria-label={`Filter ${f.label}`}
                        className="h-7 w-full min-w-0 px-1.5 text-xs font-medium shadow-none"
                        placeholder="Filter…"
                        value={columnFilters[f.name] ?? ""}
                        onChange={(e) => setColumnFilter(f.name, e.target.value)}
                      />
                    )}
                  </TableHead>
                ))}
                <TableHead className="w-20 h-auto px-1 py-1" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
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
                  <TableCell className="w-20 px-1 py-1.5 text-right whitespace-nowrap space-x-0">
                    {editable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>openEdit(row)}><Pencil className="h-3.5 w-3.5"/></Button>}
                    {deletable && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>remove(row)}><Trash2 className="h-3.5 w-3.5 text-destructive"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={tableFields.length+1+(deletable?1:0)} className="text-center py-8 text-xs text-muted-foreground">No records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}