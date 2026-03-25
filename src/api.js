import axios from "axios";

export const apiBase =
  import.meta.env.VITE_API_URL || "/index.php?route=";

export const api = axios.create({
  baseURL: apiBase,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const fetchRoute = (route, options = {}) =>
  api({ url: route, ...options });

const filenameFromDisposition = (disposition, fallbackName) => {
  if (!disposition) return fallbackName;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const plainMatch = disposition.match(/filename="?([^"]+)"?/i);
  return plainMatch?.[1] || fallbackName;
};

export const openRouteFile = async (route, params = {}) => {
  const response = await fetchRoute(route, {
    method: "GET",
    params,
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: response.headers?.["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
};

export const downloadRouteFile = async (route, params = {}, fallbackName = "download") => {
  const response = await fetchRoute(route, {
    method: "GET",
    params,
    responseType: "blob",
  });

  const blob = new Blob([response.data], {
    type: response.headers?.["content-type"] || "application/octet-stream",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(
    response.headers?.["content-disposition"],
    fallbackName,
  );
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
