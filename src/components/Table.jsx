export default function Table({ columns, rows, emptyText = 'Belum ada data', striped = false }) {
  const safeColumns = Array.isArray(columns) ? columns : []
  const safeRows = Array.isArray(rows) ? rows : []

  return (
    <div className="table-wrap">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-[0.82rem] xl:text-[0.8rem]">
          <thead className={striped ? "bg-slate-100/90" : "bg-slate-50/80"}>
            <tr>
              {safeColumns.map((column) => (
                <th
                  key={column.key}
                  className={`whitespace-nowrap px-3 py-2.5 text-left font-bold text-black xl:px-3 xl:py-2 ${column.headerClassName || ""}`.trim()}
                >
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={striped ? "divide-y divide-slate-200" : "divide-y divide-slate-100"}>
            {safeRows.length === 0 ? (
              <tr>
                <td colSpan={safeColumns.length || 1} className="px-3 py-8 text-center text-slate-500">{emptyText}</td>
              </tr>
            ) : safeRows.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={
                  striped
                    ? `${idx % 2 === 0 ? "bg-white" : "bg-slate-50/85"} hover:bg-sky-50/70`
                    : "hover:bg-slate-50/80"
                }
              >
                {safeColumns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-2.5 align-top text-slate-900 xl:px-3 xl:py-2 ${column.cellClassName || ""}`.trim()}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
