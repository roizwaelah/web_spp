export default function Table({ columns, rows, emptyText = 'Belum ada data' }) {
  const safeColumns = Array.isArray(columns) ? columns : []
  const safeRows = Array.isArray(rows) ? rows : []

  return (
    <div className="table-wrap">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              {safeColumns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-600">{column.title}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {safeRows.length === 0 ? (
              <tr>
                <td colSpan={safeColumns.length || 1} className="px-4 py-10 text-center text-slate-500">{emptyText}</td>
              </tr>
            ) : safeRows.map((row, idx) => (
              <tr key={row.id || idx} className="hover:bg-slate-50/80">
                {safeColumns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-top text-slate-700">
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
