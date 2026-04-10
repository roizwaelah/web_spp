export const formatCurrency = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));

export const formatDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
    new Date(value),
  );
};

export const roleLabel = (role) =>
  ({
    admin: "Admin",
    bendahara: "Bendahara",
    parent: "Orang Tua",
  })[role] || role;

export const formatPeriod = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  const monthMatch = raw.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]);
    if (year > 0 && month >= 1 && month <= 12) {
      return new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
      }).format(new Date(year, month - 1, 1));
    }
  }
  return raw;
};
