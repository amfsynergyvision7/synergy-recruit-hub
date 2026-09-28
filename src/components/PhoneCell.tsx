import { Phone, MessageCircle } from "lucide-react";
import { telHref, whatsappHref } from "@/lib/phone-links";

/**
 * Renders a phone number as plain text plus two small tap targets — call and
 * WhatsApp — so a recruiter can reach a candidate straight from the table or
 * the detail panel instead of copying the number out into another app.
 * Falls back to plain text (no dead links) when the stored value isn't a
 * real, dialable number (empty, "NA", malformed).
 */
export function PhoneCell({ value }: { value: string | null | undefined }) {
  const tel = telHref(value);
  const wa = whatsappHref(value);

  if (!tel) {
    return <span>{value?.trim() || "—"}</span>;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="truncate">{value}</span>
      <a
        href={tel}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Call"
        aria-label={`Call ${value}`}
      >
        <Phone className="h-3.5 w-3.5" />
      </a>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-[#25D366]"
          title="WhatsApp"
          aria-label={`WhatsApp ${value}`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </a>
      )}
    </span>
  );
}