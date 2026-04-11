import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react";
import FormModal from "../components/FormModal";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute, openRouteFile } from "../api";
import { formatCurrency } from "../utils";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

const initialReviewModal = {
  open: false,
  proofId: null,
  status: "approved",
  notes: "",
};

export default function PaymentProofsPage() {
  const [rows, setRows] = useState([]);
  const [studentSourceRows, setStudentSourceRows] = useState([]);
  const [meta, setMeta] = useState({ students: [], classes: [] });
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState({
    status: "",
    class_id: "",
    student_id: "",
  });
  const [reviewModal, setReviewModal] = useState(initialReviewModal);
  const [submittingReview, setSubmittingReview] = useState(false);
  const { user } = useAuth();
  const { confirm } = useUI();
  const isAdmin = user?.role === "admin";

  useToastMessage(message, setMessage);

  const load = () =>
    Promise.all([
      fetchRoute("admin/meta"),
      fetchRoute("admin/payment-proofs", {
        params: {
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
        },
      }),
      fetchRoute("admin/payment-proofs", {
        params: {
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
          ...(filter.student_id ? { student_id: filter.student_id } : {}),
        },
      }),
    ])
      .then(([metaRes, studentRowsRes, rowsRes]) => {
        setMeta({
          classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
          students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
        });
        setStudentSourceRows(Array.isArray(studentRowsRes.data) ? studentRowsRes.data : []);
        setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat bukti pembayaran");
      });

  useEffect(() => {
    load();
  }, [filter.status, filter.class_id, filter.student_id]);

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

  const statusLabel = (status) =>
    status === "approved" ? "Disetujui" : status === "rejected" ? "Ditolak" : "Menunggu";

  const openReviewModal = (proofId, status) => {
    setReviewModal({
      open: true,
      proofId,
      status,
      notes: "",
    });
  };

  const closeReviewModal = () => {
    if (submittingReview) return;
    setReviewModal(initialReviewModal);
  };

  const submitReview = async (event) => {
    event.preventDefault();
    try {
      setSubmittingReview(true);
      await fetchRoute("admin/payment-proofs/review", {
        method: "POST",
        data: {
          proof_id: reviewModal.proofId,
          status: reviewModal.status,
          notes: reviewModal.notes,
        },
      });
      setMessage(`Bukti pembayaran ${reviewModal.status === "approved" ? "disetujui" : "ditolak"}`);
      setReviewModal(initialReviewModal);
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memproses review");
    } finally {
      setSubmittingReview(false);
    }
  };

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus bukti pembayaran",
      description: "File bukti pembayaran yang dihapus tidak bisa dipulihkan dari aplikasi.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchRoute("admin/payment-proofs", {
        method: "DELETE",
        data: { id },
      });
      setMessage("Bukti pembayaran berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus bukti pembayaran");
    }
  };

  const previewProof = async (id) => {
    try {
      await openRouteFile("admin/payment-proofs/file", { id });
    } catch (error) {
      const fallbackMessage =
        error?.response?.status === 401
          ? "Preview gagal karena sesi login tidak valid. Silakan login ulang."
          : "Gagal membuka file bukti pembayaran";
      setMessage(error?.response?.data?.message || fallbackMessage);
    }
  };

  return (
    <Layout
      title="Verifikasi Bukti Pembayaran"
      subtitle="Review upload bukti transfer manual dari orang tua dan setujui / tolak secara cepat."
    >
      <div className="space-y-4">
        <div className="card p-3">
          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="input"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">Semua status review</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
            <select
              className="input"
              value={filter.class_id}
              onChange={(e) => setFilter({ ...filter, class_id: e.target.value, student_id: "" })}
            >
              <option value="">Semua kelas</option>
              {meta.classes.map((item) => (
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
        <div className="space-y-3 md:hidden">
          {rows.length > 0 ? (
            <ol className="space-y-3">
              {rows.map((row, index) => (
                <li key={row.id} className="card p-3">
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5 text-sm font-semibold text-slate-500">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.student_name || "-"}</p>
                        <p className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(row.amount)}</p>
                      </div>
                      <p className="text-xs text-slate-600">
                        {row.class_name || "-"}
                        <span className="mx-1 text-yellow-500">|</span>
                        {row.bill_name || "-"}
                      </p>
                      <p className="text-xs text-slate-600">Periode: {row.period || "-"}</p>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={
                            row.status === "approved"
                              ? "badge-green"
                              : row.status === "rejected"
                                ? "badge-red"
                                : "badge-amber"
                          }
                        >
                          {statusLabel(row.status)}
                        </span>
                        <span className={row.bill_status === "paid" ? "badge-green" : "badge-amber"}>
                          {row.bill_status === "paid" ? "Lunas" : "Belum Lunas"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button className="btn-secondary px-3 py-2" onClick={() => previewProof(row.id)}>
                          <Eye size={16} /> Lihat
                        </button>
                        {row.status === "pending" ? (
                          <>
                            <button className="btn-primary px-3 py-2" onClick={() => openReviewModal(row.id, "approved")}>
                              <CheckCircle2 size={16} /> Setujui
                            </button>
                            <button className="btn-danger px-3 py-2" onClick={() => openReviewModal(row.id, "rejected")}>
                              <XCircle size={16} /> Tolak
                            </button>
                            {isAdmin ? (
                              <button className="btn-secondary px-3 py-2" onClick={() => remove(row.id)}>
                                <Trash2 size={16} /> Hapus
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {isAdmin && row.status === "rejected" ? (
                          <button className="btn-secondary px-3 py-2" onClick={() => remove(row.id)}>
                            <Trash2 size={16} /> Hapus
                          </button>
                        ) : null}
                        {row.status !== "pending" && !(isAdmin && row.status === "rejected") ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs text-slate-500">Sudah direview</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="card p-4 text-sm text-slate-500">Belum ada bukti pembayaran</div>
          )}
        </div>

        <div className="hidden md:block">
          <Table
            columns={[
              { key: "student_name", title: "Siswa" },
              { key: "class_name", title: "Kelas" },
              { key: "bill_name", title: "Tagihan" },
              { key: "period", title: "Periode" },
              {
                key: "amount",
                title: "Nominal",
                render: (row) => formatCurrency(row.amount),
              },
              {
                key: "proof_file_name",
                title: "File Bukti",
                render: (row) => (
                  <button className="btn-secondary px-3 py-2" onClick={() => previewProof(row.id)}>
                    <Eye size={16} /> Lihat
                  </button>
                ),
              },
              {
                key: "status",
                title: "Status",
                render: (row) => (
                  <span
                    className={
                      row.status === "approved"
                        ? "badge-green"
                        : row.status === "rejected"
                          ? "badge-red"
                          : "badge-amber"
                    }
                  >
                    {statusLabel(row.status)}
                  </span>
                ),
              },
              {
                key: "bill_status",
                title: "Status Tagihan",
                render: (row) => (
                  <span className={row.bill_status === "paid" ? "badge-green" : "badge-amber"}>
                    {row.bill_status === "paid" ? "Lunas" : "Belum Lunas"}
                  </span>
                ),
              },
              {
                key: "actions",
                title: "Aksi",
                render: (row) => {
                  if (row.status === "pending") {
                    return (
                      <div className="flex gap-2">
                        <button className="btn-primary px-3 py-2" onClick={() => openReviewModal(row.id, "approved")}>
                          <CheckCircle2 size={16} /> Setujui
                        </button>
                        <button className="btn-danger px-3 py-2" onClick={() => openReviewModal(row.id, "rejected")}>
                          <XCircle size={16} /> Tolak
                        </button>
                        {isAdmin && (
                          <button className="btn-secondary px-3 py-2" onClick={() => remove(row.id)}>
                            <Trash2 size={16} /> Hapus
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (isAdmin && row.status === "rejected") {
                    return (
                      <button className="btn-secondary px-3 py-2" onClick={() => remove(row.id)}>
                        <Trash2 size={16} /> Hapus
                      </button>
                    );
                  }

                  return <span className="text-sm text-slate-500">Sudah direview</span>;
                },
              },
            ]}
            rows={rows}
          />
        </div>
      </div>

      <FormModal
        open={reviewModal.open}
        title={reviewModal.status === "approved" ? "Setujui bukti pembayaran" : "Tolak bukti pembayaran"}
        description={
          reviewModal.status === "approved"
            ? "Tambahkan catatan jika perlu. Kosongkan jika tidak ada."
            : "Isi alasan penolakan agar orang tua tahu apa yang perlu diperbaiki."
        }
        variant={reviewModal.status === "approved" ? "default" : "danger"}
        submitLabel={reviewModal.status === "approved" ? "Setujui" : "Tolak"}
        submitClassName={reviewModal.status === "approved" ? "btn-primary" : "btn-danger"}
        submitting={submittingReview}
        onClose={closeReviewModal}
        onSubmit={submitReview}
      >
        <textarea
          className="textarea"
          value={reviewModal.notes}
          onChange={(e) => setReviewModal((current) => ({ ...current, notes: e.target.value }))}
          placeholder={reviewModal.status === "approved" ? "Catatan approval (opsional)" : "Alasan penolakan"}
          required={reviewModal.status === "rejected"}
        />
      </FormModal>
    </Layout>
  );
}
