import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth, canEdit, canDelete } from "@/hooks/use-auth";
import { Check, ChevronsUpDown, Plus, Pencil, Trash2, Search } from "lucide-react";
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

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    const sf = searchFields ?? tableFields.map((f) => f.name);
    return sf.some((k) => String(r[k] ?? "").toLowerCase().includes(s));
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
            <Input className="pl-8 w-64" placeholder="Search…" value={search} onChange={(e)=>setSearch(e.target.value)}/>
          </div>
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
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {tableFields.map((f) => <TableHead key={f.name}>{f.label}</TableHead>)}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row) => (
                <TableRow key={row.id}>
                  {tableFields.map((f) => (
                    <TableCell key={f.name}>{f.render ? f.render(row) : f.relation ? (relationOptions[f.name]?.find((r) => r.id === row[f.name]) ? f.relation.label(relationOptions[f.name].find((r) => r.id === row[f.name])) : "—") : String(row[f.name] ?? "—")}</TableCell>
                  ))}
                  <TableCell className="text-right space-x-1">
                    {editable && <Button size="icon" variant="ghost" onClick={()=>openEdit(row)}><Pencil className="h-4 w-4"/></Button>}
                    {deletable && <Button size="icon" variant="ghost" onClick={()=>remove(row)}><Trash2 className="h-4 w-4 text-destructive"/></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={tableFields.length+1} className="text-center py-8 text-sm text-muted-foreground">No records</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
