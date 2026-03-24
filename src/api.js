import axios from "axios";

export const apiBase =
  import.meta.env.VITE_API_URL || "/api/index.php?route=";
export const apiRoot = apiBase.includes("index.php?route=")
  ? apiBase.split("index.php?route=")[0]
  : apiBase;

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

export const fileUrl = (route, params = {}) => {
  const search = new URLSearchParams({ route, ...params }).toString();
  return `${apiRoot}index.php?${search}`;
};
