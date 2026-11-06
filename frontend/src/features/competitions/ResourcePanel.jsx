import { useEffect, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trophy,
} from "lucide-react";
import { api } from "../../api.js";
import { Notice } from "../../components/ui/Fields.jsx";
import {
  resourceNames,
  singular,
  labels,
  empty,
  catalogsEmpty,
  readableDate,
  eventStatus,
  canEdit,
  canCreate,
} from "./config.js";
import { ResourceForm } from "./ResourceForm.jsx";
import { ResourceDetail } from "./ResourceDetail.jsx";
// Listado con filtros, paginación y acciones autorizadas de cada catálogo.
export function ResourcePanel({ type, user, onLogout }) {
  const [data, setData] = useState(empty),
    [catalogs, setCatalogs] = useState(catalogsEmpty);
  const [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [filters, setFilters] = useState({}),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true),
    [catalogReady, setCatalogReady] = useState(false),
    [error, setError] = useState(""),
    [form, setForm] = useState(null),
    [detail, setDetail] = useState(null),
    [toast, setToast] = useState(""),
    [publishing, setPublishing] = useState("");
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
    setCatalogReady(false);
    const params = new URLSearchParams({
      page,
      limit: 8,
      q: debounced,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    });
    Promise.all([
      api(`/${type}?${params}`, { signal: controller.signal }),
      api("/catalogos", { signal: controller.signal }),
    ])
      .then(([list, catalogs]) => {
        setData(list);
        setCatalogs(catalogs);
        setCatalogReady(true);
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
  }, [type, debounced, filters, page, refresh, onLogout]);
  const filter = (key, value) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPage(1);
  };
  function saved(message) {
    setForm(null);
    setToast(message);
    setRefresh((v) => v + 1);
  }
  async function publish(item) {
    setPublishing(item.id);
    setError("");
    try {
      await api(`/${type}/${item.id}/estado`, {
        method: "PATCH",
        body: { estado: "inscripciones" },
      });
      saved("Inscripciones abiertas.");
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing("");
    }
  }
  const isEvent = ["torneos", "hackatones"].includes(type);
  const states =
    type === "torneos"
      ? ["borrador", "inscripciones", "en_curso", "finalizado", "cancelado"]
      : type === "hackatones"
        ? [
            "borrador",
            "inscripciones",
            "entrega",
            "evaluacion",
            "publicado",
            "cancelado",
          ]
        : ["activo", "inactivo"];
  const descriptions = {
    disciplinas:
      "Un catálogo para todos los deportes, con sus categorías y formatos.",
    torneos:
      "Organiza competencias y consulta sus fechas, cupos y reglamentos.",
    hackatones: "Innovación, equipos y requisitos en un espacio propio.",
    participantes: "Personas, instituciones y datos necesarios para competir.",
    equipos:
      "Equipos deportivos y tecnológicos con sus responsables e integrantes.",
    inscripciones:
      "Participación deportiva confirmada con requisitos y cupos verificados.",
  };
  const secondary = (item) =>
    type === "disciplinas"
      ? item.modalidades.map((m) => labels[m]).join(" · ")
      : type === "participantes"
        ? `${item.institucionNombre} · ${item.categoria}`
        : type === "equipos"
          ? `${labels[item.tipo]} · ${item.institucionNombre || item.hackatonNombre}`
          : type === "inscripciones"
            ? `${item.torneoNombre} · ${item.prueba || labels[item.modalidad]}`
            : "";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">GESTIÓN DE COMPETENCIAS</span>
          <h1>{resourceNames[type]}</h1>
          <p className="page-description">{descriptions[type]}</p>
        </div>
        {canCreate(type, user) && (
          <button
            className="button button-primary"
            disabled={!catalogReady}
            onClick={() => setForm({ item: null })}
          >
            <Plus size={18} />
            {type === "inscripciones"
              ? "Nueva inscripción"
              : `Crear ${singular[type]}`}
          </button>
        )}
      </div>
      <section className="resource-summary">
        <div>
          <Trophy size={23} />
          <span>
            {isEvent
              ? "Eventos disponibles para tu cuenta"
              : "Registros disponibles para tu cuenta"}
            <strong>{loading ? "—" : data.summary.total}</strong>
          </span>
        </div>
        <div>
          <Check size={23} />
          <span>
            {isEvent
              ? "En etapa de inscripciones"
              : type === "inscripciones"
                ? "Confirmadas"
                : "Activos"}
            <strong>{loading ? "—" : data.summary.active}</strong>
          </span>
        </div>
      </section>
      <section className="directory-card">
        <div className="directory-title">
          <div>
            <h2>
              {isEvent
                ? "Explora los eventos"
                : `Directorio de ${resourceNames[type].toLowerCase()}`}
            </h2>
            <p>
              {isEvent
                ? "Abre el detalle para conocer las condiciones de participación."
                : "Consulta la información y gestiona tus registros autorizados."}
            </p>
          </div>
          <span className="records-label">{data.total} registros</span>
        </div>
        <div className="toolbar resource-toolbar">
          {type !== "inscripciones" && (
            <label className="search-box">
              <Search size={18} />
              <input
                aria-label={`Buscar ${type}`}
                placeholder="Buscar por nombre…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          )}
          {type !== "inscripciones" && (
            <select
              aria-label="Filtrar por estado"
              value={filters.estado || ""}
              onChange={(e) => filter("estado", e.target.value)}
            >
              <option value="">Todos los estados</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {labels[s]}
                </option>
              ))}
            </select>
          )}
          {["torneos", "equipos"].includes(type) && (
            <select
              aria-label="Filtrar por tipo"
              value={filters.tipo || ""}
              onChange={(e) => filter("tipo", e.target.value)}
            >
              <option value="">Todos los tipos</option>
              {(type === "torneos"
                ? ["intercolegiados", "universitario"]
                : ["deportivo", "tecnologico"]
              ).map((t) => (
                <option key={t} value={t}>
                  {labels[t]}
                </option>
              ))}
            </select>
          )}
          {type === "torneos" && (
            <>
              <select
                aria-label="Filtrar por disciplina"
                value={filters.disciplina || ""}
                onChange={(e) => {
                  setFilters((old) => ({
                    ...old,
                    disciplina: e.target.value,
                    categoria: "",
                  }));
                  setPage(1);
                }}
              >
                <option value="">Todas las disciplinas</option>
                {catalogs.disciplinas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
              {filters.disciplina && (
                <select
                  aria-label="Filtrar por categoría deportiva"
                  value={filters.categoria || ""}
                  onChange={(e) => filter("categoria", e.target.value)}
                >
                  <option value="">Todas las categorías</option>
                  {catalogs.disciplinas
                    .find((d) => d.id === filters.disciplina)
                    ?.categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              )}
            </>
          )}
          {type === "hackatones" && (
            <select
              aria-label="Filtrar por categoría tecnológica"
              value={filters.categoria || ""}
              onChange={(e) => filter("categoria", e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {[
                ...new Set(catalogs.hackatones.flatMap((h) => h.categorias)),
              ].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          {type === "participantes" && (
            <>
              <select
                aria-label="Filtrar por institución"
                value={filters.institucion || ""}
                onChange={(e) => filter("institucion", e.target.value)}
              >
                <option value="">Todas las instituciones</option>
                {catalogs.instituciones.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre}
                  </option>
                ))}
              </select>
              <input
                className="category-filter"
                aria-label="Filtrar categoría de referencia"
                placeholder="Categoría exacta"
                value={filters.categoria || ""}
                onChange={(e) => filter("categoria", e.target.value)}
              />
            </>
          )}
          {type === "inscripciones" && (
            <select
              aria-label="Filtrar por torneo"
              value={filters.torneo || ""}
              onChange={(e) => filter("torneo", e.target.value)}
            >
              <option value="">Todos los torneos</option>
              {catalogs.torneos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          )}
          <button
            className="icon-button refresh-button"
            aria-label={`Actualizar ${type}`}
            onClick={() => setRefresh((v) => v + 1)}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
        <Notice>{error}</Notice>
        {loading ? (
          <div className="loading-area" role="status">
            <LoaderCircle className="spin" size={24} />
            Cargando {resourceNames[type].toLowerCase()}…
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>No pudimos cargar la información</h3>
            <p>Actualiza para volver a intentar.</p>
          </div>
        ) : !data.items.length ? (
          <div className="empty-state">
            <Trophy size={35} />
            <h3>No hay registros para mostrar</h3>
            <p>
              {Object.values(filters).some(Boolean) || query
                ? "Cambia la búsqueda o los filtros."
                : "Los registros disponibles aparecerán aquí."}
            </p>
          </div>
        ) : isEvent ? (
          <div className="event-grid">
            {data.items.map((item) => (
              <article className="event-card" key={item.id}>
                <div className="event-card-top">
                  <span className="event-symbol">
                    <Trophy size={23} />
                  </span>
                  <span
                    className={`badge ${item.estado === "inscripciones" ? "badge-active" : "badge-inactive"}`}
                  >
                    {eventStatus(item)}
                  </span>
                </div>
                <span className="eyebrow">
                  {type === "torneos"
                    ? `${labels[item.tipo]} · ${item.disciplinaNombre}`
                    : labels[item.modalidad]}
                </span>
                <h3>{item.nombre}</h3>
                <p>
                  {item.descripcion ||
                    "Consulta los requisitos de este evento."}
                </p>
                <div className="event-meta">
                  <span>
                    {item.ciudad}, {item.departamento}
                  </span>
                  <span>Inicio: {readableDate(item.inicio)}</span>
                  <span>
                    {type === "torneos"
                      ? `${item.inscritos} / ${item.cupos} inscripciones`
                      : `${item.cupos} equipos · ${item.integrantesMin}–${item.integrantesMax} integrantes`}
                  </span>
                </div>
                <div className="event-actions">
                  <button
                    className="button button-secondary"
                    aria-label={`Ver ${item.nombre}`}
                    onClick={() => setDetail(item)}
                  >
                    <Eye size={15} />
                    Ver requisitos
                  </button>
                  {canEdit(type, item, user) && (
                    <>
                      <button
                        className="icon-button edit-button"
                        aria-label={`Editar ${item.nombre}`}
                        onClick={() => setForm({ item })}
                      >
                        <Pencil size={16} />
                      </button>
                      {item.estado === "borrador" && (
                        <button
                          className="button button-primary"
                          disabled={Boolean(publishing)}
                          onClick={() => publish(item)}
                        >
                          {publishing === item.id ? (
                            <LoaderCircle size={15} className="spin" />
                          ) : (
                            "Abrir inscripciones"
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{type === "inscripciones" ? "Competidor" : "Nombre"}</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.nombre || item.competidorNombre}</strong>
                    </td>
                    <td>
                      <span className="resource-reference">
                        {secondary(item)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${["activo", "confirmada"].includes(item.estado) ? "badge-active" : "badge-inactive"}`}
                      >
                        {labels[item.estado]}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          aria-label={`Ver ${item.nombre || item.competidorNombre}`}
                          onClick={() => setDetail(item)}
                        >
                          <Eye size={17} />
                        </button>
                        {type !== "inscripciones" &&
                          canEdit(type, item, user) && (
                            <button
                              className="icon-button edit-button"
                              aria-label={`Editar ${item.nombre}`}
                              onClick={() => setForm({ item })}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            {data.total ? `Página ${page} de ${data.pages}` : "Sin registros"}
          </span>
          <div>
            <button
              className="pagination-button"
              aria-label="Página anterior"
              disabled={loading || page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              className="pagination-button"
              aria-label="Página siguiente"
              disabled={loading || page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
      {form && (
        <ResourceForm
          type={type}
          item={form.item}
          catalogs={catalogs}
          user={user}
          onClose={() => setForm(null)}
          onSaved={saved}
          onLogout={onLogout}
        />
      )}
      {detail && (
        <ResourceDetail
          type={type}
          item={detail}
          catalogs={catalogs}
          onClose={() => setDetail(null)}
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
