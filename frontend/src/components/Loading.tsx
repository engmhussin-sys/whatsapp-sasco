export function Loading({ label = 'جارٍ التحميل...' }: { label?: string }) {
  return <p className="text-sm text-slate-500">{label}</p>;
}
