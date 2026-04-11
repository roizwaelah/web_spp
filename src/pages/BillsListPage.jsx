import { useEffect, useMemo, useState } from "react";
import { CheckCheck, Download, Eye, Plus, Send, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import FormModal from "../components/FormModal";
import ModalFrame from "../components/ModalFrame";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

const romanToNumber = (rawValue) => {
  const value = String(rawValue || "").toUpperCase();
  if (!value || !/^[IVXLCDM]+$/.test(value)) return null;
  const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < value.length; i += 1) {
    const current = map[value[i]] || 0;
    const next = map[value[i + 1]] || 0;
    total += current < next ? -current : current;
  }
  return total > 0 ? total : null;
};

const getClassOrder = (item) => {
  const source = `${item?.name || ""} ${item?.grade_level || ""}`.toUpperCase();
  const arabic = source.match(/\b\d+\b/);
  if (arabic) return Number(arabic[0]);
  const tokens = source.split(/[^A-Z0-9]+/).filter(Boolean);
  for (const token of tokens) {
    const roman = romanToNumber(token);
    if (roman != null) return roman;
  }
  return null;
};

export default function BillsListPage() {
  const [rows, setRows] = useState([]);
  const [studentSourceRows, setStudentSourceRows] = useState([]);
  const [meta, setMeta] = useState({ students: [], classes: [], years: [], finance_posts: [] });
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [message, setMessage] = useState("");
  const [sendingStudentId, setSendingStudentId] = useState(null);
  const [sendingSelectedBills, setSendingSelectedBills] = useState(false);
  const [removingSelectedBills, setRemovingSelectedBills] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState("");
  const [detailSelectedBillIds, setDetailSelectedBillIds] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const [exportFilter, setExportFilter] = useState({
    month: defaultMonth,
    finance_post_ids: [],
  });
  const [filter, setFilter] = useState({
    status: "",
    class_id: "",
    student_id: "",
    academic_year_id: "",
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageBills = user?.role === "admin" || user?.role === "bendahara";
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const load = async () => {
    try {
      const [metaRes, studentRowsRes, rowsRes] = await Promise.all([
        fetchRoute("admin/meta"),
        fetchRoute("admin/bills", {
          params: {
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.class_id ? { class_id: filter.class_id } : {}),
            ...(filter.academic_year_id ? { academic_year_id: filter.academic_year_id } : {}),
          },
        }),
        fetchRoute("admin/bills", {
          params: {
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.class_id ? { class_id: filter.class_id } : {}),
            ...(filter.academic_year_id ? { academic_year_id: filter.academic_year_id } : {}),
            ...(filter.student_id ? { student_id: filter.student_id } : {}),
          },
        }),
      ]);

      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
        students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
        years: Array.isArray(metaRes.data?.years) ? metaRes.data.years : [],
        finance_posts: Array.isArray(metaRes.data?.finance_posts) ? metaRes.data.finance_posts : [],
      });
      setStudentSourceRows(Array.isArray(studentRowsRes.data) ? studentRowsRes.data : []);
      setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat data tagihan");
    }
  };

  useEffect(() => {
    load();
  }, [filter.status, filter.class_id, filter.student_id, filter.academic_year_id]);

  useEffect(() => {
    const postIds = (meta.finance_posts || []).map((item) => Number(item.id)).filter((id) => id > 0);
    setExportFilter((current) => {
      if (current.finance_post_ids.length > 0) return current;
      return { ...current, finance_post_ids: postIds };
    });
  }, [meta.finance_posts]);

  useEffect(() => {
    if (!Array.isArray(meta.years) || meta.years.length === 0) return;
    setFilter((current) => {
      if (current.academic_year_id) return current;
      const activeYear = meta.years.find((item) => Number(item?.is_active || 0) === 1);
      if (!activeYear?.id) return current;
      return { ...current, academic_year_id: String(activeYear.id), student_id: "" };
    });
  }, [meta.years]);


  const groupedRows = useMemo(() => {
    const byStudent = new Map();

    for (const row of rows) {
      const studentId = String(row?.student_id ?? "");
      if (!studentId) continue;

      if (!byStudent.has(studentId)) {
        byStudent.set(studentId, {
          id: studentId,
          student_name: row.student_name || "-",
          class_name: row.class_name || "-",
          periods: new Set(),
          academicYears: new Set(),
          bills: [],
          total_amount: 0,
          has_paid: false,
          has_unpaid: false,
        });
      }

      const entry = byStudent.get(studentId);
      entry.total_amount += Number(row.amount || 0);
      if (row.period) entry.periods.add(String(row.period));
      if (row.academic_year_name) entry.academicYears.add(String(row.academic_year_name));
      if (row.status === "paid") entry.has_paid = true;
      if (row.status !== "paid") entry.has_unpaid = true;
      entry.bills.push({
        id: row.id,
        bill_name: row.bill_name || "-",
        period: row.period || "-",
        academic_year_name: row.academic_year_name || "-",
        due_date: row.due_date || "",
        amount: Number(row.amount || 0),
        status: row.status || "unpaid",
      });
    }

    return Array.from(byStudent.values())
      .map((entry) => {
        const periodList = Array.from(entry.periods).sort((a, b) => a.localeCompare(b, "id"));
        const periodLabel =
          periodList.length <= 1
            ? periodList[0] || "-"
            : `${periodList[0]} s/d ${periodList[periodList.length - 1]}`;

        const academicYearList = Array.from(entry.academicYears).sort((a, b) => a.localeCompare(b, "id"));
        const academicYearLabel =
          academicYearList.length <= 1
            ? academicYearList[0] || "-"
            : `${academicYearList[0]} s/d ${academicYearList[academicYearList.length - 1]}`;

        const dueDateSource = entry.bills
          .filter((item) => item.status !== "paid" && item.due_date)
          .concat(entry.bills.filter((item) => item.status === "paid" && item.due_date));
        const nearestDueDate = dueDateSource
          .map((item) => item.due_date)
          .sort((a, b) => String(a).localeCompare(String(b)))[0] || "";

        const statusLabel = entry.has_unpaid
          ? entry.has_paid
            ? "Sebagian Lunas"
            : "Belum Lunas"
          : "Lunas";
        const statusClass =
          statusLabel === "Lunas" ? "badge-green" : statusLabel === "Sebagian Lunas" ? "badge-slate" : "badge-amber";

        return {
          ...entry,
          period_label: periodLabel,
          due_date: nearestDueDate,
          academic_year_label: academicYearLabel,
          status_label: statusLabel,
          status_class: statusClass,
          bills: [...entry.bills].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date))),
        };
      })
      .sort((a, b) => String(a.student_name).localeCompare(String(b.student_name), "id"));
  }, [rows]);

  const detailRow = useMemo(
    () => groupedRows.find((row) => String(row.id) === String(detailStudentId)) || null,
    [groupedRows, detailStudentId],
  );
  const detailUnpaidBillIds = useMemo(
    () => (detailRow ? detailRow.bills.filter((bill) => bill.status !== "paid").map((bill) => Number(bill.id)) : []),
    [detailRow],
  );
  const detailAllUnpaidSelected =
    detailUnpaidBillIds.length > 0 && detailSelectedBillIds.length === detailUnpaidBillIds.length;
  const detailSomeUnpaidSelected =
    detailSelectedBillIds.length > 0 && detailSelectedBillIds.length < detailUnpaidBillIds.length;

  useEffect(() => {
    const available = new Set(groupedRows.map((row) => String(row.id)));
    setSelectedStudentIds((current) => current.filter((id) => available.has(String(id))));
  }, [groupedRows]);

  useEffect(() => {
    if (!detailStudentId) return;
    if (!detailRow) setDetailStudentId("");
  }, [detailStudentId, detailRow]);

  useEffect(() => {
    if (!detailRow) {
      setDetailSelectedBillIds([]);
      return;
    }
    setDetailSelectedBillIds([]);
  }, [detailRow?.id]);

  const removeBill = async (billId) => {
    if (!canManageBills) {
      setMessage("Anda tidak memiliki izin untuk menghapus tagihan");
      return;
    }
    const confirmed = await confirm({
      title: "Hapus tagihan",
      description: "Perhatikan tagihan yang sudah punya transaksi atau bukti bayar.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchRoute("admin/bills", { method: "DELETE", data: { id: billId } });
      setMessage("Tagihan berhasil dihapus");
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus tagihan");
    }
  };

  const sendStudentReminder = async (studentId) => {
    try {
      setSendingStudentId(studentId);
      const { data } = await fetchRoute("admin/bills/remind-student", {
        method: "POST",
        data: { student_id: Number(studentId) },
      });
      setMessage(data?.message || "Pengingat gabungan tagihan berhasil dikirim");
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengirim pengingat gabungan tagihan");
    } finally {
      setSendingStudentId(null);
    }
  };

  const sendSelectedBillsReminder = async () => {
    if (!detailRow) return;
    if (detailSelectedBillIds.length === 0) {
      setMessage("Pilih minimal satu tagihan/pos yang ingin dikirim");
      return;
    }

    try {
      setSendingSelectedBills(true);
      const { data } = await fetchRoute("admin/bills/remind-selected", {
        method: "POST",
        data: {
          student_id: Number(detailRow.id),
          bill_ids: detailSelectedBillIds.map((id) => Number(id)),
        },
      });
      setMessage(data?.message || "Pengingat tagihan terpilih berhasil dikirim");
      setDetailSelectedBillIds([]);
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengirim tagihan terpilih");
    } finally {
      setSendingSelectedBills(false);
    }
  };

  const removeSelectedBills = async () => {
    if (!canManageBills) {
      setMessage("Anda tidak memiliki izin untuk menghapus tagihan");
      return;
    }
    if (!detailRow) return;
    if (detailSelectedBillIds.length === 0) {
      setMessage("Pilih minimal satu tagihan/pos yang ingin dihapus");
      return;
    }

    const confirmed = await confirm({
      title: "Hapus tagihan terpilih",
      description: `${detailSelectedBillIds.length} tagihan akan dihapus. Perhatikan tagihan yang sudah punya transaksi atau bukti bayar.`,
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      setRemovingSelectedBills(true);
      const { data } = await fetchRoute("admin/bills", {
        method: "DELETE",
        data: { ids: detailSelectedBillIds.map((id) => Number(id)) },
      });
      setMessage(data?.message || "Tagihan terpilih berhasil dihapus");
      setDetailSelectedBillIds([]);
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus tagihan terpilih");
    } finally {
      setRemovingSelectedBills(false);
    }
  };

  const removeBulkByStudent = async () => {
    if (!canManageBills) {
      setMessage("Anda tidak memiliki izin untuk menghapus tagihan");
      return;
    }
    if (selectedStudentIds.length === 0) return;

    const selectedSet = new Set(selectedStudentIds.map((id) => String(id)));
    const selectedRows = groupedRows.filter((row) => selectedSet.has(String(row.id)));
    const billIds = selectedRows.flatMap((row) => (row.bills || []).map((bill) => Number(bill.id))).filter((id) => id > 0);
    if (billIds.length === 0) {
      setMessage("Tidak ada tagihan yang bisa dihapus dari siswa terpilih");
      return;
    }

    const confirmed = await confirm({
      title: "Hapus tagihan terpilih",
      description: `${selectedRows.length} siswa dipilih (${billIds.length} tagihan). Perhatikan tagihan yang sudah punya transaksi atau bukti bayar.`,
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      const { data } = await fetchRoute("admin/bills", {
        method: "DELETE",
        data: { ids: billIds },
      });
      setMessage(data?.message || "Bulk hapus tagihan selesai diproses");
      setSelectedStudentIds([]);
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus tagihan terpilih");
    }
  };

  const submitExport = async (event) => {
    event.preventDefault();
    if (!exportFilter.month) {
      setMessage("Bulan wajib diisi");
      return;
    }
    if (exportFilter.finance_post_ids.length === 0) {
      setMessage("Pilih minimal satu pos tagihan");
      return;
    }

    try {
      setExporting(true);
      await downloadRouteFile(
        "admin/bills/export-tunggakan",
        {
          month: exportFilter.month,
          finance_post_ids: exportFilter.finance_post_ids.join(","),
        },
        `laporan-tunggakan-${exportFilter.month}.xlsx`,
      );
      setExportOpen(false);
      setMessage("Laporan tunggakan berhasil diunduh");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengunduh laporan tunggakan");
    } finally {
      setExporting(false);
    }
  };

  const studentOptions = useMemo(() => {
    const studentMap = new Map();
    for (const row of studentSourceRows) {
      if (!row?.student_id) continue;
      if (!studentMap.has(String(row.student_id))) {
        studentMap.set(String(row.student_id), {
          id: String(row.student_id),
          name: row.student_name || "",
          nis: row.nis || "",
        });
      }
    }
    return Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [studentSourceRows]);

  const sortedClassOptions = useMemo(
    () =>
      [...(meta.classes || [])].sort((a, b) => {
        const orderA = getClassOrder(a);
        const orderB = getClassOrder(b);
        if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
        if (orderA != null && orderB == null) return -1;
        if (orderA == null && orderB != null) return 1;
        const byName = String(a.name || "").localeCompare(String(b.name || ""), "id", {
          numeric: true,
          sensitivity: "base",
        });
        if (byName !== 0) return byName;
        return String(a.grade_level || "").localeCompare(String(b.grade_level || ""), "id", {
          numeric: true,
          sensitivity: "base",
        });
      }),
    [meta.classes],
  );

  const allSelected = groupedRows.length > 0 && selectedStudentIds.length === groupedRows.length;

  return (
    <Layout
      title="Daftar Tagihan"
      subtitle="Gunakan tombol detail untuk melihat rincian tagihan per siswa."
      actions={
        <div className="flex w-full justify-end">
          <button
            type="button"
            className="btn-primary shrink-0 px-3"
            onClick={() => navigate("/admin/tagihan/edit")}
            onMouseEnter={() => prefetchRoute("/admin/tagihan/edit")}
            onFocus={() => prefetchRoute("/admin/tagihan/edit")}
            title="Buat tagihan"
            aria-label="Buat tagihan"
          >
            <Plus size={18} />
            <span>Buat tagihan</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-3 md:hidden">
          <div className="card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Filter Tagihan</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                className="input"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">Semua status</option>
                <option value="unpaid">Belum lunas</option>
                <option value="paid">Lunas</option>
              </select>
              <select
                className="input"
                value={filter.class_id}
                onChange={(e) => setFilter({ ...filter, class_id: e.target.value, student_id: "" })}
              >
                <option value="">Semua kelas</option>
                {sortedClassOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filter.academic_year_id}
                onChange={(e) => setFilter({ ...filter, academic_year_id: e.target.value, student_id: "" })}
              >
                <option value="">Semua tahun ajaran</option>
                {(meta.years || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filter.student_id}
                disabled={studentOptions.length === 0}
                onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}
              >
                <option value="">{studentOptions.length === 0 ? "Tidak ada siswa" : "Semua siswa"}</option>
                {studentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.nis}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canManageBills && (
            <div className="card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi Massal</p>
              <div className="grid grid-cols-4 gap-2">
                {canManageBills ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary w-full justify-center px-0"
                      onClick={() => setSelectedStudentIds(groupedRows.map((row) => String(row.id)))}
                      disabled={groupedRows.length === 0 || allSelected}
                      title="Pilih semua"
                      aria-label="Pilih semua"
                    >
                      <CheckCheck size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-secondary w-full justify-center px-0"
                      onClick={() => setSelectedStudentIds([])}
                      disabled={selectedStudentIds.length === 0}
                      title="Batal pilih"
                      aria-label="Batal pilih"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-danger w-full justify-center px-0"
                      onClick={removeBulkByStudent}
                      disabled={selectedStudentIds.length === 0}
                      title={`Hapus terpilih (${selectedStudentIds.length})`}
                      aria-label={`Hapus terpilih (${selectedStudentIds.length})`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn-primary w-full justify-center px-0"
                  onClick={() => {
                    const postIds = (meta.finance_posts || []).map((item) => Number(item.id)).filter((id) => id > 0);
                    setExportFilter((current) => ({
                      ...current,
                      month: current.month || defaultMonth,
                      finance_post_ids: current.finance_post_ids.length > 0 ? current.finance_post_ids : postIds,
                    }));
                    setExportOpen(true);
                  }}
                  title="Export"
                  aria-label="Export"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`hidden gap-3 md:grid ${canManageBills ? "xl:grid-cols-[484px_minmax(0,1fr)]" : "grid-cols-1"}`}>
          {canManageBills && (
            <div className="card p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Aksi Massal</p>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:overflow-x-auto">
                {canManageBills ? (
                  <>
                    <button
                      type="button"
                      className="btn-secondary whitespace-normal sm:whitespace-nowrap"
                      onClick={() => setSelectedStudentIds(groupedRows.map((row) => String(row.id)))}
                      disabled={groupedRows.length === 0 || allSelected}
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      className="btn-secondary whitespace-normal sm:whitespace-nowrap"
                      onClick={() => setSelectedStudentIds([])}
                      disabled={selectedStudentIds.length === 0}
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      className="btn-danger whitespace-normal sm:whitespace-nowrap"
                      onClick={removeBulkByStudent}
                      disabled={selectedStudentIds.length === 0}
                    >
                      <Trash2 size={16} /> Hapus Terpilih ({selectedStudentIds.length})
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn-primary whitespace-normal sm:whitespace-nowrap"
                  onClick={() => {
                    const postIds = (meta.finance_posts || []).map((item) => Number(item.id)).filter((id) => id > 0);
                    setExportFilter((current) => ({
                      ...current,
                      month: current.month || defaultMonth,
                      finance_post_ids: current.finance_post_ids.length > 0 ? current.finance_post_ids : postIds,
                    }));
                    setExportOpen(true);
                  }}
                >
                  <Download size={16} /> Export
                </button>
              </div>
            </div>
          )}

          <div className="card p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Filter Tagihan</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <select
                className="input"
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">Semua status</option>
                <option value="unpaid">Belum lunas</option>
                <option value="paid">Lunas</option>
              </select>
              <select
                className="input"
                value={filter.class_id}
                onChange={(e) => setFilter({ ...filter, class_id: e.target.value, student_id: "" })}
              >
                <option value="">Semua kelas</option>
                {sortedClassOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filter.academic_year_id}
                onChange={(e) => setFilter({ ...filter, academic_year_id: e.target.value, student_id: "" })}
              >
                <option value="">Semua tahun ajaran</option>
                {(meta.years || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                className="input"
                value={filter.student_id}
                disabled={studentOptions.length === 0}
                onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}
              >
                <option value="">{studentOptions.length === 0 ? "Tidak ada siswa" : "Semua siswa"}</option>
                {studentOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.nis}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {groupedRows.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">Belum ada data tagihan</div>
          ) : (
            <ol className="space-y-3">
              {groupedRows.map((row, index) => {
                const rowSelected = selectedStudentIds.includes(String(row.id));
                return (
                  <li key={row.id} className="card p-3">
                    <div className="flex items-start gap-3">
                      <span className="pt-0.5 text-sm font-semibold text-slate-500">{index + 1}.</span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{row.student_name}</p>
                            <p className="text-xs text-slate-500">{row.class_name}</p>
                          </div>
                          <span className={row.status_class}>{row.status_label}</span>
                        </div>
                        <div className="space-y-1 text-xs text-slate-600">
                          <p>Periode: {row.period_label}</p>
                          <p>Jatuh tempo: {row.due_date ? formatDate(row.due_date) : "-"}</p>
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(row.total_amount)}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
                          {canManageBills ? (
                            <label className="inline-flex items-center gap-2 text-xs text-slate-600">
                              <input
                                type="checkbox"
                                checked={rowSelected}
                                onChange={(e) =>
                                  setSelectedStudentIds((current) =>
                                    e.target.checked
                                      ? [...new Set([...current, String(row.id)])]
                                      : current.filter((id) => String(id) !== String(row.id)),
                                  )
                                }
                              />
                              Pilih
                            </label>
                          ) : (
                            <span />
                          )}
                          <div className="flex items-center gap-2">
                            {canManageBills ? (
                              <button
                                className="btn-secondary px-3 py-2"
                                title="Kirim semua tagihan"
                                onClick={() => sendStudentReminder(row.id)}
                                disabled={sendingStudentId === row.id || row.status_label === "Lunas"}
                              >
                                <Send size={16} />
                              </button>
                            ) : null}
                            <button
                              className="btn-secondary px-3 py-2"
                              title="Lihat detail"
                              onClick={() => setDetailStudentId(String(row.id))}
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <div className="hidden md:block">
          <Table
            columns={[
              ...(canManageBills
                ? [
                    {
                      key: "select",
                      title: (
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) =>
                            setSelectedStudentIds(e.target.checked ? groupedRows.map((row) => String(row.id)) : [])
                          }
                        />
                      ),
                      headerClassName: "w-0 whitespace-nowrap",
                      cellClassName: "w-0 whitespace-nowrap",
                      render: (row) => (
                        <input
                          type="checkbox"
                          checked={selectedStudentIds.includes(String(row.id))}
                          onChange={(e) =>
                            setSelectedStudentIds((current) =>
                              e.target.checked
                                ? [...new Set([...current, String(row.id)])]
                                : current.filter((id) => String(id) !== String(row.id)),
                            )
                          }
                        />
                      ),
                    },
                  ]
                : []),
              { key: "student_name", title: "Siswa" },
              { key: "class_name", title: "Kelas" },
              { key: "period_label", title: "Periode" },
              {
                key: "due_date",
                title: "Jatuh Tempo",
                render: (row) => (row.due_date ? formatDate(row.due_date) : "-"),
              },
              {
                key: "total_amount",
                title: "Total Tagihan",
                render: (row) => formatCurrency(row.total_amount),
              },
              {
                key: "status_label",
                title: "Status",
                render: (row) => <span className={row.status_class}>{row.status_label}</span>,
              },
              {
                key: "actions",
                title: "Aksi",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    {canManageBills ? (
                      <button
                        className="btn-secondary px-3 py-2"
                        title="Kirim semua tagihan"
                        onClick={() => sendStudentReminder(row.id)}
                        disabled={sendingStudentId === row.id || row.status_label === "Lunas"}
                      >
                        <Send size={16} />
                      </button>
                    ) : null}
                    <button
                      className="btn-secondary px-3 py-2"
                      title="Lihat detail"
                      onClick={() => setDetailStudentId(String(row.id))}
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={groupedRows}
            emptyText="Belum ada data tagihan"
          />
        </div>
      </div>

      <ModalFrame
        open={Boolean(detailStudentId && detailRow)}
        title="Detail Tagihan"
        description="Rincian tagihan per siswa"
        maxWidthClass="max-w-5xl"
        showIcon={false}
        onClose={() => setDetailStudentId("")}
      >
        {detailRow ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="col-span-2 rounded-xl border border-slate-200 p-3 text-sm xl:col-span-1">
                <p className="text-xs text-slate-500">Siswa</p>
                <p className="font-semibold text-slate-900">{detailRow.student_name}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">Kelas</p>
                <p className="font-semibold text-slate-900">{detailRow.class_name}</p>
              </div>
              <div className="hidden rounded-xl border border-slate-200 p-3 text-sm xl:block">
                <p className="text-xs text-slate-500">Tahun Ajaran Tagihan</p>
                <p className="font-semibold text-slate-900">{detailRow.academic_year_label}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">Total Tagihan</p>
                <p className="font-semibold text-slate-900">{formatCurrency(detailRow.total_amount)}</p>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {canManageBills ? (
                <div className="rounded-xl border border-slate-200 p-3">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <input
                      type="checkbox"
                      aria-label="Pilih semua tagihan belum lunas"
                      ref={(input) => {
                        if (input) input.indeterminate = detailSomeUnpaidSelected;
                      }}
                      checked={detailAllUnpaidSelected}
                      onChange={(e) => setDetailSelectedBillIds(e.target.checked ? detailUnpaidBillIds : [])}
                    />
                    Pilih semua belum lunas
                  </label>
                </div>
              ) : null}
              <ol className="space-y-3">
                {detailRow.bills.map((bill, index) => (
                  <li key={bill.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-3">
                      <span className="pt-0.5 text-sm font-semibold text-slate-500">{index + 1}.</span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <p className="truncate text-sm font-semibold text-slate-900">{bill.bill_name}</p>
                          <p className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(bill.amount)}</p>
                        </div>
                        <p className="text-xs text-slate-600">
                          {bill.period || "-"}
                          <span className="mx-1 text-yellow-500">|</span>
                          {bill.academic_year_name || "-"}
                        </p>
                        <p className="text-xs text-slate-600">
                          Jatuh Tempo: {bill.due_date ? formatDate(bill.due_date) : "-"}
                        </p>
                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
                          <span className={bill.status === "paid" ? "badge-green" : "badge-amber"}>
                            {bill.status === "paid" ? "Lunas" : "Belum Lunas"}
                          </span>
                          {canManageBills ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                disabled={bill.status === "paid"}
                                checked={detailSelectedBillIds.includes(Number(bill.id))}
                                onChange={(e) =>
                                  setDetailSelectedBillIds((current) =>
                                    e.target.checked
                                      ? [...new Set([...current, Number(bill.id)])]
                                      : current.filter((id) => id !== Number(bill.id)),
                                  )
                                }
                              />
                              <button className="btn-danger px-3 py-2" onClick={() => removeBill(bill.id)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {canManageBills ? (
                      <th className="px-3 py-2 text-center font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          aria-label="Pilih semua tagihan belum lunas"
                          ref={(input) => {
                            if (input) input.indeterminate = detailSomeUnpaidSelected;
                          }}
                          checked={detailAllUnpaidSelected}
                          onChange={(e) => setDetailSelectedBillIds(e.target.checked ? detailUnpaidBillIds : [])}
                        />
                      </th>
                    ) : null}
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Tagihan</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Periode</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">TA</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Jatuh Tempo</th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">Nominal</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                    {canManageBills ? <th className="px-3 py-2 text-left font-semibold text-slate-700">Aksi</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {detailRow.bills.map((bill) => (
                    <tr key={bill.id}>
                      {canManageBills ? (
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            disabled={bill.status === "paid"}
                            checked={detailSelectedBillIds.includes(Number(bill.id))}
                            onChange={(e) =>
                              setDetailSelectedBillIds((current) =>
                                e.target.checked
                                  ? [...new Set([...current, Number(bill.id)])]
                                  : current.filter((id) => id !== Number(bill.id)),
                              )
                            }
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2 text-slate-800">{bill.bill_name}</td>
                      <td className="px-3 py-2 text-slate-600">{bill.period || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{bill.academic_year_name || "-"}</td>
                      <td className="px-3 py-2 text-slate-600">{bill.due_date ? formatDate(bill.due_date) : "-"}</td>
                      <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(bill.amount)}</td>
                      <td className="px-3 py-2">
                        <span className={bill.status === "paid" ? "badge-green" : "badge-amber"}>
                          {bill.status === "paid" ? "Lunas" : "Belum Lunas"}
                        </span>
                      </td>
                      {canManageBills ? (
                        <td className="px-3 py-2">
                          <button className="btn-danger px-3 py-2" onClick={() => removeBill(bill.id)}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              {canManageBills ? (
                <>
                  <button
                    type="button"
                    className="btn-danger px-3 py-2"
                    title="Hapus tagihan terpilih"
                    aria-label="Hapus tagihan terpilih"
                    onClick={removeSelectedBills}
                    disabled={removingSelectedBills || sendingSelectedBills || detailSelectedBillIds.length === 0}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-primary px-3 py-2"
                    title="Kirim pos terpilih"
                    aria-label="Kirim pos terpilih"
                    onClick={sendSelectedBillsReminder}
                    disabled={sendingSelectedBills || removingSelectedBills || detailSelectedBillIds.length === 0}
                  >
                    <Send size={16} />
                  </button>
                </>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => setDetailStudentId("")}>
                Tutup
              </button>
            </div>
          </div>
        ) : null}
      </ModalFrame>

      <FormModal
        open={exportOpen}
        title="Export Laporan Tunggakan"
        description="Pilih bulan jatuh tempo dan pos tagihan yang ingin diunduh."
        submitLabel="Unduh"
        submitting={exporting}
        onClose={() => {
          if (exporting) return;
          setExportOpen(false);
        }}
        onSubmit={submitExport}
      >
        <div className="grid gap-3">
          <div>
            <label className="label">Bulan</label>
            <input
              type="month"
              className="input"
              value={exportFilter.month}
              onChange={(e) => setExportFilter((current) => ({ ...current, month: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Pos tagihan</label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
              {(meta.finance_posts || []).length === 0 ? (
                <p className="text-sm text-slate-500">Belum ada data pos aktif.</p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={
                        meta.finance_posts.length > 0 &&
                        exportFilter.finance_post_ids.length === meta.finance_posts.length
                      }
                      onChange={(e) =>
                        setExportFilter((current) => ({
                          ...current,
                          finance_post_ids: e.target.checked ? meta.finance_posts.map((item) => Number(item.id)) : [],
                        }))
                      }
                    />
                    Pilih semua pos
                  </label>
                  {meta.finance_posts.map((item) => {
                    const postId = Number(item.id);
                    const checked = exportFilter.finance_post_ids.includes(postId);
                    return (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setExportFilter((current) => ({
                              ...current,
                              finance_post_ids: e.target.checked
                                ? [...new Set([...current.finance_post_ids, postId])]
                                : current.finance_post_ids.filter((id) => id !== postId),
                            }))
                          }
                        />
                        {item.name}
                      </label>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </FormModal>
    </Layout>
  );
}








