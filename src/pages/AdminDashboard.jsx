import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck, Wallet } from "lucide-react";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const INITIAL_DASHBOARD_DATA = {
  summary: {},
  integrations: {},
  monthly: [],
  dueSoon: [],
  latestTransactions: [],
  latestExpenses: [],
};

const normalizeDashboardData = (payload) => ({
  summary: payload?.summary ?? {},
  integrations: payload?.integrations ?? {},
  monthly: Array.isArray(payload?.monthly) ? payload.monthly : [],
  dueSoon: Array.isArray(payload?.dueSoon) ? payload.dueSoon : [],
  latestTransactions: Array.isArray(payload?.latestTransactions)
    ? payload.latestTransactions
    : [],
  latestExpenses: Array.isArray(payload?.latestExpenses)
    ? payload.latestExpenses
    : [],
});

export default function AdminDashboard() {
  const [data, setData] = useState(INITIAL_DASHBOARD_DATA);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useToastMessage(message, setMessage);

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

  const now = new Date();
  const daysInMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
  ).getDate();
  const dailyIncomeMap = new Map(
    data.monthly.map((item) => [
      Number(item.day || 0),
      Number(item.total || 0),
    ]),
  );
  const dailySeries = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return { day, total: dailyIncomeMap.get(day) || 0 };
  });
  const maxDailyTotal = Math.max(...dailySeries.map((item) => item.total), 0);
  const chartMax = maxDailyTotal > 0 ? maxDailyTotal : 1;
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  const chartHeight = 220;
  const chartPadding = { top: 16, right: 14, bottom: 34, left: 56 };
  const chartInnerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const chartWidth = Math.max(
    640,
    daysInMonth * 16 + chartPadding.left + chartPadding.right,
  );
  const chartInnerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const barWidth = Math.max(6, Math.min(10, chartInnerWidth / daysInMonth - 4));
  const gap =
    (chartInnerWidth - barWidth * daysInMonth) / Math.max(1, daysInMonth - 1);
  const formatYAxis = (value) => {
    const n = Number(value || 0);
    if (n >= 1000000000) return `Rp ${(n / 1000000000).toFixed(1)} M`;
    if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1)} Jt`;
    if (n >= 1000) return `Rp ${(n / 1000).toFixed(0)} Rb`;
    return `Rp ${n.toFixed(0)}`;
  };

  return (
    <Layout
      title={
        <div className="flex flex-wrap items-center gap-2">
          <span>Dashboard</span>
          <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-amber-500 bg-clip-text text-2xl font-bold tracking-wide text-transparent">
            MADSC Payment
          </span>
        </div>
      }
      subtitle="Pantau ringkasan operasional, performa pembayaran, tagihan aktif, dan bukti bayar pending."
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Siswa"
          value={data.summary?.students || 0}
          helper="Terdaftar pada sistem"
          className="border-sky-300 shadow-sky-100/80"
          accentClass="bg-sky-500"
          titleClass="text-sky-700"
          valueClass="text-sky-900"
          helperClass="text-sky-500"
        />
        <StatCard
          title="Tagihan Aktif"
          value={data.summary?.activeBills || 0}
          helper="Belum lunas"
          className="border-amber-300 shadow-amber-100/80"
          accentClass="bg-amber-500"
          titleClass="text-amber-700"
          valueClass="text-amber-900"
          helperClass="text-amber-600"
        />
        <StatCard
          title="Bukti Pending"
          value={data.summary?.pendingProofs || 0}
          helper="Menunggu verifikasi admin"
          className="border-rose-300 shadow-rose-100/80"
          accentClass="bg-rose-500"
          titleClass="text-rose-700"
          valueClass="text-rose-900"
          helperClass="text-rose-500"
        />
        <StatCard
          title="Pemasukan Bulan Ini"
          value={formatCurrency(data.summary?.monthIncome || 0)}
          helper={`Backup terakhir: ${data.summary?.lastBackup || "-"}`}
          className="border-emerald-300 shadow-emerald-100/80"
          accentClass="bg-emerald-500"
          titleClass="text-emerald-700"
          valueClass="text-emerald-900"
          helperClass="text-emerald-600"
        />
        <StatCard
          title="Pengeluaran Bulan Ini"
          value={formatCurrency(data.summary?.monthExpense || 0)}
          helper={`Saldo bulan ini: ${formatCurrency(data.summary?.monthBalance || 0)}`}
          className="border-rose-300 shadow-rose-100/80"
          accentClass="bg-rose-500"
          titleClass="text-rose-700"
          valueClass="text-rose-900"
          helperClass="text-rose-500"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[auto_1fr] xl:items-start">
        {/* KOLOM KIRI (Grafik): Lebarnya pas sesuai SVG (w-fit) */}
        <div className="card w-fit max-w-full p-5 xl:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="section-title">Pendapatan bulan ini</h3>
              <p className="text-[0.82rem] text-slate-500">
                Ringkasan transaksi sukses.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2.5">
            {loading ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Memuat...
              </div>
            ) : dailySeries.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Belum ada data.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <svg
                  width={chartWidth}
                  height={chartHeight}
                  role="img"
                  aria-label="Grafik pendapatan harian bulan ini"
                >
                  {yTicks.map((tick) => {
                    const y = chartPadding.top + chartInnerHeight * (1 - tick);
                    const val = chartMax * tick;
                    return (
                      <g key={tick}>
                        <line
                          x1={chartPadding.left}
                          y1={y}
                          x2={chartWidth - chartPadding.right}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="3 3"
                        />
                        <text
                          x={chartPadding.left - 8}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="11"
                          fill="#00000"
                        >
                          {formatYAxis(val)}
                        </text>
                      </g>
                    );
                  })}

                  {dailySeries.map((item, index) => {
                    const x = chartPadding.left + index * (barWidth + gap);
                    const barHeight =
                      chartInnerHeight * (item.total / chartMax);
                    const y = chartPadding.top + chartInnerHeight - barHeight;
                    return (
                      <g key={item.day}>
                        <rect
                          x={x}
                          y={y}
                          width={barWidth}
                          height={Math.max(1, barHeight)}
                          rx="2"
                          fill="#0ea5e9"
                        />
                        <text
                          x={x + barWidth / 2}
                          y={chartHeight - 14}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#000000"
                        >
                          {item.day}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={chartPadding.left}
                    y1={chartPadding.top + chartInnerHeight}
                    x2={chartWidth - chartPadding.right}
                    y2={chartPadding.top + chartInnerHeight}
                    stroke="#cbd5e1"
                  />
                  <line
                    x1={chartPadding.left}
                    y1={chartPadding.top}
                    x2={chartPadding.left}
                    y2={chartPadding.top + chartInnerHeight}
                    stroke="#cbd5e1"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        <div className="w-full">
          <div className="card w-full p-3">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
              {/* Item Payment Gateway */}
              <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">
                    Payment Gateway
                  </p>
                </div>
                <span
                  className={
                    data.integrations?.paymentGatewayEnabled
                      ? "badge-green"
                      : "badge-red"
                  }
                >
                  {data.integrations?.paymentGatewayEnabled
                    ? "Aktif"
                    : "Nonaktif"}
                </span>
              </div>
              {/* Item WhatsApp Gateway */}
              <div className="flex items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">
                    WhatsApp Gateway
                  </p>
                </div>
                <span
                  className={
                    data.integrations?.whatsappGatewayEnabled
                      ? "badge-green"
                      : "badge-red"
                  }
                >
                  {data.integrations?.whatsappGatewayEnabled
                    ? "Aktif"
                    : "Nonaktif"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-5 xl:p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="section-title">Transaksi terbaru</h3>
                <p className="text-[0.82rem] text-slate-500">
                  Pencatatan otomatis transaksi yang masuk.
                </p>
              </div>
            </div>
            <Table
              emptyText={
                loading ? "Memuat transaksi..." : "Belum ada transaksi"
              }
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

        <div className="space-y-4">
          <div className="card p-5 xl:p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700">
                <Wallet size={18} />
              </div>
              <div>
                <h3 className="section-title">Pengeluaran terbaru</h3>
                <p className="text-[0.82rem] text-slate-500">
                  Pencatatan biaya operasional terakhir.
                </p>
              </div>
            </div>
            <Table
              emptyText={
                loading ? "Memuat pengeluaran..." : "Belum ada pengeluaran"
              }
              columns={[
                { key: "expense_date", title: "Tanggal" },
                { key: "title", title: "Pengeluaran" },
                {
                  key: "category",
                  title: "Kategori",
                  render: (row) => row.category || "-",
                },
                {
                  key: "amount",
                  title: "Nominal",
                  render: (row) => formatCurrency(row.amount),
                },
              ]}
              rows={data.latestExpenses}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
