/**
 * CurrencyLogo — a small fiat flag for a reserve's currency.
 *
 * The reserve is pegged to a currency; this shows the fiat it represents:
 * MUSD → US, MTESOURO/MBRL → Brazil, MARS → Argentina. Flags are the one place we use
 * literal color (otherwise Precision Brutalism stays monochrome + amber);
 * they're kept small and hairline-bordered so they read as identity marks,
 * not decoration.
 */

const CURRENCY_COUNTRY: Record<string, string> = {
  MUSD: "US",
  MTESOURO: "BR",
  MBRL: "BR",
  MARS: "AR",
};

/** Simplified, recognizable flags drawn in a 24×16 viewBox. */
function Flag({ country }: { country: string }) {
  switch (country) {
    case "US":
      return (
        <>
          <rect width="24" height="16" fill="#fff" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect key={i} y={(i * 16) / 7} width="24" height={16 / 13} fill="#B22234" />
          ))}
          <rect width="10" height={(16 / 13) * 7} fill="#3C3B6E" />
        </>
      );
    case "BR":
      return (
        <>
          <rect width="24" height="16" fill="#009C3B" />
          <polygon points="12,2 22,8 12,14 2,8" fill="#FFDF00" />
          <circle cx="12" cy="8" r="3.2" fill="#002776" />
        </>
      );
    case "AR":
      return (
        <>
          <rect width="24" height="16" fill="#74ACDF" />
          <rect y="5.33" width="24" height="5.33" fill="#fff" />
          <circle cx="12" cy="8" r="1.7" fill="#F6B40E" />
        </>
      );
    default:
      return <rect width="24" height="16" fill="var(--color-surface-2)" />;
  }
}

export function CurrencyLogo({
  currency,
  width = 24,
  muted = false,
}: {
  currency: string;
  width?: number;
  /** Desaturate the flag to read as "locked / not yet available" (planned reserves). */
  muted?: boolean;
}) {
  const country = CURRENCY_COUNTRY[currency];
  const height = Math.round((width * 16) / 24);
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        width: `${width}px`,
        height: `${height}px`,
        border: "1px solid var(--color-border)",
        flexShrink: 0,
        overflow: "hidden",
        // Planned reserves: grayscale flag so it reads as blocked/not-yet-live.
        filter: muted ? "grayscale(1)" : undefined,
        opacity: muted ? 0.65 : 1,
      }}
    >
      <svg width="100%" height="100%" viewBox="0 0 24 16" preserveAspectRatio="none">
        {country ? <Flag country={country} /> : <Flag country="" />}
      </svg>
    </span>
  );
}
