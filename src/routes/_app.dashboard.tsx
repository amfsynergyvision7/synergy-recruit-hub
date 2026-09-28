import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Users, UserPlus, CalendarCheck, CheckCircle2, FileSignature, Trophy,
  Building2, Briefcase, Wallet, Clock, Inbox, UserX, type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line,
  PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

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

function Kpi({ label, value, hint, icon: Icon, tone = "primary", loading }:
  { label: string; value: string | number; hint?: string; icon: LucideIcon; tone?: keyof typeof TONE_VAR; loading?: boolean }) {
  const cssVar = TONE_VAR[tone];
  return (
    <Card className="card-hover overflow-hidden border-border/60">
      <CardContent className="p-5 flex items-start justify-between gap-3">
        <div className="min-w-0 w-full">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          {loading ? (
            <Skeleton className="h-7 w-16 mt-1.5" />
          ) : (
            <div className="text-2xl font-bold mt-1.5 tracking-tight">{value}</div>
          )}
          {hint && !loading && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
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

function ChartSkeleton() {
  return (
    <div className="h-full w-full flex items-end gap-2 px-2 pb-2">
      {[45, 70, 55, 85, 60, 40].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function Dashboard() {
  const [stats, setStats] = useState<any>({});
  const [monthly, setMonthly] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [sourceEffectiveness, setSourceEffectiveness] = useState<any[]>([]);
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

    // Current-stage snapshot per candidate, reused below for the funnel,
    // source effectiveness, and recruiter performance calculations — one
    // query already fetched this (candAll), no extra round-trip needed.
    const stageCount: Record<string, number> = {};
    (candAll||[]).forEach((c:any)=>{ stageCount[c.stage]=(stageCount[c.stage]||0)+1; });
    const exitedCount = (stageCount["rejected"]||0) + (stageCount["dropped"]||0);
    const exitRate = (candAll||[]).length > 0 ? Math.round((exitedCount / (candAll||[]).length) * 100) : 0;

    setStats({ totalCand, newCand, intSched, intDone, offers, joined, clients, jobs, revenue, pending, exitRate });

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

    // Funnel — every forward-moving stage (rejected/dropped are "exits" from
    // the pipeline, reported separately as the Rejected/Dropped KPI above,
    // not as a funnel step). Each stage shows two things: "current" (how many
    // candidates are sitting there right now — the original metric) and
    // "reached" (how many are at that stage or any later one — the classic
    // funnel view, which is what actually shows where drop-off happens).
    // "Reached" treats stage as strictly sequential, since there's no logged
    // history of past stage changes to compute a true cohort-over-time
    // conversion — a reasonable read given stages only move forward in the
    // UI, but an approximation worth knowing about rather than hard data.
    const FUNNEL_STAGES = [
      "lead_received","contacted","interested","resume_collected","submitted_to_client",
      "interview_scheduled","interview_completed","selected","offer_released","joined",
    ];
    let running = 0;
    const reachedByStage: Record<string, number> = {};
    for (let i = FUNNEL_STAGES.length - 1; i >= 0; i--) {
      running += stageCount[FUNNEL_STAGES[i]] || 0;
      reachedByStage[FUNNEL_STAGES[i]] = running;
    }
    const funnelBaseline = reachedByStage[FUNNEL_STAGES[0]] || 0;
    setFunnel(FUNNEL_STAGES.map(s => ({
      stage: s.replace(/_/g," "),
      current: stageCount[s] || 0,
      reached: reachedByStage[s],
      pct: funnelBaseline > 0 ? Math.round((reachedByStage[s] / funnelBaseline) * 100) : 0,
    })));

    // Sources — raw lead volume (unchanged) plus, new, what fraction of each
    // source's candidates actually reached "joined". A source can produce a
    // lot of leads and still be a weak source if few of them ever get hired.
    const srcMap: Record<string, { total: number; joined: number }> = {};
    (candAll||[]).forEach((c:any)=>{
      const s = c.source || "Unknown";
      if (!srcMap[s]) srcMap[s] = { total: 0, joined: 0 };
      srcMap[s].total++;
      if (c.stage === "joined") srcMap[s].joined++;
    });
    setSources(Object.entries(srcMap).map(([name, v]) => ({ name, value: v.total })));
    setSourceEffectiveness(
      Object.entries(srcMap)
        .map(([name, v]) => ({
          name,
          rate: v.total > 0 ? Math.round((v.joined / v.total) * 100) : 0,
          joined: v.joined,
          total: v.total,
        }))
        .sort((a, b) => b.rate - a.rate),
    );

    // Recruiter perf - get names from profiles. Tracks both how many
    // candidates are assigned (existing metric — workload/volume) and how
    // many of those actually reached "joined" (new — actual placements,
    // the number that matters more than raw assignment count).
    const rec: Record<string, { count: number; joined: number; name: string }> = {};
    (candAll||[]).forEach((c:any) => {
      const recruiterId = c.assigned_recruiter;
      if (!recruiterId) return;
      if (!rec[recruiterId]) {
        rec[recruiterId] = { count: 0, joined: 0, name: recruiterId };
      }
      rec[recruiterId].count++;
      if (c.stage === "joined") rec[recruiterId].joined++;
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
      count: r.count,
      joined: r.joined,
    })));
    setLoading(false);
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
        <Kpi label="Total Candidates" value={stats.totalCand ?? 0} icon={Users} tone="primary" loading={loading}/>
        <Kpi label="New This Month" value={stats.newCand ?? 0} icon={UserPlus} tone="cyan" loading={loading}/>
        <Kpi label="Interviews Scheduled" value={stats.intSched ?? 0} icon={CalendarCheck} tone="warning" loading={loading}/>
        <Kpi label="Interviews Completed" value={stats.intDone ?? 0} icon={CheckCircle2} tone="success" loading={loading}/>
        <Kpi label="Offers Released" value={stats.offers ?? 0} icon={FileSignature} tone="violet" loading={loading}/>
        <Kpi label="Joined Candidates" value={stats.joined ?? 0} icon={Trophy} tone="success" loading={loading}/>
        <Kpi label="Active Clients" value={stats.clients ?? 0} icon={Building2} tone="primary" loading={loading}/>
        <Kpi label="Open Positions" value={stats.jobs ?? 0} icon={Briefcase} tone="cyan" loading={loading}/>
        <Kpi label="Revenue" value={`₹${(stats.revenue ?? 0).toLocaleString()}`} icon={Wallet} tone="success" loading={loading}/>
        <Kpi label="Pending Payments" value={`₹${(stats.pending ?? 0).toLocaleString()}`} icon={Clock} tone="danger" loading={loading}/>
        <Kpi label="Rejected / Dropped" value={`${stats.exitRate ?? 0}%`} hint="of total pipeline" icon={UserX} tone="danger" loading={loading}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="card-hover">
          <CardHeader><CardTitle>Monthly Joining Trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            {loading ? <ChartSkeleton /> : (
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
            )}
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Hiring Funnel</CardTitle>
            <CardDescription>
              {loading ? "Loading…" : `${funnel.find(f=>f.stage==="joined")?.pct ?? 0}% of the pipeline reaches Joined`}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? <ChartSkeleton /> : (
            <ResponsiveContainer><BarChart data={funnel}>
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_ACCENT}/>
                  <stop offset="100%" stopColor={CHART_PRIMARY}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)"/><XAxis dataKey="stage" tick={{fontSize:11}} stroke="currentColor"/><YAxis stroke="currentColor" tick={{fontSize:11}}/>
              <Tooltip
                contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}
                formatter={(value:any, name:string, props:any) =>
                  name === "reached" ? [`${value} (${props.payload.pct}%)`, "Reached this stage+"] : [value, "Currently here"]
                }
              />
              <Legend wrapperStyle={{fontSize: 11}}/>
              <Bar dataKey="current" name="Currently here" fill={CHART_ACCENT} radius={[6,6,0,0]}/>
              <Bar dataKey="reached" name="Reached this stage+" fill="url(#barGrad)" radius={[6,6,0,0]}/>
            </BarChart></ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader><CardTitle>Candidate Sources</CardTitle></CardHeader>
          <CardContent className="h-72">
            {loading ? <ChartSkeleton /> : sources.length ? (
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
          <CardHeader>
            <CardTitle>Source Effectiveness</CardTitle>
            <CardDescription>% of each source's candidates that reached Joined — not just lead volume</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? <ChartSkeleton /> : sourceEffectiveness.length ? (
              <ResponsiveContainer><BarChart data={sourceEffectiveness} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)"/>
                <XAxis type="number" stroke="currentColor" tick={{fontSize:11}} unit="%"/>
                <YAxis type="category" dataKey="name" stroke="currentColor" tick={{fontSize:11}} width={110}/>
                <Tooltip
                  contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}
                  formatter={(_:any, __:string, props:any) => [`${props.payload.joined} of ${props.payload.total} joined (${props.payload.rate}%)`, "Hire rate"]}
                />
                <Bar dataKey="rate" fill={CHART_PRIMARY} radius={[0,6,6,0]}/>
              </BarChart></ResponsiveContainer>
            ) : (
              <ChartEmptyState label="No candidates yet — source effectiveness will appear here once added." />
            )}
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader>
            <CardTitle>Recruiter Performance</CardTitle>
            <CardDescription>Assigned candidates vs. how many actually reached Joined</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {loading ? <ChartSkeleton /> : recruiters.length ? (
              <ResponsiveContainer><BarChart data={recruiters}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)"/><XAxis dataKey="name" stroke="currentColor" tick={{fontSize:11}}/><YAxis stroke="currentColor" tick={{fontSize:11}}/>
                <Tooltip contentStyle={{borderRadius:8, border:"1px solid var(--border)", background:"var(--card)"}}/>
                <Legend wrapperStyle={{fontSize: 11}}/>
                <Bar dataKey="count" name="Assigned" fill={CHART_ACCENT} radius={[6,6,0,0]}/>
                <Bar dataKey="joined" name="Joined" fill={CHART_PRIMARY} radius={[6,6,0,0]}/>
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