export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'brand' | 'amber' | 'red' | 'green';
}) {
  const accentClass = {
    brand: 'text-brand-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
    green: 'text-emerald-600',
  }[accent ?? 'brand'];

  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
