export default function StatCard({
  title,
  value,
  helper,
  className = "",
  accentClass = "bg-slate-300",
  titleClass = "text-slate-500",
  valueClass = "text-slate-900",
  helperClass = "text-slate-400",
}) {
  return (
    <div className={`kpi ${className}`.trim()}>
      <div className={`mb-3 h-1.5 w-14 rounded-full ${accentClass}`.trim()} />
      <p className={`text-[0.78rem] uppercase tracking-wide ${titleClass}`.trim()}>{title}</p>
      <h3 className={`mt-2 text-xl font-bold leading-tight xl:text-[1.2rem] ${valueClass}`.trim()}>{value}</h3>
      <p className={`mt-1.5 text-[0.72rem] ${helperClass}`.trim()}>{helper}</p>
    </div>
  )
}
