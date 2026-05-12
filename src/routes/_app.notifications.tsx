import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/notifications")({ component: Page });

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("notifications").select("*")
      .order("created_at", { ascending: false }).limit(100);
    setItems(data || []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("notif-rt").on("postgres_changes",
      { event:"*", schema:"public", table:"notifications" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };
  const seedReminder = async () => {
    if (!user) return;
    await supabase.from("notifications").insert({
      user_id: user.id, title: "Test reminder", message: "This is a test notification.", type: "info"
    });
    toast.success("Notification created");
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted-foreground">Reminders for interviews, follow-ups, joinings and payments.</p>
        </div>
        <Button variant="outline" onClick={seedReminder}>Create test reminder</Button>
      </div>
      <Card><CardHeader><CardTitle className="text-base">{items.length} notification(s)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {items.map(n => (
            <div key={n.id} className={`flex items-start gap-3 p-3 rounded-md border ${n.is_read ? "bg-muted/30" : "bg-background"}`}>
              <Bell className="h-4 w-4 mt-1 text-primary"/>
              <div className="flex-1">
                <div className="font-medium text-sm">{n.title}</div>
                {n.message && <div className="text-xs text-muted-foreground">{n.message}</div>}
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </div>
              {!n.is_read && <Button size="icon" variant="ghost" onClick={()=>markRead(n.id)}><Check className="h-4 w-4"/></Button>}
            </div>
          ))}
          {!items.length && <div className="text-sm text-muted-foreground text-center py-8">No notifications</div>}
        </CardContent>
      </Card>
    </div>
  );
}
