import { useEffect, useState } from "react";
import { BarChart3, ShieldCheck, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  monthlyExpenses: [],
  dueSoon: [],
  latestTransactions: [],
  latestExpenses: [],
  billingOverview: {},
};

const normalizeDashboardData = (payload) => ({
  summary: payload?.summary ?? {},
  integrations: payload?.integrations ?? {},
  monthly: Array.isArray(payload?.monthly) ? payload.monthly : [],
  monthlyExpenses: Array.isArray(payload?.monthlyExpenses)
    ? payload.monthlyExpenses
    : [],
  dueSoon: Array.isArray(payload?.dueSoon) ? payload.dueSoon : [],
  latestTransactions: Array.isArray(payload?.latestTransactions)
    ? payload.latestTransactions
    : [],
  latestExpenses: Array.isArray(payload?.latestExpenses)
    ? payload.latestExpenses
    : [],
  billingOverview: payload?.billingOverview ?? {},
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
  const dailyExpenseMap = new Map(
    data.monthlyExpenses.map((item) => [
      Number(item.day || 0),
      Number(item.total || 0),
    ]),
  );
  const dailySeries = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    return {
      day,
      income: dailyIncomeMap.get(day) || 0,
      expense: dailyExpenseMap.get(day) || 0,
    };
  });
  const formatYAxis = (value) => {
    const n = Number(value || 0);
    if (n >= 1000000000) return `Rp ${(n / 1000000000).toFixed(1)} M`;
    if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1)} Jt`;
    if (n >= 1000) return `Rp ${(n / 1000).toFixed(0)} Rb`;
    return `Rp ${n.toFixed(0)}`;
  };
  const billingOverview = data.billingOverview || {};
  const billingPeriodRaw = String(billingOverview.period || "");
  const billingPeriodDate = /^\d{4}-\d{2}$/.test(billingPeriodRaw)
    ? new Date(`${billingPeriodRaw}-01T00:00:00`)
    : new Date();
  const monthLabel = billingPeriodDate.toLocaleString("id-ID", {
    month: "long",
  });
  const yearLabel = billingPeriodDate.getFullYear();
  const paidStudents = Number(billingOverview.paid_students || 0);
  const unpaidStudents = Number(billingOverview.unpaid_students || 0);
  const paidAmount = Number(billingOverview.paid_amount || 0);
  const unpaidAmount = Number(billingOverview.unpaid_amount || 0);
  const donutData = [
    { key: "paid", name: "Sudah Lunas", value: paidStudents, amount: paidAmount, color: "#65a30d" },
    { key: "unpaid", name: "Belum Lunas", value: unpaidStudents, amount: unpaidAmount, color: "#dc2626" },
  ];
  const donutTotal = paidStudents + unpaidStudents;

  const StatusDot = ({ active }) => (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"} shadow-[0_0_0_2px_rgba(15,23,42,0.08)]`}
      aria-hidden
    />
  );

  const WhatsAppIcon = ({ size = 16, className = "" }) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path d="M19.11 4.93A9.93 9.93 0 0 0 3.86 17.02L2.57 21.5l4.62-1.21A9.93 9.93 0 1 0 19.11 4.93Zm-7.06 16.31a8.23 8.23 0 0 1-4.19-1.14l-.3-.18-2.74.72.73-2.67-.2-.31a8.24 8.24 0 1 1 6.7 3.58Zm4.52-6.17c-.25-.12-1.47-.72-1.7-.8-.23-.08-.4-.12-.57.12-.17.25-.65.8-.8.96-.15.17-.3.19-.56.06-.25-.12-1.07-.4-2.03-1.28-.75-.66-1.26-1.48-1.4-1.73-.15-.25-.02-.39.1-.51.11-.11.25-.3.37-.45.12-.15.16-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.57-1.36-.78-1.87-.21-.49-.42-.42-.58-.43h-.5c-.17 0-.43.06-.65.31-.23.25-.88.86-.88 2.1s.9 2.44 1.03 2.61c.12.17 1.76 2.7 4.27 3.79.6.26 1.07.42 1.43.54.6.19 1.14.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.15-.48-.27Z" />
    </svg>
  );

  const BanknoteIcon = ({ size = 15, className = "" }) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <rect x="1.5" y="4.5" width="21" height="15" rx="2.4" fill="#4e8b47" />
      <rect x="3" y="6" width="18" height="12" rx="1.8" fill="#78a95a" />
      <circle cx="12" cy="12" r="3.8" fill="#4e8b47" />
      <circle cx="12" cy="12" r="2.8" fill="#78a95a" />
      <path
        d="M7 9.5a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7Zm10 0a1.35 1.35 0 1 1 0 2.7 1.35 1.35 0 0 1 0-2.7Z"
        fill="#3f6f3e"
      />
      <path
        d="M12.65 9.35c-.19-.08-.45-.12-.78-.12-.53 0-.9.25-.9.62 0 .41.36.58.94.77.76.26 1.39.59 1.39 1.43 0 .7-.5 1.22-1.3 1.36v.72h-.69v-.69a3.2 3.2 0 0 1-1.28-.33l.19-.62c.31.17.73.33 1.19.33.59 0 .98-.29.98-.72 0-.4-.29-.65-.9-.86-.83-.28-1.42-.58-1.42-1.39 0-.67.48-1.18 1.23-1.31v-.7h.69v.67c.5.01.84.13 1.09.25l-.23.62Z"
        fill="#2f5a30"
      />
    </svg>
  );

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
      actions={
        <div className="flex flex-col items-end gap-1.5">
          <div
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/85 px-2 py-1.5"
            title="Payment Gateway"
            aria-label="Status Payment Gateway"
          >
            <BanknoteIcon size={15} className="shrink-0" />
            <StatusDot
              active={Boolean(data.integrations?.paymentGatewayEnabled)}
            />
          </div>
          <div
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white/85 px-2 py-1.5"
            title="WhatsApp Gateway"
            aria-label="Status WhatsApp Gateway"
          >
            <WhatsAppIcon size={15} className="text-emerald-600" />
            <StatusDot
              active={Boolean(data.integrations?.whatsappGatewayEnabled)}
            />
          </div>
        </div>
      }
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

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="card w-full p-5 xl:col-span-2 xl:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-100 p-2.5 text-sky-700">
              <BarChart3 size={18} />
            </div>
            <div>
              <h3 className="section-title">Cashflow {`Periode ${monthLabel.toUpperCase()} ${yearLabel}`}</h3>
              <p className="text-[0.82rem] text-slate-500">
                Pergerakan pemasukan dan pengeluaran harian bulan berjalan.
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
              <div className="mt-1 h-[290px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailySeries}
                    margin={{ top: 8, right: 8, left: 4, bottom: 2 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 10, fill: "#334155" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tickFormatter={formatYAxis}
                      tick={{ fontSize: 11, fill: "#334155" }}
                      axisLine={{ stroke: "#cbd5e1" }}
                      tickLine={{ stroke: "#cbd5e1" }}
                      width={58}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(value),
                        name === "income" ? "Pemasukan" : "Pengeluaran",
                      ]}
                      labelFormatter={(label) => `Tanggal ${label}`}
                    />
                    <Legend
                      formatter={(value) =>
                        value === "income" ? "Pemasukan" : "Pengeluaran"
                      }
                    />
                    <Bar
                      dataKey="income"
                      fill="#0ea5e9"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={14}
                    />
                    <Bar
                      dataKey="expense"
                      fill="#f43f5e"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={14}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        <div className="card p-5 xl:p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="section-title">Komparasi Pembayaran</h3>
              <p className="text-[0.82rem] text-slate-500">
                {`Periode ${monthLabel.toUpperCase()} ${yearLabel}`}
              </p>
            </div>
          </div>

          <div className="mt-2 h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={76}
                  paddingAngle={2}
                  stroke="#fff"
                  strokeWidth={2}
                  label={(entry) =>
                    entry?.value > 0 ? `${entry.value} Siswa` : ""
                  }
                  labelLine={false}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name, props) => [
                    `${value} Siswa (${formatCurrency(props?.payload?.amount || 0)})`,
                    name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            {donutData.map((item) => (
              <div key={item.key} className="rounded-lg border border-slate-200 p-2">
                <div className="mb-1 flex items-center gap-1.5 font-semibold text-slate-700">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </div>
                <div className="text-slate-600">Siswa: {item.value}</div>
                <div className="text-slate-700">{formatCurrency(item.amount)}</div>
              </div>
            ))}
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
