import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Layout from "../components/Layout";
import ModalFrame from "../components/ModalFrame";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

export default function StudentListPage() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [classes, setClasses] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [importErrorModalOpen, setImportErrorModalOpen] = useState(false);
  const [importErrorSummary, setImportErrorSummary] = useState(null);
  const [importValidationErrors, setImportValidationErrors] = useState([]);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [sourceClassId, setSourceClassId] = useState("");
  const [sourceAcademicYearId, setSourceAcademicYearId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [targetAcademicYearId, setTargetAcademicYearId] = useState("");
  const [sourceSelectedIds, setSourceSelectedIds] = useState([]);
  const [targetSelectedIds, setTargetSelectedIds] = useState([]);
  const [movedStudentIds, setMovedStudentIds] = useState([]);
  const [isSavingPromotion, setIsSavingPromotion] = useState(false);
  const [graduateModalOpen, setGraduateModalOpen] = useState(false);
  const [graduateSourceClassId, setGraduateSourceClassId] = useState("");
  const [graduateSourceAcademicYearId, setGraduateSourceAcademicYearId] = useState("");
  const [graduateSourceSelectedIds, setGraduateSourceSelectedIds] = useState([]);
  const [graduatedStudentIds, setGraduatedStudentIds] = useState([]);
  const [graduateTargetSelectedIds, setGraduateTargetSelectedIds] = useState([]);
  const [isSavingGraduation, setIsSavingGraduation] = useState(false);
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);
  const [transitionFromYearId, setTransitionFromYearId] = useState("");
  const [transitionToYearId, setTransitionToYearId] = useState("");
  const [transitionActivateTarget, setTransitionActivateTarget] = useState(true);
  const [isProcessingTransition, setIsProcessingTransition] = useState(false);
  const [transitionImpact, setTransitionImpact] = useState({
    loading: false,
    activeStudents: 0,
    unpaidBills: 0,
    unpaidStudents: 0,
  });
  const navigate = useNavigate();
  const { confirm } = useUI();

  const romanToNumber = (value) => {
    const roman = String(value || "").toUpperCase().trim();
    if (!roman) return null;
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    let prev = 0;
    for (let i = roman.length - 1; i >= 0; i -= 1) {
      const current = map[roman[i]];
      if (!current) return null;
      if (current < prev) total -= current;
      else total += current;
      prev = current;
    }
    return total;
  };

  const classOrderFromName = (className) => {
    const textValue = String(className || "").trim();
    if (!textValue) return Number.MAX_SAFE_INTEGER;
    const arabicMatch = textValue.match(/\d+/);
    if (arabicMatch) return Number(arabicMatch[0]);
    const tokens = textValue.split(/\s+/);
    for (const token of tokens) {
      const romanValue = romanToNumber(token);
      if (romanValue != null) return romanValue;
    }
    return Number.MAX_SAFE_INTEGER;
  };


  useToastMessage(message, setMessage);

  const load = async () => {
    try {
      const [studentsRes, metaRes] = await Promise.all([
        fetchRoute("admin/students"),
        fetchRoute("admin/meta"),
      ]);
      const rows = Array.isArray(studentsRes.data) ? studentsRes.data : [];
      const classRows = Array.isArray(metaRes?.data?.classes)
        ? metaRes.data.classes
        : [];
      const yearRows = Array.isArray(metaRes?.data?.years)
        ? metaRes.data.years
        : [];
      setClasses(classRows);
      setAcademicYears(yearRows);
      setStudents(rows);
      return rows;
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal memuat data siswa",
      });
      return [];
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus data siswa",
      description: "Data siswa ini akan dihapus beserta relasi yang bergantung padanya.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/students", { method: "DELETE", data: { id } });
      setMessage({ type: "success", text: "Siswa berhasil dihapus" });
      load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menghapus siswa",
      });
    }
  };

  const importStudents = async () => {
    if (!file) {
      setMessage({ type: "warning", text: "Silakan pilih file Excel terlebih dahulu." });
      return;
    }
    const normalizeValidationErrors = (payload, withFallbackMessage = false) => {
      const raw = payload?.validation_errors;
      if (Array.isArray(raw) && raw.length > 0) return raw;
      if (withFallbackMessage && payload?.message) {
        return [{
          row: "-",
          column: "import",
          value: "",
          message: payload.message,
        }];
      }
      return [];
    };

    setImportErrorModalOpen(false);
    setImportValidationErrors([]);
    setImportErrorSummary(null);
    setIsImporting(true);
    const beforeCount = students.length;
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await fetchRoute("admin/students/import", {
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imported = Number(response?.data?.summary?.imported || 0);
      const validationErrors = normalizeValidationErrors(response?.data || {}, false);
      const rowsAfter = await load();
      const delta = Math.max(0, rowsAfter.length - beforeCount);

      if (imported > 0 || delta > 0) {
        setMessage({
          type: "success",
          text:
            response?.data?.message ||
            `Impor berhasil. ${imported || delta} siswa ditambahkan.`,
        });
      } else {
        setMessage({
          type: "warning",
          text:
            response?.data?.message ||
            "Tidak ada data baru yang masuk ke database.",
        });
      }

      if (validationErrors.length > 0) {
        setImportErrorSummary(response?.data?.summary || null);
        setImportValidationErrors(validationErrors);
        setImportErrorModalOpen(true);
      }
    } catch (error) {
      const validationErrors = normalizeValidationErrors(error?.response?.data || {}, true);
      if (validationErrors.length > 0) {
        setImportErrorSummary(error?.response?.data?.summary || null);
        setImportValidationErrors(validationErrors);
        setImportErrorModalOpen(true);
      }
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal impor data siswa",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      await downloadRouteFile("admin/students/template", {}, "template-import-siswa.xlsx");
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal mengunduh template import siswa",
      });
    }
  };

  const filtered = useMemo(
    () =>
      students.filter((item) =>
        `${item.name} ${item.nis} ${item.nisn || ""} ${item.parent_name} ${item.class_name}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [students, filter],
  );

  const filteredSorted = useMemo(() => {
    const items = filtered.slice();
    items.sort((a, b) => {
      const classOrderDiff =
        classOrderFromName(a.class_name) - classOrderFromName(b.class_name);
      if (classOrderDiff !== 0) return classOrderDiff;

      const classNameDiff = String(a.class_name || "").localeCompare(
        String(b.class_name || ""),
        "id",
      );
      if (classNameDiff !== 0) return classNameDiff;

      return String(a.name || "").localeCompare(String(b.name || ""), "id");
    });
    return items;
  }, [filtered]);

  const studentsByClass = useMemo(() => {
    const map = new Map();
    for (const row of students) {
      const cid = String(row.class_id || "");
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(row);
    }
    for (const [key, list] of map.entries()) {
      map.set(
        key,
        list.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id")),
      );
    }
    return map;
  }, [students]);

  const sourceStudents = useMemo(() => {
    if (!sourceClassId) return [];
    const movedSet = new Set(movedStudentIds.map(String));
    const base = studentsByClass.get(String(sourceClassId)) || [];
    return base.filter(
      (item) =>
        !movedSet.has(String(item.id)) &&
        (!sourceAcademicYearId || String(item.academic_year_id) === String(sourceAcademicYearId)),
    );
  }, [sourceClassId, sourceAcademicYearId, studentsByClass, movedStudentIds]);

  const targetStudents = useMemo(() => {
    if (!targetClassId) return [];
    const movedSet = new Set(movedStudentIds.map(String));
    const base = studentsByClass.get(String(targetClassId)) || [];
    const movedRows = (studentsByClass.get(String(sourceClassId)) || []).filter((item) =>
      movedSet.has(String(item.id)),
    );
    const merged = [...base, ...movedRows];
    return merged.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
  }, [targetClassId, sourceClassId, studentsByClass, movedStudentIds]);

  const movedSet = useMemo(
    () => new Set(movedStudentIds.map(String)),
    [movedStudentIds],
  );

  const graduateMovedSet = useMemo(
    () => new Set(graduatedStudentIds.map(String)),
    [graduatedStudentIds],
  );

  const resetPromotionState = () => {
    setSourceSelectedIds([]);
    setTargetSelectedIds([]);
    setMovedStudentIds([]);
  };

  const resetGraduationState = () => {
    setGraduateSourceSelectedIds([]);
    setGraduateTargetSelectedIds([]);
    setGraduatedStudentIds([]);
  };

  const openPromoteModal = () => {
    setPromoteModalOpen(true);
    resetPromotionState();
    if (!sourceClassId && classes.length > 0) {
      setSourceClassId(String(classes[0].id));
    }
    if (!sourceAcademicYearId && academicYears.length > 0) {
      setSourceAcademicYearId(String(academicYears[0].id));
    }
    if (!targetClassId && classes.length > 1) {
      setTargetClassId(String(classes[1].id));
    }
    if (!targetAcademicYearId && academicYears.length > 0) {
      setTargetAcademicYearId(String(academicYears[0].id));
    }
  };

  const openGraduateModal = () => {
    setGraduateModalOpen(true);
    resetGraduationState();
    if (!graduateSourceClassId && classes.length > 0) {
      setGraduateSourceClassId(String(classes[0].id));
    }
    if (!graduateSourceAcademicYearId && academicYears.length > 0) {
      setGraduateSourceAcademicYearId(String(academicYears[0].id));
    }
  };

  const openTransitionModal = () => {
    setTransitionModalOpen(true);

    const activeYear = academicYears.find((item) => Number(item.is_active || 0) === 1);
    const fallbackFrom = activeYear ? String(activeYear.id) : (academicYears[0] ? String(academicYears[0].id) : "");

    let fallbackTo = "";
    if (academicYears.length > 1) {
      const sourceIndex = academicYears.findIndex((item) => String(item.id) === fallbackFrom);
      if (sourceIndex >= 0 && sourceIndex < academicYears.length - 1) {
        fallbackTo = String(academicYears[sourceIndex + 1].id);
      } else {
        fallbackTo = String(academicYears[0].id) === fallbackFrom
          ? String(academicYears[1].id)
          : String(academicYears[0].id);
      }
    }

    setTransitionFromYearId(fallbackFrom);
    setTransitionToYearId(fallbackTo);
    setTransitionActivateTarget(true);
  };

  useEffect(() => {
    if (!transitionModalOpen || !transitionFromYearId) {
      setTransitionImpact({
        loading: false,
        activeStudents: 0,
        unpaidBills: 0,
        unpaidStudents: 0,
      });
      return;
    }

    let cancelled = false;

    const computeImpact = async () => {
      setTransitionImpact((current) => ({ ...current, loading: true }));
      try {
        const { data } = await fetchRoute("admin/academic-years/transition-impact", {
          method: "POST",
          data: { from_year_id: Number(transitionFromYearId) },
        });

        if (!cancelled) {
          setTransitionImpact({
            loading: false,
            activeStudents: Number(data?.active_students || 0),
            unpaidBills: Number(data?.unpaid_bills || 0),
            unpaidStudents: Number(data?.unpaid_students || 0),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setTransitionImpact((current) => ({ ...current, loading: false }));
        }
      }
    };

    computeImpact();

    return () => {
      cancelled = true;
    };
  }, [transitionModalOpen, transitionFromYearId]);
  useEffect(() => {
    if (!promoteModalOpen || !sourceClassId) return;
    const base = (studentsByClass.get(String(sourceClassId)) || []).filter(
      (row) =>
        !sourceAcademicYearId ||
        String(row.academic_year_id) === String(sourceAcademicYearId),
    );
    setSourceSelectedIds(base.map((row) => String(row.id)));
    setTargetSelectedIds([]);
  }, [promoteModalOpen, sourceClassId, sourceAcademicYearId, studentsByClass]);

  const graduationSourceStudents = useMemo(() => {
    if (!graduateSourceClassId) return [];
    const base = studentsByClass.get(String(graduateSourceClassId)) || [];
    return base.filter(
      (row) =>
        row.status === "active" &&
        !graduateMovedSet.has(String(row.id)) &&
        (!graduateSourceAcademicYearId ||
          String(row.academic_year_id) === String(graduateSourceAcademicYearId)),
    );
  }, [graduateSourceClassId, graduateSourceAcademicYearId, studentsByClass, graduateMovedSet]);

  const graduationTargetStudents = useMemo(() => {
    if (!graduateSourceClassId) return [];
    const base = studentsByClass.get(String(graduateSourceClassId)) || [];
    return base
      .filter((row) => graduateMovedSet.has(String(row.id)))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
  }, [graduateSourceClassId, studentsByClass, graduateMovedSet]);

  useEffect(() => {
    if (!graduateModalOpen || !graduateSourceClassId) return;
    const base = (studentsByClass.get(String(graduateSourceClassId)) || []).filter(
      (row) =>
        row.status === "active" &&
        (!graduateSourceAcademicYearId ||
          String(row.academic_year_id) === String(graduateSourceAcademicYearId)),
    );
    setGraduateSourceSelectedIds(base.map((row) => String(row.id)));
    setGraduateTargetSelectedIds([]);
  }, [graduateModalOpen, graduateSourceClassId, graduateSourceAcademicYearId, studentsByClass]);

  const moveRight = () => {
    if (!sourceSelectedIds.length) return;
    const selectedSet = new Set(sourceSelectedIds.map(String));
    const selectedRows = sourceStudents.filter((row) => selectedSet.has(String(row.id)));
    if (!selectedRows.length) return;
    setMovedStudentIds((current) => {
      const merged = new Set(current.map(String));
      selectedRows.forEach((row) => merged.add(String(row.id)));
      return Array.from(merged);
    });
    setSourceSelectedIds([]);
  };

  const moveLeft = () => {
    if (!targetSelectedIds.length) return;
    const selectedSet = new Set(targetSelectedIds.map(String));
    setMovedStudentIds((current) =>
      current.filter((id) => !selectedSet.has(String(id))),
    );
    setTargetSelectedIds([]);
  };

  const moveGraduateRight = () => {
    if (!graduateSourceSelectedIds.length) return;
    const selectedSet = new Set(graduateSourceSelectedIds.map(String));
    const selectedRows = graduationSourceStudents.filter((row) => selectedSet.has(String(row.id)));
    if (!selectedRows.length) return;
    setGraduatedStudentIds((current) => {
      const merged = new Set(current.map(String));
      selectedRows.forEach((row) => merged.add(String(row.id)));
      return Array.from(merged);
    });
    setGraduateSourceSelectedIds([]);
  };

  const moveGraduateLeft = () => {
    if (!graduateTargetSelectedIds.length) return;
    const selectedSet = new Set(graduateTargetSelectedIds.map(String));
    setGraduatedStudentIds((current) =>
      current.filter((id) => !selectedSet.has(String(id))),
    );
    setGraduateTargetSelectedIds([]);
  };

  const submitPromotion = async () => {
    if (!sourceClassId || !targetClassId) {
      setMessage({ type: "warning", text: "Pilih kelas asal dan kelas tujuan terlebih dahulu." });
      return;
    }
    if (!targetAcademicYearId) {
      setMessage({ type: "warning", text: "Pilih tahun ajaran tujuan terlebih dahulu." });
      return;
    }
    if (sourceClassId === targetClassId) {
      setMessage({ type: "warning", text: "Kelas asal dan tujuan tidak boleh sama." });
      return;
    }
    if (!movedStudentIds.length) {
      setMessage({ type: "warning", text: "Pilih minimal satu siswa untuk dipindahkan." });
      return;
    }

    const confirmMove = await confirm({
      title: "Simpan perpindahan kelas",
      description: `Pindahkan ${movedStudentIds.length} siswa ke kelas tujuan?`,
      confirmLabel: "Ya, simpan",
    });
    if (!confirmMove) return;

    const targetClassIdNum = Number(targetClassId);
    const targetAcademicYearIdNum = Number(targetAcademicYearId);
    const rowsToMove = students.filter((row) => movedSet.has(String(row.id)));
    setIsSavingPromotion(true);
    try {
      await Promise.all(
        rowsToMove.map((row) =>
          fetchRoute("admin/students", {
            method: "PUT",
            data: {
              id: row.id,
              nis: row.nis,
              nisn: row.nisn,
              name: row.name,
              class_id: targetClassIdNum,
              academic_year_id: targetAcademicYearIdNum,
              parent_name: row.parent_name,
              parent_phone: row.parent_phone,
              address: row.address ?? "",
              status: row.status || "active",
            },
          }),
        ),
      );
      setMessage({ type: "success", text: `${rowsToMove.length} siswa berhasil dipindahkan kelas.` });
      setPromoteModalOpen(false);
      resetPromotionState();
      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menyimpan perpindahan kelas",
      });
    } finally {
      setIsSavingPromotion(false);
    }
  };

  const submitGraduation = async () => {
    if (!graduateSourceClassId) {
      setMessage({ type: "warning", text: "Pilih kelas asal terlebih dahulu." });
      return;
    }
    if (!graduateSourceAcademicYearId) {
      setMessage({ type: "warning", text: "Pilih tahun ajaran asal terlebih dahulu." });
      return;
    }
    if (!graduatedStudentIds.length) {
      setMessage({ type: "warning", text: "Pilih minimal satu siswa untuk diluluskan." });
      return;
    }

    const confirmGraduate = await confirm({
      title: "Simpan kelulusan siswa",
      description: `Ubah status ${graduatedStudentIds.length} siswa menjadi nonaktif (lulus)?`,
      confirmLabel: "Ya, simpan",
    });
    if (!confirmGraduate) return;

    const rowsToGraduate = students.filter((row) => graduateMovedSet.has(String(row.id)));
    setIsSavingGraduation(true);
    try {
      await Promise.all(
        rowsToGraduate.map((row) =>
          fetchRoute("admin/students", {
            method: "PUT",
            data: {
              id: row.id,
              nis: row.nis,
              nisn: row.nisn,
              name: row.name,
              class_id: Number(row.class_id),
              academic_year_id: Number(row.academic_year_id),
              parent_name: row.parent_name,
              parent_phone: row.parent_phone,
              address: row.address ?? "",
              status: "inactive",
            },
          }),
        ),
      );
      setMessage({ type: "success", text: `${rowsToGraduate.length} siswa berhasil diluluskan.` });
      setGraduateModalOpen(false);
      resetGraduationState();
      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menyimpan data kelulusan",
      });
    } finally {
      setIsSavingGraduation(false);
    }
  };


  const submitAcademicYearTransition = async () => {
    if (!transitionFromYearId || !transitionToYearId) {
      setMessage({ type: "warning", text: "Pilih tahun ajaran asal dan tujuan terlebih dahulu." });
      return;
    }
    if (String(transitionFromYearId) === String(transitionToYearId)) {
      setMessage({ type: "warning", text: "Tahun ajaran asal dan tujuan tidak boleh sama." });
      return;
    }

    const confirmTransition = await confirm({
      title: "Proses transisi tahun ajaran",
      description: "Semua siswa aktif di tahun ajaran asal akan dipindah ke tahun ajaran tujuan. Lanjutkan?",
      confirmLabel: "Ya, proses",
    });
    if (!confirmTransition) return;

    setIsProcessingTransition(true);
    try {
      const response = await fetchRoute("admin/academic-years/transition", {
        method: "POST",
        data: {
          from_year_id: Number(transitionFromYearId),
          to_year_id: Number(transitionToYearId),
          activate_target: transitionActivateTarget ? 1 : 0,
        },
      });
      setMessage({
        type: "success",
        text: response?.data?.message || "Transisi tahun ajaran berhasil diproses.",
      });
      setTransitionModalOpen(false);
      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal memproses transisi tahun ajaran",
      });
    } finally {
      setIsProcessingTransition(false);
    }
  };

  return (
    <Layout
      title="Data Siswa"
      subtitle="Kelola daftar siswa, pencarian cepat, impor data, dan aksi edit/hapus."
      actions={
        <div className="w-full lg:w-auto">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:hidden">
            Aksi Massal
          </div>
          <div className="grid w-full grid-cols-4 gap-2 md:hidden">
            <button
              type="button"
              className="btn-secondary w-full justify-center px-2"
              onClick={openPromoteModal}
              title="Kenaikan"
              aria-label="Kenaikan"
            >
              <ArrowUpDown size={16} />
              <span className="hidden md:inline">Kenaikan</span>
            </button>
            <button
              type="button"
              className="btn-secondary w-full justify-center px-2"
              onClick={openGraduateModal}
              title="Kelulusan"
              aria-label="Kelulusan"
            >
              <GraduationCap size={16} />
              <span className="hidden md:inline">Kelulusan</span>
            </button>
            <button
              type="button"
              className="btn-secondary w-full justify-center px-2"
              onClick={openTransitionModal}
              title="Transisi TA"
              aria-label="Transisi TA"
            >
              <CalendarRange size={16} />
            </button>
            <button
              type="button"
              className="btn-primary w-full justify-center px-2"
              title="Tambah Siswa"
              aria-label="Tambah Siswa"
              onClick={() => navigate("/admin/siswa/edit")}
              onMouseEnter={() => prefetchRoute("/admin/siswa/edit")}
              onFocus={() => prefetchRoute("/admin/siswa/edit")}
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <button
              type="button"
              className="btn-secondary"
              onClick={openPromoteModal}
            >
              Kenaikan
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={openGraduateModal}
            >
              Kelulusan
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={openTransitionModal}
            >
              Transisi TA
            </button>
            <button
              type="button"
              className="btn-primary"
              title="Tambah Siswa"
              aria-label="Tambah Siswa"
              onClick={() => navigate("/admin/siswa/edit")}
              onMouseEnter={() => prefetchRoute("/admin/siswa/edit")}
              onFocus={() => prefetchRoute("/admin/siswa/edit")}
            >
              <Plus size={18} /> Tambah Siswa
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="card flex flex-col gap-3 p-3 md:flex-row md:items-end md:gap-4">
          <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-end md:gap-4">
            <div className="flex-1">
              <label className="label">Pencarian</label>
              <input
                className="input h-10 w-full md:h-11"
                placeholder="Cari nama / NIM / NISN / orang tua / kelas"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="w-full md:w-64">
              <label className="label">Import Excel</label>
              <input
                type="file"
                className="input h-10 w-full md:h-11"
                accept=".xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 md:flex md:items-end">
              <button type="button" className="btn-primary w-full whitespace-nowrap md:w-auto" onClick={importStudents}>
                Import
              </button>
              <button type="button" className="btn-secondary w-full whitespace-nowrap md:w-auto" onClick={downloadTemplate}>
                Template
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-2 md:hidden">
          {filteredSorted.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">Belum ada data siswa</div>
          ) : (
            filteredSorted.map((row, idx) => (
              <div key={row.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-slate-900">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="pt-0.5 text-sm font-semibold text-slate-900">{row.name || "-"}</p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {row.nis || "-"} | {row.nisn || "-"} | {row.class_name || "-"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {row.parent_name || "-"} | {row.parent_phone || "-"}
                      </p>
                    </div>
                  </div>
                  <span className={row.status === "active" ? "badge-green" : "badge-amber"}>
                    {row.status}
                  </span>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => navigate(`/admin/siswa/edit/${row.id}`)}
                    onMouseEnter={() => prefetchRoute("/admin/siswa/edit")}
                    onFocus={() => prefetchRoute("/admin/siswa/edit")}
                  >
                    <Pencil size={16} />
                  </button>
                  <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <Table
            columns={[
              {
              key: "nis",
              title: "NIM",
              render: (row) => row.nis || "-",
            },
              { key: "nisn", title: "NISN" },
              { key: "name", title: "Nama" },
              { key: "class_name", title: "Kelas" },
              { key: "academic_year", title: "Tahun Ajaran" },
              { key: "parent_name", title: "Wali" },
              { key: "parent_phone", title: "WA" },
              {
                key: "status",
                title: "Status",
                render: (row) => (
                  <span className={row.status === "active" ? "badge-green" : "badge-amber"}>
                    {row.status}
                  </span>
                ),
              },
              {
                key: "actions",
                title: "Aksi",
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary px-3 py-2"
                      onClick={() => navigate(`/admin/siswa/edit/${row.id}`)}
                      onMouseEnter={() => prefetchRoute("/admin/siswa/edit")}
                      onFocus={() => prefetchRoute("/admin/siswa/edit")}
                    >
                      <Pencil size={16} />
                    </button>
                    <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredSorted}
          />
        </div>
      </div>
      <ModalFrame
        open={promoteModalOpen}
        onClose={() => {
          if (isSavingPromotion) return;
          setPromoteModalOpen(false);
          resetPromotionState();
        }}
        title="Naik Kelas"
        showIcon={false}
        maxWidthClass="max-w-5xl"
        cardClassName="max-h-[calc(100vh-35px)]"
      >
        <div className="max-h-[calc(100vh-125px)] overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">Kelas Asal</label>
                <select
                  className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[12px] leading-normal text-black outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  value={sourceClassId}
                  onChange={(e) => {
                    setSourceClassId(e.target.value);
                    resetPromotionState();
                  }}
                >
                  <option value="">Pilih kelas asal</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tahun Ajaran</label>
                <select
                  className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[12px] leading-normal text-black outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  value={sourceAcademicYearId}
                  onChange={(e) => {
                    setSourceAcademicYearId(e.target.value);
                    resetPromotionState();
                  }}
                >
                  <option value="">Pilih tahun ajaran</option>
                  {academicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 max-h-[250px] overflow-auto rounded-lg border border-slate-200 bg-white">
              {sourceStudents.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">Tidak ada siswa</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {sourceStudents.map((row) => (
                    <li key={row.id} className="px-3 py-1">
                      <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-800">
                        <input
                          type="checkbox"
                          checked={sourceSelectedIds.includes(String(row.id))}
                          onChange={(e) => {
                            const id = String(row.id);
                            setSourceSelectedIds((current) =>
                              e.target.checked
                                ? [...current, id]
                                : current.filter((item) => item !== id),
                            );
                          }}
                        />
                        <span>{row.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-1.5">
            <button
              type="button"
              className="btn-primary h-9 w-9 rounded-full p-0"
              onClick={moveRight}
              disabled={!sourceSelectedIds.length || !targetClassId || sourceClassId === targetClassId}
              title="Pindahkan ke kanan"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="btn-secondary h-9 w-9 rounded-full p-0"
              onClick={moveLeft}
              disabled={!targetSelectedIds.length}
              title="Tarik kembali ke kiri"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="label">Kelas Tujuan</label>
                <select
                  className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[12px] leading-normal text-black outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  value={targetClassId}
                  onChange={(e) => {
                    setTargetClassId(e.target.value);
                    resetPromotionState();
                  }}
                >
                  <option value="">Pilih kelas tujuan</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tahun Ajaran</label>
                <select
                  className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[12px] leading-normal text-black outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  value={targetAcademicYearId}
                  onChange={(e) => setTargetAcademicYearId(e.target.value)}
                >
                  <option value="">Pilih tahun ajaran</option>
                  {academicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-2 max-h-[250px] overflow-auto rounded-lg border border-slate-200 bg-white">
              {targetStudents.length === 0 ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">Tidak ada siswa</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {targetStudents.map((row) => {
                    const isMoved = movedSet.has(String(row.id));
                    return (
                    <li key={row.id} className="px-3 py-1">
                        <label
                          className={`flex items-center gap-2 text-[13px] ${isMoved ? "cursor-pointer text-slate-800" : "text-slate-500"}`}
                        >
                          <input
                            type="checkbox"
                            checked={targetSelectedIds.includes(String(row.id))}
                            disabled={!isMoved}
                            onChange={(e) => {
                              const id = String(row.id);
                              setTargetSelectedIds((current) =>
                                e.target.checked
                                  ? [...current, id]
                                  : current.filter((item) => item !== id),
                              );
                            }}
                          />
                          <span>{row.name}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
        </div>
        <div className="modal-actions mt-2">
          <button
            type="button"
            className="btn-secondary"
            disabled={isSavingPromotion}
            onClick={() => {
              setPromoteModalOpen(false);
              resetPromotionState();
            }}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={
              isSavingPromotion ||
              !movedStudentIds.length ||
              !targetClassId ||
              !targetAcademicYearId ||
              sourceClassId === targetClassId
            }
            onClick={submitPromotion}
          >
            {isSavingPromotion ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </ModalFrame>
      <ModalFrame
        open={graduateModalOpen}
        onClose={() => {
          if (isSavingGraduation) return;
          setGraduateModalOpen(false);
          resetGraduationState();
        }}
        title="Kelulusan"
        showIcon={false}
        maxWidthClass="max-w-5xl"
        cardClassName="max-h-[calc(100vh-35px)]"
      >
        <div className="max-h-[calc(100vh-125px)] overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="label">Kelas Asal</label>
                  <select
                    className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[12px] leading-normal text-black outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    value={graduateSourceClassId}
                    onChange={(e) => {
                      setGraduateSourceClassId(e.target.value);
                      resetGraduationState();
                    }}
                  >
                    <option value="">Pilih kelas asal</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tahun Ajaran</label>
                  <select
                    className="h-7 w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-[12px] leading-normal text-black outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    value={graduateSourceAcademicYearId}
                    onChange={(e) => {
                      setGraduateSourceAcademicYearId(e.target.value);
                      resetGraduationState();
                    }}
                  >
                    <option value="">Pilih tahun ajaran</option>
                    {academicYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-2 max-h-[250px] overflow-auto rounded-lg border border-slate-200 bg-white">
                {graduationSourceStudents.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">Tidak ada siswa aktif</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {graduationSourceStudents.map((row) => (
                      <li key={row.id} className="px-3 py-1">
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-800">
                          <input
                            type="checkbox"
                            checked={graduateSourceSelectedIds.includes(String(row.id))}
                            onChange={(e) => {
                              const id = String(row.id);
                              setGraduateSourceSelectedIds((current) =>
                                e.target.checked
                                  ? [...current, id]
                                  : current.filter((item) => item !== id),
                              );
                            }}
                          />
                          <span className="flex-1">{row.name}</span>
                          <span
                            className={`inline-flex h-2.5 w-2.5 rounded-full ${Number(row.active_bills || 0) > 0 ? "bg-rose-500" : "bg-emerald-500"}`}
                            title={
                              Number(row.active_bills || 0) > 0
                                ? `Masih punya ${row.active_bills} tanggungan`
                                : "Tidak ada tanggungan"
                            }
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                className="btn-primary h-9 w-9 rounded-full p-0"
                onClick={moveGraduateRight}
                disabled={!graduateSourceSelectedIds.length}
                title="Pindahkan ke kanan"
              >
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="btn-secondary h-9 w-9 rounded-full p-0"
                onClick={moveGraduateLeft}
                disabled={!graduateTargetSelectedIds.length}
                title="Tarik kembali ke kiri"
              >
                <ChevronLeft size={16} />
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
              <div>
                <label className="label">Siswa Diluluskan</label>
                <div className="h-7 rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[12px] leading-normal text-slate-600">
                  Status akan diubah menjadi nonaktif
                </div>
              </div>
              <div className="mt-2 max-h-[250px] overflow-auto rounded-lg border border-slate-200 bg-white">
                {graduationTargetStudents.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-slate-500">Belum ada siswa dipilih</div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {graduationTargetStudents.map((row) => (
                      <li key={row.id} className="px-3 py-1">
                        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-800">
                          <input
                            type="checkbox"
                            checked={graduateTargetSelectedIds.includes(String(row.id))}
                            onChange={(e) => {
                              const id = String(row.id);
                              setGraduateTargetSelectedIds((current) =>
                                e.target.checked
                                  ? [...current, id]
                                  : current.filter((item) => item !== id),
                              );
                            }}
                          />
                          <span>{row.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions mt-2 w-full justify-between">
          <div className="mr-auto flex items-center gap-4 text-xs text-slate-700">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span>Tidak ada tanggungan</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              <span>Masih ada tanggungan</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={isSavingGraduation}
              onClick={() => {
                setGraduateModalOpen(false);
                resetGraduationState();
              }}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSavingGraduation || !graduatedStudentIds.length || !graduateSourceAcademicYearId}
              onClick={submitGraduation}
            >
              {isSavingGraduation ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </ModalFrame>
      <ModalFrame
        open={transitionModalOpen}
        onClose={() => {
          if (isProcessingTransition) return;
          setTransitionModalOpen(false);
        }}
        title="Transisi Tahun Ajaran"
        showIcon={false}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Tahun Ajaran Asal</label>
              <select
                className="input h-10"
                value={transitionFromYearId}
                onChange={(e) => setTransitionFromYearId(e.target.value)}
              >
                <option value="">Pilih tahun ajaran asal</option>
                {academicYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tahun Ajaran Tujuan</label>
              <select
                className="input h-10"
                value={transitionToYearId}
                onChange={(e) => setTransitionToYearId(e.target.value)}
              >
                <option value="">Pilih tahun ajaran tujuan</option>
                {academicYears.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={transitionActivateTarget}
              onChange={(e) => setTransitionActivateTarget(e.target.checked)}
            />
            Jadikan tahun ajaran tujuan sebagai tahun ajaran aktif
          </label>

          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Proses ini akan memindahkan semua siswa berstatus aktif dari tahun ajaran asal ke tahun ajaran tujuan.
            Gunakan setelah proses Kenaikan/Kelulusan selesai.
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-800">Ringkasan Dampak</p>
            {transitionImpact.loading ? (
              <p className="mt-1 text-slate-500">Menghitung data...</p>
            ) : (
              <div className="mt-1 grid gap-1 sm:grid-cols-3">
                <p>Siswa aktif dipindah: <span className="font-semibold">{transitionImpact.activeStudents}</span></p>
                <p>Tagihan belum lunas: <span className="font-semibold">{transitionImpact.unpaidBills}</span></p>
                <p>Siswa bertunggakan: <span className="font-semibold">{transitionImpact.unpaidStudents}</span></p>
              </div>
            )}
            {transitionImpact.unpaidBills > 0 ? (
              <p className="mt-1 text-rose-700">Ada tunggakan pada tahun ajaran asal. Sesuai kebijakan, tunggakan tetap dibawa apa adanya.</p>
            ) : null}
          </div>

          <div className="modal-actions mt-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={isProcessingTransition}
              onClick={() => setTransitionModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isProcessingTransition || !transitionFromYearId || !transitionToYearId || transitionFromYearId === transitionToYearId}
              onClick={submitAcademicYearTransition}
            >
              {isProcessingTransition ? "Memproses..." : "Proses"}
            </button>
          </div>
        </div>
      </ModalFrame>
      <ModalFrame
        open={isImporting}
        onClose={() => {}}
        title="Memvalidasi Data Import"
        description="Sistem sedang memeriksa format dan menyimpan data siswa. Mohon tunggu..."
        showIcon={false}
        variant="default"
        maxWidthClass="max-w-md"
      >
        <div className="flex items-center justify-center py-3">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />
        </div>
      </ModalFrame>
      <ModalFrame
        open={importErrorModalOpen}
        onClose={() => setImportErrorModalOpen(false)}
        title="Detail Error Import Siswa"
        description="Periksa baris/kolom berikut lalu perbaiki file template sebelum impor ulang."
        variant="danger"
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-3">
          {importErrorSummary ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              Total: {importErrorSummary.total || 0} | Berhasil: {importErrorSummary.imported || 0} | Dilewati: {importErrorSummary.skipped || 0}
            </div>
          ) : null}
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2">Baris</th>
                  <th className="px-3 py-2">Kolom</th>
                  <th className="px-3 py-2">Nilai</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {importValidationErrors.map((item, index) => (
                  <tr key={`${item.row}-${item.column}-${index}`} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 text-slate-700">{item.row || "-"}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">{item.column || "-"}</td>
                    <td className="px-3 py-2 text-slate-500">{item.value === "" ? "-" : item.value ?? "-"}</td>
                    <td className="px-3 py-2 text-rose-700">{item.message || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => setImportErrorModalOpen(false)}>
              Tutup
            </button>
          </div>
        </div>
      </ModalFrame>
    </Layout>
  );
}








