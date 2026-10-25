export function PaidBadge({ paid, className = "" }: { paid: boolean; className?: string }) {
  return paid ? (
    <span className={`badge badge-success ${className}`}>
      <span aria-hidden="true">✓</span> Paid
    </span>
  ) : (
    <span className={`badge badge-neutral ${className}`}>
      <span aria-hidden="true">◷</span> Pending
    </span>
  );
}
