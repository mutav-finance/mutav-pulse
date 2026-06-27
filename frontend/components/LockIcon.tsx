/**
 * LockIcon — the padlock glyph for "planned / not yet available" reserves.
 *
 * One source of truth for the shape so the home strip, /reserves directory, and
 * the cockpit reserve switcher don't drift on stroke weight or accessibility.
 * Pass `label` for a standalone meaning (role="img"); omit it when the icon sits
 * next to text that already conveys the state (aria-hidden).
 */

export function LockIcon({
  size = 11,
  strokeWidth = 2,
  stroke = "currentColor",
  label,
}: {
  size?: number;
  strokeWidth?: number;
  stroke?: string;
  /** Accessible name. Omit when adjacent text already conveys the state. */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      style={{ flexShrink: 0 }}
    >
      <rect x="5" y="11" width="14" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
