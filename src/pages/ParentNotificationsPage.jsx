import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatDate } from "../utils";

const channelLabel = (channel) => {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "system") return "Sistem";
  return channel || "-";
};

export default function ParentNotificationsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await fetchRoute("parent/notifications");
        setRows(Array.isArray(data) ? data : []);
        setMessage("");
      } catch (error) {
        setMessage(error?.response?.data?.message || "Gagal memuat notifikasi");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <Layout title="Notifikasi Orang Tua" subtitle="Riwayat pengingat jatuh tempo dan notifikasi transaksi via WhatsApp / sistem.">
      {message && (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}
      <Table
        emptyText={loading ? "Memuat notifikasi..." : "Belum ada notifikasi"}
        columns={[
          { key: "title", title: "Judul" },
          { key: "message", title: "Pesan" },
          { key: "channel", title: "Kanal", render: (row) => channelLabel(row.channel) },
          {
            key: "status",
            title: "Status",
            render: (row) => (
              <span className={row.status === "sent" ? "badge-green" : row.status === "failed" ? "badge-red" : "badge-amber"}>
                {row.status === "sent" ? "Terkirim" : row.status === "failed" ? "Gagal" : "Menunggu"}
              </span>
            ),
          },
          { key: "created_at", title: "Dibuat", render: (row) => formatDate(row.created_at) },
        ]}
        rows={rows}
      />
    </Layout>
  );
}
