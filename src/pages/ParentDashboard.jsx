import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ParentDashboard() {
  const [data, setData] = useState({ summary: {}, student: {}, settings: {} });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useToastMessage({ type: "error", text: message }, setMessage);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await fetchRoute("parent/dashboard");
        setData({
          summary: data?.summary || {},
          student: data?.student || {},
          settings: data?.settings || {},
        });
        setMessage("");
      } catch (error) {
        setMessage(error?.response?.data?.message || "Gagal memuat ringkasan portal orang tua");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <Layout
      title="Portal Orang Tua"
      subtitle="Pantau tagihan anak, pembayaran, dan notifikasi madrasah secara mandiri."
      showHeader={true}
    >
      {data.settings?.payment_gateway_enabled !== "1" && (
        <div className="card border border-amber-200 bg-amber-50/80 p-4">
          <h3 className="section-title text-amber-900">Pembayaran Online sedang dalam pemeliharaan</h3>
          <p className="mt-2 text-sm text-amber-800">
            Pembayaran otomatis sementara dinonaktifkan oleh admin. Silakan gunakan transfer manual dan unggah bukti pembayaran pada menu Tagihan.
          </p>
        </div>
      )}
      <div className="card p-4">
        <h3 className="text-xl font-bold text-slate-900">
          {loading ? "Memuat data siswa..." : data.student?.name || "-"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {data.student?.class_name || "-"} | Wali: {data.student?.parent_name || "-"}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Madrasah: <span className="font-semibold">{data.settings?.school_name || "-"}</span>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Tagihan Aktif"
          value={loading ? "..." : data.summary?.activeBills || 0}
          helper="Belum lunas"
          className="border-amber-300 shadow-amber-100/80"
          accentClass="bg-amber-500"
          titleClass="text-amber-700"
          valueClass="text-amber-900"
          helperClass="text-amber-600"
        />
        <StatCard
          title="Total Tunggakan"
          value={loading ? "..." : formatCurrency(data.summary?.outstanding || 0)}
          helper="Harap dibayarkan sebelum jatuh tempo"
          className="border-rose-300 shadow-rose-100/80"
          accentClass="bg-rose-500"
          titleClass="text-rose-700"
          valueClass="text-rose-900"
          helperClass="text-rose-500"
        />
        <StatCard
          title="Pembayaran Tahun Ini"
          value={loading ? "..." : formatCurrency(data.summary?.paidThisYear || 0)}
          helper="Transaksi sukses"
          className="border-emerald-300 shadow-emerald-100/80"
          accentClass="bg-emerald-500"
          titleClass="text-emerald-700"
          valueClass="text-emerald-900"
          helperClass="text-emerald-600"
        />
        <StatCard
          title="Bukti Pending"
          value={loading ? "..." : data.summary?.pendingProofs || 0}
          helper="Sedang direview admin"
          className="border-sky-300 shadow-sky-100/80"
          accentClass="bg-sky-500"
          titleClass="text-sky-700"
          valueClass="text-sky-900"
          helperClass="text-sky-500"
        />
      </div>
    </Layout>
  );
}
