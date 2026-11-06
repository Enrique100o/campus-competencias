import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { api } from "../../api.js";
import { Notice as ErrorNotice } from "../../components/ui/Fields.jsx";
import { types, emptyData } from "./config.js";
import { InstitutionDialog } from "./InstitutionDialog.jsx";
import { InstitutionDeleteDialog } from "./InstitutionDeleteDialog.jsx";
// Directorio de instituciones separado del menú y de la autenticación.
export function InstitutionsPanel({ user, onLogout }) {
  const [data, setData] = useState(emptyData);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState("");
  const admin = user.rol === "administrador";
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page,
      limit: 8,
      q: debounced,
      ...(state ? { estado: state } : {}),
    });
    api(`/instituciones?${params}`, { signal: controller.signal })
      .then((result) => {
        setData(result);
        if (page > result.pages) setPage(result.pages);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (err.status === 401) onLogout();
        else setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debounced, state, page, refresh, onLogout]);
  function saved(message) {
    setDialog(null);
    setDeleting(null);
    setToast(message);
    setRefresh((v) => v + 1);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">NUESTRA COMUNIDAD</span>
          <h1>Instituciones</h1>
          <p className="page-description">
            Las instituciones que dan vida a cada competencia.
          </p>
        </div>
        {admin && (
          <button
            className="button button-primary"
            onClick={() => setDialog({ institution: null })}
          >
            <Plus size={18} />
            Nueva institución
          </button>
        )}
      </div>
      <section className="summary-grid" aria-label="Resumen de instituciones">
        <div className="summary-card">
          <span className="summary-icon">
            <Building2 size={21} />
          </span>
          <div>
            <span>Instituciones registradas</span>
            <strong>
              {loading && !data.summary.total ? "—" : data.summary.total}
            </strong>
          </div>
          <small>Una red que sigue creciendo</small>
        </div>
        <div className="summary-card">
          <span className="summary-icon mint">
            <Check size={21} />
          </span>
          <div>
            <span>Instituciones activas</span>
            <strong>
              {loading && !data.summary.total ? "—" : data.summary.active}
            </strong>
          </div>
          <small>Disponibles para participar</small>
        </div>
        <div className="summary-card">
          <span className="summary-icon sand">
            <MapPin size={21} />
          </span>
          <div>
            <span>Ciudades/municipios representados</span>
            <strong>
              {loading && !data.summary.total ? "—" : data.summary.cities}
            </strong>
          </div>
          <small>Conectando nuevas comunidades</small>
        </div>
      </section>
      <section className="directory-card" aria-labelledby="directory-heading">
        <div className="directory-title">
          <div>
            <h2 id="directory-heading">Directorio de instituciones</h2>
            <p>Consulta y organiza tu comunidad educativa.</p>
          </div>
          <span className="records-label">
            {data.total} {data.total === 1 ? "registro" : "registros"}
          </span>
        </div>
        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Buscar instituciones"
              placeholder="Buscar por nombre, ciudad/municipio o departamento…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por estado"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="activo">Activas</option>
            <option value="inactivo">Inactivas</option>
          </select>
          <button
            className="icon-button refresh-button"
            aria-label="Actualizar instituciones"
            onClick={() => setRefresh((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
        <ErrorNotice>{error}</ErrorNotice>
        {loading ? (
          <div className="loading-area" role="status">
            <LoaderCircle size={25} className="spin" />
            <span>Cargando instituciones…</span>
          </div>
        ) : error ? (
          <div className="empty-state">
            <AlertCircle size={31} />
            <h3>No pudimos cargar el directorio</h3>
            <p>Intenta actualizar la información.</p>
            <button
              className="button button-secondary"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Volver a intentar
            </button>
          </div>
        ) : !data.items.length ? (
          <div className="empty-state">
            <span className="empty-icon">
              <Building2 size={35} strokeWidth={1.5} />
            </span>
            <h3>
              {query || state
                ? "No encontramos coincidencias"
                : admin
                  ? "Tu comunidad comienza aquí"
                  : "Todavía no hay instituciones"}
            </h3>
            <p>
              {query || state
                ? "Prueba con otro nombre o cambia los filtros."
                : admin
                  ? "Registra la primera institución para empezar a construir tu directorio."
                  : "Las instituciones aparecerán aquí cuando el administrador las registre."}
            </p>
            {admin && !query && !state && (
              <button
                className="button button-secondary"
                onClick={() => setDialog({ institution: null })}
              >
                <Plus size={16} />
                Registrar una institución
              </button>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Institución</th>
                  <th>Ciudad/municipio</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  {admin && (
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="institution-name">
                        <span
                          className={`institution-avatar type-${item.tipo}`}
                        >
                          <Building2 size={19} />
                        </span>
                        <strong>{item.nombre}</strong>
                      </div>
                    </td>
                    <td>
                      <div className="location-cell">
                        <span>{item.ciudad}</span>
                        <small>{item.departamento}</small>
                      </div>
                    </td>
                    <td>
                      <span className="type-label">{types[item.tipo]}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${item.estado === "activo" ? "badge-active" : "badge-inactive"}`}
                      >
                        <span />
                        {item.estado === "activo" ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    {admin && (
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button edit-button"
                            title="Editar institución"
                            aria-label={`Editar ${item.nombre}`}
                            onClick={() => setDialog({ institution: item })}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            className="icon-button delete-button"
                            title="Eliminar institución"
                            aria-label={`Eliminar ${item.nombre}`}
                            onClick={() => setDeleting(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            {data.total
              ? `Página ${page} de ${data.pages}`
              : "Sin registros para mostrar"}
          </span>
          <div>
            <button
              className="pagination-button"
              aria-label="Página anterior"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="pagination-button"
              aria-label="Página siguiente"
              disabled={page >= data.pages || loading}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      <div className="bottom-note">
        <ShieldCheck size={15} />
        <span>
          La información de tu comunidad, organizada en un solo lugar.
        </span>
        <span className="bottom-note-brand">campus.</span>
      </div>
      {dialog && (
        <InstitutionDialog
          institution={dialog.institution}
          onClose={() => setDialog(null)}
          onSaved={saved}
        />
      )}
      {deleting && (
        <InstitutionDeleteDialog
          institution={deleting}
          onClose={() => setDeleting(null)}
          onSaved={saved}
          onLogout={onLogout}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
