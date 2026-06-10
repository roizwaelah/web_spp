import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Trash2, XCircle } from "lucide-react";
import FormModal from "../components/FormModal";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute, openRouteFile } from "../api";
import { formatCurrency, formatPeriod } from "../utils";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

const initialReviewModal = {
  open: false,
  id: null,
  proofId: null,
  proofScope: "legacy",
  proofLabel: "",
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

  const rowIsGrouped = (row) =>
    row?.is_group === true || row?.is_group === 1 || row?.is_group === "1" || row?.is_group === "true";

  const getProofScope = (row) => {
    const scope = String(row?.proof_scope || "").trim().toLowerCase();
    return scope || (rowIsGrouped(row) ? "group" : "legacy");
  };

  const isGroupedProof = (row) => getProofScope(row) === "group";

  const getProofIdentifier = (row) => row?.proof_id ?? row?.id;

  const getProofPayload = (row) => {
    const payload = { proof_scope: getProofScope(row) };
    const proofId = getProofIdentifier(row);

    if (proofId !== undefined && proofId !== null && proofId !== "") payload.proof_id = proofId;
    if (row?.id !== undefined && row.id !== null && row.id !== "") payload.id = row.id;

    return payload;
  };

  const getProofAmount = (row) => Number(row?.total_amount ?? row?.amount ?? 0);

  const getReferenceLabel = (row) => row?.reference_no || (isGroupedProof(row) ? `Grup #${getProofIdentifier(row) || "-"}` : "-");

  const getBillCountLabel = (row) => {
    if (!isGroupedProof(row)) return row?.bill_name || "-";
    const billCount = Number(row?.bill_count || 0);
    return billCount > 0 ? `${billCount} tagihan` : "Tagihan gabungan";
  };

  const getBillSummaryLabel = (row) => {
    const summary = row?.bill_summary || row?.bill_name || "-";
    return isGroupedProof(row) ? `${getBillCountLabel(row)} - ${summary}` : summary;
  };

  const getPeriodLabel = (row) => {
    if (isGroupedProof(row) && Number(row?.bill_count || 0) > 1) {
      return row?.period ? String(row.period).split(", ").map(formatPeriod).join(", ") : "Gabungan";
    }
    return formatPeriod(row?.period);
  };

  const getRowKey = (row, index) => `${getProofScope(row)}-${getProofIdentifier(row) ?? row?.id ?? index}`;

  const renderBillCell = (row) => (
    <div className="space-y-1">
      <p className="font-medium text-slate-900">{getBillCountLabel(row)}</p>
      {isGroupedProof(row) && row?.bill_summary ? (
        <p className="max-w-xs text-xs text-slate-500">{row.bill_summary}</p>
      ) : null}
    </div>
  );

  const renderReferenceCell = (row) => (
    <span className={row?.reference_no ? "font-mono text-xs text-slate-700" : "text-sm text-slate-500"}>
      {getReferenceLabel(row)}
    </span>
  );

  const openReviewModal = (row, status) => {
    setReviewModal({
      open: true,
      id: row?.id ?? null,
      proofId: getProofIdentifier(row) ?? null,
      proofScope: getProofScope(row),
      proofLabel: getReferenceLabel(row),
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
      const payload = {
        proof_scope: reviewModal.proofScope || "legacy",
        status: reviewModal.status,
        notes: reviewModal.notes,
      };

      if (reviewModal.proofId !== undefined && reviewModal.proofId !== null && reviewModal.proofId !== "") {
        payload.proof_id = reviewModal.proofId;
      }
      if (reviewModal.id !== undefined && reviewModal.id !== null && reviewModal.id !== "") {
        payload.id = reviewModal.id;
      }

      await fetchRoute("admin/payment-proofs/review", {
        method: "POST",
        data: payload,
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

  const remove = async (row) => {
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
        data: getProofPayload(row),
      });
      setMessage("Bukti pembayaran berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus bukti pembayaran");
    }
  };

  const previewProof = async (row) => {
    try {
      await openRouteFile("admin/payment-proofs/file", getProofPayload(row));
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
              <option value="">{studentOptions.length === 0 ? "Tidak ada santri" : "Semua santri"}</option>
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
                <li key={getRowKey(row, index)} className="card p-3">
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5 text-sm font-semibold text-slate-500">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.student_name || "-"}</p>
                        <p className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(getProofAmount(row))}</p>
                      </div>
                      <p className="text-xs text-slate-600">
                        {row.class_name || "-"}
                        <span className="mx-1 text-yellow-500">|</span>
                        Ref: {getReferenceLabel(row)}
                      </p>
                      <div className="space-y-1 text-xs text-slate-600">
                        <p>{getBillSummaryLabel(row)}</p>
                        <p>Periode: {getPeriodLabel(row)}</p>
                      </div>
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
                        <button
                          className="btn-secondary px-3 py-2"
                          onClick={() => previewProof(row)}
                          title="Lihat bukti pembayaran"
                          aria-label="Lihat bukti pembayaran"
                        >
                          <Eye size={16} />
                        </button>
                        {row.status === "pending" ? (
                          <>
                            <button
                              className="btn-primary px-3 py-2"
                              onClick={() => openReviewModal(row, "approved")}
                              title="Setujui bukti pembayaran"
                              aria-label="Setujui bukti pembayaran"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              className="btn-danger px-3 py-2"
                              onClick={() => openReviewModal(row, "rejected")}
                              title="Tolak bukti pembayaran"
                              aria-label="Tolak bukti pembayaran"
                            >
                              <XCircle size={16} />
                            </button>
                            {isAdmin ? (
                              <button
                                className="btn-secondary px-3 py-2"
                                onClick={() => remove(row)}
                                title="Hapus bukti pembayaran"
                                aria-label="Hapus bukti pembayaran"
                              >
                                <Trash2 size={16} />
                              </button>
                            ) : null}
                          </>
                        ) : null}
                        {isAdmin && row.status === "rejected" ? (
                          <button
                            className="btn-secondary px-3 py-2"
                            onClick={() => remove(row)}
                            title="Hapus bukti pembayaran"
                            aria-label="Hapus bukti pembayaran"
                          >
                            <Trash2 size={16} />
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
              { key: "student_name", title: "Santri" },
              { key: "reference_no", title: "Referensi", render: renderReferenceCell },
              { key: "period", title: "Periode", render: (row) => getPeriodLabel(row) },
              {
                key: "amount",
                title: "Nominal",
                render: (row) => formatCurrency(getProofAmount(row)),
              },
              {
                key: "proof_file_name",
                title: "File Bukti",
                render: (row) => (
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => previewProof(row)}
                    title="Lihat bukti pembayaran"
                    aria-label="Lihat bukti pembayaran"
                  >
                    <Eye size={16} />
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
                key: "actions",
                title: "Aksi",
                render: (row) => {
                  if (row.status === "pending") {
                    return (
                      <div className="flex gap-2">
                        <button
                          className="btn-primary px-3 py-2"
                          onClick={() => openReviewModal(row, "approved")}
                          title="Setujui bukti pembayaran"
                          aria-label="Setujui bukti pembayaran"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                        <button
                          className="btn-danger px-3 py-2"
                          onClick={() => openReviewModal(row, "rejected")}
                          title="Tolak bukti pembayaran"
                          aria-label="Tolak bukti pembayaran"
                        >
                          <XCircle size={16} />
                        </button>
                        {isAdmin && (
                          <button
                            className="btn-secondary px-3 py-2"
                            onClick={() => remove(row)}
                            title="Hapus bukti pembayaran"
                            aria-label="Hapus bukti pembayaran"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (isAdmin && row.status === "rejected") {
                    return (
                      <button
                        className="btn-secondary px-3 py-2"
                        onClick={() => remove(row)}
                        title="Hapus bukti pembayaran"
                        aria-label="Hapus bukti pembayaran"
                      >
                        <Trash2 size={16} />
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
        {reviewModal.proofLabel ? (
          <p className="text-sm text-slate-600">Referensi: {reviewModal.proofLabel}</p>
        ) : null}
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

