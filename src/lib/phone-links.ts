// Turns a stored phone number into tel:/WhatsApp links a recruiter can tap
// straight from their phone — handles the messy real-world formats already
// sitting in the candidates table (some with a leading 0, some with +91,
// some as a bare 10 digits, and some literally "NA" for auto-created rows
// where nothing could be extracted).

function digitsOnly(value: string): string {
    return value.replace(/\D/g, "");
  }
  
  // Assumes India (+91) when no country code is present — every candidate in
  // this CRM is dialed as an Indian mobile number today. If this CRM ever
  // takes on international candidates, this is the one place that would need
  // a smarter guess (or a stored country code per candidate).
  const DEFAULT_COUNTRY_CODE = "91";
  
  /**
   * Digits including country code, no "+", no leading zero — exactly the
   * shape both tel: links and wa.me expect. Returns null for anything that
   * isn't a real, dialable number (empty, "NA", too short to be a mobile).
   */
  export function normalizeForDialing(raw: string | null | undefined): string | null {
    if (!raw) return null;
    if (raw.trim().toLowerCase() === "na") return null;
  
    let digits = digitsOnly(raw);
    if (digits.length === 0) return null;
  
    if (digits.length === 10) {
      digits = DEFAULT_COUNTRY_CODE + digits;
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = DEFAULT_COUNTRY_CODE + digits.slice(1);
    }
  
    // Anything still short of a real mobile number (a stray extension, a
    // partially-entered value) isn't safe to treat as dialable.
    if (digits.length < 11) return null;
    return digits;
  }
  
  export function telHref(raw: string | null | undefined): string | null {
    const digits = normalizeForDialing(raw);
    return digits ? `tel:+${digits}` : null;
  }
  
  export function whatsappHref(raw: string | null | undefined): string | null {
    const digits = normalizeForDialing(raw);
    return digits ? `https://wa.me/${digits}` : null;
  }