export default function StatCard({ title, value, helper }) {
  return (
    <div className="kpi">
      <p className="text-[0.82rem] uppercase tracking-wide text-slate-500">{title}</p>
      <h3 className="mt-2 text-2xl font-bold leading-tight text-slate-900 xl:text-[1.7rem]">{value}</h3>
      <p className="mt-1.5 text-[0.72rem] text-slate-400">{helper}</p>
    </div>
  )
}
