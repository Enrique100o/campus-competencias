import { useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { api } from "../../api.js";
import { Notice, Field, Select, TextArea } from "./Fields.jsx";
import { labels } from "../../features/competitions/config.js";
export { Notice, Field, Select, TextArea };
export const displayDate = (value) =>
  value ? new Date(value).toLocaleString("es-CO") : "Sin fecha";
export const localDate = (value) =>
  value
    ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export const referenceId = (value) => value?.id || value;
export const stateLabel = (value) =>
  ({
    ...labels,
    pendiente: "Pendiente",
    rechazada: "Rechazada",
    cancelada: "Cancelada",
    programada: "Programada",
    reprogramada: "Reprogramada",
    finalizada: "Finalizada",
    entregado: "Entregado",
    enviada: "Enviada",
  })[value] || value;
export function PageHeading({ title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">CAMPUS · COMPETENCIAS</span>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {children}
    </div>
  );
}
export function LoadState({ resource }) {
  return (
    <>
      <Notice>{resource.error}</Notice>
      {resource.loading && (
        <p role="status">
          <LoaderCircle size={18} className="spin" /> Cargando…
        </p>
      )}
    </>
  );
}
export function Refresh({ onClick }) {
  return (
    <button className="icon-button" aria-label="Actualizar" onClick={onClick}>
      <RefreshCw size={18} />
    </button>
  );
}
export function Empty({ children = "No hay registros para mostrar." }) {
  return (
    <div className="empty-state">
      <p>{children}</p>
    </div>
  );
}
export function Submit({ busy, children = "Guardar" }) {
  return (
    <button className="button button-primary" disabled={busy}>
      {busy ? <LoaderCircle className="spin" size={17} /> : children}
    </button>
  );
}
export function DataTable({ columns, rows, rowKey = (row) => row.id }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.label}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((c) => (
                <td key={c.label}>{c.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function useAction(onSuccess) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(path, method, body) {
    setBusy(true);
    setError("");
    try {
      const value = await api(path, { method, body });
      onSuccess?.(value);
      return value;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
