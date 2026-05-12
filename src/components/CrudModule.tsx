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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export type FieldType = "text" | "email" | "tel" | "number" | "date" | "time" | "textarea" | "select";

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

  useEffect(() => {
    load();
    const ch = supabase.channel(`rt-${table}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table]);

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
                        <Textarea value={form[f.name] ?? ""} onChange={(e)=>setForm({...form, [f.name]:e.target.value})}/>
                      ) : f.type === "select" ? (
                        <Select value={form[f.name] ?? ""} onValueChange={(v)=>setForm({...form,[f.name]:v})}>
                          <SelectTrigger><SelectValue placeholder="Select…"/></SelectTrigger>
                          <SelectContent>{f.options?.map(o=>(<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                        </Select>
                      ) : (
                        <Input type={f.type ?? "text"} value={form[f.name] ?? ""} onChange={(e)=>setForm({...form,[f.name]:e.target.value})}/>
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
                    <TableCell key={f.name}>{f.render ? f.render(row) : String(row[f.name] ?? "—")}</TableCell>
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
