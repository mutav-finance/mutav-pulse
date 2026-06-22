/**
 * Mutav Pulse — scaffold placeholder page
 *
 * Demonstrates the TGA three-layer hierarchy on the Investidor dark canvas:
 *   Layer 1 (Declaration) — Geist Bold heading
 *   Layer 2 (Explanation) — Inter body
 *   Layer 3 (Evidence)    — JetBrains Mono data
 *
 * This page will be replaced by the reserve dashboard in later tasks.
 */
import { ConnectButton } from "@/components/ConnectButton";

export default function Home() {
  return (
    <main
      className="texture-investidor flex flex-1 flex-col"
      style={{ minHeight: "100vh" }}
    >
      {/* Nav */}
      <nav
        style={{
          height: "56px",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-canvas)",
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          gap: "16px",
        }}
      >
        {/* Logo — Layer 1: Geist Bold, amber accent */}
        <span
          className="font-display"
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--color-accent)",
            letterSpacing: "-0.02em",
          }}
        >
          tga
        </span>

        <span
          className="font-body"
          style={{
            fontSize: "14px",
            color: "var(--color-text-2)",
          }}
        >
          pulse
        </span>

        {/* Right side: network indicator + connect button */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="live-dot" aria-hidden="true" />
            <span
              className="font-mono"
              style={{ fontSize: "12px", color: "var(--color-text-3)" }}
            >
              testnet
            </span>
          </div>
          <ConnectButton />
        </div>
      </nav>

      {/* Content */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "64px 32px",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Layer 2: Explanation — Inter label */}
        <p
          className="font-body"
          style={{
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.06em",
            color: "var(--color-text-2)",
            marginBottom: "16px",
            textTransform: "uppercase",
          }}
        >
          SGR Reserve
        </p>

        {/* Layer 1: Declaration — Geist Bold heading */}
        <h1
          className="font-display"
          style={{
            fontSize: "clamp(2.25rem, 1.278rem + 0.751vw, 2.25rem)",
            fontWeight: 700,
            color: "var(--color-text)",
            lineHeight: 1.111,
            letterSpacing: "-0.02em",
            marginBottom: "24px",
          }}
        >
          Mutav Pulse
        </h1>

        {/* Layer 2: Explanation — Inter body */}
        <p
          className="font-body"
          style={{
            fontSize: "16px",
            color: "var(--color-text-2)",
            lineHeight: 1.5,
            maxWidth: "480px",
            marginBottom: "48px",
          }}
        >
          Solvency-gated tokenized reserve vault with premium-gated coverage.
          Stellar Pulso hackathon testbed for the Mutav SGR rental-guarantee infrastructure.
        </p>

        {/* Layer 3: Evidence — JetBrains Mono data */}
        <div
          style={{
            border: "1px solid var(--color-border)",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minWidth: "320px",
          }}
        >
          <span
            className="font-body"
            style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}
          >
            Network
          </span>

          <span
            className="font-mono"
            style={{ fontSize: "13px", color: "var(--color-text)", letterSpacing: "0.01em" }}
          >
            Stellar Testnet · SDF
          </span>

          <span
            className="font-mono"
            style={{ fontSize: "11px", color: "var(--color-text-3)", letterSpacing: "0.03em", marginTop: "8px" }}
          >
            contracts pending deployment
          </span>
        </div>
      </section>
    </main>
  );
}
