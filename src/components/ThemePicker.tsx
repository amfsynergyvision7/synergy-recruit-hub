import { Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useColorTheme } from "@/hooks/use-color-theme";
import { COLOR_THEME_LIST, type ColorThemeId } from "@/lib/color-themes";
import { cn } from "@/lib/utils";

/**
 * Every theme swatch also draws its own tiny mandala gradient circle (not
 * just a flat color chip) so switching themes here previews exactly what
 * changes on the sidebar/login mandala — the whole point of this picker.
 */
function SwatchPreview({ theme }: { theme: (typeof COLOR_THEME_LIST)[number] }) {
  const id = `swatch-${theme.id}`;
  return (
    <div
      className="h-14 w-full rounded-md border"
      style={{ background: theme.dark.background, borderColor: theme.dark.border }}
    >
      <svg viewBox="0 0 100 56" className="h-full w-full">
        <defs>
          <radialGradient id={id} cx="50%" cy="50%">
            <stop offset="0%" stopColor={theme.mandala[0]} />
            <stop offset="55%" stopColor={theme.mandala[1]} />
            <stop offset="100%" stopColor={theme.mandala[2]} />
          </radialGradient>
        </defs>
        <circle cx="78" cy="14" r="34" fill={`url(#${id})`} opacity={0.55} />
        <rect x="8" y="34" width="26" height="8" rx="2" fill={theme.dark.primary} />
        <rect x="8" y="44" width="46" height="4" rx="2" fill={theme.dark["muted-foreground"]} opacity={0.6} />
      </svg>
    </div>
  );
}

export function ThemePicker({
  isAdmin,
  orgDefault,
  onSetOrgDefault,
}: {
  /** Shows a "Make default" action per swatch and the current org default's badge. Omit for a non-admin viewer. */
  isAdmin?: boolean;
  orgDefault?: ColorThemeId;
  onSetOrgDefault?: (id: ColorThemeId) => void;
}) {
  const { colorTheme, setColorTheme } = useColorTheme();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {COLOR_THEME_LIST.map((t) => {
        const active = colorTheme === t.id;
        const isOrgDefault = orgDefault === t.id;
        return (
          <div
            key={t.id}
            className={cn(
              "rounded-lg border p-3 space-y-2 text-left transition-colors",
              active ? "border-primary ring-1 ring-primary" : "border-border",
            )}
          >
            <button type="button" className="block w-full text-left" onClick={() => setColorTheme(t.id)}>
              <SwatchPreview theme={t} />
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-sm font-medium">{t.label}</span>
                {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                {isOrgDefault && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                    <Star className="h-3 w-3" />Default
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t.description}</p>
            </button>
            {isAdmin && onSetOrgDefault && !isOrgDefault && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onSetOrgDefault(t.id)}>
                Make organization default
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}