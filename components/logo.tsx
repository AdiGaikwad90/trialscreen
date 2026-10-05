/**
 * The mark is the product reduced to 24px: a criterion ledger seen end-on.
 * Three rows, each carrying its verdict colour on the left and a bar whose
 * length falls away down the stack — the screening funnel and the pass / flag /
 * fail column in one shape. It is the only place in the app those three colours
 * appear together without words, so it reads as a signature rather than a
 * status.
 */
export function Logo({
  className = "",
  /** For dark surfaces, where an ink tile would vanish into the background. */
  inverted = false,
}: {
  className?: string;
  inverted?: boolean;
}) {
  // Lightened verdict tints. The page tokens are tuned for ink on paper and go
  // muddy against this dark tile, where the dots are only 2.6px across.
  const rows = [
    { y: 5.7, dot: inverted ? "var(--color-pass)" : "#6ec49b", width: 10 },
    { y: 10.7, dot: inverted ? "var(--color-flag)" : "#e8b45c", width: 7.4 },
    { y: 15.7, dot: inverted ? "var(--color-fail)" : "#e07b7b", width: 4.8 },
  ];

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden focusable="false">
      <rect
        width="24"
        height="24"
        rx="6.5"
        fill={inverted ? "var(--color-paper)" : "var(--color-ink)"}
      />
      {rows.map((r) => (
        <g key={r.y}>
          <rect x="4.7" y={r.y} width="2.6" height="2.6" rx="1.3" fill={r.dot} />
          <rect
            x="9.3"
            y={r.y + 0.55}
            width={r.width}
            height="1.5"
            rx="0.75"
            fill={inverted ? "var(--color-ink)" : "var(--color-paper)"}
            opacity={inverted ? 0.45 : 0.72}
          />
        </g>
      ))}
    </svg>
  );
}

/** Mark plus wordmark. One weight, tightened tracking — the mark carries the
 *  personality so the name does not have to. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Logo className="h-[26px] w-[26px] shrink-0" />
      <span className="text-[15.5px] font-semibold tracking-[-0.02em]">TrialScreen</span>
    </span>
  );
}
