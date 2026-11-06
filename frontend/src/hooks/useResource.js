import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";

// Cancela las consultas anteriores al cambiar filtros/evento para no mostrar respuestas atrasadas.
export function useResource(path, initial = null) {
  const [data, setData] = useState(initial),
    [loading, setLoading] = useState(Boolean(path)),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!path) {
      setData(initial);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(path, { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, version]);
  return { data, loading, error, reload };
}
