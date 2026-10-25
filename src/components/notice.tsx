type Tone = "warning" | "danger" | "success" | "info";

// Full class names so Tailwind sees them; the icon carries the meaning for
// anyone who can't tell the colours apart.
const TONES: Record<Tone, { box: string; accent: string; icon: string }> = {
  warning: { box: "notice-warning", accent: "text-warning", icon: "⚠" },
  danger: { box: "notice-danger", accent: "text-danger", icon: "✕" },
  success: { box: "notice-success", accent: "text-success", icon: "✓" },
  info: { box: "notice-info", accent: "text-info", icon: "ℹ" },
};

/** A status message box: warnings, errors, confirmations and notes. */
export function Notice({
  tone,
  title,
  children,
  className = "",
}: {
  tone: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`notice ${t.box} ${className}`}>
      <span aria-hidden="true" className={`font-bold ${t.accent}`}>
        {t.icon}
      </span>
      <div className="min-w-0">
        {title && <strong className={t.accent}>{title} </strong>}
        {children}
      </div>
    </div>
  );
}
