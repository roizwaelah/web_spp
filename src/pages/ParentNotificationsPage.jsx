import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import ModalFrame from "../components/ModalFrame";
import { fetchRoute } from "../api";
import { formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const channelLabel = (channel) => {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "system") return "Sistem";
  return channel || "-";
};

export default function ParentNotificationsPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [detailId, setDetailId] = useState("");

  useToastMessage({ type: "error", text: message }, setMessage);

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

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
      ),
    [rows],
  );

  const detailRow = useMemo(
    () => sortedRows.find((row) => String(row.id) === String(detailId)) || null,
    [sortedRows, detailId],
  );

  return (
    <Layout title="Notifikasi Orang Tua" subtitle="Riwayat pengingat jatuh tempo dan notifikasi transaksi via WhatsApp / sistem.">
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card p-4 text-sm text-slate-600">Memuat notifikasi...</div>
        ) : sortedRows.length === 0 ? (
          <div className="card p-4 text-sm text-slate-600">Belum ada notifikasi</div>
        ) : (
          <ul className="space-y-2">
            {sortedRows.map((row) => (
              <li key={row.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 w-4 shrink-0 text-sm font-semibold text-slate-900">&bull;</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.title || "-"}</p>
                      <p className="mt-1 text-sm text-slate-700">
                        {channelLabel(row.channel)} | {formatDate(row.created_at)}
                      </p>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary px-3 py-1" onClick={() => setDetailId(String(row.id))}>
                    Lihat
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden md:block">
        <Table
          emptyText={loading ? "Memuat notifikasi..." : "Belum ada notifikasi"}
          columns={[
            {
              key: "title",
              title: "Judul",
              headerClassName: "w-[180px]",
              cellClassName: "w-[180px] align-top",
            },
            {
              key: "message",
              title: "Pesan",
              headerClassName: "w-[460px]",
              cellClassName: "w-[460px] align-top",
            },
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
            {
              key: "created_at",
              title: "Dibuat",
              headerClassName: "w-28 whitespace-nowrap",
              cellClassName: "w-28 whitespace-nowrap",
              render: (row) => formatDate(row.created_at),
            },
          ]}
          rows={sortedRows}
        />
      </div>

      <ModalFrame
        open={Boolean(detailRow)}
        title="Pesan Notifikasi"
        showIcon={false}
        onClose={() => setDetailId("")}
      >
        {detailRow ? (
          <div className="space-y-4">
            <p className="whitespace-pre-line text-sm text-slate-700">{detailRow.message || "-"}</p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetailId("")}>
                Kembali
              </button>
            </div>
          </div>
        ) : null}
      </ModalFrame>
    </Layout>
  );
}
