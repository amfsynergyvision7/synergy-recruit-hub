import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, UserPlus, CalendarCheck, CheckCircle2, FileSignature, Trophy,
  Building2, Briefcase, Wallet, Clock, Inbox, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({ component: Dashboard });

// Chart palette pulled straight from the app's own --chart-1..5 tokens (styles.css)
// instead of a hardcoded, unrelated blue/cyan palette, so every chart on the
// dashboard automatically matches the Neon Mandala theme in both light and dark
// mode with zero extra work if the palette is ever retuned.
const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)",
  "color-mix(in srgb, var(--chart-1) 55%, var(--chart-3))",
];
const CHART_PRIMARY = "var(--chart-1)";
const CHART_ACCENT = "var(--chart-2)";

// KPI icon-badge colors, mapped onto the same theme tokens as everything else
// (the semantic --success/--warning/--destructive tokens where the meaning is
// semantic, the --chart-* tokens for the purely-decorative accents) rather than
// a separate hand-picked oklch palette that happened to clash with the brand.
const TONE_VAR: Record<string, string> = {
  primary: "--chart-1",
  cyan: "--chart-2",
  success: "--success",
  warning: "--warning",
  danger: "--destructive",
  violet: "--chart-3",
};

function Kpi({ label, value, hint, icon: Icon, tone = "primary" }:
  { label: string; value: string | number; hint?: string; icon: LucideIcon; tone?: keyof typeof TONE_VAR }) {
  const cssVar = TONE_VAR[tone];
  return (
    <Card className="card-hover overflow-hidden border-border/60">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="text-2xl font-bold mt-1.5 tracking-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div
          className="h-11 w-11 shrink-0 rounded-xl text-white flex items-center justify-center"
          style={{
            backgroundImage: `linear-gradient(135deg, var(${cssVar}), color-mix(in srgb, var(${cssVar}) 55%, black))`,
            boxShadow: `0 8px 20px -6px color-mix(in srgb, var(${cssVar}) 55%, transparent)`,
          }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function ChartEmptyState({ label }: { label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
      <Inbox className="h-7 w-7 opacity-50" />
      <div className="text-xs">{label}</div>
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<any>({});
  const [monthly, setMonthly] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);

  const load = async () => {
    const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0,0,0,0);
    const [
      { count: totalCand },
      { count: newCand },
      { count: intSched },
      { count: intDone },
      { count: offers },
      { count: joined },
      { count: clients },
      { count: jobs },
      { data: bills },
      { data: candAll },
      { data: candByMonth },
    ] = await Promise.all([
      supabase.from("candidates").select("*", { count: "exact", head: true }),
      supabase.from("candidates").select("*", { count: "exact", head: true }).gte("created_at", startMonth.toISOString()),
      supabase.from("interviews").select("*", { count: "exact", head: true }).eq("status","scheduled"),
      supabase.from("interviews").select("*", { count: "exact", head: true }).eq("status","completed"),
      supabase.from("offers").select("*", { count: "exact", head: true }).eq("offer_status","released"),
      supabase.from("offers").select("*", { count: "exact", head: true }).eq("joining_status","joined"),
      supabase.from("clients").select("*", { count: "exact", head: true }).eq("status","active"),
      supabase.from("job_openings").select("*", { count: "exact", head: true }).eq("status","open"),
      supabase.from("billing").select("invoice_amount,outstanding_amount,payment_status,invoice_date"),
      supabase.from("candidates").select("stage,source,assigned_recruiter,created_at"),
      supabase.from("offers").select("joining_date,joining_status").eq("joining_status","joined"),
    ]);

    const revenue = (bills||[]).filter(b=>b.payment_status==="paid").reduce((s,b)=>s+Number(b.invoice_amount||0),0);
    const pending = (bills||[]).reduce((s,b)=>s+Number(b.outstanding_amount||0),0);
    setStats({ totalCand, newCand, intSched, intDone, offers, joined, clients, jobs, revenue, pending });

    // Monthly joining trend
    const months: Record<string, number> = {};
    for (let i=5; i>=0; i--) {
      const d = new Date(); d.setMonth(d.getMonth()-i);
      const k = d.toLocaleString("en", { month: "short" });
      months[k] = 0;
    }
    (candByMonth||[]).forEach((r:any)=>{
      if (!r.joining_date) return;
      const k = new Date(r.joining_date).toLocaleString("en",{ month: "short" });
      if (k in months) months[k]++;
    });
    setMonthly(Object.entries(months).map(([m,v])=>({ month:m, joined:v })));

    // Funnel
    const stageOrder = ["lead_received","contacted","submitted_to_client","interview_scheduled","selected","joined"];
    const stageCount: Record<string, number> = {};
    (candAll||[]).forEach((c:any)=>{ stageCount[c.stage]=(stageCount[c.stage]||0)+1; });
    setFunnel(stageOrder.map(s=>({ stage: s.replace(/_/g," "), count: stageCount[s]||0 })));

    // Sources
    const srcMap: Record<string,number> = {};
    (candAll||[]).forEach((c:any)=>{ const s=c.source||"Unknown"; srcMap[s]=(srcMap[s]||0)+1; });
    setSources(Object.entries(srcMap).map(([name,value])=>({ name, value })));

    // Recruiter perf - get names from profiles
    const rec: Record<string, { count: number; name: string }> = {};
    (candAll||[]).forEach((c:any) => {
      const recruiterId = c.assigned_recruiter;
      if (!recruiterId) return;
      if (!rec[recruiterId]) {
        rec[recruiterId] = { count: 0, name: recruiterId };
      }
      rec[recruiterId].count++;
    });

    // Fetch recruiter names from profiles table
    const recruiterIds = Object.keys(rec);
    if (recruiterIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', recruiterIds);

      if (profiles) {
        profiles.forEach(profile => {
          if (rec[profile.id]) {
            rec[profile.id].name = profile.full_name || profile.id.substring(0,6);
          }
        });
      }
    }

    // Fixed: Use the name directly, no need to check r.id
    setRecruiters(Object.values(rec).slice(0,6).map(r => ({
      name: r.name,
      count: r.count
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("dash").on("postgres_changes", { event: "*", schema: "public" }, load).subscribe();
    const t = setInterval(load, 60000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live overview of recruitment activity.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Kpi label="Total Candidates" value={stats.totalCand ?? 0} icon={Users} tone="primary"/>
        <Kpi label="New This Month" value={stats.newCand ?? 0} icon={UserPlus} tone="cyan"/>
        <Kpi label="Interviews Scheduled" value={stats.intSched ?? 0} icon={CalendarCheck} tone="warning"/>
        <Kpi label="Interviews Completed" value={stats.intDone ?? 0} icon={CheckCircle2} tone="success"/>
        <Kpi label="Offers Released" value={stats.offers ?? 0} icon={FileSignature} tone="violet"/>
        <Kpi label="Joined Candidates" value={stats.joined ?? 0} icon={Trophy} tone="success"/>
        <Kpi label="Active Clients" value={stats.clients ?? 0} icon={Building2} tone="primary"/>
        <Kpi label="Open Positions" value={stats.jobs ?? 0} icon={Briefcase} tone="cyan"/>
        <Kpi label="Revenue" value={`₹${(stats.revenue ?? 0).toLocaleString()}`} icon={Wallet} tone="success"/>
        <Kpi label="Pending Payments" value={`₹${(stats.pending ?? 0).toLocaleString()}`} icon={Clock} tone="danger"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="card-hover">
          <CardHeader><CardTitle>Monthly Joining Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><LineChart data={monthly}>
              <defs>
                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={CHART_PRIMARY}/>
                  <stop offset="100%" stopColor={CHART_ACCENT}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)"/><XAxis dataKey="month" stroke="currentColor" tick={{fontSize:11}}/><YAxis stroke="currentColor" tick={{fontSize:11}}/><Tooltip contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}/>
              <Line type="monotone" dataKey="joined" stroke="url(#lineGrad)" strokeWidth={3} dot={{ r: 4, fill: CHART_PRIMARY }}/>
            </LineChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader><CardTitle>Hiring Funnel</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><BarChart data={funnel}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_ACCENT}/>
                  <stop offset="100%" stopColor={CHART_PRIMARY}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)"/><XAxis dataKey="stage" tick={{fontSize:11}} stroke="currentColor"/><YAxis stroke="currentColor" tick={{fontSize:11}}/><Tooltip contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}/>
              <Bar dataKey="count" fill="url(#barGrad)" radius={[6,6,0,0]}/>
            </BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader><CardTitle>Candidate Sources</CardTitle></CardHeader>
          <CardContent className="h-72">
            {sources.length ? (
              <ResponsiveContainer><PieChart>
                <Pie data={sources} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45} paddingAngle={2} label>
                  {sources.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie><Legend/><Tooltip contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}/>
              </PieChart></ResponsiveContainer>
            ) : (
              <ChartEmptyState label="No candidates yet — sources will appear here once added." />
            )}
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader><CardTitle>Recruiter Performance</CardTitle></CardHeader>
          <CardContent className="h-72">
            {recruiters.length ? (
              <ResponsiveContainer><BarChart data={recruiters}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)"/><XAxis dataKey="name" stroke="currentColor" tick={{fontSize:11}}/><YAxis stroke="currentColor" tick={{fontSize:11}}/><Tooltip contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}/>
                <Bar dataKey="count" fill={CHART_ACCENT} radius={[6,6,0,0]}/>
              </BarChart></ResponsiveContainer>
            ) : (
              <ChartEmptyState label="No candidates assigned to recruiters yet." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}