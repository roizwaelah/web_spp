import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ReportsPage() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const getMonthRange = (monthValue) => {
    const [yearStr, monthStr] = String(monthValue || "").split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) {
      const fallback = new Date();
      return {
        start: new Date(fallback.getFullYear(), fallback.getMonth(), 1)
          .toISOString()
          .slice(0, 10),
        end: new Date(fallback.getFullYear(), fallback.getMonth() + 1, 0)
          .toISOString()
          .slice(0, 10),
      };
    }
    return {
      start: new Date(year, month - 1, 1).toISOString().slice(0, 10),
      end: new Date(year, month, 0).toISOString().slice(0, 10),
    };
  };

  const [filter, setFilter] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    type: "",
    status: "",
    class_id: "",
    student_id: "",
  });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [summary, setSummary] = useState({
    count: 0,
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    successful: 0,
    pending: 0,
  });
  const [monthFilter, setMonthFilter] = useState(defaultMonth);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loadedParamsKey, setLoadedParamsKey] = useState("");
  const [reportHeader, setReportHeader] = useState({
    title: "LAPORAN KAS MADRASAH",
    periodLabel: "-",
    academicYear: "-",
    principalName: "",
    treasurerName: "",
  });

  useToastMessage(message, setMessage);

  const loadMeta = useCallback(async () => {
    try {
      const metaRes = await fetchRoute("admin/meta");
      setMeta({
        classes: Array.isArray(metaRes.data?.classes)
          ? metaRes.data.classes
          : [],
        students: Array.isArray(metaRes.data?.students)
          ? metaRes.data.students
          : [],
      });
    } catch {
      setMeta({ classes: [], students: [] });
    }
  }, []);

  const load = async () => {
    if (!filter.type) {
      setRows([]);
      setSummary({
        count: 0,
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
        successful: 0,
        pending: 0,
      });
      setMessage("Pilih jenis laporan terlebih dahulu.");
      return;
    }

    try {
      const reportsRes = await fetchRoute("admin/reports", {
        params: {
          start_date: filter.start_date,
          end_date: filter.end_date,
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
          ...(filter.student_id ? { student_id: filter.student_id } : {}),
        },
      });
      setRows(Array.isArray(reportsRes.data?.rows) ? reportsRes.data.rows : []);
      setSummary(
        reportsRes.data?.summary || {
          count: 0,
          totalIncome: 0,
          totalExpense: 0,
          net: 0,
          successful: 0,
          pending: 0,
        },
      );
      setReportHeader(
        reportsRes.data?.header || {
          title: "LAPORAN KAS MADRASAH",
          periodLabel: "-",
          academicYear: "-",
          principalName: "",
          treasurerName: "",
        },
      );
      setLoadedParamsKey(currentParamsKey);
      setMessage("");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat laporan");
    }
  };

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const studentOptions = useMemo(() => {
    const source = Array.isArray(meta.students) ? meta.students : [];
    return source
      .filter((item) => {
        if (!filter.class_id) return true;
        return String(item.class_id || "") === String(filter.class_id);
      })
      .map((item) => ({ id: String(item.id), name: item.name || "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [filter.class_id, meta.students]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.report_type || ""} ${row.report_date || ""} ${row.student_name || ""} ${row.class_name || ""} ${row.item_name || ""} ${row.category || ""} ${row.payment_channel || ""} ${row.reference_no || ""} ${row.status || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [rows, search],
  );

  const mutationRows = useMemo(() => {
    const ascending = [...filteredRows].sort((a, b) => {
      if (String(a.report_date) === String(b.report_date)) {
        return Number(a.id || 0) - Number(b.id || 0);
      }
      return String(a.report_date).localeCompare(String(b.report_date));
    });

    const openingBalance =
      filter.type === "all" ? Number(summary?.openingBalance || 0) : 0;
    let runningBalance = openingBalance;
    const withBalance = ascending.map((row, idx) => {
      const income = row.report_type === "income" ? Number(row.amount || 0) : 0;
      const expense =
        row.report_type === "expense" ? Number(row.amount || 0) : 0;
      runningBalance += income - expense;
      return {
        ...row,
        _key: row.id || `${row.report_type}-${row.report_date}-${idx}`,
        mutation_income: income,
        mutation_expense: expense,
        mutation_balance: runningBalance,
      };
    });

    return withBalance;
  }, [filteredRows, filter.type, summary?.openingBalance]);

  const isIncomeDetailView = filter.type === "income";
  const isMonthlyView = filter.type === "all";
  const currentRows = filter.type
    ? isIncomeDetailView
      ? filteredRows
      : mutationRows
    : [];
  const currentParamsKey = JSON.stringify({
    start_date: filter.start_date,
    end_date: filter.end_date,
    type: filter.type,
    status: filter.status,
    class_id: filter.class_id,
    student_id: filter.student_id,
  });

  const toLabelStatus = (status) => {
    if (status === "paid") return "Lunas";
    if (status === "pending") return "Menunggu";
    if (status === "recorded") return "Tercatat";
    return "Gagal";
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const exportReport = async () => {
    if (!filter.type) {
      setMessage("Pilih jenis laporan terlebih dahulu.");
      return;
    }
    if (loadedParamsKey !== currentParamsKey) {
      setMessage(
        "Filter berubah. Klik Tampilkan dulu agar saldo dan data sesuai.",
      );
      return;
    }

    try {
      const response = await fetchRoute("admin/reports/export", {
        method: "GET",
        params: {
          format: "xls",
          start_date: filter.start_date,
          end_date: filter.end_date,
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
          ...(filter.student_id ? { student_id: filter.student_id } : {}),
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "laporan-keuangan.xls";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("");
    } catch (error) {
      const fallbackMessage =
        error?.response?.status === 401
          ? "Export gagal karena sesi login tidak valid. Silakan login ulang."
          : "Gagal export laporan";
      setMessage(error?.response?.data?.message || fallbackMessage);
    }
  };

  const printPdf = () => {
    if (!filter.type) {
      setMessage("Pilih jenis laporan terlebih dahulu.");
      return;
    }
    if (loadedParamsKey !== currentParamsKey) {
      setMessage(
        "Filter berubah. Klik Tampilkan dulu agar saldo dan data sesuai.",
      );
      return;
    }
    if (currentRows.length === 0) {
      setMessage("Tidak ada data untuk dicetak.");
      return;
    }

    const columns = isIncomeDetailView
      ? [
          { key: "tanggal", label: "Tanggal", align: "center" },
          { key: "siswa", label: "Siswa", align: "left" },
          { key: "kelas", label: "Kelas", align: "left" },
          { key: "pos", label: "Pos", align: "left" },
          { key: "kanal", label: "Kanal", align: "left" },
          { key: "nominal", label: "Nominal", align: "right" },
          { key: "referensi", label: "Referensi", align: "center" },
          { key: "status", label: "Status", align: "left" },
        ]
      : isMonthlyView
        ? [
            { key: "no", label: "No.", align: "center" },
            { key: "tanggal", label: "Tanggal", align: "center" },
            { key: "uraian", label: "Uraian", align: "left" },
            { key: "kategori", label: "Kategori", align: "left" },
            { key: "kanal", label: "Kanal", align: "left" },
            { key: "pemasukan", label: "Pemasukan", align: "right" },
            { key: "pengeluaran", label: "Pengeluaran", align: "right" },
            { key: "saldo", label: "Saldo", align: "right" },
          ]
        : [
            { key: "jenis", label: "Jenis", align: "left" },
            { key: "tanggal", label: "Tanggal", align: "center" },
            { key: "uraian", label: "Uraian", align: "left" },
            { key: "kategori", label: "Kategori", align: "left" },
            { key: "kanal", label: "Kanal", align: "left" },
            { key: "pemasukan", label: "Pemasukan", align: "right" },
            { key: "pengeluaran", label: "Pengeluaran", align: "right" },
            { key: "saldo", label: "Saldo", align: "right" },
            { key: "referensi", label: "Referensi", align: "center" },
            { key: "status", label: "Status", align: "left" },
          ];

    const bodyRows = currentRows
      .map((row, idx) => {
        const cells = isIncomeDetailView
          ? [
              { value: row.report_date, align: "center" },
              { value: row.student_name, align: "left" },
              { value: row.class_name, align: "left" },
              { value: row.item_name, align: "left" },
              { value: row.payment_channel, align: "left" },
              { value: formatCurrency(row.amount), align: "right" },
              { value: row.reference_no || "-", align: "center" },
              { value: toLabelStatus(row.status), align: "left" },
            ]
          : isMonthlyView
            ? [
                { value: String(idx + 1), align: "center" },
                { value: row.report_date, align: "center" },
                { value: row.item_name, align: "left" },
                { value: row.category || "-", align: "left" },
                { value: row.payment_channel || "-", align: "left" },
                {
                  value:
                    row.mutation_income > 0
                      ? formatCurrency(row.mutation_income)
                      : "-",
                  align: "right",
                },
                {
                  value:
                    row.mutation_expense > 0
                      ? formatCurrency(row.mutation_expense)
                      : "-",
                  align: "right",
                },
                { value: formatCurrency(row.mutation_balance), align: "right" },
              ]
            : [
                {
                  value:
                    row.report_type === "income" ? "Pemasukan" : "Pengeluaran",
                  align: "left",
                },
                { value: row.report_date, align: "center" },
                { value: row.item_name, align: "left" },
                { value: row.category || "-", align: "left" },
                { value: row.payment_channel || "-", align: "left" },
                {
                  value:
                    row.mutation_income > 0
                      ? formatCurrency(row.mutation_income)
                      : "-",
                  align: "right",
                },
                {
                  value:
                    row.mutation_expense > 0
                      ? formatCurrency(row.mutation_expense)
                      : "-",
                  align: "right",
                },
                { value: formatCurrency(row.mutation_balance), align: "right" },
                { value: row.reference_no || "-", align: "center" },
                { value: toLabelStatus(row.status), align: "left" },
              ];

        return `<tr>${cells.map((cell) => `<td style="text-align:${cell.align};">${escapeHtml(cell.value)}</td>`).join("")}</tr>`;
      })
      .join("");

    const openingBalance = Number(summary?.openingBalance || 0);
    const closingBalance = isMonthlyView
      ? Number(
          currentRows[currentRows.length - 1]?.mutation_balance ??
            summary?.closingBalance ??
            openingBalance,
        )
      : Number(summary?.closingBalance || openingBalance);
    const monthlyPrefixRow = isMonthlyView
      ? `<tr>
          <td style="text-align:center;font-weight:700;"></td>
          <td style="text-align:center;font-weight:700;"></td>
          <td style="text-align:left;font-weight:700;">Saldo akhir bulan lalu</td>
          <td style="text-align:left;font-weight:700;"></td>
          <td style="text-align:left;font-weight:700;"></td>
          <td style="text-align:right;font-weight:700;"></td>
          <td style="text-align:right;font-weight:700;"></td>
          <td style="text-align:right;font-weight:700;">${escapeHtml(formatCurrency(openingBalance))}</td>
        </tr>`
      : "";
    const monthlySuffixRow = isMonthlyView
      ? `<tr>
          <td style="text-align:center;font-weight:700;"></td>
          <td style="text-align:center;font-weight:700;"></td>
          <td style="text-align:left;font-weight:700;">Saldo akhir bulan ini</td>
          <td style="text-align:left;font-weight:700;"></td>
          <td style="text-align:left;font-weight:700;"></td>
          <td style="text-align:right;font-weight:700;"></td>
          <td style="text-align:right;font-weight:700;"></td>
          <td style="text-align:right;font-weight:700;">${escapeHtml(formatCurrency(closingBalance))}</td>
        </tr>`
      : "";

    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      setMessage("Popup diblokir browser. Izinkan popup untuk mencetak PDF.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Laporan Keuangan</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1 { margin: 0 0 4px; font-size: 18px; text-align: center; }
            .meta { margin: 0 0 16px; font-size: 12px; color: #334155; text-align: center; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
            th { background: #f1f5f9; font-weight: 700; text-align: center; }
            .signature-wrap { margin-top: 24px; display: flex; justify-content: space-between; gap: 20px; }
            .signature-col { width: 45%; text-align: center; font-size: 12px; }
            .signature-line { margin-top: 56px; padding-top: 4px; font-weight: 700; }
            @media print {
              body { margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(reportHeader.title || "LAPORAN KAS MADRASAH")}</h1>
          <p class="meta">
            Periode ${escapeHtml(reportHeader.periodLabel || "-")} T.A ${escapeHtml(reportHeader.academicYear || "-")}
          </p>
          <table>
            <thead>
              <tr>${columns.map((column) => `<th style="text-align:center;">${escapeHtml(column.label)}</th>`).join("")}</tr>
            </thead>
            <tbody>${monthlyPrefixRow}${bodyRows}${monthlySuffixRow}</tbody>
          </table>
          <div class="signature-wrap">
            <div class="signature-col">
              Mengetahui,<br/>Kepala Madrasah
              <div class="signature-line">(${escapeHtml(reportHeader.principalName || ".................................")})</div>
            </div>
            <div class="signature-col">
              &nbsp;<br/>Bendahara
              <div class="signature-line">(${escapeHtml(reportHeader.treasurerName || ".................................")})</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 150);
  };

  return (
    <Layout
      title="Laporan Keuangan Real-Time"
      subtitle="Mutasi keuangan: pemasukan per jenis pos dan pengeluaran operasional dalam satu kronologi laporan."
    >
      <div className="space-y-4">
        <div className="card p-4">
          <div className="grid gap-4 xl:grid-cols-1">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label">Jenis</label>
                <select
                  className="input"
                  value={filter.type}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    if (nextType === "all") {
                      const range = getMonthRange(monthFilter);
                      setFilter({
                        ...filter,
                        type: nextType,
                        start_date: range.start,
                        end_date: range.end,
                        status: "",
                        class_id: "",
                        student_id: "",
                      });
                      return;
                    }
                    setFilter({
                      ...filter,
                      type: nextType,
                      status: "",
                      class_id: "",
                      student_id: "",
                    });
                  }}
                >
                  <option value="">Pilih jenis laporan</option>
                  <option value="all">Bulanan</option>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                </select>
              </div>
              {filter.type === "all" ? (
                <div>
                  <label className="label">Periode</label>
                  <input
                    type="month"
                    className="input"
                    value={monthFilter}
                    onChange={(e) => {
                      const nextMonth = e.target.value;
                      setMonthFilter(nextMonth);
                      const range = getMonthRange(nextMonth);
                      setFilter((prev) => ({
                        ...prev,
                        start_date: range.start,
                        end_date: range.end,
                      }));
                    }}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Tanggal mulai</label>
                    <input
                      type="date"
                      className="input"
                      value={filter.start_date}
                      onChange={(e) =>
                        setFilter({ ...filter, start_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Tanggal akhir</label>
                    <input
                      type="date"
                      className="input"
                      value={filter.end_date}
                      onChange={(e) =>
                        setFilter({ ...filter, end_date: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select
                      className="input"
                      value={filter.status}
                      disabled={filter.type === "expense"}
                      onChange={(e) =>
                        setFilter({
                          ...filter,
                          status: e.target.value,
                          student_id: "",
                        })
                      }
                    >
                      <option value="">Semua status</option>
                      <option value="paid">Lunas</option>
                      <option value="pending">Menunggu</option>
                      <option value="failed">Gagal</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Kelas</label>
                    <select
                      className="input"
                      value={filter.class_id}
                      disabled={filter.type === "expense"}
                      onChange={(e) =>
                        setFilter({
                          ...filter,
                          class_id: e.target.value,
                          student_id: "",
                        })
                      }
                    >
                      <option value="">Semua kelas</option>
                      {meta.classes.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">Siswa</label>
                    <select
                      className="input"
                      value={filter.student_id}
                      disabled={
                        filter.type === "expense" || studentOptions.length === 0
                      }
                      onChange={(e) =>
                        setFilter({ ...filter, student_id: e.target.value })
                      }
                    >
                      <option value="">
                        {studentOptions.length === 0
                          ? "Tidak ada siswa"
                          : "Semua siswa"}
                      </option>
                      {studentOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                className="btn-primary"
                onClick={load}
                disabled={!filter.type}
              >
                Tampilkan
              </button>
              <button
                className="btn-secondary justify-center"
                onClick={exportReport}
                disabled={!filter.type}
              >
                <Download size={18} /> Export
              </button>
              <button
                className="btn-secondary justify-center"
                onClick={printPdf}
                disabled={!filter.type}
              >
                <Printer size={18} /> Cetak
              </button>
            </div>
          </div>
        </div>
        <Table
          columns={
            isIncomeDetailView
              ? [
                  { key: "report_date", title: "Tanggal" },
                  { key: "student_name", title: "Siswa" },
                  { key: "class_name", title: "Kelas" },
                  { key: "item_name", title: "Pos" },
                  { key: "payment_channel", title: "Kanal" },
                  {
                    key: "amount",
                    title: "Nominal",
                    render: (row) => formatCurrency(row.amount),
                  },
                  { key: "reference_no", title: "Referensi" },
                  {
                    key: "status",
                    title: "Status",
                    render: (row) => (
                      <span
                        className={
                          row.status === "paid"
                            ? "badge-green"
                            : row.status === "pending"
                              ? "badge-amber"
                              : row.status === "recorded"
                                ? "badge-slate"
                                : "badge-red"
                        }
                      >
                        {row.status === "paid"
                          ? "Lunas"
                          : row.status === "pending"
                            ? "Menunggu"
                            : row.status === "recorded"
                              ? "Tercatat"
                              : "Gagal"}
                      </span>
                    ),
                  },
                ]
              : [
                  {
                    key: "report_type",
                    title: "Jenis",
                    render: (row) => (
                      <span
                        className={
                          row.report_type === "income"
                            ? "badge-green"
                            : "badge-red"
                        }
                      >
                        {row.report_type === "income"
                          ? "Pemasukan"
                          : "Pengeluaran"}
                      </span>
                    ),
                  },
                  { key: "report_date", title: "Tanggal" },
                  { key: "item_name", title: "Uraian" },
                  {
                    key: "category",
                    title: "Kategori",
                    render: (row) => row.category || "-",
                  },
                  { key: "payment_channel", title: "Kanal" },
                  {
                    key: "mutation_income",
                    title: "Pemasukan",
                    render: (row) =>
                      row.mutation_income > 0
                        ? formatCurrency(row.mutation_income)
                        : "-",
                  },
                  {
                    key: "mutation_expense",
                    title: "Pengeluaran",
                    render: (row) =>
                      row.mutation_expense > 0
                        ? formatCurrency(row.mutation_expense)
                        : "-",
                  },
                  {
                    key: "mutation_balance",
                    title: "Saldo",
                    render: (row) => formatCurrency(row.mutation_balance),
                  },
                  { key: "reference_no", title: "Referensi" },
                  {
                    key: "status",
                    title: "Status",
                    render: (row) => (
                      <span
                        className={
                          row.status === "paid"
                            ? "badge-green"
                            : row.status === "pending"
                              ? "badge-amber"
                              : row.status === "recorded"
                                ? "badge-slate"
                                : "badge-red"
                        }
                      >
                        {row.status === "paid"
                          ? "Lunas"
                          : row.status === "pending"
                            ? "Menunggu"
                            : row.status === "recorded"
                              ? "Tercatat"
                              : "Gagal"}
                      </span>
                    ),
                  },
                ]
          }
          rows={currentRows}
          emptyText={
            !filter.type
              ? "Jenis laporan belum dipilih, Data tidak ditampilkan."
              : "Belum ada data"
          }
        />
      </div>
    </Layout>
  );
}
