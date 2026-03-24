export default function StatCard({ title, value, helper }) {
  return (
    <div className="kpi">
      <p className="text-sm text-slate-500">{title}</p>
      <h3 className="mt-3 text-3xl font-bold text-slate-900">{value}</h3>
      <p className="mt-2 text-xs text-slate-400">{helper}</p>
    </div>
  )
}
