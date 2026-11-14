import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canMountApprovedCrm } from "@/lib/crm-shell-access";
import { filterOwnedNotificationRows } from "@/lib/notification-owner";
import { hasCompleteIdList } from "@/lib/crm-list-integrity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Calendar, Check, Clock, IndianRupee, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/notifications")({ component: Page });

const TYPE_ICON: Record<string, typeof Bell> = {
  interview_reminder: Calendar,
  payment_overdue: IndianRupee,
  joining_followup: UserCheck,
  stalled_followup: Clock,
};

type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
};

function Page() {
  const { user, profile, role, loading } = useAuth();
  // The shell also verifies access; repeat the gate at the read entrypoint.
  if (loading || !user || !canMountApprovedCrm(user.id, profile, role)) {
    return <div className="text-sm text-muted-foreground">Notifications require an active, approved account.</div>;
  }
  // A new account remounts the entire feed and discards previous user state.
  return <OwnedNotifications key={user.id} userId={user.id} />;
}

function OwnedNotifications({ userId }: { userId: string }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let newestRequest = 0;
    let requestController: AbortController | null = null;
    setItems([]);
    setLoading(true);
    setLoadFailed(false);
    const load = async () => {
      const ticket = ++newestRequest;
      requestController?.abort();
      const controller = new AbortController();
      requestController = controller;
      setItems([]);
      setLoading(true);
      setLoadFailed(false);
      try {
        const { data, error, count } = await supabase.from("notifications")
          .select("id,user_id,title,message,type,is_read,created_at", { count: "exact" })
          .eq("user_id", userId)
          .order("created_at", { ascending: false }).limit(100)
          .abortSignal(controller.signal);
        if (!active || controller.signal.aborted || ticket !== newestRequest) return;
        // A default API cap or unexpected owner cannot become a plausible
        // "100 notifications" or "nothing to see" claim.
        if (error || !hasCompleteIdList(data, count, 100) ||
            data.some(row => row.user_id !== userId)) {
          setLoadFailed(true);
          return;
        }
        setItems(filterOwnedNotificationRows(data, userId) as NotificationItem[]);
      } catch {
        if (active && !controller.signal.aborted && ticket === newestRequest)
          setLoadFailed(true);
      } finally {
        if (active && !controller.signal.aborted && ticket === newestRequest)
          setLoading(false);
      }
    };
    void load();
    const channel = supabase.channel(`notif-rt-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `user_id=eq.${userId}`,
      }, () => { void load(); }).subscribe();
    return () => {
      active = false;
      requestController?.abort();
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = async (id: string) => {
    // Neither a stale selection nor a malformed identifier can mutate another
    // account's notifications. The server must acknowledge the exact row.
    if (!items.some(n => n.id === id && n.user_id === userId && !n.is_read)) return;
    try {
      const { data, error } = await supabase.from("notifications")
        .update({ is_read: true }).eq("id", id).eq("user_id", userId).select("id");
      if (error || data?.length !== 1 || data[0]?.id !== id) {
        toast.error("Notification update was not confirmed.");
        return;
      }
      setItems(prev => prev.map(n => n.id === id && n.user_id === userId
        ? { ...n, is_read: true } : n));
    } catch {
      toast.error("Notification update was not confirmed.");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Account-specific reminders for interviews, follow-ups, joinings and payments.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">
          {loading ? "Checking notifications…" : loadFailed
            ? "Notification list unavailable"
            : `${items.length} notification(s)`}
        </CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map(n => {
            const Icon = TYPE_ICON[n.type ?? ""] ?? Bell;
            return (
              <div key={n.id} className={`flex items-start gap-3 p-3 rounded-md border ${n.is_read ? "bg-muted/30" : "bg-background"}`}>
                <Icon className="h-4 w-4 mt-1 text-primary"/>
                <div className="flex-1">
                  <div className="font-medium text-sm">{n.title}</div>
                  {n.message && <div className="text-xs text-muted-foreground">{n.message}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
                </div>
                {!n.is_read && (
                  <Button size="icon" variant="ghost" aria-label="Mark notification read"
                    onClick={() => { void markRead(n.id); }}>
                    <Check className="h-4 w-4"/>
                  </Button>
                )}
              </div>
            );
          })}
          {!loading && loadFailed && (
            <div className="text-sm text-destructive text-center py-8">Notification list is incomplete or unavailable. No partial results are displayed.</div>
          )}
          {!loading && !loadFailed && !items.length && (
            <div className="text-sm text-muted-foreground text-center py-8">No notifications</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
