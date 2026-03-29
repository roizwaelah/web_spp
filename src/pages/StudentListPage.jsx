import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import ModalFrame from "../components/ModalFrame";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

export default function StudentListPage() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importErrorModalOpen, setImportErrorModalOpen] = useState(false);
  const [importErrorSummary, setImportErrorSummary] = useState(null);
  const [importValidationErrors, setImportValidationErrors] = useState([]);
  const navigate = useNavigate();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const load = async () => {
    try {
      const studentsRes = await fetchRoute("admin/students");
      const rows = Array.isArray(studentsRes.data) ? studentsRes.data : [];
      setStudents(rows);
      return rows;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal memuat data siswa",
      });
      return [];
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus data siswa",
      description: "Data siswa ini akan dihapus beserta relasi yang bergantung padanya.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/students", { method: "DELETE", data: { id } });
      setMessage({ type: "success", text: "Siswa berhasil dihapus" });
      load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menghapus siswa",
      });
    }
  };

  const importStudents = async () => {
    if (!file) {
      setMessage({ type: "warning", text: "Silakan pilih file Excel terlebih dahulu." });
      return;
    }
    const normalizeValidationErrors = (payload, withFallbackMessage = false) => {
      const raw = payload?.validation_errors;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (withFallbackMessage && payload?.message) {
        return [{
          row: "-",
          column: "import",
          value: "",
          message: payload.message,
        }];
      }
      return [];
    };

    setImportErrorModalOpen(false);
    setImportValidationErrors([]);
    setImportErrorSummary(null);
    setIsImporting(true);
    const beforeCount = students.length;
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await fetchRoute("admin/students/import", {
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imported = Number(response?.data?.summary?.imported || 0);
      const validationErrors = normalizeValidationErrors(response?.data || {}, false);
      const rowsAfter = await load();
      const delta = Math.max(0, rowsAfter.length - beforeCount);

      if (imported > 0 || delta > 0) {
        setMessage({
          type: "success",
          text:
            response?.data?.message ||
            `Impor berhasil. ${imported || delta} siswa ditambahkan.`,
        });
      } else {
        setMessage({
          type: "warning",
          text:
            response?.data?.message ||
            "Tidak ada data baru yang masuk ke database.",
        });
      }

      if (validationErrors.length > 0) {
        setImportErrorSummary(response?.data?.summary || null);
        setImportValidationErrors(validationErrors);
        setImportErrorModalOpen(true);
      }
    } catch (error) {
      const validationErrors = normalizeValidationErrors(error?.response?.data || {}, true);
      if (validationErrors.length > 0) {
        setImportErrorSummary(error?.response?.data?.summary || null);
        setImportValidationErrors(validationErrors);
        setImportErrorModalOpen(true);
      }
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal impor data siswa",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await downloadRouteFile("admin/students/template", {}, "template-import-siswa.xlsx");
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal mengunduh template import siswa",
      });
    }
  };

  const filtered = useMemo(
    () =>
      students.filter((item) =>
        `${item.name} ${item.nis} ${item.nisn || ""} ${item.parent_name} ${item.class_name}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [students, filter],
  );

  return (
    <Layout
      title="Data Siswa"
      subtitle="Daftar lengkap siswa, pencarian cepat, impor data, dan aksi edit/hapus."
      actions={
        <button
          className="btn-primary"
          onClick={() => navigate("/admin/siswa/edit")}
          onMouseEnter={() => prefetchRoute("/admin/siswa/edit")}
          onFocus={() => prefetchRoute("/admin/siswa/edit")}
        >
          <Plus size={18} /> Tambah Siswa
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-3 flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1 flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="label">Pencarian</label>
              <input
                className="input h-11 w-full"
                placeholder="Cari nama / NIS / NISN / orang tua / kelas"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="w-full md:w-64">
              <label className="label">Import Excel</label>
              <input
                type="file"
                className="input h-11 w-full"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <button type="button" className="btn-primary whitespace-nowrap" onClick={importStudents}>
              Import
            </button>
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={downloadTemplate}>
              Template
            </button>
          </div>
        </div>

        <Table
          columns={[
            { key: "nis", title: "NIS" },
            { key: "nisn", title: "NISN" },
            { key: "name", title: "Nama" },
            { key: "class_name", title: "Kelas" },
            { key: "academic_year", title: "Tahun Ajaran" },
            { key: "parent_name", title: "Wali" },
            { key: "parent_phone", title: "WA" },
            {
              key: "status",
              title: "Status",
              render: (row) => (
                <span className={row.status === "active" ? "badge-green" : "badge-amber"}>
                  {row.status}
                </span>
              ),
            },
            { key: "active_bills", title: "Tagihan Aktif" },
            {
              key: "actions",
              title: "Aksi",
              render: (row) => (
                <div className="flex gap-2">
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => navigate(`/admin/siswa/edit/${row.id}`)}
                    onMouseEnter={() => prefetchRoute("/admin/siswa/edit")}
                    onFocus={() => prefetchRoute("/admin/siswa/edit")}
                  >
                    <Pencil size={16} />
                  </button>
                  <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      </div>
      <ModalFrame
        open={isImporting}
        onClose={() => {}}
        title="Memvalidasi Data Import"
        description="Sistem sedang memeriksa format dan menyimpan data siswa. Mohon tunggu..."
        showIcon={false}
        variant="default"
        maxWidthClass="max-w-md"
      >
        <div className="flex items-center justify-center py-3">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />
        </div>
      </ModalFrame>
      <ModalFrame
        open={importErrorModalOpen}
        onClose={() => setImportErrorModalOpen(false)}
        title="Detail Error Import Siswa"
        description="Periksa baris/kolom berikut lalu perbaiki file template sebelum impor ulang."
        variant="danger"
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-3">
          {importErrorSummary ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Total: {importErrorSummary.total || 0} | Berhasil: {importErrorSummary.imported || 0} | Dilewati: {importErrorSummary.skipped || 0}
            </div>
          ) : null}
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Baris</th>
                  <th className="px-3 py-2">Kolom</th>
                  <th className="px-3 py-2">Nilai</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {importValidationErrors.map((item, index) => (
                  <tr key={`${item.row}-${item.column}-${index}`} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-slate-700">{item.row || "-"}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{item.column || "-"}</td>
                    <td className="px-3 py-2 text-slate-500">{item.value === "" ? "-" : item.value ?? "-"}</td>
                    <td className="px-3 py-2 text-rose-700">{item.message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setImportErrorModalOpen(false)}>
              Tutup
            </button>
          </div>
        </div>
      </ModalFrame>
    </Layout>
  );
}
