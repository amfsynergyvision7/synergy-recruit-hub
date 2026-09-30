// Public, unauthenticated page — a candidate reaches this straight from a
// link a recruiter copied out of ScheduleLinkButton.tsx (no CRM account, no
// _app layout, no auth check: the token itself is the only credential, same
// trust model as a password-reset email link). Data comes from
// scheduling.functions.ts's public functions, which use supabaseAdmin
// server-side — nothing here ever touches Supabase directly from the browser.
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getSchedulingInfo, confirmSchedulingSlot } from "@/lib/scheduling.functions";
import { formatSlotForDisplay } from "@/lib/scheduling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLogo } from "@/components/BrandMark";
import { useColorTheme } from "@/hooks/use-color-theme";
import { hexToRgba } from "@/lib/color-themes";
import { CalendarCheck, CalendarClock, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/schedule/$token")({ component: SchedulePage });

function SchedulePage() {
  const { token } = Route.useParams();
  const { theme } = useColorTheme();
  const glow = hexToRgba(theme.mandala[0], 0.6);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);

  const runInfo = useServerFn(getSchedulingInfo);
  const infoQuery = useQuery({
    queryKey: ["scheduling-info", token],
    queryFn: () => runInfo({ data: { token } }),
    retry: false,
  });

  const runConfirm = useServerFn(confirmSchedulingSlot);
  const confirmMut = useMutation({
    mutationFn: (slot: string) => runConfirm({ data: { token, slot } }),
    onSuccess: (_res, slot) => setPickedSlot(slot),
  });

  const info = infoQuery.data;
  // Confirmed either from the start (a manually-scheduled interview whose
  // link got shared after the fact) or just now via the mutation above.
  const isConfirmed = !!pickedSlot || (info && info.status !== "awaiting_candidate" && info.confirmedDate);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-center gap-2">
          <div className="h-8 w-8 rounded-md bg-sidebar-accent/60 border border-sidebar-border flex items-center justify-center">
            <BrandLogo className="h-6 w-6" style={{ filter: `drop-shadow(0 0 5px ${glow})` }} />
          </div>
          <span className="text-sm font-medium text-muted-foreground">AMF Synergy Vision</span>
        </div>

        <Card>
          {infoQuery.isLoading && (
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          )}

          {infoQuery.isError && !infoQuery.isLoading && (
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 text-destructive">
                <TriangleAlert className="h-5 w-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium">This link isn't valid</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    It may have expired or been superseded by a newer one. Please reach out to your recruiter for an updated link.
                  </p>
                </div>
              </div>
            </CardContent>
          )}

          {info && !infoQuery.isLoading && !infoQuery.isError && (
            isConfirmed ? (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" />You're booked</CardTitle>
                  <CardDescription>We've let your recruiter know.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-border bg-muted/20 p-3 text-sm">
                    <div className="font-medium">
                      {formatSlotForDisplay(
                        pickedSlot ?? `${info.confirmedDate}T${(info.confirmedTime ?? "00:00").slice(0, 5)}`,
                      )}
                    </div>
                    {info.round && <div className="text-muted-foreground mt-1">{info.round} interview{info.companyName ? ` · ${info.companyName}` : ""}</div>}
                  </div>
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>Hi {info.candidateName}, pick a time</CardTitle>
                  <CardDescription>
                    {info.round ? `${info.round} interview` : "Interview"}{info.companyName ? ` with ${info.companyName}` : ""}
                    {info.mode ? ` (${info.mode === "f2f" ? "in person" : info.mode})` : ""} — choose whichever slot works best.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {info.proposedSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">No times have been proposed yet — please check back shortly or contact your recruiter.</p>
                  )}
                  {info.proposedSlots.map((slot) => (
                    <Button
                      key={slot}
                      variant="outline"
                      className="w-full justify-start"
                      disabled={confirmMut.isPending}
                      onClick={() => confirmMut.mutate(slot)}
                    >
                      <CalendarClock className="h-4 w-4 mr-2" />
                      {formatSlotForDisplay(slot)}
                    </Button>
                  ))}
                  {confirmMut.isError && (
                    <p className="text-sm text-destructive">{(confirmMut.error as any)?.message ?? "Couldn't confirm that slot — please try again."}</p>
                  )}
                </CardContent>
              </>
            )
          )}
        </Card>
      </div>
    </div>
  );
}