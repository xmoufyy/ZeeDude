export function PaidBadge({ paid, className = "" }: { paid: boolean; className?: string }) {
  return paid ? (
    <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ${className}`}>
      <span aria-hidden="true">✓</span> Paid
    </span>
  ) : (
    <span className={`inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-muted ${className}`}>
      Pending
    </span>
  );
}
