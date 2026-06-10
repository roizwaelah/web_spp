import { useEffect, useState } from "react";
import { fetchRoute } from "../api";

const emptyMeta = {
  classes: [],
  students: [],
  years: [],
  finance_posts: [],
};

let cachedToken = null;
let cachedMeta = null;
let pendingRequest = null;

const normalizeMeta = (data) => ({
  classes: Array.isArray(data?.classes) ? data.classes : [],
  students: Array.isArray(data?.students) ? data.students : [],
  years: Array.isArray(data?.years) ? data.years : [],
  finance_posts: Array.isArray(data?.finance_posts) ? data.finance_posts : [],
});

const currentToken = () => localStorage.getItem("token") || "";

export const invalidateAdminMeta = () => {
  cachedToken = null;
  cachedMeta = null;
  pendingRequest = null;
};

export const loadAdminMeta = (force = false) => {
  const token = currentToken();

  if (!force && cachedToken === token && cachedMeta) {
    return Promise.resolve(cachedMeta);
  }

  if (!force && cachedToken === token && pendingRequest) {
    return pendingRequest;
  }

  cachedToken = token;
  pendingRequest = fetchRoute("admin/meta").then((response) => {
    cachedMeta = normalizeMeta(response.data);
    return cachedMeta;
  }).finally(() => {
    pendingRequest = null;
  });

  return pendingRequest;
};

export function useAdminMeta() {
  const [meta, setMeta] = useState(() => {
    if (cachedToken === currentToken() && cachedMeta) return cachedMeta;
    return emptyMeta;
  });
  const [loading, setLoading] = useState(() => !(cachedToken === currentToken() && cachedMeta));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    loadAdminMeta()
      .then((data) => {
        if (!active) return;
        setMeta(data);
        setError(null);
      })
      .catch((metaError) => {
        if (active) setError(metaError);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadAdminMeta(true);
      setMeta(data);
      setError(null);
      return data;
    } catch (metaError) {
      setError(metaError);
      throw metaError;
    } finally {
      setLoading(false);
    }
  };

  return { meta, loading, error, refresh };
}
