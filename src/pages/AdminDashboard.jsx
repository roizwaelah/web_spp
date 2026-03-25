import { useEffect, useState } from "react";
import {
  BarChart3,
  Clock3,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";

const INITIAL_DASHBOARD_DATA = {
  summary: {},
  monthly: [],
  channelBreakdown: [],
  dueSoon: [],
  latestTransactions: [],
};

const normalizeDashboardData = (payload) => ({
  summary: payload?.summary ?? {},
  monthly: Array.isArray(payload?.monthly) ? payload.monthly : [],
  channelBreakdown: Array.isArray(payload?.channelBreakdown)
    ? payload.channelBreakdown
    : [],
  dueSoon: Array.isArray(payload?.dueSoon) ? payload.dueSoon : [],
  latestTransactions: Array.isArray(payload?.latestTransactions)
    ? payload.latestTransactions
    : [],
});

export default function AdminDashboard() {
  const [data, setData] = useState(INITIAL_DASHBOARD_DATA);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadDashboard = () => {
    setLoading(true);
    fetchRoute("admin/dashboard")
      .then(({ data }) => {
        setData(normalizeDashboardData(data));
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat dashboard");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const maxMonthlyTotal = Math.max(
    ...data.monthly.map((item) => Number(item.total || 0)),
    0,
  );

  return (
    <Layout
      title="Dashboard"
      subtitle="Pantau ringkasan operasional, performa pembayaran, tagihan aktif, dan bukti bayar pending."
    >
      {message && (
        <div className="mb-6 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
          {message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Siswa"
          value={data.summary?.students || 0}
          helper="Terdaftar pada sistem"
        />
        <StatCard
          title="Tagihan Aktif"
          value={data.summary?.activeBills || 0}
          helper="Belum lunas"
        />
        <StatCard
          title="Bukti Pending"
          value={data.summary?.pendingProofs || 0}
          helper="Menunggu verifikasi admin"
        />
        <StatCard
          title="Pemasukan Bulan Ini"
          value={formatCurrency(data.summary?.monthIncome || 0)}
          helper={`Backup terakhir: ${data.summary?.lastBackup || "-"}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <BarChart3 size={20} />
            </div>
            <div>
              <h3 className="section-title">Pendapatan per bulan</h3>
              <p className="text-sm text-slate-500">
                Ringkasan transaksi sukses per bulan berjalan.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {loading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Memuat grafik...
              </div>
            ) : data.monthly.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Belum ada data grafik.
              </div>
            ) : (
              data.monthly.map((item) => (
                <div
                  key={item.month}
                  className="grid grid-cols-[80px_1fr_120px] items-center gap-3"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {item.month}
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-500"
                      style={{
                        width: `${maxMonthlyTotal > 0 ? Math.max(8, Math.round((Number(item.total || 0) / maxMonthlyTotal) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <div className="text-right text-sm font-semibold text-slate-800">
                    {formatCurrency(item.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
              <Wallet size={20} />
            </div>
            <div>
              <h3 className="section-title">Breakdown kanal pembayaran</h3>
              <p className="text-sm text-slate-500">
                Akumulasi pemasukan berdasarkan kanal.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Memuat data kanal...
              </div>
            ) : data.channelBreakdown.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Belum ada data kanal.
              </div>
            ) : (
              data.channelBreakdown.map((item) => (
                <div
                  key={item.payment_channel}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {item.payment_channel}
                  </div>
                  <div className="badge-green">
                    {formatCurrency(item.total)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                <Clock3 size={20} />
              </div>
              <div>
                <h3 className="section-title">Jatuh tempo terdekat</h3>
                <p className="text-sm text-slate-500">
                  Tagihan yang perlu segera ditindaklanjuti.
                </p>
              </div>
            </div>
            <Table
              emptyText={loading ? "Memuat data jatuh tempo..." : "Belum ada tagihan jatuh tempo"}
              columns={[
                { key: "student_name", title: "Siswa" },
                { key: "bill_name", title: "Tagihan" },
                {
                  key: "due_date",
                  title: "Jatuh tempo",
                  render: (row) => formatDate(row.due_date),
                },
                {
                  key: "amount",
                  title: "Nominal",
                  render: (row) => formatCurrency(row.amount),
                },
              ]}
              rows={data.dueSoon}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="section-title">Transaksi terbaru</h3>
                <p className="text-sm text-slate-500">
                  Pencatatan otomatis transaksi yang masuk.
                </p>
              </div>
            </div>
            <Table
              emptyText={loading ? "Memuat transaksi..." : "Belum ada transaksi"}
              columns={[
                { key: "student_name", title: "Siswa" },
                { key: "bill_name", title: "Tagihan" },
                { key: "payment_channel", title: "Kanal" },
                {
                  key: "amount",
                  title: "Nominal",
                  render: (row) => formatCurrency(row.amount),
                },
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
                            : "badge-red"
                      }
                    >
                      {row.status === "paid"
                        ? "Lunas"
                        : row.status === "pending"
                          ? "Menunggu"
                          : "Gagal"}
                    </span>
                  ),
                },
              ]}
              rows={data.latestTransactions}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
