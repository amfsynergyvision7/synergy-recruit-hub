// Client-ready resume PDF — same extension pattern as ResumeSummaryButton /
// AtsScoreButton (rendered via a field's "render" prop, not built into
// CrudModule.tsx). Unlike those two, this has no dialog: a click generates
// the PDF server-side (base64) and immediately triggers a browser download,
// the same base64 -> Blob -> anchor-click approach used nowhere else yet in
// this app (CSV export in csv.ts is plain text, so it builds its Blob
// directly from a string instead of decoding base64).
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { generateClientResumePdf } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { FileDown, TriangleAlert } from "lucide-react";

interface Props {
  candidateId: string;
  resumeUrl: string | null;
}

function downloadBase64Pdf(base64: string, filename: string) {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ClientResumePdfButton({ candidateId, resumeUrl }: Props) {
  const [failed, setFailed] = useState<string | null>(null);

  const runGenerate = useServerFn(generateClientResumePdf);
  const genMut = useMutation({
    mutationFn: () => runGenerate({ data: { candidateId } }),
    onSuccess: (data) => {
      setFailed(null);
      downloadBase64Pdf(data.base64, data.filename);
    },
    onError: (err: any) => setFailed(err?.message ?? "Couldn't generate the client resume PDF."),
  });

  if (!resumeUrl) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" className="h-7 px-2" disabled={genMut.isPending} onClick={() => genMut.mutate()}>
        <FileDown className="h-3.5 w-3.5 mr-1.5" />
        {genMut.isPending ? "Generating…" : "Client resume PDF"}
      </Button>
      {failed && !genMut.isPending && (
        <span className="flex items-center gap-1 text-xs text-destructive">
          <TriangleAlert className="h-3 w-3 shrink-0" />
          {failed}
        </span>
      )}
    </div>
  );
}