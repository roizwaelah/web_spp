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
