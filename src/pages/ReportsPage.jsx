import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency, formatPeriod } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const reportPerPage = 50;

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
    academic_year_id: "",
    finance_post_id: "",
    status: "",
    class_id: "",
    student_id: "",
  });
  const [rows, setRows] = useState([]);
  const [loadedRows, setLoadedRows] = useState([]);
  const [reportPage, setReportPage] = useState(1);
  const [reportPagination, setReportPagination] = useState({
    page: 1,
    per_page: reportPerPage,
    total: 0,
    total_pages: 1,
  });
  const [meta, setMeta] = useState({ classes: [], students: [], years: [], financePosts: [] });
  const [summary, setSummary] = useState({
    count: 0,
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    successful: 0,
    pending: 0,
  });
  const [monthFilter, setMonthFilter] = useState(defaultMonth);
  const [allPeriodMode, setAllPeriodMode] = useState("month");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loadedParamsKey, setLoadedParamsKey] = useState("");
  const [appliedType, setAppliedType] = useState("");
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
        years: Array.isArray(metaRes.data?.years)
          ? metaRes.data.years
          : [],
        financePosts: Array.isArray(metaRes.data?.finance_posts)
          ? metaRes.data.finance_posts
          : Array.isArray(metaRes.data?.financePosts)
            ? metaRes.data.financePosts
            : [],
      });
    } catch {
      setMeta({ classes: [], students: [], years: [], financePosts: [] });
    }
  }, []);

  const load = async (pageOverride = reportPage) => {
    if (!filter.type) {
      setRows([]);
      setLoadedRows([]);
      setAppliedType("");
      setReportPagination({ page: 1, per_page: reportPerPage, total: 0, total_pages: 1 });
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
          mode: "page",
          page: pageOverride,
          per_page: reportPerPage,
          start_date: filter.start_date,
          end_date: filter.end_date,
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.academic_year_id ? { academic_year_id: filter.academic_year_id } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.type === "income" && filter.finance_post_id
            ? { finance_post_id: filter.finance_post_id }
            : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
          ...(filter.student_id ? { student_id: filter.student_id } : {}),
        },
      });
      const rawData = reportsRes?.data;
      const parseLooseJson = (text) => {
        if (typeof text !== "string") return {};
        const raw = text.trim();
        if (!raw) return {};
        try { return JSON.parse(raw); } catch {}
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const sliced = raw.slice(firstBrace, lastBrace + 1);
          try { return JSON.parse(sliced); } catch {}
        }
        return {};
      };

      const parsedRawData = (() => {
        if (typeof rawData === "string") return parseLooseJson(rawData);
        return rawData ?? {};
      })();

      const unwrap = (value) => {
        if (value == null) return {};
        if (typeof value === "string") return parseLooseJson(value);
        return value;
      };

      const payload = unwrap(parsedRawData?.data ?? parsedRawData);
      const findFirstRowArray = (node, depth = 0) => {
        if (depth > 6 || node == null) return [];
        if (Array.isArray(node)) {
          if (node.length === 0) return [];
          if (typeof node[0] === "object") return node;
          return [];
        }
        if (typeof node !== "object") return [];

        const preferredKeys = ["rows", "data", "result", "items", "list"];
        for (const key of preferredKeys) {
          if (Object.prototype.hasOwnProperty.call(node, key)) {
            const found = findFirstRowArray(node[key], depth + 1);
            if (found.length > 0) return found;
          }
        }

        for (const value of Object.values(node)) {
          const found = findFirstRowArray(value, depth + 1);
          if (found.length > 0) return found;
        }
        return [];
      };

      const incomingRows = findFirstRowArray(parsedRawData);
      const pagination = payload?.pagination || {};
      const totalPages = Math.max(1, Number(pagination.total_pages || 1));
      const normalizedRows = (Array.isArray(incomingRows) ? incomingRows : []).map((row, idx) => {
        const reportType =
          row?.report_type ??
          (String(row?.tipe || "").toLowerCase().includes("pengeluaran")
            ? "expense"
            : "income");
        const reportDate = row?.report_date ?? row?.tanggal ?? "";
        const amountNumber = Number(row?.amount ?? row?.nominal ?? 0) || 0;
        const statusValue = row?.status ?? (reportType === "expense" ? "recorded" : "paid");
        return {
          ...row,
          report_type: reportType,
          report_date: reportDate,
          amount: amountNumber,
          status: statusValue,
          _key: row?._key ?? row?.id ?? `${reportType}-${reportDate}-${idx}`,
        };
      });
      setRows(normalizedRows);
      setLoadedRows(normalizedRows);
      setReportPage(Number(pagination.page || pageOverride || 1));
      setReportPagination({
        page: Number(pagination.page || pageOverride || 1),
        per_page: Number(pagination.per_page || reportPerPage),
        total: Number(pagination.total ?? normalizedRows.length),
        total_pages: totalPages,
      });
      setSummary(
        payload?.summary || {
          count: 0,
          totalIncome: 0,
          totalExpense: 0,
          net: 0,
          successful: 0,
          pending: 0,
        },
      );
      setReportHeader(
        payload?.header || {
          title: "LAPORAN KAS MADRASAH",
          periodLabel: "-",
          academicYear: "-",
          principalName: "",
          treasurerName: "",
        },
      );
      setLoadedParamsKey(currentParamsKey);
      setAppliedType(filter.type);
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
      (appliedType || filter.type) === "all"
        ? Number(summary?.openingBalance || 0)
        : 0;
    const hasServerBalances = ascending.every((row) => row.mutation_balance != null);
    let runningBalance = openingBalance;
    const withBalance = ascending.map((row, idx) => {
      const income = row.report_type === "income" ? Number(row.amount || 0) : 0;
      const expense =
        row.report_type === "expense" ? Number(row.amount || 0) : 0;
      if (!hasServerBalances) runningBalance += income - expense;
      return {
        ...row,
        _key: row.id || `${row.report_type}-${row.report_date}-${idx}`,
        mutation_income: income,
        mutation_expense: expense,
        mutation_balance: hasServerBalances ? Number(row.mutation_balance || 0) : runningBalance,
      };
    });

    return withBalance;
  }, [appliedType, filter.type, filteredRows, summary?.openingBalance]);

  const effectiveType = appliedType || filter.type;
  const isIncomeDetailView = effectiveType === "income";
  const isMonthlyView = effectiveType === "all";
  const isExpenseView = effectiveType === "expense";
  const currentRows = effectiveType
    ? isIncomeDetailView
      ? filteredRows
      : mutationRows.length > 0
        ? mutationRows
        : filteredRows
    : [];
  const fallbackRows = loadedRows.length > 0 ? loadedRows : rows;
  const displayRows = currentRows.length > 0 ? currentRows : fallbackRows;
  const currentParamsKey = JSON.stringify({
    start_date: filter.start_date,
    end_date: filter.end_date,
    type: filter.type,
    academic_year_id: filter.academic_year_id,
    finance_post_id: filter.finance_post_id,
    status: filter.status,
    class_id: filter.class_id,
    student_id: filter.student_id,
  });

  useEffect(() => {
    setReportPage(1);
    setReportPagination((current) => ({ ...current, page: 1 }));
  }, [currentParamsKey, search]);

  const toLabelStatus = (status) => {
    if (status === "paid") return "Lunas";
    if (status === "pending") return "Menunggu";
    if (status === "recorded") return "Tercatat";
    return "Gagal";
  };

  const formatDateOnly = (value) => {
    if (!value) return "-";
    const dateText = String(value).trim();
    if (dateText.length >= 10) return dateText.slice(0, 10);
    return dateText;
  };

  const getReportTypeLabel = (type) => {
    if (type === "all") return "Bulanan";
    if (type === "income") return "Pemasukan";
    if (type === "expense") return "Pengeluaran";
    return "Keuangan";
  };

  const formatDateLabel = (dateValue) => {
    const dateText = formatDateOnly(dateValue);
    const parsed = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateText;
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(parsed);
  };

  const activeReportType = effectiveType;
  const reportPeriodLabel =
    activeReportType === "all" && allPeriodMode === "month" && reportHeader?.periodLabel && reportHeader.periodLabel !== "-"
      ? reportHeader.periodLabel
      : `${formatDateLabel(filter.start_date)} s.d. ${formatDateLabel(filter.end_date)}`;
  const reportTitle = `Laporan ${getReportTypeLabel(activeReportType)} ${reportPeriodLabel}`;
  const reportFileNameBase = reportTitle.replace(/[\\/:*?"<>|]/g, "-");
  const escapeHtml = (value) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");


  const getDistinctValues = (items, resolver) => {
    const values = [];
    const seen = new Set();
    items.forEach((item) => {
      const value = String(resolver(item) ?? "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      values.push(value);
    });
    return values;
  };

  const parseBillPeriod = (value) => {
    const text = String(value ?? "").trim();
    const match = text.match(/^(\d{4})-(\d{1,2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!year || month < 1 || month > 12) return null;
    return { text, year, month, index: year * 12 + month };
  };

  const compactBillPeriods = (items) => {
    const rawPeriods = getDistinctValues(
      items,
      (item) => item.period ?? item.bill_period ?? item.periode,
    );
    if (rawPeriods.length === 0) return "-";

    const parsedPeriods = rawPeriods.map(parseBillPeriod);
    if (parsedPeriods.some((period) => !period)) {
      return rawPeriods.join(", ");
    }

    const sortedPeriods = [...parsedPeriods].sort((a, b) => a.index - b.index);
    const labels = [];

    for (let idx = 0; idx < sortedPeriods.length; idx += 1) {
      const start = sortedPeriods[idx];
      let end = start;
      while (
        idx + 1 < sortedPeriods.length &&
        sortedPeriods[idx + 1].index === end.index + 1
      ) {
        idx += 1;
        end = sortedPeriods[idx];
      }
      labels.push(start.index === end.index ? formatPeriod(start.text) : formatPeriod(start.text) + " - " + formatPeriod(end.text));
    }

    return labels.join(", ");
  };

  const groupIncomeRowsByReference = (sourceRows) => {
    const groups = new Map();
    sourceRows.forEach((row, idx) => {
      const referenceNo = String(row.reference_no ?? "").trim();
      const key = referenceNo || "blank-" + (row._key ?? row.id ?? idx);
      if (!groups.has(key)) {
        groups.set(key, {
          ...row,
          reference_no: referenceNo,
          amount: 0,
          _incomeRows: [],
        });
      }
      const group = groups.get(key);
      group.amount += Number(row.amount ?? row.amount_paid ?? 0) || 0;
      group._incomeRows.push(row);
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      item_name: getDistinctValues(group._incomeRows, (row) => row.item_name).join(", "),
      payment_channel: getDistinctValues(group._incomeRows, (row) => row.payment_channel).join(", "),
      period: compactBillPeriods(group._incomeRows),
    }));
  };

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
          format: "xlsx",
          start_date: filter.start_date,
          end_date: filter.end_date,
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.academic_year_id ? { academic_year_id: filter.academic_year_id } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.type === "income" && filter.finance_post_id
            ? { finance_post_id: filter.finance_post_id }
            : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
          ...(filter.student_id ? { student_id: filter.student_id } : {}),
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportFileNameBase}.xlsx`;
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
    if (displayRows.length === 0) {
      setMessage("Tidak ada data untuk dicetak.");
      return;
    }

    const columns = isIncomeDetailView
      ? [
          { key: "no", label: "No.", align: "center" },
          { key: "tanggal", label: "Tanggal", align: "center" },
          { key: "referensi", label: "Referensi", align: "center" },
          { key: "nama_siswa", label: "Nama Siswa", align: "left" },
          { key: "kelas", label: "Kelas", align: "left" },
          { key: "pos", label: "Pos", align: "left" },
          { key: "bulan", label: "Bulan", align: "left" },
          { key: "kanal", label: "Kanal", align: "left" },
          { key: "nominal", label: "Nominal", align: "right" },
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
        : isExpenseView
          ? [
              { key: "no", label: "No.", align: "center" },
              { key: "tanggal", label: "Tanggal", align: "center" },
              { key: "referensi", label: "Referensi", align: "center" },
              { key: "uraian", label: "Uraian", align: "left" },
              { key: "kategori", label: "Kategori", align: "left" },
              { key: "kanal", label: "Kanal", align: "left" },
              { key: "nominal", label: "Nominal", align: "right" },
            ]
          : [
              { key: "tanggal", label: "Tanggal", align: "center" },
              { key: "referensi", label: "Referensi", align: "center" },
              { key: "uraian", label: "Uraian", align: "left" },
              { key: "kategori", label: "Kategori", align: "left" },
              { key: "kanal", label: "Kanal", align: "left" },
              { key: "nominal", label: "Nominal", align: "right" },
            ];

    const printRows = isIncomeDetailView
      ? groupIncomeRowsByReference(displayRows)
      : displayRows;
    const bodyRows = printRows
      .map((row, idx) => {
        const cells = isIncomeDetailView
          ? [
              { value: String(idx + 1), align: "center" },
              { value: formatDateOnly(row.report_date), align: "center" },
              { value: row.reference_no || "-", align: "center" },
              { value: row.student_name, align: "left" },
              { value: row.class_name, align: "left" },
              { value: row.item_name, align: "left" },
              { value: formatPeriod(row.period), align: "left" },
              { value: row.payment_channel, align: "left" },
              { value: formatCurrency(row.amount), align: "right" },
            ]
          : isMonthlyView
            ? [
                { value: String(idx + 1), align: "center" },
                { value: formatDateOnly(row.report_date), align: "center" },
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
            : isExpenseView
              ? [
                  { value: String(idx + 1), align: "center" },
                  { value: formatDateOnly(row.report_date), align: "center" },
                  { value: row.reference_no || "-", align: "center" },
                  { value: row.item_name, align: "left" },
                  { value: row.category || "-", align: "left" },
                  { value: row.payment_channel || "-", align: "left" },
                  { value: formatCurrency(row.amount), align: "right" },
                ]
              : [
                  { value: formatDateOnly(row.report_date), align: "center" },
                  { value: row.reference_no || "-", align: "center" },
                  { value: row.item_name, align: "left" },
                  { value: row.category || "-", align: "left" },
                  { value: row.payment_channel || "-", align: "left" },
                  { value: formatCurrency(row.amount), align: "right" },
                ];

        return `<tr>${cells.map((cell) => `<td style="text-align:${cell.align};">${escapeHtml(cell.value)}</td>`).join("")}</tr>`;
      })
      .join("");

    const openingBalance = Number(summary?.openingBalance || 0);
    const closingBalance = isMonthlyView
      ? Number(
          displayRows[displayRows.length - 1]?.mutation_balance ??
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
    const incomeTotalRow = isIncomeDetailView
      ? (() => {
          const total = printRows.reduce(
            (acc, row) => acc + Number(row.amount || 0),
            0,
          );
          return `<tr><td colspan="9" style="border:none;height:12px;"></td></tr>
                  <tr>
                    <td colspan="8" style="text-align:right;font-weight:700;">TOTAL</td>
                    <td style="text-align:right;font-weight:700;">${escapeHtml(formatCurrency(total))}</td>
                  </tr>`;
        })()
      : "";
    const expenseTotalRow = isExpenseView
      ? (() => {
          const total = displayRows.reduce(
            (acc, row) => acc + Number(row.amount || 0),
            0,
          );
          return `<tr><td colspan="7" style="border:none;height:12px;"></td></tr>
                  <tr>
                    <td colspan="6" style="text-align:right;font-weight:700;">TOTAL</td>
                    <td style="text-align:right;font-weight:700;">${escapeHtml(formatCurrency(total))}</td>
                  </tr>`;
        })()
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
          <title>${escapeHtml(reportTitle)}</title>
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
          <h1>${escapeHtml(reportTitle)}</h1>
          <p class="meta">
            Periode ${escapeHtml(reportHeader.periodLabel || "-")} T.A ${escapeHtml(reportHeader.academicYear || "-")}
          </p>
          <table>
            <thead>
              <tr>${columns.map((column) => `<th style="text-align:center;">${escapeHtml(column.label)}</th>`).join("")}</tr>
            </thead>
            <tbody>${monthlyPrefixRow}${bodyRows}${monthlySuffixRow}${incomeTotalRow}${expenseTotalRow}</tbody>
          </table>
          <div class="signature-wrap">
            <div class="signature-col">
              Mengetahui,<br/>Pengasuh
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="grid min-w-[280px] flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="label">Jenis</label>
                  <select
                    className="input"
                    value={filter.type}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      if (nextType === "all") {
                        const range =
                          allPeriodMode === "month"
                            ? getMonthRange(monthFilter)
                            : { start: filter.start_date, end: filter.end_date };
                        setFilter({
                          ...filter,
                          type: nextType,
                          start_date: range.start,
                          end_date: range.end,
                          academic_year_id: "",
    finance_post_id: "",
    status: "",
                          class_id: "",
                          student_id: "",
                        });
                        return;
                      }
                      setFilter({
                        ...filter,
                        type: nextType,
                        academic_year_id: "",
    finance_post_id: "",
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
                  <>
                    {allPeriodMode === "month" ? (
                      <div>
                        <label className="label">Periode Bulan</label>
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
</>
                    )}
                  </>
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
                      <label className="label">Tahun Ajaran</label>
                      <select
                        className="input"
                        value={filter.academic_year_id}
                        disabled={false}
                        onChange={(e) =>
                          setFilter({
                            ...filter,
                            academic_year_id: e.target.value,
                            student_id: "",
                          })
                        }
                      >
                        <option value="">Semua tahun ajaran</option>
                        {meta.years.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
{filter.type === "income" ? (
                      <div>
                        <label className="label">Pos</label>
                        <select
                          className="input"
                          value={filter.finance_post_id}
                          onChange={(e) =>
                            setFilter({ ...filter, finance_post_id: e.target.value })
                          }
                        >
                          <option value="">Semua pos</option>
                          {meta.financePosts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <div>
                      <label className="label">Status</label>
                      <select
                        className="input"
                        value={filter.status}
                        disabled={filter.type === "expense"}
                        onChange={(e) =>
                          setFilter({ ...filter, status: e.target.value })
                        }
                      >
                        <option value="">Semua status</option>
                        <option value="paid">Lunas</option>
                        <option value="pending">Menunggu</option>
                        <option value="recorded">Tercatat</option>
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
{filter.type === "all" ? (
                <div className="flex w-full flex-col items-start justify-center self-stretch md:w-auto md:items-end">
                  <span className="mb-1 text-xs font-medium text-slate-600">Mode</span>
                  <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
                    <button
                      type="button"
                      className={`px-2 py-1 text-xs ${allPeriodMode === "month" ? "bg-sky-600 text-white" : "bg-white text-slate-700"}`}
                      onClick={() => {
                        setAllPeriodMode("month");
                        const range = getMonthRange(monthFilter);
                        setFilter((prev) => ({
                          ...prev,
                          start_date: range.start,
                          end_date: range.end,
                        }));
                      }}
                    >
                      Bln
                    </button>
                    <button
                      type="button"
                      className={`px-2 py-1 text-xs ${allPeriodMode === "date" ? "bg-sky-600 text-white" : "bg-white text-slate-700"}`}
                      onClick={() => setAllPeriodMode("date")}
                    >
                      Tgl
                    </button>
                  </div>
</div>
) : null}
            </div>
<div className="flex flex-wrap justify-center gap-3">
              <button
                className="btn-primary"
                onClick={() => load(1)}
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
          rows={displayRows}
          emptyText={
            !effectiveType
              ? "Jenis laporan belum ditampilkan, klik Tampilkan terlebih dahulu."
              : "Belum ada data"
          }
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Halaman {reportPagination.page} dari {reportPagination.total_pages} ({reportPagination.total} data)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={!filter.type || reportPage <= 1 || loadedParamsKey !== currentParamsKey}
              onClick={() => load(Math.max(1, reportPage - 1))}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={!filter.type || reportPage >= reportPagination.total_pages || loadedParamsKey !== currentParamsKey}
              onClick={() => load(reportPage + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}



































