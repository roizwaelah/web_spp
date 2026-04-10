import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck2, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useToastMessage } from "../hooks/useToastMessage";

export default function BillsEditPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [meta, setMeta] = useState({ students: [], finance_posts: [] });
  const [form, setForm] = useState({
    period_start: currentMonth,
    period_end: currentMonth,
    due_date: "",
    student_id: "",
    finance_post_ids: [],
  });
  const [message, setMessage] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const studentDropdownRef = useRef(null);
  const [financeDropdownOpen, setFinanceDropdownOpen] = useState(false);
  const financeDropdownRef = useRef(null);
  const navigate = useNavigate();

  useToastMessage(message, setMessage);

  useEffect(() => {
    fetchRoute("admin/meta")
      .then((metaRes) => {
        setMeta({
          students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
          finance_posts: Array.isArray(metaRes.data?.finance_posts) ? metaRes.data.finance_posts : [],
        });
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat form tagihan");
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await fetchRoute("admin/bills/generate", {
        method: "POST",
        data: {
          period_start: form.period_start,
          period_end: form.period_end,
          due_date: form.due_date || undefined,
          student_id: form.student_id || undefined,
          finance_post_ids: form.finance_post_ids.length > 0 ? form.finance_post_ids.map((id) => Number(id)) : undefined,
        },
      });

      setMessage(data?.message || "Generate tagihan berhasil");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal generate tagihan");
    }
  };

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    return meta.students.filter((item) => {
      if (!keyword) return true;
      const haystack = `${item.name || ""} ${item.nis || ""}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [meta.students, studentSearch]);

  useEffect(() => {
    const activeStudent = meta.students.find((item) => String(item.id) === String(form.student_id));
    if (activeStudent) {
      setStudentSearch(`${activeStudent.name} - ${activeStudent.nis}`);
    } else {
      setStudentSearch("");
    }
  }, [form.student_id, meta.students]);

  useEffect(() => {
    const handleOutside = (event) => {
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target)) {
        setStudentDropdownOpen(false);
      }
      if (financeDropdownRef.current && !financeDropdownRef.current.contains(event.target)) {
        setFinanceDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectedFinanceLabel = useMemo(() => {
    const selectedSet = new Set(form.finance_post_ids.map((id) => String(id)));
    const selectedItems = (meta.finance_posts || []).filter((item) => selectedSet.has(String(item.id)));
    if (selectedItems.length === 0) return "Tidak ada pos dipilih";
    if (selectedItems.length === (meta.finance_posts || []).length) return "Semua pos aktif";
    if (selectedItems.length === 1) return selectedItems[0]?.name || "1 pos dipilih";
    return `${selectedItems.length} pos dipilih`;
  }, [form.finance_post_ids, meta.finance_posts]);

  useEffect(() => {
    const activePostIds = (meta.finance_posts || []).map((item) => String(item.id));
    if (activePostIds.length === 0) return;
    setForm((current) => {
      if (current.finance_post_ids.length > 0) return current;
      return { ...current, finance_post_ids: activePostIds };
    });
  }, [meta.finance_posts]);

  return (
    <Layout
      title="Buat Tagihan"
      subtitle="Generate tagihan otomatis per periode untuk semua siswa atau siswa tertentu."
      actions={
        <button className="btn-accent" onClick={() => navigate("/admin/tagihan/list")}>
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
            <CalendarCheck2 size={20} />
          </div>
          <div>
            <h3 className="section-title">Generate tagihan</h3>
            <p className="text-sm text-slate-500">Buat tagihan massal untuk rentang bulan.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="label">Jatuh tempo</label>
              <input
                type="date"
                className="input"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Periode</label>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <input
                  type="month"
                  className="input"
                  value={form.period_start}
                  onChange={(e) =>
                    setForm((current) => {
                      const nextStart = e.target.value;
                      const nextEnd =
                        !current.period_end || (nextStart && current.period_end < nextStart)
                          ? nextStart
                          : current.period_end;
                      return { ...current, period_start: nextStart, period_end: nextEnd };
                    })
                  }
                />
                <span className="text-sm font-semibold text-slate-600">s/d</span>
                <input
                  type="month"
                  className="input"
                  min={form.period_start}
                  value={form.period_end}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      period_end: e.target.value || current.period_start,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Pos Pembayaran</label>
              <div className="relative" ref={financeDropdownRef}>
                <button
                  type="button"
                  className="input flex items-center justify-between text-left"
                  disabled={(meta.finance_posts || []).length === 0}
                  onClick={() => setFinanceDropdownOpen((open) => !open)}
                >
                  <span className="truncate">{selectedFinanceLabel}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-black transition-transform ${financeDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {financeDropdownOpen && (meta.finance_posts || []).length > 0 ? (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-300 bg-white p-2 shadow-lg">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            finance_post_ids: (meta.finance_posts || []).map((item) => String(item.id)),
                          }))
                        }
                      >
                        Pilih semua
                      </button>
                      <button
                        type="button"
                        className="text-slate-600 hover:underline"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            finance_post_ids: [],
                          }))
                        }
                      >
                        Kosongkan
                      </button>
                    </div>
                    <div className="space-y-1">
                      {(meta.finance_posts || []).map((item) => {
                        const id = String(item.id);
                        const checked = form.finance_post_ids.includes(id);
                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setForm((current) => ({
                                  ...current,
                                  finance_post_ids: e.target.checked
                                    ? [...new Set([...current.finance_post_ids, id])]
                                    : current.finance_post_ids.filter((value) => value !== id),
                                }))
                              }
                              className="mt-0.5"
                            />
                            <span className="text-sm text-slate-700">{item.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-slate-500">
                  Pilih satu atau lebih pos pembayaran.
                </div>
              </div>
            </div>
            <div>
              <label className="label">Siswa</label>
              <div className="relative" ref={studentDropdownRef}>
                <input
                  className="input"
                  placeholder="Semua siswa (ketik nama / NIS)"
                  value={studentSearch}
                  onFocus={() => setStudentDropdownOpen(true)}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setStudentDropdownOpen(true);
                    setForm((current) => ({ ...current, student_id: "" }));
                  }}
                />
                {studentDropdownOpen ? (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setForm((current) => ({ ...current, student_id: "" }));
                        setStudentSearch("");
                        setStudentDropdownOpen(false);
                      }}
                    >
                      Semua siswa
                    </button>
                    {filteredStudents.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-slate-500">Siswa tidak ditemukan.</p>
                    ) : (
                      filteredStudents.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                          onClick={() => {
                            setForm((current) => ({ ...current, student_id: String(item.id) }));
                            setStudentSearch(`${item.name} - ${item.nis}`);
                            setStudentDropdownOpen(false);
                          }}
                        >
                          {item.name} - {item.nis}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1">Generate sekarang</button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setForm({
                  period_start: currentMonth,
                  period_end: currentMonth,
                  due_date: "",
                  student_id: "",
                  finance_post_ids: (meta.finance_posts || []).map((item) => String(item.id)),
                });
                setStudentSearch("");
                setStudentDropdownOpen(false);
              }}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
