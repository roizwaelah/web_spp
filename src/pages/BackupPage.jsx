import { useEffect, useState } from "react";
import { Download, HardDriveDownload, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";

export default function BackupPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");

  const load = () =>
    fetchRoute("admin/backups")
      .then(({ data }) => {
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat data backup");
      });
  useEffect(() => {
    load();
  }, []);

  const createBackup = async () => {
    try {
      await fetchRoute("admin/backups", { method: "POST" });
      setMessage("Backup database berhasil dibuat");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal membuat backup database");
    }
  };

  const downloadBackup = async (id) => {
    try {
      await downloadRouteFile("admin/backups/download", { id }, "backup.sql");
      setMessage("");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengunduh file backup");
    }
  };

  const removeBackup = async (id) => {
    if (!confirm("Hapus file backup ini?")) return;
    try {
      await fetchRoute("admin/backups", {
        method: "DELETE",
        data: { id },
      });
      setMessage("Backup berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus backup");
    }
  };

  return (
    <Layout
      title="Backup Database"
      subtitle="Buat backup manual dan unduh file cadangan database untuk keamanan data."
      actions={
        <button className="btn-primary" onClick={createBackup}>
          <HardDriveDownload size={18} /> Buat backup
        </button>
      }
    >
      {message && (
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
          {message}
        </div>
      )}
      <Table
        columns={[
          { key: "filename", title: "Nama file" },
          { key: "size_kb", title: "Ukuran (KB)" },
          { key: "created_at", title: "Dibuat pada" },
          {
            key: "actions",
            title: "Aksi",
            render: (row) => (
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  onClick={() => downloadBackup(row.id)}
                >
                  <Download size={16} /> Download
                </button>
                <button
                  className="btn-danger"
                  onClick={() => removeBackup(row.id)}
                >
                  <Trash2 size={16} /> Hapus
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
      />
    </Layout>
  );
}
